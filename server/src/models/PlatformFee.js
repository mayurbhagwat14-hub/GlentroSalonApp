const mongoose = require('mongoose');

const platformFeeSchema = new mongoose.Schema(
  {
    feeType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED'],
      default: 'PERCENTAGE',
    },
    feePercentage: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
      max: 100,
    },
    // Used when feeType is 'FIXED' (in INR, e.g. ₹30)
    feeAmount: {
      type: Number,
      default: 30,
      min: 0,
    },
    // ─── Service GST Configuration ──────────────────────────────────────────────
    gstEnabled: {
      type: Boolean,
      default: false,
    },
    gstType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED'],
      default: 'PERCENTAGE',
    },
    gstPercentage: {
      type: Number,
      default: 18,
      min: 0,
      max: 100,
    },
    gstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ─── Online Payment Cashback ──────────────────────────────────────────────
    onlineCashbackEnabled: {
      type: Boolean,
      default: false,
    },
    cashbackType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED'],
      default: 'FIXED',
    },
    cashbackPercentage: {
      type: Number,
      default: 5,
      min: 0,
      max: 100,
    },
    // Used when cashbackType is 'FIXED' (in INR, e.g. ₹20)
    cashbackAmount: {
      type: Number,
      default: 20,
      min: 0,
    },
    adminCommissionPercentage: {
      type: Number,
      required: true,
      default: 10,
      min: 0,
      max: 100,
    },
    cancellationFeePercentage: {
      type: Number,
      required: true,
      default: 25,
      min: 0,
      max: 100,
    },

    // ─── Call Policy ───────────────────────────────────────────────────────────
    // Admin controls whether in-app calling is enabled at all
    callEnabled: {
      type: Boolean,
      default: true,
    },
    // How many minutes before the appointment can a call be made.
    // 0 = no restriction (available anytime on booking day).
    // e.g. 60 = can only call until 60 mins before appointment.
    callWindowMinutes: {
      type: Number,
      default: 60,
      min: 0,
    },

    // ─── Cancellation Policy ───────────────────────────────────────────────────
    // Whether a cancellation fee is charged at all
    cancellationChargeEnabled: {
      type: Boolean,
      default: true,
    },
    // How many minutes before the appointment is cancellation free.
    // e.g. 60 = cancel more than 60 mins before → no charge
    freeCancellationWindowMinutes: {
      type: Number,
      default: 60,
      min: 0,
    },
    // 'PERCENTAGE' uses cancellationFeePercentage field above
    // 'FIXED' uses cancellationFixedAmount field below
    cancellationChargeType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED'],
      default: 'PERCENTAGE',
    },
    // Used only when cancellationChargeType = 'FIXED' (in INR)
    cancellationFixedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PlatformFee', platformFeeSchema);
