// backend/helpers/rateLimitConfig.js
//
// Reads a rate limit from the environment, falling back to a production default.
//
// Extracted into its own module for one reason: the fallback behaviour is
// security-relevant and must be directly testable. A missing, empty, zero,
// negative or non-numeric env var must ALWAYS collapse to the strict default —
// never to "unlimited". A typo in a deploy config should tighten the limit or
// leave it unchanged, never silently remove it.

/**
 * @param {string} name  env var name, e.g. 'PUBLIC_WRITE_RATE_LIMIT'
 * @param {number} fallback the production default
 * @returns {number} a positive integer
 */
function limitFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;

  const n = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

module.exports = { limitFromEnv };
