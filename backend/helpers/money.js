// backend/helpers/money.js
//
// All monetary values that touch PayHere are stored and computed as INTEGER
// CENTS. Never as floating-point rupees.
//
// Why this matters more than it looks: PayHere hashes a two-decimal amount
// STRING into the checkout signature, and hashes it again into the `md5sig` it
// sends back on the IPN. If our amount string differs from theirs by a single
// character — "999.5" vs "999.50", or a float that has drifted to
// 4999.999999999999 — the signature will not match and the payment will be
// rejected with no useful error. Integer cents make that class of bug
// impossible by construction.
//
// Rule of thumb for the rest of the codebase:
//   - Store cents (Number, integer).
//   - Do arithmetic in cents.
//   - Convert to a display/gateway string only at the very edge.

/**
 * Convert a rupee amount to integer cents.
 *
 * Uses exponential-notation shifting rather than `Math.round(n * 100)`, because
 * the naive form mis-rounds values that cannot be represented exactly in binary
 * floating point. The classic failure is 1.005: `1.005 * 100` evaluates to
 * 100.49999999999999, so `Math.round` yields 100 instead of 101. Re-parsing
 * `"1.005e2"` gives exactly 100.5, which rounds correctly.
 *
 * Rounding is half-away-from-zero, so -1.005 → -101 rather than JavaScript's
 * default half-toward-positive-infinity (which would give -100).
 *
 * @param {number|string} amount rupees, e.g. 4500 or "4500.50"
 * @returns {number} integer cents, e.g. 450000
 */
function toCents(amount) {
  if (amount === null || amount === undefined || amount === '') return 0;

  const n = typeof amount === 'number' ? amount : Number(String(amount).trim());

  if (!Number.isFinite(n)) {
    throw new TypeError(`money.toCents: not a finite number: ${JSON.stringify(amount)}`);
  }

  const sign = n < 0 ? -1 : 1;
  // String-then-reparse avoids the binary representation error described above.
  const shifted = Number(`${Math.abs(n)}e2`);

  if (!Number.isFinite(shifted)) {
    throw new RangeError(`money.toCents: amount out of range: ${amount}`);
  }

  const cents = sign * Math.round(shifted);

  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`money.toCents: amount exceeds safe integer range: ${amount}`);
  }
  return cents;
}

/**
 * Convert integer cents back to a rupee Number.
 *
 * For DISPLAY and for writing the legacy float columns only. Never feed the
 * result back into arithmetic that will be hashed — use cents for that.
 *
 * @param {number} cents
 * @returns {number} rupees, e.g. 4500.5
 */
function fromCents(cents) {
  const c = assertCents(cents, 'fromCents');
  return Number(`${c}e-2`);
}

/**
 * Format integer cents as the exact string PayHere expects: a plain decimal
 * with exactly two places, no thousands separators, no currency symbol.
 *
 * Deliberately built by integer division rather than `toFixed(2)`, so no
 * floating-point value is ever involved and the output cannot drift.
 *
 * @param {number} cents
 * @returns {string} e.g. "1000.00", "999.50", "0.30"
 */
function formatForPayHere(cents) {
  const c = assertCents(cents, 'formatForPayHere');
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  const rupees = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}${rupees}.${String(remainder).padStart(2, '0')}`;
}

/**
 * Compare an amount reported by PayHere against what we recorded.
 *
 * PayHere sends `payhere_amount` as a decimal string. Comparing it as a string
 * is unsafe ("1000.00" vs "1000.0"), and comparing as floats reintroduces the
 * drift problem — so normalise both sides to integer cents.
 *
 * @param {string|number} gatewayAmount value of `payhere_amount`
 * @param {number} expectedCents what our Payment row says
 * @returns {boolean}
 */
function amountMatches(gatewayAmount, expectedCents) {
  try {
    return toCents(gatewayAmount) === assertCents(expectedCents, 'amountMatches');
  } catch {
    return false;
  }
}

function assertCents(cents, fnName) {
  if (!Number.isInteger(cents)) {
    throw new TypeError(
      `money.${fnName}: expected integer cents, got ${JSON.stringify(cents)}. ` +
      'Did you pass rupees by mistake?'
    );
  }
  return cents;
}

module.exports = { toCents, fromCents, formatForPayHere, amountMatches };
