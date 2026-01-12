const mongoose = require('mongoose');
const { Schema } = mongoose;

const staffSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  profile_picture: { 
    type: String, 
    required: false,
    default: null
  },
  birthday: { 
    type: Date, 
    required: false,
    default: null
  },
  email: { 
    type: String, 
    required: false,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        // Only validate if email is provided
        if (!v) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  phone: { 
    type: String, 
    required: false,
    trim: true
  },
  joined_date: { 
    type: Date, 
    required: false,
    default: null
  },
  current_salary: { 
    type: Schema.Types.Decimal128, 
    required: false,
    default: null
  },
  role: { 
    type: String, 
    required: true,
    enum: ['Admin', 'Owner', 'Manager', 'Technician', 'Reception', 'Cleaning'],
    default: 'Reception'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_leave'],
    default: 'active'
  },
  // Optional fields for future use
  emergency_contact: {
    name: { type: String, required: false },
    phone: { type: String, required: false },
    relationship: { type: String, required: false }
  },
  notes: { 
    type: String, 
    required: false,
    default: ''
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name formatting (if needed in future)
staffSchema.virtual('displayName').get(function() {
  return this.name;
});

// Index for faster queries
staffSchema.index({ name: 1 });
staffSchema.index({ role: 1 });
staffSchema.index({ status: 1 });
staffSchema.index({ email: 1 }, { sparse: true, unique: true });

// Pre-save middleware to format phone numbers (optional)
staffSchema.pre('save', function(next) {
  if (this.phone) {
    // Remove any non-digit characters
    this.phone = this.phone.replace(/\D/g, '');
  }
  next();
});

module.exports = mongoose.model('Staff', staffSchema);