const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    role: {
      type: String,
      default: 'vendor',
      immutable: true,
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
    },
    avatar: {
      type: String,
      default: '',
    },

    // ─── Business Details ───────────────────────────────────────────────
    businessType: {
      type: String,
      enum: ['individual', 'partnership', 'pvt_ltd', 'llp', 'other', ''],
      default: '',
    },
    businessDescription: { type: String, default: '', trim: true },
    businessEmail: { type: String, default: '', lowercase: true, trim: true },
    businessContact: { type: String, default: '', trim: true },
    registeredAddress: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    country: { type: String, default: 'India', trim: true },

    // ─── KYC ────────────────────────────────────────────────────────────
    kyc: {
      aadhaarNumber: { type: String, default: '' },
      aadhaarFront: { type: String, default: '' },  // file path, NOT public URL
      aadhaarBack: { type: String, default: '' },
      panNumber: { type: String, default: '' },
      panCard: { type: String, default: '' },        // file path
    },
    kycStatus: {
      type: String,
      enum: ['pending', 'submitted', 'verified', 'rejected'],
      default: 'pending',
    },
    kycRejectReason: { type: String, default: '' },

    // ─── Bank / Payout ──────────────────────────────────────────────────
    bank: {
      accountHolderName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      bankName: { type: String, default: '' },
      bankBranch: { type: String, default: '' },
      upiId: { type: String, default: '' },
    },

    // ─── Account / Approval Status ──────────────────────────────────────
    isApproved: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    accountStatus: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    suspensionReasons: {
      type: [{ type: String, enum: ['CASH_LIMIT_EXCEEDED', 'KYC_PENDING', 'ADMIN_SUSPENDED', 'OTHER'] }],
      default: [],
    },

    // ==========================================
    // DEPRECATED: Old Subscription Field
    // Retained temporarily for backward compatibility / migration.
    // Use VendorSubscription model instead.
    // ==========================================
    subscriptionPlan: {
      plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription',
      },
      startDate: Date,
      endDate: Date,
      isActive: {
        type: Boolean,
        default: false,
      },
    },

    // ==========================================
    // NEW SUBSCRIPTION / TRIAL FIELDS
    // ==========================================
    trialUsed: {
      type: Boolean,
      default: false,
    },
    trialStartedAt: {
      type: Date,
    },
    trialEndsAt: {
      type: Date,
    },
    commissionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    fcmtoken: {
      type: [String],
      default: [],
    },
    fcmtokenmobile: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
vendorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
vendorSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if vendor has active subscription
vendorSchema.methods.hasActiveSubscription = function () {
  return (
    this.subscriptionPlan &&
    this.subscriptionPlan.isActive &&
    this.subscriptionPlan.endDate &&
    new Date(this.subscriptionPlan.endDate) > new Date()
  );
};

// Remove password and sensitive fields from JSON output
vendorSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  // Strip raw KYC/bank by default — use kycUtils for controlled access
  if (obj.kyc) {
    delete obj.kyc.aadhaarFront;
    delete obj.kyc.aadhaarBack;
    delete obj.kyc.panCard;
  }
  return obj;
};

module.exports = mongoose.model('Vendor', vendorSchema);
