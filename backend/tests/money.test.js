// tests/money.test.js
//
// ⭐ One of the three tests the work plan marks "do not ship without".
//
// A bug here does not look like a bug. It looks like PayHere rejecting a
// perfectly good payment with an opaque signature error, at 2am, with a real
// guest's money in limbo. Hence the paranoid coverage of rounding edges.

const { toCents, fromCents, formatForPayHere, amountMatches } = require('../helpers/money');

describe('toCents', () => {
  test.each([
    [0, 0],
    [1, 100],
    [1000, 100000],
    [4500.5, 450050],
    [999.5, 99950],
    [0.01, 1],
    [0.1, 10],
    ['4500.50', 450050],
    ['0', 0],
  ])('toCents(%p) === %p', (input, expected) => {
    expect(toCents(input)).toBe(expected);
  });

  test('handles binary floating point drift: 0.1 + 0.2', () => {
    // 0.1 + 0.2 === 0.30000000000000004
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  test('rounds half away from zero, not toward -Infinity', () => {
    // The classic trap: 1.005 * 100 === 100.49999999999999 in IEEE-754, so a
    // naive Math.round(n * 100) yields 100 here instead of 101.
    expect(toCents(1.005)).toBe(101);
    expect(toCents(-1.005)).toBe(-101);
  });

  test('accumulated float error does not leak into cents', () => {
    let sum = 0;
    for (let i = 0; i < 10; i += 1) sum += 0.1;   // 0.9999999999999999
    expect(toCents(sum)).toBe(100);
  });

  test('empty-ish values are zero, not NaN', () => {
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(toCents('')).toBe(0);
  });

  test('rejects non-numeric input rather than silently producing NaN', () => {
    expect(() => toCents('abc')).toThrow(TypeError);
    expect(() => toCents(Infinity)).toThrow(TypeError);
    expect(() => toCents(NaN)).toThrow(TypeError);
  });

  test('rejects amounts beyond safe integer range', () => {
    expect(() => toCents(1e17)).toThrow(RangeError);
  });
});

describe('formatForPayHere', () => {
  test.each([
    [100000, '1000.00'],
    [99950, '999.50'],
    [30, '0.30'],
    [0, '0.00'],
    [1, '0.01'],
    [450050, '4500.50'],
    [100, '1.00'],
  ])('formatForPayHere(%p) === %p', (cents, expected) => {
    expect(formatForPayHere(cents)).toBe(expected);
  });

  test('the work plan acceptance cases', () => {
    expect(formatForPayHere(toCents(1000))).toBe('1000.00');
    expect(formatForPayHere(toCents(999.5))).toBe('999.50');
    expect(formatForPayHere(toCents(0.1 + 0.2))).toBe('0.30');
  });

  test('never emits thousands separators', () => {
    // PayHere hashes this string; a comma would silently break the signature.
    expect(formatForPayHere(toCents(1234567.89))).toBe('1234567.89');
    expect(formatForPayHere(toCents(1234567.89))).not.toContain(',');
  });

  test('always emits exactly two decimal places', () => {
    for (const cents of [0, 1, 10, 100, 105, 1000, 123456]) {
      expect(formatForPayHere(cents)).toMatch(/^-?\d+\.\d{2}$/);
    }
  });

  test('rejects rupees passed where cents were expected', () => {
    // The likeliest caller mistake, and one that would otherwise produce a
    // plausible-looking but 100x-wrong amount.
    expect(() => formatForPayHere(999.5)).toThrow(TypeError);
  });
});

describe('fromCents', () => {
  test.each([
    [100000, 1000],
    [99950, 999.5],
    [30, 0.3],
    [0, 0],
  ])('fromCents(%p) === %p', (cents, expected) => {
    expect(fromCents(cents)).toBe(expected);
  });

  test('round-trips with toCents', () => {
    for (const amount of [0, 1, 999.5, 4500.5, 1234567.89, 0.01]) {
      expect(fromCents(toCents(amount))).toBe(amount);
    }
  });
});

describe('amountMatches', () => {
  test('accepts equivalent representations from the gateway', () => {
    // PayHere sends payhere_amount as a decimal string; these are all the same
    // amount and all must verify.
    expect(amountMatches('1000.00', 100000)).toBe(true);
    expect(amountMatches('1000.0', 100000)).toBe(true);
    expect(amountMatches('1000', 100000)).toBe(true);
    expect(amountMatches(1000, 100000)).toBe(true);
  });

  test('rejects a mismatched amount', () => {
    // The attack this guards: a valid signature over a tampered amount.
    expect(amountMatches('999.99', 100000)).toBe(false);
    expect(amountMatches('10000.00', 100000)).toBe(false);
    expect(amountMatches('0.00', 100000)).toBe(false);
  });

  test('returns false rather than throwing on garbage input', () => {
    // Called from the IPN handler on untrusted input — must never throw.
    expect(amountMatches('not-a-number', 100000)).toBe(false);
    expect(amountMatches(null, 100000)).toBe(false);
    expect(amountMatches(undefined, 100000)).toBe(false);
  });
});
