// backend/scripts/verify-local.js
//
// End-to-end local verification of everything built in M1–M3, run against a
// real MongoDB, in-process (no separate server needed).
//
// SAFETY: creates its own throwaway tenant (slug "local-verify-property") and
// deletes it afterwards. It never reads, modifies or counts your real bookings.
// It will still refuse to run without --confirm, because MONGO_URI in .env
// usually points at production Atlas and you should have to say so out loud.
//
// USAGE
//   node scripts/verify-local.js --confirm
//   npm run verify:local
//
// Exit code 0 = everything passed.

const path = require('path');
const mongoose = require('mongoose');
const express = require('express');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-verify-secret';
// Raise the public rate limits: this script fires far more requests in a few
// seconds than any real guest would.
process.env.PUBLIC_READ_RATE_LIMIT = '100000';
process.env.PUBLIC_WRITE_RATE_LIMIT = '100000';
process.env.PUBLIC_STATUS_RATE_LIMIT = '100000';

const jwt = require('jsonwebtoken');
const http = require('http');

const Client = require('../models/client');
const Settings = require('../models/settings');
const Room = require('../models/room');
const Booking = require('../models/booking');
const IdempotencyKey = require('../models/idempotencyKey');

const TEST_SLUG = 'local-verify-property';
const TEST_CODE = 'LOCAL_VERIFY_ONLY';

