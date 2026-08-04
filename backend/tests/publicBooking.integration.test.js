// tests/publicBooking.integration.test.js
//
// End-to-end tests for the public booking API against a real MongoDB.
//
// Runs on an in-memory REPLICA SET rather than a standalone mongod, because the
// double-booking guarantee depends on transactions and a standalone instance
// would silently exercise the non-transactional fallback path instead — testing
// something other than what production runs.

const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
process.env.TIMEZONE = 'Asia/Colombo';

// Raise the rate limits for this suite. Every request originates from
// 127.0.0.1, so the production write limit of 10 per 15 minutes would starve
// the suite after the tenth booking and mask real failures as 429s. The
// limiter middleware itself still runs — see rateLimiting.test.js, which
// exercises it deliberately with a low limit.
process.env.PUBLIC_READ_RATE_LIMIT = '100000';
process.env.PUBLIC_WRITE_RATE_LIMIT = '100000';
process.env.PUBLIC_STATUS_RATE_LIMIT = '100000';

const Client = require('../models/client');
const Settings = require('../models/settings');
const Room = require('../models/room');
const Booking = require('../models/booking');
const IdempotencyKey = require('../models/idempotencyKey');
const { clearTenantCache } = require('../middleware/tenantResolver');
const { _resetTransactionSupport } = require('../services/bookingHoldService');

jest.setTimeout(120000);

let replSet;
let app;
let client;

const SLUG = 'zonova-mist';

const futureDate = (daysAhead) => {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return d.toISOString().slice(0, 10);
};

const CHECKIN = futureDate(30);
const CHECKOUT = futureDate(32);   // 2 nights

function bookingPayload(over = {}) {
  // `guest` is pulled out and merged separately — spreading `over` wholesale
  // would replace the whole guest object rather than override one field of it.
  const { guest: guestOver, ...rest } = over;
  return {
    room_number: '101',
    checkin: CHECKIN,
    checkout: CHECKOUT,
    adults: 2,
    children: 0,
    terms_accepted: true,
    ...rest,
    guest: {
      name: 'Nimal Perera',
      email: 'nimal@example.lk',
      phone: '0771234567',
      ...(guestOver || {}),
    },
  };
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri());

  app = express();
  app.use('/api/v1/public', require('../routes/publicRoutes'));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  _resetTransactionSupport();
  clearTenantCache();
  await Promise.all([
    Client.deleteMany({}), Settings.deleteMany({}),
    Room.deleteMany({}), Booking.deleteMany({}), IdempotencyKey.deleteMany({}),
  ]);

  client = await Client.create({
    name: 'Zonova Mist', code: `C_${Date.now()}`, slug: SLUG, isActive: true,
  });

  await Settings.create({
    clientId: client._id,
    guestHouseName: 'Zonova Mist',
    guestHouseAddress: 'Ambewela',
    hostName: 'Host',
    telephone: '94771234567',
    newBookingSmsTemplate: 'x',
    todayBookingSmsTemplate: 'x',
    publicBookingEnabled: true,
    holdDurationMinutes: 20,
    depositPercentage: 100,
  });

  await Room.create([
    { clientId: client._id, roomNumber: '101', type: 'double', maxOccupancy: 2, pricePerNight: 5000, status: 'available' },
    { clientId: client._id, roomNumber: '102', type: 'family', maxOccupancy: 4, pricePerNight: 8000, status: 'available' },
    { clientId: client._id, roomNumber: '103', type: 'single', maxOccupancy: 1, pricePerNight: 3000, status: 'maintenance' },
  ]);
});

// --- tenant resolution ----------------------------------------------------

