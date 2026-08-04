// backend/middleware/idempotency.js
//
// Makes a mutating public endpoint safe to retry.
//
// The client sends `Idempotency-Key: <uuid>`. The first request does the work
// and its response is stored; any repeat with the same key replays that stored
// response instead of doing the work again.
//
// The ordering matters: the key row is inserted BEFORE the handler runs, with a
// unique index on it. A simultaneous duplicate therefore fails to insert and is
// told to retry, rather than both requests sailing past a "have we seen this?"
// check and creating two bookings.

const crypto = require('crypto');
const IdempotencyKey = require('../models/idempotencyKey');

const MAX_KEY_LENGTH = 200;

function hashBody(body) {
  // Key order is normalised so two semantically identical payloads that differ
  // only in property order are not treated as different requests.
  const normalise = (v) => {
    if (Array.isArray(v)) return v.map(normalise);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort().reduce((acc, k) => { acc[k] = normalise(v[k]); return acc; }, {});
    }
    return v;
  };
  return crypto.createHash('sha256')
    .update(JSON.stringify(normalise(body ?? {})))
    .digest('hex');
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.required=true] reject requests with no key
 */
function idempotency(opts = {}) {
  const required = opts.required !== false;

  return async function idempotencyMiddleware(req, res, next) {
    const key = req.header('Idempotency-Key');

    if (!key) {
      if (!required) return next();
      return res.status(400).json({
        success: false,
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'An Idempotency-Key header is required for this request.',
        },
      });
    }

    if (key.length > MAX_KEY_LENGTH) {
      return res.status(400).json({
        success: false,
        error: { code: 'IDEMPOTENCY_KEY_INVALID', message: 'Idempotency-Key is too long.' },
      });
    }

    const requestHash = hashBody(req.body);
    const scopedKey = `${req.method}:${req.baseUrl}${req.path}:${key}`;

    try {
      // Insert-first. The unique index is what makes this race-safe.
      await IdempotencyKey.create({
        key: scopedKey,
        method: req.method,
        path: `${req.baseUrl}${req.path}`,
        request_hash: requestHash,
        status: 'IN_PROGRESS',
      });
    } catch (err) {
      if (err.code !== 11000) throw err;

      const existing = await IdempotencyKey.findOne({ key: scopedKey }).lean();

      // Lost a race with a concurrent identical request that has not finished.
      // 409 rather than a replay: we do not yet know what the outcome was, and
      // inventing one would be worse than asking the client to retry.
      if (!existing || existing.status === 'IN_PROGRESS') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'REQUEST_IN_PROGRESS',
            message: 'An identical request is already being processed. Retry shortly.',
          },
        });
      }

      // Same key, different payload — a client-side bug. Replaying the first
      // response would silently discard the second request, so surface it.
      if (existing.request_hash !== requestHash) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'This Idempotency-Key was already used with a different request body.',
          },
        });
      }

      res.set('Idempotent-Replay', 'true');
      return res.status(existing.response_status || 200).json(existing.response_body);
    }

    // Capture the response so it can be replayed later.
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const finish = res.statusCode >= 200 && res.statusCode < 300
        ? IdempotencyKey.updateOne(
            { key: scopedKey },
            { $set: { status: 'COMPLETED', response_status: res.statusCode, response_body: body } },
          )
        // Failures are NOT recorded as completed — the key is released so the
        // guest can correct the problem and try again with the same key.
        : IdempotencyKey.deleteOne({ key: scopedKey });

      finish.catch((e) => console.error('[IDEMPOTENCY] bookkeeping failed:', e.message));
      return originalJson(body);
    };

    return next();
  };
}

module.exports = { idempotency, hashBody };
