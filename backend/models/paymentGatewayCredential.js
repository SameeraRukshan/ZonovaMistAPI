// backend/models/paymentGatewayCredential.js
//
// Per-tenant gateway credentials. The seam that makes the SaaS story work.
//
// PayHere confirmed (2026-07-31) that different business models cannot share a
// merchant account. In a multi-tenant future each guest house will therefore
// likely need its OWN PayHere merchant account — so credentials must be a
// per-tenant lookup, never a global env var. Building it this way now costs
// nothing and avoids a rewrite later.
//
// For launch there will be exactly one row, seeded from environment variables
// by the migration. The lookup path is identical for one tenant and a thousand.
//
// Secrets are stored AES-256-GCM encrypted (helpers/secretCrypto.js) and are
// never returned by any API. See the toJSON override at the bottom.

const mongoose = require('mongoose');
const { encryptSecret, decryptSecret } = require('../helpers/secretCrypto');

const paymentGatewayCredentialSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true,
  },

  gateway: { type: String, default: 'PAYHERE' },

  // The APPROVED MAIN DOMAIN this credential belongs to.
  //
  // PayHere only whitelists main domains — subdomains cannot be registered at
  // all — so this is always an apex domain (e.g. "zonovamist.lk"), never
  // "mist.zonova.lk". The Merchant Secret is issued per approved domain, which
  // is why it is stored alongside rather than on the Client.
  domain: { type: String, required: true },

  merchant_id: { type: String, required: true },
  merchant_secret_encrypted: { type: String, required: true },

  // Business App credentials for the Retrieval and Refund APIs.
  app_id_encrypted: { type: String, default: null },
  app_secret_encrypted: { type: String, default: null },

  mode: {
    type: String,
    enum: ['SANDBOX', 'LIVE'],
    default: 'SANDBOX',
    required: true,
  },

  is_active: { type: Boolean, default: true },
  notes: { type: String, default: null },
}, { timestamps: true });

// One active credential per tenant + gateway + mode.
paymentGatewayCredentialSchema.index(
  { clientId: 1, gateway: 1, mode: 1 },
  { unique: true },
);

// --- Setters: always encrypt on the way in -------------------------------

paymentGatewayCredentialSchema.methods.setMerchantSecret = function (plain) {
  this.merchant_secret_encrypted = encryptSecret(plain);
};
paymentGatewayCredentialSchema.methods.setAppId = function (plain) {
  this.app_id_encrypted = plain ? encryptSecret(plain) : null;
};
paymentGatewayCredentialSchema.methods.setAppSecret = function (plain) {
  this.app_secret_encrypted = plain ? encryptSecret(plain) : null;
};

// --- Getters: decrypt on demand, never eagerly ---------------------------

paymentGatewayCredentialSchema.methods.getMerchantSecret = function () {
  return decryptSecret(this.merchant_secret_encrypted);
};
paymentGatewayCredentialSchema.methods.getAppId = function () {
  return this.app_id_encrypted ? decryptSecret(this.app_id_encrypted) : null;
};
paymentGatewayCredentialSchema.methods.getAppSecret = function () {
  return this.app_secret_encrypted ? decryptSecret(this.app_secret_encrypted) : null;
};

// Belt and braces: even if one of these documents is accidentally passed to
// res.json(), the ciphertext must not leave the server.
paymentGatewayCredentialSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.merchant_secret_encrypted;
    delete ret.app_id_encrypted;
    delete ret.app_secret_encrypted;
    return ret;
  },
});
paymentGatewayCredentialSchema.set('toObject', {
  transform: (_doc, ret) => {
    delete ret.merchant_secret_encrypted;
    delete ret.app_id_encrypted;
    delete ret.app_secret_encrypted;
    return ret;
  },
});

module.exports = mongoose.model(
  'PaymentGatewayCredential',
  paymentGatewayCredentialSchema,
);
