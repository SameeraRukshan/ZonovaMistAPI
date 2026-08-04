// backend/services/pricingService.js
//
// Server-authoritative pricing.
//
// The single rule this file exists to enforce: THE CLIENT NEVER SENDS A PRICE.
// Every amount is recomputed here from the room's stored rate and the requested
// dates, both when quoting availability and again when the booking is created.
// A browser that posts {"total": 1} must be unable to influence what PayHere is
// asked to charge.

const Room = require('../models/room');
const { toCents, formatForPayHere } = require('../helpers/money');
const { nightsBetween } = require('../helpers/dates');

const DEFAULT_CURRENCY = 'LKR';

/**
 * Price one room for a stay.
 *
 * @param {object} room a Room document/lean object
 * @param {Date} checkin
 * @param {Date} checkout
 * @param {object} [opts]
 * @param {number} [opts.depositPercentage] 1–100; 100 = pay in full
 * @param {string} [opts.currency]
 */
function quoteRoom(room, checkin, checkout, opts = {}) {
  const nights = nightsBetween(checkin, checkout);
  const currency = opts.currency || DEFAULT_CURRENCY;

  const rateCents = toCents(room.pricePerNight || 0);
  const totalCents = rateCents * nights;

  // Round the deposit UP to the nearest cent so the property is never short by
  // a rounding artefact; the balance absorbs the difference.
  const pct = clampPercentage(opts.depositPercentage);
  const depositCents = pct >= 100
    ? totalCents
    : Math.ceil((totalCents * pct) / 100);

  return {
    room_number: String(room.roomNumber),
    room_type: room.type || null,
    bed_count: room.bedCount ?? null,
    max_occupancy: room.maxOccupancy ?? null,
    amenities: room.amenities || [],
    nights,
    currency,
    rate_per_night_cents: rateCents,
    rate_per_night_formatted: formatForPayHere(rateCents),
    total_cents: totalCents,
    total_formatted: formatForPayHere(totalCents),
    deposit_cents: depositCents,
    deposit_formatted: formatForPayHere(depositCents),
    balance_cents: totalCents - depositCents,
  };
}

/**
 * Re-price a room by number, straight from the database.
 *
 * Used at booking creation. Deliberately re-reads the Room rather than trusting
 * anything echoed back by the client from an earlier availability response —
 * a quote the guest was shown five minutes ago is not authority for what to
 * charge now.
 *
 * @returns {Promise<object|null>} null when the room does not exist
 */
async function quoteRoomByNumber(clientId, roomNumber, checkin, checkout, opts = {}) {
  const room = await Room.findOne({ clientId, roomNumber: String(roomNumber) }).lean();
  if (!room) return null;
  return quoteRoom(room, checkin, checkout, opts);
}

function clampPercentage(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(100, Math.max(1, n));
}

module.exports = { quoteRoom, quoteRoomByNumber, DEFAULT_CURRENCY };
