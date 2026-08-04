// backend/services/bookingHoldService.js
//
// Creates the provisional HOLD that a guest then pays for.
//
// The hard part is not the insert — it is guaranteeing that two guests
// checking out simultaneously cannot both hold the same room. A plain
// read-then-write is not enough, and neither is wrapping that read-then-write
// in a transaction: MongoDB transactions provide snapshot isolation, under
// which both transactions read "no conflicting booking", both insert, and both
// commit. That is textbook write skew.
//
// The fix is to give the competing transactions a document to fight over. Each
// booking attempt $incs `bookingLockVersion` on the Room it is booking, so two
// concurrent attempts on the SAME room produce a WriteConflict; MongoDB aborts
// one, and the retry re-reads and correctly sees the winner's booking.
// Attempts on DIFFERENT rooms touch different documents and stay parallel.

const mongoose = require('mongoose');
const Booking = require('../models/booking');
const Room = require('../models/room');
const { isRoomAvailable } = require('./availabilityService');
const { quoteRoom } = require('./pricingService');
const { generateUniqueBookingRef } = require('../helpers/bookingRef');

// Write conflicts are EXPECTED here, not exceptional — they are the mechanism
// by which concurrent attempts on one room get serialised. Under contention the
// loser should retry, re-read, and then report the accurate "room is taken"
// rather than giving up with a vague "try again". Five attempts with backoff
// comfortably covers realistic contention (a handful of simultaneous guests)
// and still terminates quickly in the pathological case.
const MAX_TRANSACTION_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 15;

