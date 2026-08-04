// backend/helpers/dates.js
//
// Calendar-date handling for bookings.
//
// A hotel booking is about CALENDAR DATES, not instants. "1 September" means
// the same night regardless of the guest's timezone, so dates are normalised to
// UTC midnight and compared as whole days. Storing a local-time instant instead
// is how you end up with a booking that silently shifts a night when the server
// moves region.
//
// "Today" is evaluated in the property's timezone (Asia/Colombo by default), not
// the server's — otherwise a guest booking at 9pm Colombo on a UTC-hosted server
// would be told their own date is in the past.

const { DateTime } = require('luxon');

const PROPERTY_TZ = process.env.TIMEZONE || 'Asia/Colombo';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MAX_NIGHTS = 30;
const MAX_DAYS_AHEAD = 365;

/**
 * Parse a strict YYYY-MM-DD string into a Date at UTC midnight.
 *
 * Deliberately strict: `new Date('2026-9-1')` and `new Date('01/09/2026')` both
 * "work" in JS but mean different things in different runtimes, so anything not
 * matching the ISO calendar-date form is rejected outright.
 *
 * @param {string} input
 * @returns {Date|null} null when unparseable
 */
function parseCalendarDate(input) {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) return null;

  const dt = DateTime.fromISO(input.trim(), { zone: 'utc' }).startOf('day');
  if (!dt.isValid) return null;
  return dt.toJSDate();
}

/** Today's calendar date in the property's timezone, as UTC midnight. */
function todayInPropertyTz() {
  const local = DateTime.now().setZone(PROPERTY_TZ).startOf('day');
  return DateTime.utc(local.year, local.month, local.day).toJSDate();
}

/** Whole nights between two UTC-midnight dates. */
function nightsBetween(checkin, checkout) {
  return Math.round((checkout.getTime() - checkin.getTime()) / MS_PER_DAY);
}

/** Format a Date back to YYYY-MM-DD (UTC). */
function toCalendarString(date) {
  return DateTime.fromJSDate(date, { zone: 'utc' }).toFormat('yyyy-MM-dd');
}

/**
 * Validate a requested stay.
 *
 * @returns {{ok: true, checkin: Date, checkout: Date, nights: number}
 *          |{ok: false, error: string, field: string}}
 */
function validateStay(checkinInput, checkoutInput) {
  const checkin = parseCalendarDate(checkinInput);
  if (!checkin) {
    return { ok: false, field: 'checkin', error: 'checkin must be a date in YYYY-MM-DD format' };
  }

  const checkout = parseCalendarDate(checkoutInput);
  if (!checkout) {
    return { ok: false, field: 'checkout', error: 'checkout must be a date in YYYY-MM-DD format' };
  }

  const nights = nightsBetween(checkin, checkout);
  if (nights < 1) {
    return { ok: false, field: 'checkout', error: 'checkout must be at least one night after checkin' };
  }
  if (nights > MAX_NIGHTS) {
    return { ok: false, field: 'checkout', error: `Stays longer than ${MAX_NIGHTS} nights must be arranged directly` };
  }

  const today = todayInPropertyTz();
  if (checkin.getTime() < today.getTime()) {
    return { ok: false, field: 'checkin', error: 'checkin cannot be in the past' };
  }

  const maxDate = new Date(today.getTime() + MAX_DAYS_AHEAD * MS_PER_DAY);
  if (checkin.getTime() > maxDate.getTime()) {
    return { ok: false, field: 'checkin', error: `Bookings can be made at most ${MAX_DAYS_AHEAD} days ahead` };
  }

  return { ok: true, checkin, checkout, nights };
}

module.exports = {
  parseCalendarDate,
  todayInPropertyTz,
  nightsBetween,
  toCalendarString,
  validateStay,
  PROPERTY_TZ,
  MAX_NIGHTS,
  MAX_DAYS_AHEAD,
};
