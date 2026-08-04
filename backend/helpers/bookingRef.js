// backend/helpers/bookingRef.js
//
// Public-facing booking references.
//
// Used everywhere a booking is exposed outside the admin app: URLs, SMS, and
// the payment return page. Mongo ObjectIds are unsuitable for that — they embed
// a creation timestamp and are sequential enough to enumerate, so publishing
// one lets a stranger walk the booking list.

const crypto = require('crypto');

// Excludes I, O, 0, 1 — these are the characters guests misread when reading a
// reference over the phone to a staff member, which is a real workflow here.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REF_LENGTH = 6;
const PREFIX = 'ZM';

/**
 * Generate a candidate reference, e.g. "ZM-7K2QMX".
 *
 * Uses crypto.randomInt rather than Math.random: these appear in URLs that
 * grant access to booking status, so they should not be predictable from
 * another reference issued moments earlier.
 *
 * ~1.07 billion combinations. Collisions are unlikely but not impossible, so
 * always create through generateUniqueBookingRef.
 */
function generateBookingRef() {
  let out = '';
  for (let i = 0; i < REF_LENGTH; i += 1) {
    out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return `${PREFIX}-${out}`;
}

/**
 * Generate a reference guaranteed unused, checked against the collection.
 *
 * @param {import('mongoose').Model} BookingModel
 * @param {number} maxAttempts
 * @returns {Promise<string>}
 */
async function generateUniqueBookingRef(BookingModel, maxAttempts = 12) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const ref = generateBookingRef();
    // eslint-disable-next-line no-await-in-loop
    const clash = await BookingModel.exists({ booking_ref: ref });
    if (!clash) return ref;
  }
  throw new Error(
    `Could not generate a unique booking_ref after ${maxAttempts} attempts. ` +
    'Reference space may be exhausted — increase REF_LENGTH.'
  );
}

/** True if the string looks like one of our references. */
function isValidBookingRef(ref) {
  return typeof ref === 'string'
    && new RegExp(`^${PREFIX}-[${ALPHABET}]{${REF_LENGTH}}$`).test(ref);
}

module.exports = {
  generateBookingRef,
  generateUniqueBookingRef,
  isValidBookingRef,
  PREFIX,
};