/** Exponential backoff with jitter, so retriers do not resynchronise and collide again. */
function retryDelay(attempt) {
  const ceiling = RETRY_BASE_DELAY_MS * (2 ** attempt);
  return Math.floor(Math.random() * ceiling);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Remembered after the first attempt so a standalone mongod does not pay the
// cost of failing a transaction on every single booking.
let transactionsSupported = null;

class BookingConflictError extends Error {
  constructor(message) { super(message); this.name = 'BookingConflictError'; this.code = 'ROOM_UNAVAILABLE'; }
}
class RoomNotFoundError extends Error {
  constructor(message) { super(message); this.name = 'RoomNotFoundError'; this.code = 'ROOM_NOT_FOUND'; }
}

function isTransactionUnsupportedError(err) {
  const m = String(err && err.message);
  return m.includes('Transaction numbers are only allowed on a replica set')
    || m.includes('Transactions are not supported')
    || m.includes('This MongoDB deployment does not support retryable writes');
}

function isTransientTransactionError(err) {
  return !!(err && err.errorLabels && err.errorLabels.includes('TransientTransactionError'));
}

/**
 * Build the booking document. Every monetary and status field is derived here
 * on the server; nothing is taken from the request except guest details and the
 * requested room and dates.
 */
function buildBookingDoc({ clientId, room, quote, stay, guest, notes, holdMinutes, idempotencyKey }) {
  const now = new Date();
  return {
    clientId,
    guest_name: guest.name,
    guest_nic: guest.nic || null,
    guest_email: guest.email,
    phone_no: guest.phone,
    guest_address: guest.address || '',
    guest_city: guest.city || '',
    guest_country: guest.country || 'Sri Lanka',

    booked_room_no: String(room.roomNumber),
    checkin_date: stay.checkin,
    checkout_date: stay.checkout,
    adult_count: guest.adults,
    child_count: guest.children || 0,
    special_notes: notes || '',

    // Legacy float columns, kept in step for the admin app.
    total_price: quote.total_cents / 100,
    advance_amount: 0,
    food: 0,

    // Authoritative amounts.
    total_amount_cents: quote.total_cents,
    deposit_amount_cents: quote.deposit_cents,
    paid_amount_cents: 0,
    refunded_amount_cents: 0,
    currency: quote.currency,

    status: 'pending',            // legacy vocabulary
    booking_status: 'HOLD',
    payment_status: 'UNPAID',
    source: 'WEB',

    hold_expires_at: new Date(now.getTime() + holdMinutes * 60 * 1000),
    terms_accepted_at: now,
    idempotency_key: idempotencyKey || null,
    has_gateway_payment: false,
    deleted: false,
  };
}

/**
 * Create a provisional hold.
 *
 * @throws {RoomNotFoundError|BookingConflictError}
 * @returns {Promise<object>} the saved Booking document
 */
async function createHold({ clientId, roomNumber, stay, guest, notes, settings, idempotencyKey }) {
  const holdMinutes = settings?.holdDurationMinutes || 20;
  const depositPercentage = settings?.depositPercentage ?? 100;
  const currency = settings?.currency || 'LKR';

  const room = await Room.findOne({ clientId, roomNumber: String(roomNumber) }).lean();
  if (!room) throw new RoomNotFoundError(`Room ${roomNumber} does not exist`);
  if (room.status === 'maintenance') {
    throw new BookingConflictError(`Room ${roomNumber} is not available for booking`);
  }

  // Priced here, on the server, from the stored rate. Never from the request.
  const quote = quoteRoom(room, stay.checkin, stay.checkout, { depositPercentage, currency });

  if (quote.total_cents <= 0) {
    throw new BookingConflictError(`Room ${roomNumber} has no rate configured`);
  }

  const bookingRef = await generateUniqueBookingRef(Booking);
  const doc = buildBookingDoc({
    clientId, room, quote, stay, guest, notes, holdMinutes, idempotencyKey,
  });
  doc.booking_ref = bookingRef;

  if (transactionsSupported === false) {
    return createHoldWithoutTransaction({ clientId, roomNumber, stay, doc });
  }

  try {
    return await createHoldInTransaction({ clientId, room, roomNumber, stay, doc });
  } catch (err) {
    if (isTransactionUnsupportedError(err)) {
      transactionsSupported = false;
      console.warn(
        '\n⚠️  MongoDB transactions are unavailable on this deployment.\n' +
        '   Falling back to a NON-ATOMIC availability check. Two simultaneous\n' +
        '   bookings for the same room could both succeed.\n' +
        '   Acceptable for local development against a standalone mongod.\n' +
        '   NOT acceptable in production — Atlas is a replica set and supports\n' +
        '   transactions, so this warning must never appear there.\n'
      );
      return createHoldWithoutTransaction({ clientId, roomNumber, stay, doc });
    }
    throw err;
  }
}

async function createHoldInTransaction({ clientId, room, roomNumber, stay, doc }) {
  let lastErr;

  for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });

      // Serialization point — see the file header. This must happen BEFORE the
      // availability read, so concurrent attempts on this room conflict rather
      // than both reading a stale "available".
      await Room.updateOne({ _id: room._id }, { $inc: { bookingLockVersion: 1 } }, { session });

      const free = await isRoomAvailable(clientId, roomNumber, stay.checkin, stay.checkout, { session });
      if (!free) {
        await session.abortTransaction();
        throw new BookingConflictError(
          `Room ${roomNumber} is no longer available for those dates`
        );
      }

      const [saved] = await Booking.create([doc], { session });
      await session.commitTransaction();
      return saved;
    } catch (err) {
      try { await session.abortTransaction(); } catch { /* already aborted */ }

      if (err instanceof BookingConflictError) throw err;

      // A WriteConflict means another booking for this room won the race.
      // Retrying re-reads and will normally surface a clean conflict error.
      if (isTransientTransactionError(err)) {
        lastErr = err;
        session.endSession();
        // eslint-disable-next-line no-await-in-loop
        await sleep(retryDelay(attempt));
        continue;
      }
      throw err;
    } finally {
      // endSession is idempotent; the retry path above may already have called it.
      session.endSession();
    }
  }

  // Retries exhausted. The outcome is still SAFE — no booking was created — but
  // we could not determine whether the room is genuinely taken or merely
  // contended, so the message stays deliberately vague. Logged at warn rather
  // than error: nothing is broken, the system is just busy.
  console.warn(
    `[BOOKING] room ${roomNumber}: transaction retries exhausted under contention `
    + `(${lastErr && lastErr.message})`
  );
  throw new BookingConflictError('Could not secure that room just now, please try again');
}

/**
 * Development-only path. Still performs the overlap check — it is simply not
 * atomic, so a genuinely simultaneous pair of requests could both pass.
 */
async function createHoldWithoutTransaction({ clientId, roomNumber, stay, doc }) {
  const free = await isRoomAvailable(clientId, roomNumber, stay.checkin, stay.checkout);
  if (!free) {
    throw new BookingConflictError(`Room ${roomNumber} is no longer available for those dates`);
  }
  return Booking.create(doc);
}

/** Test hook — forget the cached transaction-support probe. */
function _resetTransactionSupport() { transactionsSupported = null; }

module.exports = {
  createHold,
  BookingConflictError,
  RoomNotFoundError,
  _resetTransactionSupport,
};
