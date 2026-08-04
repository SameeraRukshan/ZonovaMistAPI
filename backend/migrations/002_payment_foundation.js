// migrations/002_payment_foundation.js
//
// M2.5 — prepares the database for the PayHere integration.
//
// Does six things:
//   1. Backfills booking_ref on every existing booking
//   2. Maps legacy `status` → booking_status + payment_status
//   3. Populates the *_cents fields from the existing float columns
//   4. Stamps source='ADMIN' on existing rows (all pre-date the public flow)
//   5. Drops the old GLOBAL unique indexes on Room.roomNumber / Hotel.name
//   6. Seeds one PaymentGatewayCredential row from environment variables
//
// IDEMPOTENT: safe to run repeatedly. Every step checks before it writes, so a
// second run reports "0 changed" rather than corrupting anything.
//
// USAGE
//   Dry run (reads only, changes nothing — ALWAYS do this first):
//     node migrations/002_payment_foundation.js --dry-run
//   Apply:
//     node migrations/002_payment_foundation.js
//
// BEFORE RUNNING AGAINST PRODUCTION: take a verified backup and rehearse
// against a restored snapshot. This touches every booking document.

const path = require('path');
const mongoose = require('mongoose');

// Resolve .env relative to THIS FILE, not the current working directory.
// Plain `require('dotenv').config()` is cwd-sensitive, so running the script
// from inside migrations/ would silently load nothing and fail later with a
// misleading "MONGO_URI is not set". This makes the script runnable from
// anywhere.
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Booking = require('../models/booking');
const Client = require('../models/client');
const PaymentGatewayCredential = require('../models/paymentGatewayCredential');
const { toCents } = require('../helpers/money');
const { generateBookingRef } = require('../helpers/bookingRef');

const DRY_RUN = process.argv.includes('--dry-run');

// Legacy `status` → (booking_status, payment_status).
//
// 'pending' maps to HOLD/UNPAID. Note this means historical pending bookings
// have no hold_expires_at and will therefore never be auto-expired by the
// reconciliation job — deliberate, since expiring a year-old admin booking
// would be destructive. Only bookings created through the new public flow carry
// a hold expiry.
const STATUS_MAP = {
  pending:      { booking_status: 'HOLD',      payment_status: 'UNPAID' },
  advance_paid: { booking_status: 'CONFIRMED', payment_status: 'PARTIALLY_PAID' },
  paid:         { booking_status: 'CONFIRMED', payment_status: 'PAID' },
  cancelled:    { booking_status: 'CANCELLED', payment_status: 'UNPAID' },
};

const log = (...args) => console.log(...args);
const step = (n, title) => log(`\n${'─'.repeat(64)}\n${n}. ${title}\n${'─'.repeat(64)}`);