describe('tenant resolution', () => {
  test('resolves a known slug', async () => {
    const res = await request(app).get(`/api/v1/public/${SLUG}/property`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Zonova Mist');
  });

  test('unknown slug is 404', async () => {
    const res = await request(app).get('/api/v1/public/nope/property');
    expect(res.status).toBe(404);
  });

  test('inactive tenant is 404, indistinguishable from unknown', async () => {
    // A public endpoint must not let a stranger enumerate which properties exist.
    await Client.updateOne({ _id: client._id }, { isActive: false });
    clearTenantCache();
    const res = await request(app).get(`/api/v1/public/${SLUG}/property`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TENANT_NOT_FOUND');
  });

  test('booking is refused while publicBookingEnabled is false', async () => {
    await Settings.updateOne({ clientId: client._id }, { publicBookingEnabled: false });
    clearTenantCache();
    const res = await request(app)
      .post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'k1')
      .send(bookingPayload());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PUBLIC_BOOKING_DISABLED');
  });
});

// --- availability ---------------------------------------------------------

describe('availability', () => {
  test('lists bookable rooms with server-computed prices', async () => {
    const res = await request(app)
      .get(`/api/v1/public/${SLUG}/availability`)
      .query({ checkin: CHECKIN, checkout: CHECKOUT, adults: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.nights).toBe(2);

    const nums = res.body.data.rooms.map((r) => r.room_number);
    expect(nums).toContain('101');
    expect(nums).not.toContain('103');   // maintenance

    const r101 = res.body.data.rooms.find((r) => r.room_number === '101');
    expect(r101.total_cents).toBe(1000000);      // 5000 × 2 nights
    expect(r101.total_formatted).toBe('10000.00');
  });

  test('filters by occupancy', async () => {
    const res = await request(app)
      .get(`/api/v1/public/${SLUG}/availability`)
      .query({ checkin: CHECKIN, checkout: CHECKOUT, adults: 4 });
    const nums = res.body.data.rooms.map((r) => r.room_number);
    expect(nums).toEqual(['102']);               // only the family room fits 4
  });

  test('excludes a room already held', async () => {
    await request(app).post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'hold-1').send(bookingPayload());

    const res = await request(app)
      .get(`/api/v1/public/${SLUG}/availability`)
      .query({ checkin: CHECKIN, checkout: CHECKOUT, adults: 2 });

    expect(res.body.data.rooms.map((r) => r.room_number)).not.toContain('101');
  });

  test('same-day turnover is still bookable', async () => {
    // The boundary that a >= / <= mistake would silently break.
    await request(app).post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'hold-2').send(bookingPayload());

    const res = await request(app)
      .get(`/api/v1/public/${SLUG}/availability`)
      .query({ checkin: CHECKOUT, checkout: futureDate(34), adults: 2 });

    expect(res.body.data.rooms.map((r) => r.room_number)).toContain('101');
  });

  test('rejects malformed dates', async () => {
    const res = await request(app)
      .get(`/api/v1/public/${SLUG}/availability`)
      .query({ checkin: 'yesterday', checkout: CHECKOUT });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DATES');
  });
});

// --- booking creation -----------------------------------------------------

describe('booking creation', () => {
  test('creates a HOLD and returns only public fields', async () => {
    const res = await request(app)
      .post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'create-1')
      .send(bookingPayload());

    expect(res.status).toBe(201);
    const d = res.body.data;
    expect(d.booking_ref).toMatch(/^ZM-[A-HJ-NP-Z2-9]{6}$/);
    expect(d.booking_status).toBe('HOLD');
    expect(d.payment_status).toBe('UNPAID');
    expect(d.total_amount_cents).toBe(1000000);
    expect(d.hold_expires_at).toBeTruthy();

    // Internal identifiers must never leak.
    expect(JSON.stringify(d)).not.toContain('_id');
    expect(d.clientId).toBeUndefined();
  });

  test('persists server-side fields correctly', async () => {
    const res = await request(app)
      .post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'create-2')
      .send(bookingPayload());

    const saved = await Booking.findOne({ booking_ref: res.body.data.booking_ref }).lean();
    expect(saved.source).toBe('WEB');
    expect(saved.status).toBe('pending');            // legacy dual-write
    expect(saved.booking_status).toBe('HOLD');
    expect(saved.guest_email).toBe('nimal@example.lk');
    expect(saved.terms_accepted_at).toBeTruthy();
    expect(saved.has_gateway_payment).toBe(false);
    expect(saved.total_price).toBe(10000);           // legacy float mirror
  });

  test('IGNORES a client-supplied price', async () => {
    // The core anti-tamper property: the browser cannot influence the amount.
    const res = await request(app)
      .post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'create-3')
      .send({
        ...bookingPayload(),
        total_price: 1, total_amount_cents: 1, deposit_amount_cents: 1,
        paid_amount_cents: 999999, booking_status: 'CONFIRMED', payment_status: 'PAID',
      });

    expect(res.status).toBe(201);
    const saved = await Booking.findOne({ booking_ref: res.body.data.booking_ref }).lean();
    expect(saved.total_amount_cents).toBe(1000000);  // recomputed, not 1
    expect(saved.paid_amount_cents).toBe(0);
    expect(saved.booking_status).toBe('HOLD');       // not CONFIRMED
    expect(saved.payment_status).toBe('UNPAID');
  });

  test.each([
    [{ guest: { name: '' } }, 'guest.name'],
    [{ guest: { email: 'not-an-email' } }, 'guest.email'],
    [{ guest: { phone: '12' } }, 'guest.phone'],
  ])('rejects invalid guest details (%p)', async (over, field) => {
    const res = await request(app)
      .post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', `bad-${field}`)
      .send(bookingPayload(over));
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe(field);
  });

  test('requires terms acceptance', async () => {
    const res = await request(app)
      .post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'no-terms')
      .send({ ...bookingPayload(), terms_accepted: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TERMS_NOT_ACCEPTED');
  });

  test('unknown room is 404', async () => {
    const res = await request(app)
      .post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'no-room')
      .send({ ...bookingPayload(), room_number: '999' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
  });

  test('a room under maintenance cannot be booked', async () => {
    const res = await request(app)
      .post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'maint')
      .send({ ...bookingPayload(), room_number: '103' });
    expect(res.status).toBe(409);
  });

  test('a second booking for the same room and dates is refused', async () => {
    await request(app).post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'first').send(bookingPayload());

    const res = await request(app).post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'second').send(bookingPayload());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROOM_UNAVAILABLE');
    expect(await Booking.countDocuments({})).toBe(1);
  });
});

