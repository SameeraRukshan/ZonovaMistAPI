// tests/dates.test.js
//
// Off-by-one errors in date handling are the classic booking-system bug: they
// either block half of all legitimate bookings (same-day turnover treated as a
// clash) or silently shift a night when the server changes region.

const {
  parseCalendarDate, nightsBetween, toCalendarString, validateStay,
  todayInPropertyTz, MAX_NIGHTS,
} = require('../helpers/dates');

const iso = (d) => toCalendarString(d);
const plusDays = (date, n) => new Date(date.getTime() + n * 86400000);

describe('parseCalendarDate', () => {
  test('parses a valid calendar date to UTC midnight', () => {
    const d = parseCalendarDate('2026-09-01');
    expect(d.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  test.each([
    ['2026-9-1', 'non-padded'],
    ['01/09/2026', 'slash format'],
    ['2026-09-01T10:00:00Z', 'includes a time'],
    ['September 1 2026', 'prose'],
    ['', 'empty'],
    ['not-a-date', 'garbage'],
    [null, 'null'],
    [undefined, 'undefined'],
    [20260901, 'number'],
  ])('rejects %p (%s)', (input) => {
    expect(parseCalendarDate(input)).toBeNull();
  });

  test('rejects impossible calendar dates', () => {
    expect(parseCalendarDate('2026-02-30')).toBeNull();
    expect(parseCalendarDate('2026-13-01')).toBeNull();
  });

  test('is timezone-independent', () => {
    // Same string must yield the same instant regardless of server TZ, or a
    // booking silently moves a night when the host region changes.
    expect(parseCalendarDate('2026-09-01').getTime())
      .toBe(Date.UTC(2026, 8, 1, 0, 0, 0, 0));
  });
});

describe('nightsBetween', () => {
  test.each([
    ['2026-09-01', '2026-09-02', 1],
    ['2026-09-01', '2026-09-03', 2],
    ['2026-09-01', '2026-09-08', 7],
    ['2026-09-01', '2026-09-01', 0],
    ['2026-12-30', '2027-01-02', 3],   // across a year boundary
    ['2028-02-28', '2028-03-01', 2],   // across a leap day
  ])('%s → %s is %i nights', (a, b, expected) => {
    expect(nightsBetween(parseCalendarDate(a), parseCalendarDate(b))).toBe(expected);
  });
});

describe('validateStay', () => {
  const today = todayInPropertyTz();
  const tomorrow = iso(plusDays(today, 1));
  const dayAfter = iso(plusDays(today, 2));

  test('accepts a normal future stay', () => {
    const r = validateStay(tomorrow, dayAfter);
    expect(r.ok).toBe(true);
    expect(r.nights).toBe(1);
  });

  test('accepts a stay starting today', () => {
    // Walk-in same-day bookings are legitimate and must not be rejected as past.
    const r = validateStay(iso(today), tomorrow);
    expect(r.ok).toBe(true);
  });

  test('rejects a checkin in the past', () => {
    const r = validateStay(iso(plusDays(today, -1)), tomorrow);
    expect(r.ok).toBe(false);
    expect(r.field).toBe('checkin');
  });

  test('rejects checkout before or equal to checkin', () => {
    expect(validateStay(tomorrow, tomorrow).ok).toBe(false);
    expect(validateStay(dayAfter, tomorrow).ok).toBe(false);
  });

  test('rejects an over-long stay', () => {
    const r = validateStay(tomorrow, iso(plusDays(today, MAX_NIGHTS + 5)));
    expect(r.ok).toBe(false);
    expect(r.field).toBe('checkout');
  });

  test('rejects booking too far ahead', () => {
    const r = validateStay(iso(plusDays(today, 400)), iso(plusDays(today, 401)));
    expect(r.ok).toBe(false);
    expect(r.field).toBe('checkin');
  });

  test('reports which field was wrong', () => {
    expect(validateStay('garbage', dayAfter).field).toBe('checkin');
    expect(validateStay(tomorrow, 'garbage').field).toBe('checkout');
  });
});
