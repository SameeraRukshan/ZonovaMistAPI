// tests/pricing.test.js
//
// Pricing is server-authoritative. These tests pin the arithmetic that will be
// hashed into a PayHere signature — a rounding disagreement here becomes an
// opaque gateway rejection later.

const { quoteRoom } = require('../services/pricingService');
const { parseCalendarDate } = require('../helpers/dates');

const room = (over = {}) => ({
  roomNumber: '101', type: 'double', bedCount: 1, maxOccupancy: 2,
  amenities: ['wifi'], pricePerNight: 5000, ...over,
});

const stay = (a, b) => [parseCalendarDate(a), parseCalendarDate(b)];

describe('basic pricing', () => {
  test('rate × nights, in cents', () => {
    const [ci, co] = stay('2026-09-01', '2026-09-04');
    const q = quoteRoom(room(), ci, co);
    expect(q.nights).toBe(3);
    expect(q.rate_per_night_cents).toBe(500000);
    expect(q.total_cents).toBe(1500000);
    expect(q.total_formatted).toBe('15000.00');
  });

  test('a single night', () => {
    const [ci, co] = stay('2026-09-01', '2026-09-02');
    expect(quoteRoom(room(), ci, co).total_cents).toBe(500000);
  });

  test('handles a fractional nightly rate without float drift', () => {
    const [ci, co] = stay('2026-09-01', '2026-09-04');
    const q = quoteRoom(room({ pricePerNight: 3333.33 }), ci, co);
    expect(q.rate_per_night_cents).toBe(333333);
    expect(q.total_cents).toBe(999999);
    expect(q.total_formatted).toBe('9999.99');
  });

  test('a room with no rate prices at zero rather than NaN', () => {
    const [ci, co] = stay('2026-09-01', '2026-09-02');
    for (const r of [room({ pricePerNight: 0 }), room({ pricePerNight: undefined })]) {
      expect(quoteRoom(r, ci, co).total_cents).toBe(0);
    }
  });
});

describe('deposit', () => {
  const [ci, co] = stay('2026-09-01', '2026-09-03');   // 2 nights, 10000.00

  test('100% means the whole total, with no balance', () => {
    const q = quoteRoom(room(), ci, co, { depositPercentage: 100 });
    expect(q.deposit_cents).toBe(1000000);
    expect(q.balance_cents).toBe(0);
  });

  test('defaults to 100% when unspecified', () => {
    expect(quoteRoom(room(), ci, co).deposit_cents).toBe(1000000);
  });

  test('a partial deposit leaves the remainder as balance', () => {
    const q = quoteRoom(room(), ci, co, { depositPercentage: 25 });
    expect(q.deposit_cents).toBe(250000);
    expect(q.balance_cents).toBe(750000);
  });

  test('deposit + balance always reconstructs the total', () => {
    // The invariant that matters: money must never be created or lost by
    // splitting it, at any percentage.
    for (const pct of [1, 7, 25, 33, 50, 66, 99, 100]) {
      const q = quoteRoom(room({ pricePerNight: 3333.33 }), ci, co, { depositPercentage: pct });
      expect(q.deposit_cents + q.balance_cents).toBe(q.total_cents);
    }
  });

  test('rounds the deposit up, so the property is never short', () => {
    // 999999 cents at 33% is 329999.67 — must round up, not down.
    const q = quoteRoom(room({ pricePerNight: 4999.995 }), ci, co, { depositPercentage: 33 });
    expect(q.deposit_cents).toBe(Math.ceil((q.total_cents * 33) / 100));
    expect(q.deposit_cents * 100).toBeGreaterThanOrEqual(q.total_cents * 33);
  });

  test.each([0, -10, 150, NaN, null, undefined, 'abc'])(
    'clamps an out-of-range percentage (%p) to a full deposit', (pct) => {
      const q = quoteRoom(room(), ci, co, { depositPercentage: pct });
      expect(q.deposit_cents).toBe(q.total_cents);
    });
});

describe('output shape', () => {
  test('carries the room details the booking UI needs', () => {
    const [ci, co] = stay('2026-09-01', '2026-09-02');
    const q = quoteRoom(room(), ci, co);
    expect(q).toMatchObject({
      room_number: '101', room_type: 'double', bed_count: 1,
      max_occupancy: 2, amenities: ['wifi'], currency: 'LKR',
    });
  });

  test('formatted amounts are always PayHere-shaped', () => {
    const [ci, co] = stay('2026-09-01', '2026-09-05');
    const q = quoteRoom(room({ pricePerNight: 12345.67 }), ci, co, { depositPercentage: 40 });
    for (const s of [q.total_formatted, q.deposit_formatted, q.rate_per_night_formatted]) {
      expect(s).toMatch(/^\d+\.\d{2}$/);
      expect(s).not.toContain(',');
    }
  });

  test('room_number is a string, matching booked_room_no', () => {
    // Booking.booked_room_no is a String; a numeric room number here would
    // break the availability match silently.
    const [ci, co] = stay('2026-09-01', '2026-09-02');
    expect(typeof quoteRoom(room({ roomNumber: 101 }), ci, co).room_number).toBe('string');
  });
});
