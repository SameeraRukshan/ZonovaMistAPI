// backend/helpers/secretCrypto.js
//
// AES-256-GCM encryption for gateway credentials at rest (PayHere Merchant
// Secret, Business App secret).
//
// Threat model: this protects secrets from anyone who obtains a copy of the
// database — a leaked backup, an Atlas snapshot shared with a contractor, a
// read-only analytics connection. It does NOT protect against an attacker who
// already has the running server's environment, because the key lives there.
// That is the accepted trade-off; the alternative (a KMS/HSM) is not
// proportionate at this scale.
//
// GCM is chosen over CBC because it is authenticated: tampering with the stored
// ciphertext produces a decryption error rather than silently yielding
// different plaintext.
//
// Key: CREDENTIAL_ENCRYPTION_KEY, 32 bytes, provided as 64 hex chars or base64.
// Generate one with:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit nonce, the size GCM is specified for
const KEY_BYTES = 32;

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;

  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY is not set. Generate one with:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  let key;
  if (/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    key = Buffer.from(raw.trim(), 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
  }

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `CREDENTIAL_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}. ` +
      'Expected 64 hex characters or 44 base64 characters.'
    );
  }

  cachedKey = key;
  return key;
}

/**
 * Encrypt a secret for storage.
 *
 * Output format is `v1:<iv>:<authTag>:<ciphertext>`, all base64. The version
 * prefix exists so the key can be rotated later without guessing at the format
 * of existing rows.
 *
 * @param {string} plaintext
 * @returns {string} storable ciphertext
 */
function encryptSecret(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new TypeError('encryptSecret: expected a non-empty string');
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a secret produced by encryptSecret.
 *
 * Throws if the ciphertext has been tampered with — GCM authentication failure
 * is a hard error, never a silent fallback.
 *
 * @param {string} stored
 * @returns {string} plaintext
 */
function decryptSecret(stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) {
    throw new TypeError('decryptSecret: malformed ciphertext');
  }

  const [version, ivB64, tagB64, dataB64] = stored.split(':');
  if (version !== 'v1') {
    throw new Error(`decryptSecret: unsupported ciphertext version "${version}"`);
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Test hook — clears the memoised key so a changed env var takes effect. */
function _resetKeyCache() {
  cachedKey = null;
}

module.exports = { encryptSecret, decryptSecret, _resetKeyCache };