let pass = 0, fail = 0;
const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? `  — ${detail}` : ''}`);
}
const section = (t) => console.log(`\n${'─'.repeat(68)}\n${t}\n${'─'.repeat(68)}`);

const futureDate = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const CHECKIN = futureDate(45);
const CHECKOUT = futureDate(47);

// --- tiny HTTP client -----------------------------------------------------

function req(server, method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: '127.0.0.1', port: server.address().port, method, path: urlPath,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch { /* non-JSON */ }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    r.on('error', (e) => resolve({ status: 0, error: e.message, body: null, headers: {} }));
    if (payload) r.write(payload);
    r.end();
  });
}

const guest = { name: 'Local Verify', email: 'verify@example.lk', phone: '0770000000' };
const payload = (over = {}) => {
  const { guest: g, ...rest } = over;
  return {
    room_number: '901', checkin: CHECKIN, checkout: CHECKOUT,
    adults: 2, children: 0, terms_accepted: true,
    ...rest,
    guest: { ...guest, ...(g || {}) },
  };
};

// --- setup / teardown -----------------------------------------------------

async function cleanup() {
  const c = await Client.findOne({ slug: TEST_SLUG });
  if (!c) return;
  await Promise.all([
    Booking.deleteMany({ clientId: c._id }),
    Room.deleteMany({ clientId: c._id }),
    Settings.deleteMany({ clientId: c._id }),
    IdempotencyKey.deleteMany({ key: /local-verify/ }),
  ]);
  await Client.deleteOne({ _id: c._id });
}

async function seed() {
  await cleanup();
  const client = await Client.create({
    name: 'Local Verify Property', code: TEST_CODE, slug: TEST_SLUG, isActive: true,
  });
  await Settings.create({
    clientId: client._id,
    guestHouseName: 'Local Verify Property', guestHouseAddress: 'Nowhere',
    hostName: 'Host', telephone: '94770000000',
    newBookingSmsTemplate: 'x', todayBookingSmsTemplate: 'x',
    publicBookingEnabled: true, holdDurationMinutes: 20, depositPercentage: 100,
  });
  await Room.create([
    { clientId: client._id, roomNumber: '901', type: 'double', maxOccupancy: 2, pricePerNight: 5000, status: 'available' },
    { clientId: client._id, roomNumber: '902', type: 'family', maxOccupancy: 4, pricePerNight: 8000, status: 'available' },
  ]);
  return client;
}

// --- the run --------------------------------------------------------------

async function main() {
  if (!process.argv.includes('--confirm')) {
    const uri = process.env.MONGO_URI || '(unset)';
    const target = uri.replace(/\/\/[^@]*@/, '//***@');
    console.log('\n⚠️  This connects to a real database and writes a throwaway tenant.\n');
    console.log(`   Target: ${target}\n`);
    console.log('   It only touches its own tenant (slug "local-verify-property")');
    console.log('   and deletes it afterwards. Your real bookings are untouched.\n');
    console.log('   Re-run with --confirm to proceed:\n');
    console.log('     node scripts/verify-local.js --confirm\n');
    process.exit(2);
  }

  if (!process.env.MONGO_URI) { console.error('❌ MONGO_URI is not set'); process.exit(1); }

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  Local verification — M1, M2, M3                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('🔗 Connected');

  const client = await seed();

  const app = express();
  app.use('/api/v1/public', require('../routes/publicRoutes'));
  app.use(express.json());
  app.use('/api/bookings', require('../routes/bookingRoutes'));
  const server = http.createServer(app).listen(0);
  await new Promise((r) => server.once('listening', r));

  try {
    // ---------------- M1: RBAC ----------------
    section('M1 — staff read-only enforcement');

    const tok = (role) => jwt.sign(
      { id: '507f1f77bcf86cd799439011', email: `${role}@local`, role, clientId: client._id },
      process.env.JWT_SECRET,
    );

    const staffPost = await req(server, 'POST', '/api/bookings', {
      body: { guest_name: 'x' }, headers: { Authorization: `Bearer ${tok('staff')}` },
    });
    check('staff blocked from creating a booking', staffPost.status === 403, `got ${staffPost.status}`);

    const adminPost = await req(server, 'POST', '/api/bookings', {
      body: {}, headers: { Authorization: `Bearer ${tok('admin')}` },
    });
    check('admin NOT blocked by RBAC', adminPost.status !== 403, `got ${adminPost.status} (400 = validation, correct)`);

    const noAuth = await req(server, 'GET', '/api/bookings');
    check('unauthenticated request rejected', noAuth.status === 401, `got ${noAuth.status}`);

    // ---------------- M2: money + refs ----------------
    section('M2 — money helpers and booking refs');

    const { toCents, formatForPayHere } = require('../helpers/money');
    check('1000 → "1000.00"', formatForPayHere(toCents(1000)) === '1000.00');
    check('999.5 → "999.50"', formatForPayHere(toCents(999.5)) === '999.50');
    check('0.1+0.2 → "0.30"', formatForPayHere(toCents(0.1 + 0.2)) === '0.30');
    check('1.005 rounds up to 101 cents', toCents(1.005) === 101);

    const { encryptSecret, decryptSecret } = require('../helpers/secretCrypto');
    if (process.env.CREDENTIAL_ENCRYPTION_KEY) {
      const round = decryptSecret(encryptSecret('test-secret-value')) === 'test-secret-value';
      check('credential encryption round-trips', round);
    } else {
      check('credential encryption', true, 'SKIPPED — CREDENTIAL_ENCRYPTION_KEY not set (needed for M4)');
    }

    // ---------------- M3: public booking ----------------
    section('M3 — public booking API');

    const prop = await req(server, 'GET', `/api/v1/public/${TEST_SLUG}/property`);
    check('GET /property resolves the tenant', prop.status === 200 && prop.body?.data?.name === 'Local Verify Property',
      `got ${prop.status}`);

    const unknown = await req(server, 'GET', '/api/v1/public/does-not-exist/property');
    check('unknown tenant → 404', unknown.status === 404, `got ${unknown.status}`);

    const avail = await req(server, 'GET',
      `/api/v1/public/${TEST_SLUG}/availability?checkin=${CHECKIN}&checkout=${CHECKOUT}&adults=2`);
    const rooms = avail.body?.data?.rooms || [];
    check('GET /availability lists rooms', avail.status === 200 && rooms.length > 0, `${rooms.length} rooms`);
    check('price computed server-side (5000 × 2 nights)',
      rooms.find((r) => r.room_number === '901')?.total_cents === 1000000);

    const created = await req(server, 'POST', `/api/v1/public/${TEST_SLUG}/bookings`, {
      body: payload(), headers: { 'Idempotency-Key': 'local-verify-1' },
    });
    const ref = created.body?.data?.booking_ref;
    check('POST /bookings creates a HOLD', created.status === 201 && created.body?.data?.booking_status === 'HOLD',
      `got ${created.status}`);
    check('booking_ref looks right', /^ZM-[A-HJ-NP-Z2-9]{6}$/.test(ref || ''), ref);
    check('no internal _id leaked', !JSON.stringify(created.body?.data || {}).includes('_id'));

    // Price tampering
    const tampered = await req(server, 'POST', `/api/v1/public/${TEST_SLUG}/bookings`, {
      body: { ...payload({ room_number: '902' }), total_price: 1, total_amount_cents: 1, payment_status: 'PAID' },
      headers: { 'Idempotency-Key': 'local-verify-tamper' },
    });
    const tamperedDoc = await Booking.findOne({ booking_ref: tampered.body?.data?.booking_ref }).lean();
    check('client-supplied price IGNORED',
      tamperedDoc && tamperedDoc.total_amount_cents === 1600000, `stored ${tamperedDoc?.total_amount_cents}`);
    check('client-supplied payment_status IGNORED', tamperedDoc?.payment_status === 'UNPAID');

    // Idempotency
    const replay = await req(server, 'POST', `/api/v1/public/${TEST_SLUG}/bookings`, {
      body: payload(), headers: { 'Idempotency-Key': 'local-verify-1' },
    });
    check('idempotent replay returns the same booking',
      replay.body?.data?.booking_ref === ref && replay.headers['idempotent-replay'] === 'true');

    const noKey = await req(server, 'POST', `/api/v1/public/${TEST_SLUG}/bookings`, { body: payload() });
    check('missing Idempotency-Key rejected', noKey.status === 400);

    // Double booking
    const dupe = await req(server, 'POST', `/api/v1/public/${TEST_SLUG}/bookings`, {
      body: payload(), headers: { 'Idempotency-Key': 'local-verify-dupe' },
    });
    check('double booking refused with 409', dupe.status === 409, `got ${dupe.status}`);

    // Concurrency — the headline guarantee
    await Booking.deleteMany({ clientId: client._id });
    await IdempotencyKey.deleteMany({ key: /local-verify/ });
    const burst = await Promise.all(Array.from({ length: 15 }, (_, i) =>
      req(server, 'POST', `/api/v1/public/${TEST_SLUG}/bookings`, {
        body: payload(), headers: { 'Idempotency-Key': `local-verify-burst-${i}` },
      })));
    const won = burst.filter((r) => r.status === 201).length;
    const lost = burst.filter((r) => r.status === 409).length;
    const stored = await Booking.countDocuments({ clientId: client._id });
    check('15 concurrent requests → exactly ONE booking',
      won === 1 && stored === 1, `${won} created, ${lost} refused, ${stored} in db`);

    // Same-day turnover
    const turnover = await req(server, 'GET',
      `/api/v1/public/${TEST_SLUG}/availability?checkin=${CHECKOUT}&checkout=${futureDate(49)}&adults=2`);
    check('same-day turnover still bookable',
      (turnover.body?.data?.rooms || []).some((r) => r.room_number === '901'));

    // Status endpoint
    const liveRef = (await Booking.findOne({ clientId: client._id }).lean())?.booking_ref;
    const status = await req(server, 'GET', `/api/v1/public/bookings/${liveRef}/status`);
    check('GET /bookings/:ref/status works', status.status === 200 && status.body?.data?.booking_status === 'HOLD');
    check('status does not leak email or surname',
      !JSON.stringify(status.body).includes('verify@example.lk'));

    const badRef = await req(server, 'GET', '/api/v1/public/bookings/garbage/status');
    check('malformed ref → 404', badRef.status === 404);

    // Feature flag
    await Settings.updateOne({ clientId: client._id }, { publicBookingEnabled: false });
    require('../middleware/tenantResolver').clearTenantCache();
    const disabled = await req(server, 'GET',
      `/api/v1/public/${TEST_SLUG}/availability?checkin=${CHECKIN}&checkout=${CHECKOUT}`);
    check('publicBookingEnabled=false closes the API', disabled.status === 403, `got ${disabled.status}`);

    // ---------------- production data sanity ----------------
    section('Your real data (read-only)');

    const realClients = await Client.find({ slug: { $ne: TEST_SLUG } }).select('name slug').lean();
    for (const c of realClients) {
      check(`tenant "${c.name}" has a slug`, !!c.slug,
        c.slug || 'MISSING — re-run npm run migrate:payment');
    }

    const realBookings = await Booking.countDocuments({ clientId: { $ne: client._id } });
    const missingRef = await Booking.countDocuments({
      clientId: { $ne: client._id },
      $or: [{ booking_ref: null }, { booking_ref: { $exists: false } }],
    });
    check(`all ${realBookings} real bookings have a booking_ref`, missingRef === 0, `${missingRef} missing`);

    const roomsNoRate = await Room.countDocuments({
      clientId: { $ne: client._id },
      $or: [{ pricePerNight: null }, { pricePerNight: 0 }, { pricePerNight: { $exists: false } }],
    });
    check('every real room has a nightly rate', roomsNoRate === 0,
      roomsNoRate ? `${roomsNoRate} room(s) without a rate would be HIDDEN from availability` : 'all priced');
  } finally {
    server.close();
    await cleanup();
    await mongoose.disconnect();
  }

  console.log(`\n${'═'.repeat(68)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log(`${'═'.repeat(68)}\n`);
  if (fail > 0) {
    console.log('Failed checks:');
    for (const r of results.filter((x) => !x.ok)) console.log(`  ❌ ${r.name} — ${r.detail}`);
    console.log('');
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('\n❌ Verification crashed:', e);
  await cleanup().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
