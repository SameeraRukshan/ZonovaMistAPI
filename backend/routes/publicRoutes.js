// backend/routes/publicRoutes.js
//
// Guest-facing routes. NO authMiddleware anywhere in this file — that is the
// point of it, and it is also why every route here is rate-limited and
// body-size capped.
//
// Mounted at /api/v1/public in server.js.

const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const { tenantResolver, requirePublicBookingEnabled } = require('../middleware/tenantResolver');
const { idempotency } = require('../middleware/idempotency');
const controller = require('../controllers/publicBookingController');

// 10kb is generous for a booking payload and far below the 50mb global limit,
// which exists only for the authenticated image/audio upload routes.
const jsonBody = express.json({ limit: '10kb' });

// Limits are env-overridable so integration tests can exercise these real code
// paths without the shared 127.0.0.1 bucket starving every test after the
// tenth. Defaults are the production values — an unset or malformed env var
// always collapses to the strict setting, never to unlimited. See
// helpers/rateLimitConfig.js, which is unit-tested for exactly that.
const { limitFromEnv } = require('../helpers/rateLimitConfig');

const rateLimited = (message) => ({ success: false, error: { code: 'RATE_LIMITED', message } });

// Read endpoints: generous, but enough to blunt scraping.
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: limitFromEnv('PUBLIC_READ_RATE_LIMIT', 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimited('Too many requests. Please slow down.'),
});

// Writes are much tighter. Each one can hold a room, so an unthrottled caller
// could deny availability across the whole property with a short script.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: limitFromEnv('PUBLIC_WRITE_RATE_LIMIT', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimited('Too many booking attempts. Please try again later.'),
});

// Status polling: the payment return page polls every ~2s for up to ~30s, so
// this has to tolerate a burst that would look abusive anywhere else.
const statusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: limitFromEnv('PUBLIC_STATUS_RATE_LIMIT', 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimited('Too many requests. Please slow down.'),
});

// --- Booking status -------------------------------------------------------
// Declared BEFORE the /:tenantSlug routes: Express matches in order, and
// "bookings" would otherwise be captured as a tenant slug.
router.get('/bookings/:ref/status', statusLimiter, controller.getBookingStatus);

// --- Tenant-scoped ---------------------------------------------------------
router.get('/:tenantSlug/property', readLimiter, tenantResolver, controller.getProperty);

router.get('/:tenantSlug/availability', readLimiter, tenantResolver,
  requirePublicBookingEnabled, controller.getAvailability);

router.post('/:tenantSlug/bookings',
  writeLimiter,
  jsonBody,
  tenantResolver,
  requirePublicBookingEnabled,
  idempotency(),            // must run after the body is parsed — it hashes it
  controller.createBooking);

module.exports = router;
