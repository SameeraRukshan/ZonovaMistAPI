// backend/controllers/publicBookingController.js
//
// Unauthenticated, guest-facing endpoints.
//
// Everything here is reachable by anyone on the internet, so two rules apply
// throughout and are worth stating once rather than repeating at every handler:
//
//   1. NEVER expose internal identifiers. Responses carry `booking_ref`, never
//      `_id` or `clientId`. A Mongo ObjectId leaks creation time and is
//      enumerable enough to walk the booking list.
//   2. NEVER trust a number from the request. Prices are recomputed server-side
//      from stored room rates on every path.

const { validateStay, toCalendarString } = require('../helpers/dates');
const { getAvailableRooms } = require('../services/availabilityService');
const { quoteRoom } = require('../services/pricingService');
const {
  createHold, BookingConflictError, RoomNotFoundError,
} = require('../services/bookingHoldService');
const Booking = require('../models/booking');
const { isValidBookingRef } = require('../helpers/bookingRef');

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, status, code, message, field) => res.status(status).json({
  success: false,
  error: field ? { code, message, field } : { code, message },
});

/**
 * GET /api/v1/public/:tenantSlug/property
 *
 * Public description of the property. Read-only and cacheable.
 */
const getProperty = async (req, res) => {
  try {
    const s = req.tenantSettings;
    return ok(res, {
      name: s?.guestHouseName || req.tenant.name,
      address: s?.guestHouseAddress || null,
      location: s?.guestHouseLocation || null,
      telephone: s?.telephone || null,
      currency: s?.currency || 'LKR',
      booking_enabled: s?.publicBookingEnabled === true,
      hold_duration_minutes: s?.holdDurationMinutes || 20,
      deposit_percentage: s?.depositPercentage ?? 100,
    });
  } catch (err) {
    console.error('[PUBLIC] property failed:', err.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Could not load property');
  }
};

/**
 * GET /api/v1/public/:tenantSlug/availability?checkin=&checkout=&adults=&children=
 *
 * Rooms bookable for the range, each with a server-computed price.
 */
const getAvailability = async (req, res) => {
  try {
    const stay = validateStay(req.query.checkin, req.query.checkout);
    if (!stay.ok) return fail(res, 400, 'INVALID_DATES', stay.error, stay.field);

    const adults = Number.parseInt(req.query.adults, 10) || 1;
    const children = Number.parseInt(req.query.children, 10) || 0;

    if (adults < 1 || adults > 20 || children < 0 || children > 20) {
      return fail(res, 400, 'INVALID_GUESTS', 'Guest counts are out of range', 'adults');
    }

    const rooms = await getAvailableRooms(
      req.tenant._id, stay.checkin, stay.checkout, { adults, children },
    );

    const settings = req.tenantSettings;
    const quotes = rooms.map((room) => quoteRoom(room, stay.checkin, stay.checkout, {
      depositPercentage: settings?.depositPercentage ?? 100,
      currency: settings?.currency || 'LKR',
    })).filter((q) => q.total_cents > 0);   // hide rooms with no rate configured

    return ok(res, {
      checkin: toCalendarString(stay.checkin),
      checkout: toCalendarString(stay.checkout),
      nights: stay.nights,
      adults,
      children,
      currency: settings?.currency || 'LKR',
      available_count: quotes.length,
      rooms: quotes,
    });
  } catch (err) {
    console.error('[PUBLIC] availability failed:', err.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Could not check availability');
  }
};

/**
 * POST /api/v1/public/:tenantSlug/bookings
 *
 * Creates a provisional HOLD. Does NOT take payment — that is M4.
 * Requires an Idempotency-Key header (see middleware/idempotency.js).
 */
const createBooking = async (req, res) => {
  try {
    const b = req.body || {};

    const stay = validateStay(b.checkin, b.checkout);
    if (!stay.ok) return fail(res, 400, 'INVALID_DATES', stay.error, stay.field);

    if (!b.room_number) {
      return fail(res, 400, 'VALIDATION_ERROR', 'room_number is required', 'room_number');
    }

    const guest = validateGuest(b);
    if (guest.error) return fail(res, 400, 'VALIDATION_ERROR', guest.error, guest.field);

    // Explicit consent, captured with a timestamp. Consumer-protection evidence
    // if a booking is ever disputed.
    if (b.terms_accepted !== true) {
      return fail(res, 400, 'TERMS_NOT_ACCEPTED', 'The booking terms must be accepted', 'terms_accepted');
    }

    const booking = await createHold({
      clientId: req.tenant._id,
      roomNumber: b.room_number,
      stay,
      guest: guest.value,
      notes: typeof b.special_notes === 'string' ? b.special_notes.slice(0, 1000) : '',
      settings: req.tenantSettings,
      idempotencyKey: req.header('Idempotency-Key') || null,
    });

    return ok(res, serialiseBooking(booking), 201);
  } catch (err) {
    if (err instanceof RoomNotFoundError) {
      return fail(res, 404, 'ROOM_NOT_FOUND', 'That room does not exist', 'room_number');
    }
    if (err instanceof BookingConflictError) {
      // 409, not 400: the request was valid, the world changed underneath it.
      return fail(res, 409, 'ROOM_UNAVAILABLE', err.message, 'room_number');
    }
    console.error('[PUBLIC] booking creation failed:', err);
    return fail(res, 500, 'INTERNAL_ERROR', 'Could not create booking');
  }
};

/**
 * GET /api/v1/public/bookings/:ref/status
 *
 * Poll target for the payment return page. Not tenant-scoped in the URL: the
 * reference itself is the capability, and it is unguessable by construction
 * (helpers/bookingRef.js).
 */
const getBookingStatus = async (req, res) => {
  try {
    const ref = String(req.params.ref || '').toUpperCase();

    // Reject malformed references before touching the database — cheap
    // protection against enumeration attempts on a public endpoint.
    if (!isValidBookingRef(ref)) {
      return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }

    const booking = await Booking.findOne({ booking_ref: ref, deleted: { $ne: true } })
      .select(
        'booking_ref booking_status payment_status checkin_date checkout_date '
        + 'booked_room_no total_amount_cents deposit_amount_cents paid_amount_cents '
        + 'currency hold_expires_at guest_name',
      )
      .lean();

    if (!booking) return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found');

    return ok(res, {
      booking_ref: booking.booking_ref,
      booking_status: booking.booking_status,
      payment_status: booking.payment_status,
      // First name only: this endpoint needs no auth, so it should confirm the
      // guest recognises their own booking without disclosing a full identity.
      guest_first_name: String(booking.guest_name || '').split(' ')[0] || null,
      room_number: booking.booked_room_no,
      checkin: toCalendarString(booking.checkin_date),
      checkout: toCalendarString(booking.checkout_date),
      total_amount_cents: booking.total_amount_cents,
      deposit_amount_cents: booking.deposit_amount_cents,
      paid_amount_cents: booking.paid_amount_cents,
      currency: booking.currency,
      hold_expires_at: booking.hold_expires_at,
      is_hold_expired: booking.booking_status === 'HOLD'
        && booking.hold_expires_at
        && booking.hold_expires_at.getTime() < Date.now(),
    });
  } catch (err) {
    console.error('[PUBLIC] status lookup failed:', err.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Could not load booking');
  }
};

// --- helpers --------------------------------------------------------------

function validateGuest(b) {
  const g = b.guest || {};

  const name = String(g.name || '').trim();
  if (name.length < 2 || name.length > 200) {
    return { error: 'Guest name is required', field: 'guest.name' };
  }

  // Required because PayHere's checkout mandates an email address. The original
  // schema had nowhere to store one, since staff bookings only captured a phone.
  const email = String(g.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return { error: 'A valid email address is required', field: 'guest.email' };
  }

  const phone = String(g.phone || '').trim();
  if (phone.length < 7 || phone.length > 20) {
    return { error: 'A valid phone number is required', field: 'guest.phone' };
  }

  const adults = Number.parseInt(b.adults, 10) || 1;
  const children = Number.parseInt(b.children, 10) || 0;
  if (adults < 1 || adults > 20 || children < 0 || children > 20) {
    return { error: 'Guest counts are out of range', field: 'adults' };
  }

  return {
    value: {
      name,
      email,
      phone,
      nic: g.nic ? String(g.nic).trim().slice(0, 20) : null,
      address: g.address ? String(g.address).trim().slice(0, 500) : '',
      city: g.city ? String(g.city).trim().slice(0, 100) : '',
      country: g.country ? String(g.country).trim().slice(0, 100) : 'Sri Lanka',
      adults,
      children,
    },
  };
}

/** Public projection of a booking. Internal ids deliberately omitted. */
function serialiseBooking(booking) {
  return {
    booking_ref: booking.booking_ref,
    booking_status: booking.booking_status,
    payment_status: booking.payment_status,
    room_number: booking.booked_room_no,
    checkin: toCalendarString(booking.checkin_date),
    checkout: toCalendarString(booking.checkout_date),
    adults: booking.adult_count,
    children: booking.child_count,
    total_amount_cents: booking.total_amount_cents,
    deposit_amount_cents: booking.deposit_amount_cents,
    currency: booking.currency,
    hold_expires_at: booking.hold_expires_at,
  };
}

module.exports = { getProperty, getAvailability, createBooking, getBookingStatus };
