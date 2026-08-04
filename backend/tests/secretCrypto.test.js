// tests/secretCrypto.test.js
//
// Credential encryption at rest. The property that matters most is not that
// decrypt(encrypt(x)) === x — it is that TAMPERED ciphertext fails loudly
// rather than decrypting to something else.

const crypto = require('crypto');
const { encryptSecret, decryptSecret, _resetKeyCache } = require('../helpers/secretCrypto');

const TEST_KEY = crypto.randomBytes(32).toString('hex');

beforeEach(() => {
  process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
  _resetKeyCache();
});

describe('round trip', () => {
  test('decrypts back to the original', () => {
    const secret = 'MzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  test('handles a realistic PayHere merchant secret', () => {
    const secret = '4OSjIHRVCJmHiwsuNC7SxFEyk0F3TfKmRLQ8YHqvzGGe';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  test('handles unicode and long values', () => {
    for (const s of ['ਸ਼ੁਭ 🎉 secret', 'x'.repeat(4096)]) {
      expect(decryptSecret(encryptSecret(s))).toBe(s);
    }
  });
});

describe('ciphertext properties', () => {
  test('the same plaintext encrypts differently every time', () => {
    // A fresh IV per encryption. Without this, identical secrets across tenants
    // would be visibly identical in a database dump.
    const a = encryptSecret('same-secret');
    const b = encryptSecret('same-secret');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  test('plaintext does not appear in the ciphertext', () => {
    expect(encryptSecret('SUPERSECRET123')).not.toContain('SUPERSECRET123');
  });

  test('is versioned so the format can change later', () => {
    expect(encryptSecret('x').startsWith('v1:')).toBe(true);
  });
});

describe('tamper detection', () => {
  test('a modified ciphertext body fails, it does not decrypt to something else', () => {
    const stored = encryptSecret('original-secret');
    const [v, iv, tag, data] = stored.split(':');

    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 0xff;

    expect(() => decryptSecret([v, iv, tag, flipped.toString('base64')].join(':')))
      .toThrow();
  });

  test('a modified auth tag fails', () => {
    const stored = encryptSecret('original-secret');
    const [v, iv, , data] = stored.split(':');
    const forgedTag = crypto.randomBytes(16).toString('base64');
    expect(() => decryptSecret([v, iv, forgedTag, data].join(':'))).toThrow();
  });

  test('decrypting with the wrong key fails', () => {
    const stored = encryptSecret('original-secret');
    process.env.CREDENTIAL_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    _resetKeyCache();
    expect(() => decryptSecret(stored)).toThrow();
  });

  test('an unknown version is rejected', () => {
    const stored = encryptSecret('x').replace(/^v1:/, 'v99:');
    expect(() => decryptSecret(stored)).toThrow(/unsupported ciphertext version/);
  });

  test('malformed input is rejected', () => {
    expect(() => decryptSecret('garbage')).toThrow(TypeError);
    expect(() => decryptSecret('')).toThrow(TypeError);
    expect(() => decryptSecret(null)).toThrow(TypeError);
  });
});

describe('key configuration', () => {
  test('a missing key gives an actionable error', () => {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    _resetKeyCache();
    expect(() => encryptSecret('x')).toThrow(/CREDENTIAL_ENCRYPTION_KEY is not set/);
  });

  test('a wrong-length key is rejected rather than silently padded', () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'abcd1234';
    _resetKeyCache();
    expect(() => encryptSecret('x')).toThrow(/must decode to 32 bytes/);
  });

  test('accepts a base64 key as well as hex', () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    _resetKeyCache();
    expect(decryptSecret(encryptSecret('works'))).toBe('works');
  });
});
