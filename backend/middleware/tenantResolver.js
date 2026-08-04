// backend/middleware/tenantResolver.js
//
// Resolves the tenant for PUBLIC routes, which carry no JWT.
//
// Everywhere else in this codebase `req.tenantFilter` comes from the token
// (authMiddleware). Guests are not logged in, so the tenant has to come from
// the URL instead: /api/v1/public/:tenantSlug/...
//
// It deliberately produces the SAME shape as authMiddleware — req.tenantFilter
// = { clientId } — so every existing query pattern (`{ ...req.tenantFilter }`)
// keeps working unchanged whether the caller is a guest or an admin.
//
// This is the seam the SaaS build needs. When tenants get custom domains, host
// resolution slots in here and nothing downstream changes.

const Client = require('../models/client');
const Settings = require('../models/settings');

// Small in-process cache. Public endpoints are the ones exposed to bots and
// scrapers, and re-reading an essentially static Client row on every request is
// wasted work. Short TTL so deactivating a tenant takes effect promptly.
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();   // slug -> { value, expiresAt }

function cacheGet(slug) {
  const hit = cache.get(slug);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) { cache.delete(slug); return null; }
  return hit.value;
}

function cacheSet(slug, value) {
  cache.set(slug, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Test/admin hook — drop cached tenants (e.g. after changing a slug). */
function clearTenantCache() { cache.clear(); }

/**
 * Express middleware. Expects `:tenantSlug` in the route path.
 *
 * On success sets:
 *   req.tenant        the Client document
 *   req.tenantSettings the tenant's Settings (may be null if never configured)
 *   req.tenantFilter  { clientId } — same shape authMiddleware produces
 */
async function tenantResolver(req, res, next) {
  const slug = String(req.params.tenantSlug || '').toLowerCase().trim();

  if (!slug) {
    return res.status(404).json({ success: false, error: { code: 'TENANT_NOT_FOUND', message: 'Property not found' } });
  }

  try {
    let resolved = cacheGet(slug);

    if (!resolved) {
      const client = await Client.findOne({ slug, isActive: true }).lean();

      // Same response for "no such tenant" and "tenant deactivated": a public
      // endpoint should not let a stranger enumerate which properties exist.
      if (!client) {
        return res.status(404).json({
          success: false,
          error: { code: 'TENANT_NOT_FOUND', message: 'Property not found' },
        });
      }

      const settings = await Settings.findOne({ clientId: client._id }).lean();
      resolved = { client, settings };
      cacheSet(slug, resolved);
    }

    req.tenant = resolved.client;
    req.tenantSettings = resolved.settings;
    req.tenantFilter = { clientId: resolved.client._id };
    return next();
  } catch (err) {
    console.error('[TENANT] ❌ resolution failed:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Could not load property' },
    });
  }
}

/**
 * Gate that refuses public booking traffic unless the tenant has switched it on.
 *
 * Mount AFTER tenantResolver on anything that creates or prices a booking.
 * Defaults to closed, so shipping this code does not by itself open a public
 * booking channel on a live property.
 */
function requirePublicBookingEnabled(req, res, next) {
  if (!req.tenantSettings || req.tenantSettings.publicBookingEnabled !== true) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'PUBLIC_BOOKING_DISABLED',
        message: 'Online booking is not available for this property yet.',
      },
    });
  }
  return next();
}

module.exports = { tenantResolver, requirePublicBookingEnabled, clearTenantCache };
