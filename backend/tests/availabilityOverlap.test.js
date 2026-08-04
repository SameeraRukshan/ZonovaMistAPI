// tests/availabilityOverlap.test.js
//
// Tests the overlap PREDICATE in isolation, without a database.
//
// The rule under test: a booking ending on day X and one starting on day X do
// NOT clash — the first guest checks out in the morning, the second checks in
// that afternoon. Getting this wrong with >= / <= would reject a large share of
// perfectly good bookings, and it would look like a mysterious "no rooms
// available" rather than an obvious crash.

const { overlapQuery, BLOCKING_STATUSES } = require('../services/availabilityService');
const { parseCalendarDate } = require('../helpers/dates');

const d = parseCalendarDate;

/** Apply the built query's date predicate to a candidate booking. */
function overlaps(existing, requestedCheckin, requestedCheckout) {
  const q = overlapQuery('client-1', d(requestedCheckin), d(requestedCheckout));
  const existingIn = d(existing.checkin).getTime();
  const existingOut = d(existing.checkout).getTime();
  return existingIn < q.checkin_date.$lt.getTime()
      && existingOut > q.checkout_date.$gt.getTime();
}

describe('overlap boundaries', () => {
  const existing = { checkin: '2026-09-10', checkout: '2026-09-15' };

  test.each([
    // --- must NOT clash ---
    ['2026-09-05', '2026-09-10', false, 'ends exactly when existing starts (same-day turnover)'],
    ['2026-09-15', '2026-09-20', false, 'starts exactly when existing ends (same-day turnover)'],
    ['2026-09-01', '2026-09-05', false, 'entirely before'],
    ['2026-09-20', '2026-09-25', false, 'entirely after'],

    // --- must clash ---
    ['2026-09-09', '2026-09-11', true,  'straddles the start'],
    ['2026-09-14', '2026-09-16', true,  'straddles the end'],
    ['2026-09-11', '2026-09-13', true,  'entirely inside'],
    ['2026-09-05', '2026-09-20', true,  'entirely surrounds'],
    ['2026-09-10', '2026-09-15', true,  'exactly identical'],
    ['2026-09-14', '2026-09-15', true,  'last night only'],
    ['2026-09-10', '2026-09-11', true,  'first night only'],
  ])('%s → %s overlaps=%p (%s)', (checkin, checkout, expected) => {
    expect(overlaps(existing, checkin, checkout)).toBe(expected);
  });

  test('a one-night stay does not clash with the next night', () => {
    const oneNight = { checkin: '2026-09-10', checkout: '2026-09-11' };
    expect(overlaps(oneNight, '2026-09-11', '2026-09-12')).toBe(false);
    expect(overlaps(oneNight, '2026-09-09', '2026-09-10')).toBe(false);
    expect(overlaps(oneNight, '2026-09-10', '2026-09-11')).toBe(true);
  });
});

describe('blocking statuses', () => {
  test('an unpaid HOLD blocks the room', () => {
    // If HOLD did not block, two guests could be taken to checkout for the same
    // room and one would pay for a room already gone.
    expect(BLOCKING_STATUSES).toContain('HOLD');
  });

  test('CONFIRMED and CHECKED_IN block the room', () => {
    expect(BLOCKING_STATUSES).toContain('CONFIRMED');
    expect(BLOCKING_STATUSES).toContain('CHECKED_IN');
  });

  test('released and finished states do not block', () => {
    for (const s of ['CANCELLED', 'EXPIRED', 'CHECKED_OUT', 'NO_SHOW']) {
      expect(BLOCKING_STATUSES).not.toContain(s);
    }
  });
});

describe('query shape', () => {
  const q = overlapQuery('client-1', d('2026-09-01'), d('2026-09-03'));

  test('is tenant-scoped', () => {
    expect(q.clientId).toBe('client-1');
  });

  test('excludes soft-deleted bookings', () => {
    expect(q.deleted).toEqual({ $ne: true });
  });

  test('uses strict inequalities, not inclusive ones', () => {
    // The whole same-day-turnover behaviour rests on these two operators.
    expect(q.checkin_date).toHaveProperty('$lt');
    expect(q.checkout_date).toHaveProperty('$gt');
    expect(q.checkin_date).not.toHaveProperty('$lte');
    expect(q.checkout_date).not.toHaveProperty('$gte');
  });
});
