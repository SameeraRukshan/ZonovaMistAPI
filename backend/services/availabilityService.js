// backend/services/availabilityService.js
//
// Room availability — the check the system currently does not perform at all.
// Nothing today prevents two bookings on the same room for overlapping dates.

const Booking = require('../models/booking');
const Room = require('../models/room');

// A room is unavailable if a live booking overlaps the requested range.
//
// "Live" excludes CANCELLED and EXPIRED (released) and soft-deleted rows, but
// INCLUDES HOLD — an unpaid provisional booking must block the room, otherwise
// two guests can be taken to checkout for the same room simultaneously and one
// of them will pay for a room that is already gone.
const BLOCKING_STATUSES = ['HOLD', 'CONFIRMED', 'CHECKED_IN'];

/**
 * Overlap predicate.
 *
 *   existing.checkin  <  requested.checkout
 *   existing.checkout >  requested.checkin
 *
 * Strict inequalities are what make same-day turnover work: a booking ending on
 * the 3rd and one starting on the 3rd do NOT overlap, because the first guest
 * checks out in the morning and the second checks in that afternoon. Using >=
 * or <= here would wrongly block roughly half of all real bookings — the single
 * easiest thing to get wrong in this file.
 */
function overlapQuery(clientId, checkin, checkout) {
  return {
    clientId,
    deleted: { $ne: true },
    booking_status: { $in: BLOCKING_STATUSES },
    checkin_date: { $lt: checkout },
    checkout_date: { $gt: checkin },
  };
}

/**
 * Room numbers already taken for the range.
 *
 * @param {ObjectId} clientId
 * @param {Date} checkin  UTC midnight
 * @param {Date} checkout UTC midnight
 * @param {object} [opts]
 * @param {import('mongoose').ClientSession} [opts.session]
 * @param {ObjectId} [opts.excludeBookingId] ignore this booking (for edits)
 * @returns {Promise<Set<string>>}
 */
async function getUnavailableRoomNumbers(clientId, checkin, checkout, opts = {}) {
  const query = overlapQuery(clientId, checkin, checkout);
  if (opts.excludeBookingId) query._id = { $ne: opts.excludeBookingId };

  let q = Booking.find(query).select('booked_room_no').lean();
  if (opts.session) q = q.session(opts.session);

  const taken = await q;
  return new Set(taken.map((b) => String(b.booked_room_no)));
}

/**
 * Is one specific room free? Used inside the booking transaction.
 */
async function isRoomAvailable(clientId, roomNumber, checkin, checkout, opts = {}) {
  const query = { ...overlapQuery(clientId, checkin, checkout), booked_room_no: String(roomNumber) };
  if (opts.excludeBookingId) query._id = { $ne: opts.excludeBookingId };

  let q = Booking.findOne(query).select('_id').lean();
  if (opts.session) q = q.session(opts.session);

  return !(await q);
}

/**
 * Bookable rooms for a range, filtered by occupancy.
 *
 * Rooms under maintenance are excluded. Rooms marked 'occupied' are NOT — that
 * flag reflects the room's state right now, not across a future date range, and
 * treating it as a range-wide block would hide rooms that are free next month.
 * The booking overlap query is the authority on future availability.
 */
async function getAvailableRooms(clientId, checkin, checkout, { adults = 1, children = 0 } = {}) {
  const guests = Number(adults) + Number(children);

  const rooms = await Room.find({
    clientId,
    status: { $ne: 'maintenance' },
  }).lean();

  const unavailable = await getUnavailableRoomNumbers(clientId, checkin, checkout);

  return rooms
    .filter((r) => !unavailable.has(String(r.roomNumber)))
    .filter((r) => !r.maxOccupancy || r.maxOccupancy >= guests)
    .sort((a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true }));
}

module.exports = {
  getAvailableRooms,
  getUnavailableRoomNumbers,
  isRoomAvailable,
  overlapQuery,
  BLOCKING_STATUSES,
};