async function backfillBookings() {
  step(1, 'Backfill booking_ref, statuses, cents, source');

  // .lean() is REQUIRED here, not an optimisation.
  //
  // A hydrated Mongoose document applies schema defaults for any path missing
  // from the stored record, so `doc.booking_status` would read back as 'HOLD'
  // even when the field does not exist in MongoDB at all. A migration that
  // checks `if (!doc.booking_status)` would then conclude every document was
  // already migrated and skip them — writing booking_ref but silently leaving
  // booking_status, payment_status and source unset, and leaving every
  // 'paid' / 'advance_paid' booking to read as the default 'HOLD' forever.
  //
  // .lean() returns the raw driver objects, so absent fields are genuinely
  // undefined and the guards below mean what they say.
  const bookings = await Booking.find({}).select(
    '_id status booking_status payment_status booking_ref source ' +
    'total_price advance_amount food total_amount_cents paid_amount_cents ' +
    'deposit_amount_cents currency'
  ).lean();

  log(`   Found ${bookings.length} bookings`);

  // Preload existing refs so uniqueness is checked in memory rather than with
  // one query per booking.
  const usedRefs = new Set(
    bookings.map((b) => b.booking_ref).filter(Boolean)
  );

  let refAdded = 0, statusAdded = 0, centsAdded = 0, sourceAdded = 0, unchanged = 0;
  const ops = [];

  for (const b of bookings) {
    const set = {};

    if (!b.booking_ref) {
      let ref = generateBookingRef();
      while (usedRefs.has(ref)) ref = generateBookingRef();
      usedRefs.add(ref);
      set.booking_ref = ref;
      refAdded += 1;
    }

    if (!b.booking_status || !b.payment_status) {
      const mapped = STATUS_MAP[b.status] || STATUS_MAP.pending;
      if (!b.booking_status) set.booking_status = mapped.booking_status;
      if (!b.payment_status) set.payment_status = mapped.payment_status;
      statusAdded += 1;
    }

    // Only populate cents when they are still at the default 0 AND the float
    // column has a value — never overwrite figures the new code has written.
    const totalCents = toCents(b.total_price || 0);
    if (!b.total_amount_cents && totalCents > 0) {
      set.total_amount_cents = totalCents;

      const advanceCents = toCents(b.advance_amount || 0);
      // Historical semantics: advance_amount is money already received.
      set.paid_amount_cents = advanceCents;
      set.deposit_amount_cents = advanceCents;
      if (!b.currency) set.currency = 'LKR';
      centsAdded += 1;
    }

    if (!b.source) {
      set.source = 'ADMIN';   // everything pre-dating this migration is staff-entered
      sourceAdded += 1;
    }

    if (Object.keys(set).length === 0) { unchanged += 1; continue; }
    ops.push({ updateOne: { filter: { _id: b._id }, update: { $set: set } } });
  }

  log(`   booking_ref to add ....... ${refAdded}`);
  log(`   statuses to map .......... ${statusAdded}`);
  log(`   cents to populate ........ ${centsAdded}`);
  log(`   source to stamp .......... ${sourceAdded}`);
  log(`   already up to date ....... ${unchanged}`);

  const plan = { refAdded, statusAdded, centsAdded, sourceAdded, opsCount: ops.length };

  if (ops.length === 0) { log('   ✅ nothing to do'); return plan; }
  if (DRY_RUN) { log(`   [dry-run] would write ${ops.length} documents`); return plan; }

  const result = await Booking.bulkWrite(ops, { ordered: false });
  log(`   ✅ modified ${result.modifiedCount} documents`);
  return plan;
}

/**
 * Backfill Client.slug — the public URL identifier.
 *
 * Public booking routes are /api/v1/public/:tenantSlug/..., carry no JWT, and
 * therefore resolve the tenant from the URL. `code` is unusable for that: it is
 * generated as CLIENT_<timestamp>. Derived from the client name instead.
 */
async function backfillClientSlugs() {
  step('1b', 'Backfill Client.slug');

  const clients = await Client.find({}).select('_id name slug').lean();
  const existing = new Set(clients.map((c) => c.slug).filter(Boolean));

  let added = 0, skipped = 0;

  for (const c of clients) {
    if (c.slug) { skipped += 1; continue; }

    const base = String(c.name || 'property')
      .toLowerCase()
      .normalize('NFKD')                          // decompose accents; the next
      .replace(/[^a-z0-9]+/g, '-')              // filter drops the leftover marks
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'property';

    let slug = base;
    let n = 2;
    while (existing.has(slug)) { slug = `${base}-${n}`; n += 1; }
    existing.add(slug);

    log(`   ${DRY_RUN ? '[dry-run] would set' : 'setting'}  "${c.name}" → ${slug}`);
    if (!DRY_RUN) {
      // eslint-disable-next-line no-await-in-loop
      await Client.updateOne({ _id: c._id }, { $set: { slug } });
    }
    added += 1;
  }

  log(`   slugs added .............. ${added}`);
  log(`   already had one .......... ${skipped}`);
}

async function dropLegacyUniqueIndexes() {
  step(2, 'Drop global unique indexes on Room.roomNumber / Hotel.name');

  // These blocked a second tenant from ever having a "Room 101". Mongoose will
  // not replace an existing index definition, so the old one must go explicitly.
  const targets = [
    { collection: 'rooms', index: 'roomNumber_1' },
    { collection: 'hotels', index: 'name_1' },
  ];

  for (const { collection, index } of targets) {
    const coll = mongoose.connection.db.collection(collection);
    // eslint-disable-next-line no-await-in-loop
    const existing = await coll.indexes();
    const found = existing.find((i) => i.name === index);

    if (!found) { log(`   ℹ️  ${collection}.${index} not present (already dropped)`); continue; }
    if (!found.unique) { log(`   ℹ️  ${collection}.${index} exists but is not unique — leaving alone`); continue; }
    if (DRY_RUN) { log(`   [dry-run] would drop ${collection}.${index}`); continue; }

    // eslint-disable-next-line no-await-in-loop
    await coll.dropIndex(index);
    log(`   ✅ dropped ${collection}.${index}`);
  }

  // Build the replacements EXPLICITLY and wait for them.
  //
  // Relying on Mongoose autoIndex here is a trap: it builds lazily after the
  // connection settles, and this script disconnects long before that. The
  // window between "old unique index dropped" and "new one built" is a period
  // with NO uniqueness constraint on room numbers at all — during which
  // duplicates can be created that then prevent the unique index from building
  // at all. Close it inside the migration.
  if (DRY_RUN) {
    log('   [dry-run] would build compound indexes on rooms and hotels');
    return;
  }

  const Room = require('../models/room');
  const Hotel = require('../models/hotel');

  for (const [name, Model] of [['rooms', Room], ['hotels', Hotel]]) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await Model.createIndexes();
      log(`   ✅ built compound index on ${name}`);
    } catch (err) {
      // A duplicate-key failure here means the data already violates the new
      // constraint — surface it loudly rather than leaving the table unindexed.
      log(`   ❌ could not build compound index on ${name}: ${err.message}`);
      if (err.code === 11000) {
        log('      Existing duplicates violate {clientId, <field>} uniqueness.');
        log('      Resolve the duplicates, then re-run this migration.');
      }
      throw err;
    }
  }
}

