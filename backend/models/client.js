const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  code: {
    type: String,
    required: true,
    unique: true
  },
  // URL-safe public identifier, e.g. "zonova-mist".
  //
  // Public booking routes are /api/v1/public/:tenantSlug/... and carry no JWT,
  // so the tenant has to come from the URL. `code` is unsuitable — it is
  // generated as CLIENT_<timestamp> and is neither readable nor stable-looking
  // in a public URL.
  //
  // sparse so existing Clients without one remain valid until backfilled.
  slug: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase alphanumeric with single hyphens'],
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

clientSchema.index({ isActive: 1 });

module.exports = mongoose.model('Client', clientSchema);