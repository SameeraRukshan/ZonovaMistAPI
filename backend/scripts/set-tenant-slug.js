// backend/scripts/set-tenant-slug.js
//
// Sets a Client's public URL slug, and optionally switches public booking on.
//
// The migration derives slugs from the client NAME, which produces things like
// "zonova-mist-s-organization" from "Zonova Mist's Organization". That is fine
// as a safe default but poor as a public URL, and the slug appears in every
// guest-facing request:
//
//     https://api.zonova.lk/api/v1/public/<slug>/availability
//
// So the real property's slug should be chosen deliberately.
//
// USAGE
//   List every tenant and its current slug:
//     node scripts/set-tenant-slug.js --list
//
//   Set a slug (match on a substring of the client name):
//     node scripts/set-tenant-slug.js --name "Zonova Mist" --slug zonova-mist
//
//   Set it and enable public booking in one go:
//     node scripts/set-tenant-slug.js --name "Zonova Mist" --slug zonova-mist --enable-booking
//
// Add --dry-run to preview without writing.

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Client = require('../models/client');
const Settings = require('../models/settings');
const Room = require('../models/room');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};

const DRY = flag('dry-run');

async function list() {
  const clients = await Client.find({}).select('name slug isActive').sort({ createdAt: 1 }).lean();
  const settings = await Settings.find({}).select('clientId publicBookingEnabled').lean();
  const enabled = new Map(settings.map((s) => [String(s.clientId), s.publicBookingEnabled]));

  console.log(`\n${'name'.padEnd(38)} ${'slug'.padEnd(34)} active  booking`);
  console.log('─'.repeat(92));
  for (const c of clients) {
    console.log(
      `${String(c.name).slice(0, 37).padEnd(38)} ${String(c.slug || '—').padEnd(34)} `
      + `${c.isActive ? 'yes' : 'no '}     ${enabled.get(String(c._id)) ? 'ON' : 'off'}`,
    );
  }
  console.log(`\n${clients.length} tenants\n`);
}

async function setSlug() {
  const nameQuery = value('name');
  const slug = value('slug');

  if (!nameQuery || !slug) {
    console.error('❌ Both --name and --slug are required. See --list.');
    process.exit(1);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    console.error(`❌ "${slug}" is not a valid slug — lowercase letters, digits and single hyphens only.`);
    process.exit(1);
  }

  const matches = await Client.find({ name: new RegExp(escapeRegex(nameQuery), 'i') })
    .select('name slug').lean();

  if (matches.length === 0) { console.error(`❌ No tenant matching "${nameQuery}".`); process.exit(1); }
  if (matches.length > 1) {
    console.error(`❌ "${nameQuery}" matches ${matches.length} tenants — be more specific:`);
    for (const m of matches) console.error(`   • ${m.name}`);
    process.exit(1);
  }

  const client = matches[0];

  const clash = await Client.findOne({ slug, _id: { $ne: client._id } }).select('name').lean();
  if (clash) { console.error(`❌ Slug "${slug}" is already used by "${clash.name}".`); process.exit(1); }

  console.log(`\nTenant : ${client.name}`);
  console.log(`Slug   : ${client.slug || '(none)'} → ${slug}`);

  if (flag('enable-booking')) {
    // Rooms without a rate are silently hidden from availability, so surface
    // that here rather than letting it look like "no rooms available".
    const unpriced = await Room.countDocuments({
      clientId: client._id,
      $or: [{ pricePerNight: null }, { pricePerNight: 0 }, { pricePerNight: { $exists: false } }],
    });
    const total = await Room.countDocuments({ clientId: client._id });
    console.log(`Rooms  : ${total} total, ${unpriced} without a nightly rate`);
    if (unpriced > 0) {
      console.log(`         ⚠️  those ${unpriced} will NOT appear in public availability`);
    }
    console.log('Booking: off → ON');
  }

  if (DRY) { console.log('\n[dry-run] nothing written.\n'); return; }

  await Client.updateOne({ _id: client._id }, { $set: { slug } });
  console.log('\n✅ slug set');

  if (flag('enable-booking')) {
    const res = await Settings.updateOne(
      { clientId: client._id },
      { $set: { publicBookingEnabled: true } },
    );
    if (res.matchedCount === 0) {
      console.log('⚠️  No Settings document for this tenant — save Settings once from the admin app,');
      console.log('    then re-run with --enable-booking.');
    } else {
      console.log('✅ public booking ENABLED');
    }
  }

  console.log(`\nPublic endpoints are now at:`);
  console.log(`  GET  /api/v1/public/${slug}/property`);
  console.log(`  GET  /api/v1/public/${slug}/availability?checkin=…&checkout=…`);
  console.log(`  POST /api/v1/public/${slug}/bookings\n`);
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function main() {
  if (!process.env.MONGO_URI) { console.error('❌ MONGO_URI is not set'); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  try {
    if (flag('list')) await list();
    else await setSlug();
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
