const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    salon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Salon',
      required: true,
    },
    bookingDate: {
      type: Date,
      required: [true, 'Booking date is required'],
    },
    startTime: {
      type: String, // e.g., "14:00"
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: String, // calculated from services
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'EXPIRED', 'AUTO_SETTLED'],
      default: 'PENDING',
    },

    // ─── Service Price Totals ──────────────────────────────────────────────────
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmountPaise: {
      type: Number,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmountPaise: {
      type: Number,
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    finalAmountPaise: {
      type: Number,
    },
    pointsCalculationAmount: {
      type: Number,
      default: 0,
    },
    pointsEarned: {
      type: Number,
      default: 0,
    },

    // Glentro Wallet & Online Cashback
    walletAmountApplied: {
      type: Number,
      default: 0,
    },
    walletAmountAppliedPaise: {
      type: Number,
      default: 0,
    },
    cashbackEarned: {
      type: Number,
      default: 0,
    },
    cashbackEarnedPaise: {
      type: Number,
      default: 0,
    },
    cashbackStatus: {
      type: String,
      enum: ['NONE', 'PENDING', 'CREDITED', 'REVERSED'],
      default: 'NONE',
    },

    // ─── Financial Snapshot (immutable after creation) ─────────────────────────
    // All values saved at booking time; never recalculated using current config.
    pricing: {
      subtotal: { type: Number, default: 0 },          // Sum of services
      subtotalPaise: { type: Number },
      packageDiscount: { type: Number, default: 0 },   // Package offer discount
      packageDiscountPaise: { type: Number },
      couponDiscount: { type: Number, default: 0 },    // Coupon discount
      couponDiscountPaise: { type: Number },
      grossAmount: { type: Number, default: 0 },       // subtotal - all discounts
      grossAmountPaise: { type: Number },
      platformFee: { type: Number, default: 0 },       // Platform fee (charged on top)
      platformFeePaise: { type: Number },
      platformFeeType: { type: String, enum: ['PERCENTAGE', 'FIXED'], default: 'PERCENTAGE' },
      commissionAmount: { type: Number, default: 0 },  // Commission (deducted from vendor)
      commissionAmountPaise: { type: Number },
      finalAmount: { type: Number, default: 0 },       // What customer pays
      finalAmountPaise: { type: Number },
      vendorNetAmount: { type: Number, default: 0 },   // What vendor earns
      vendorNetAmountPaise: { type: Number },
      adminRevenue: { type: Number, default: 0 },      // platform fee + commission
      adminRevenuePaise: { type: Number },
      platformFeePercentage: { type: Number, default: 0 },
      commissionPercentage: { type: Number, default: 0 },
      vendorPlanType: { type: String, enum: ['COMMISSION', 'SUBSCRIPTION'] },
      walletAmountApplied: { type: Number, default: 0 },
      walletAmountAppliedPaise: { type: Number, default: 0 },
      cashbackEarned: { type: Number, default: 0 },
      cashbackEarnedPaise: { type: Number, default: 0 },
    },

    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
    },
    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Package',
    },
    packageSnapshot: {
      packageId: mongoose.Schema.Types.ObjectId,
      name: String,
      originalPrice: Number,
      offerPrice: Number,
      discount: Number,
    },

    cancellationFee: {
      type: Number,
      default: 0,
    },
    cancellationFeePaise: {
      type: Number,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },

    // ─── Payment ───────────────────────────────────────────────────────────────
    // Normalized values only: ONLINE or CASH (no more AT_SALON / online / cash lowercase)
    paymentMethod: {
      type: String,
      enum: ['ONLINE', 'CASH'],
      default: 'CASH',
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'],
      default: 'PENDING',
    },

    // ─── OTP Verification for Completion ───────────────────────────────────────
    completionOtp: {
      type: String,
      select: false, // Don't return by default
    },
    otpExpiresAt: {
      type: Date,
      select: false,
    },
    failedOtpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    otpVerified: {
      type: Boolean,
      default: false,
    },

    // Reference to the successful PaymentTransaction (set after payment)
    paymentTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentTransaction',
    },

    // Razorpay identifiers (kept on booking for quick lookup)
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },

    // ─── Financial Breakdown (legacy fields — kept for backwards compatibility)
    // These mirror pricing.* and are preserved so existing queries don't break.
    commission: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    vendorPayout: { type: Number, default: 0 },
    commissionPaise: { type: Number },
    platformFeePaise: { type: Number },
    vendorPayoutPaise: { type: Number },
    platformFeePercentage: { type: Number, default: 0 },
    adminCommissionPercentage: { type: Number, default: 0 },
    vendorPlanType: {
      type: String,
      enum: ['COMMISSION', 'SUBSCRIPTION'],
      default: 'COMMISSION',
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ user: 1, createdAt: -1, _id: -1 }); // Optimized for pagination
bookingSchema.index({ user: 1, status: 1, createdAt: -1, _id: -1 }); // Optimized for filtered pagination
bookingSchema.index({ salon: 1, status: 1 });
bookingSchema.index({ bookingDate: 1, salon: 1 });
bookingSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