// --- idempotency ----------------------------------------------------------

describe('idempotency', () => {
  test('the same key replays the original response', async () => {
    const payload = bookingPayload();
    const first = await request(app).post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'same-key').send(payload);
    const second = await request(app).post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'same-key').send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.booking_ref).toBe(first.body.data.booking_ref);
    expect(second.headers['idempotent-replay']).toBe('true');
    expect(await Booking.countDocuments({})).toBe(1);
  });

  test('a missing key is rejected', async () => {
    const res = await request(app).post(`/api/v1/public/${SLUG}/bookings`).send(bookingPayload());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  test('reusing a key with a different body is rejected, not replayed', async () => {
    await request(app).post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'reused').send(bookingPayload());

    const res = await request(app).post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'reused')
      .send(bookingPayload({ guest: { name: 'Someone Else' } }));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  test('a failed request releases its key for retry', async () => {
    const bad = await request(app).post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'retry-me')
      .send({ ...bookingPayload(), room_number: '999' });
    expect(bad.status).toBe(404);

    // Same key, corrected payload — must be allowed through.
    const good = await request(app).post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'retry-me').send(bookingPayload());
    expect(good.status).toBe(201);
  });
});

// --- concurrency (the M3.4 acceptance criterion) --------------------------

describe('concurrent booking attempts', () => {
  test('20 simultaneous requests for the same room create exactly ONE hold', async () => {
    const attempts = Array.from({ length: 20 }, (_, i) =>
      request(app).post(`/api/v1/public/${SLUG}/bookings`)
        .set('Idempotency-Key', `concurrent-${i}`)   // distinct keys: a real race, not a replay
        .send(bookingPayload()));

    const results = await Promise.all(attempts);
    const created = results.filter((r) => r.status === 201);
    const refused = results.filter((r) => r.status === 409);

    expect(created).toHaveLength(1);
    expect(refused).toHaveLength(19);
    expect(await Booking.countDocuments({})).toBe(1);
  });

  test('simultaneous requests for DIFFERENT rooms all succeed', async () => {
    // The lock must serialise per room, not globally.
    const results = await Promise.all([
      request(app).post(`/api/v1/public/${SLUG}/bookings`)
        .set('Idempotency-Key', 'r101').send(bookingPayload({ room_number: '101' })),
      request(app).post(`/api/v1/public/${SLUG}/bookings`)
        .set('Idempotency-Key', 'r102').send(bookingPayload({ room_number: '102', adults: 2 })),
    ]);

    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(await Booking.countDocuments({})).toBe(2);
  });
});

// --- status ---------------------------------------------------------------

describe('booking status', () => {
  test('returns status for a valid reference', async () => {
    const created = await request(app).post(`/api/v1/public/${SLUG}/bookings`)
      .set('Idempotency-Key', 'status-1').send(bookingPayload());
    const ref = created.body.data.booking_ref;

    const res = await request(app).get(`/api/v1/public/bookings/${ref}/status`);
    expect(res.status).toBe(200);
    expect(res.body.data.booking_status).toBe('HOLD');
    expect(res.body.data.payment_status).toBe('UNPAID');
    expect(res.body.data.guest_first_name).toBe('Nimal');
    // Only the first name — no full identity on an unauthenticated endpoint.
    expect(JSON.stringify(res.body)).not.toContain('Perera');
    expect(JSON.stringify(res.body)).not.toContain('nimal@example.lk');
  });

  test('a malformed reference is 404 without a database lookup', async () => {
    for (const bad of ['garbage', 'ZM-111111', 'XX-ABCDEF']) {
      const res = await request(app).get(`/api/v1/public/bookings/${bad}/status`);
      expect(res.status).toBe(404);
    }
  });

  test('a well-formed but unknown reference is 404', async () => {
    const res = await request(app).get('/api/v1/public/bookings/ZM-ZZZZZZ/status');
    expect(res.status).toBe(404);
  });
});