async function seedGatewayCredential() {
  step(3, 'Seed PaymentGatewayCredential from environment');

  const {
    PAYHERE_MERCHANT_ID,
    PAYHERE_MERCHANT_SECRET,
    PAYHERE_APP_ID,
    PAYHERE_APP_SECRET,
    PAYHERE_MODE,
    PAYHERE_APPROVED_DOMAIN,
    CREDENTIAL_ENCRYPTION_KEY,
  } = process.env;

  if (!PAYHERE_MERCHANT_ID || !PAYHERE_MERCHANT_SECRET) {
    log('   ⏭️  PAYHERE_MERCHANT_ID / PAYHERE_MERCHANT_SECRET not set — skipping.');
    log('      Expected: the guest house merchant account does not exist yet (M0.0).');
    log('      Re-run this migration once credentials are available.');
    return;
  }
  if (!CREDENTIAL_ENCRYPTION_KEY) {
    log('   ❌ CREDENTIAL_ENCRYPTION_KEY is not set — cannot encrypt the secret.');
    log('      Generate one with:');
    log('      node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    return;
  }

  const client = await Client.findOne({ isActive: true }).sort({ createdAt: 1 });
  if (!client) { log('   ❌ No active Client found — cannot attach credentials.'); return; }

  const mode = (PAYHERE_MODE || 'SANDBOX').toUpperCase();
  const domain = PAYHERE_APPROVED_DOMAIN || null;

  if (!domain) {
    log('   ⚠️  PAYHERE_APPROVED_DOMAIN is not set.');
    log('      PayHere whitelists MAIN domains only — subdomains cannot be');
    log('      registered — so this must be the new apex domain (M0.1),');
    log('      e.g. "zonovamist.lk". NOT "mist.zonova.lk".');
    return;
  }

  const existing = await PaymentGatewayCredential.findOne({
    clientId: client._id, gateway: 'PAYHERE', mode,
  });

  if (existing) {
    log(`   ℹ️  credential already exists for ${client.name} (${mode}) — leaving alone`);
    log('      To rotate a secret, update the row deliberately rather than re-running this.');
    return;
  }
  if (DRY_RUN) {
    log(`   [dry-run] would create ${mode} credential for "${client.name}" on ${domain}`);
    return;
  }

  const cred = new PaymentGatewayCredential({
    clientId: client._id,
    gateway: 'PAYHERE',
    domain,
    merchant_id: PAYHERE_MERCHANT_ID,
    mode,
    is_active: true,
  });
  cred.setMerchantSecret(PAYHERE_MERCHANT_SECRET);
  if (PAYHERE_APP_ID) cred.setAppId(PAYHERE_APP_ID);
  if (PAYHERE_APP_SECRET) cred.setAppSecret(PAYHERE_APP_SECRET);
  await cred.save();

  log(`   ✅ created ${mode} credential for "${client.name}" on ${domain}`);
}

async function verify(plan) {
  step(4, 'Verify');

  // These are countDocuments queries, so they see what MongoDB actually stores
  // — no Mongoose schema defaults papering over absent fields.
  const total = await Booking.countDocuments({});
  const missingRef = await Booking.countDocuments({
    $or: [{ booking_ref: null }, { booking_ref: { $exists: false } }],
  });
  const missingStatus = await Booking.countDocuments({
    $or: [{ booking_status: null }, { booking_status: { $exists: false } }],
  });
  const missingPaymentStatus = await Booking.countDocuments({
    $or: [{ payment_status: null }, { payment_status: { $exists: false } }],
  });
  const missingSource = await Booking.countDocuments({
    $or: [{ source: null }, { source: { $exists: false } }],
  });

  log(`   bookings total ............ ${total}`);
  log(`   missing booking_ref ....... ${missingRef}`);
  log(`   missing booking_status .... ${missingStatus}`);
  log(`   missing payment_status .... ${missingPaymentStatus}`);
  log(`   missing source ............ ${missingSource}`);

  // Cross-check the PLAN against reality.
  //
  // This exists because of a bug caught in the first dry run: step 1 read
  // through Mongoose (which supplies schema defaults) and concluded 0 documents
  // needed booking_status, while the database actually had 36 missing it. The
  // plan and the raw counts disagreeing is the signature of that whole class of
  // bug, so check it explicitly rather than trusting either number alone.
  if (DRY_RUN && plan) {
    const mismatches = [];
    if (plan.refAdded !== missingRef) {
      mismatches.push(`booking_ref: plan would write ${plan.refAdded}, but ${missingRef} are missing`);
    }
    if (plan.statusAdded !== missingStatus) {
      mismatches.push(`booking_status: plan would write ${plan.statusAdded}, but ${missingStatus} are missing`);
    }
    if (plan.sourceAdded !== missingSource) {
      mismatches.push(`source: plan would write ${plan.sourceAdded}, but ${missingSource} are missing`);
    }

    if (mismatches.length > 0) {
      log('\n   ❌ PLAN/REALITY MISMATCH — this migration would not do what it reports:');
      for (const m of mismatches) log(`      • ${m}`);
      log('      Do NOT run without --dry-run until this is resolved.');
      return false;
    }
    log('\n   ✅ plan matches the raw document counts');
  }

  // aggregate() reads raw MongoDB, so during a dry run booking_status is
  // genuinely absent and would print as "undefined" — accurate but alarming on
  // the very screen used to decide whether to proceed. Show the PROJECTED
  // mapping instead, and the actual one after a real run.
  if (DRY_RUN) {
    const byLegacy = await Booking.aggregate([
      { $group: { _id: '$status', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]);
    log('\n   status mapping that WOULD be applied:');
    for (const row of byLegacy) {
      const legacy = row._id;
      const mapped = STATUS_MAP[legacy] || STATUS_MAP.pending;
      const fallback = STATUS_MAP[legacy] ? '' : '  ⚠️ unrecognised — treated as pending';
      log(`     ${String(legacy).padEnd(14)} → ${mapped.booking_status.padEnd(11)} / ` +
          `${mapped.payment_status.padEnd(16)} (${row.n})${fallback}`);
    }
  } else {
    const byStatus = await Booking.aggregate([
      { $group: { _id: { legacy: '$status', bs: '$booking_status', ps: '$payment_status' }, n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]);
    log('\n   status mapping as stored:');
    for (const row of byStatus) {
      const { legacy, bs, ps } = row._id;
      log(`     ${String(legacy).padEnd(14)} → ${String(bs).padEnd(11)} / ${String(ps).padEnd(16)} (${row.n})`);
    }
  }

  if (!DRY_RUN && (missingRef > 0 || missingStatus > 0)) {
    log('\n   ⚠️  Some documents were not migrated. Investigate before proceeding to M3.');
    return false;
  }
  return true;
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not set'); process.exit(1);
  }

  log('\n╔═══════════════════════════════════════════════════════════════╗');
  log(`║  002_payment_foundation${DRY_RUN ? '  [DRY RUN — no writes]' : '  [APPLYING CHANGES]'}`.padEnd(64) + '║');
  log('╚═══════════════════════════════════════════════════════════════╝');

  await mongoose.connect(process.env.MONGO_URI);
  log('🔗 Connected to MongoDB');

  try {
    const plan = await backfillBookings();
    await backfillClientSlugs();
    await dropLegacyUniqueIndexes();
    await seedGatewayCredential();
    const ok = await verify(plan);

    log(DRY_RUN
      ? '\n✅ Dry run complete — nothing was written. Re-run without --dry-run to apply.'
      : (ok ? '\n✅ Migration complete.' : '\n⚠️  Migration completed with warnings — see above.'));

    await mongoose.disconnect();
    process.exit(ok || DRY_RUN ? 0 : 1);
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
