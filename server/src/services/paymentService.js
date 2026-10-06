/**
 * paymentService.js — Central payment service.
 *
 * ALL financial operations flow through this service:
 *  - createRazorpayOrder
 *  - verifyAndRecordPayment  (idempotent)
 *  - recordCashPayment       (idempotent)
 *  - initiateRefund          (idempotent)
 *  - handleWebhook           (idempotent)
 *
 * SECURITY:
 *  - RAZORPAY_KEY_SECRET is never sent to frontend.
 *  - RAZORPAY_WEBHOOK_SECRET is used only here.
 *  - All amounts taken from database, never from frontend input.
 *  - MongoDB sessions used for atomic multi-document updates.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const PaymentTransaction = require('../models/PaymentTransaction');
const VendorLedger = require('../models/VendorLedger');
const VendorCashLedger = require('../models/VendorCashLedger');
const RefundTransaction = require('../models/RefundTransaction');
const Salon = require('../models/Salon');
const { syncVendorCashSuspension } = require('./vendorCashService');
const razorpay = require('../utils/razorpay');
const { calculateCancellationFee } = require('../utils/calculateFees');
// Wallet service — lazy require to avoid circular deps
const walletSvc = () => require('./withdrawalService');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build pricing snapshot from a Booking document
// ─────────────────────────────────────────────────────────────────────────────
const buildPricingSnapshot = (booking) => ({
  subtotal: booking.totalAmount || 0,
  subtotalPaise: booking.totalAmountPaise !== undefined ? booking.totalAmountPaise : Math.round((booking.totalAmount || 0) * 100),
  packageDiscount: booking.packageSnapshot?.discount || 0,
  packageDiscountPaise: booking.pricing?.packageDiscountPaise !== undefined ? booking.pricing.packageDiscountPaise : Math.round((booking.packageSnapshot?.discount || 0) * 100),
  couponDiscount: booking.discountAmount || 0,
  couponDiscountPaise: booking.discountAmountPaise !== undefined ? booking.discountAmountPaise : Math.round((booking.discountAmount || 0) * 100),
  grossAmount: booking.totalAmount || 0,
  grossAmountPaise: booking.pricing?.grossAmountPaise !== undefined ? booking.pricing.grossAmountPaise : Math.round((booking.totalAmount || 0) * 100),
  platformFee: booking.platformFee || 0,
  platformFeePaise: booking.platformFeePaise !== undefined ? booking.platformFeePaise : Math.round((booking.platformFee || 0) * 100),
  commissionAmount: booking.commission || 0,
  commissionAmountPaise: booking.commissionPaise !== undefined ? booking.commissionPaise : Math.round((booking.commission || 0) * 100),
  finalAmount: booking.finalAmount || 0,
  finalAmountPaise: booking.finalAmountPaise !== undefined ? booking.finalAmountPaise : Math.round((booking.finalAmount || 0) * 100),
  vendorNetAmount: booking.vendorPayout || 0,
  vendorNetAmountPaise: booking.vendorPayoutPaise !== undefined ? booking.vendorPayoutPaise : Math.round((booking.vendorPayout || 0) * 100),
  adminRevenue: (booking.commission || 0) + (booking.platformFee || 0),
  adminRevenuePaise: (booking.commissionPaise || 0) + (booking.platformFeePaise || 0) || Math.round(((booking.commission || 0) + (booking.platformFee || 0)) * 100),
});

// ─────────────────────────────────────────────────────────────────────────────
// createRazorpayOrder
// ─────────────────────────────────────────────────────────────────────────────
const createRazorpayOrder = async (bookingId, userId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error('Booking not found');
  if (booking.user.toString() !== userId.toString()) {
    throw new Error('Not authorized to pay for this booking');
  }
  if (booking.paymentStatus === 'PAID') {
    throw new Error('This booking has already been paid');
  }
  if (booking.paymentMethod !== 'ONLINE') {
    throw new Error('This booking is not set for online payment');
  }
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    throw new Error(`Cannot create payment order for booking with status: ${booking.status}`);
  }
  if (!razorpay) {
    throw new Error('Payment gateway is not configured on the server');
  }

  // ⚠️ Amount comes from DB — NEVER from frontend
  // Use finalAmountPaise directly if available, fallback to Math.round otherwise
  const amountToCharge = booking.finalAmountPaise !== undefined ? booking.finalAmountPaise : Math.round(booking.finalAmount * 100);
  
  const options = {
    amount: amountToCharge, // strict integer paise
    currency: 'INR',
    receipt: `booking_${booking._id}`,
  };

  let order;
  try {
    order = await razorpay.orders.create(options);
  } catch (rpErr) {
    const errorDetail = rpErr?.error?.description || rpErr?.message || 'Razorpay order creation failed';
    throw new Error(`Razorpay Error: ${errorDetail}`);
  }

  // Save order ID on booking for reconciliation
  booking.razorpayOrderId = order.id;
  await booking.save();

  // Return only key_id (public), never key_secret
  return { order, key_id: process.env.RAZORPAY_KEY_ID };
};

// ─────────────────────────────────────────────────────────────────────────────
// verifyAndRecordPayment — IDEMPOTENT
// ─────────────────────────────────────────────────────────────────────────────
const verifyAndRecordPayment = async ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  bookingId,
  userId,
}) => {
  // 1. Idempotency: if this order is already processed, return existing record
  const existingTxn = await PaymentTransaction.findOne({
    razorpayOrderId: razorpay_order_id,
    status: 'PAID',
  });
  if (existingTxn) {
    return { success: true, alreadyProcessed: true, transaction: existingTxn };
  }

  // 2. Verify HMAC signature — RAZORPAY_KEY_SECRET stays on server
  const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSign = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(sign)
    .digest('hex');

  if (razorpay_signature !== expectedSign) {
    throw new Error('Payment signature verification failed. Possible tampering detected.');
  }

  // 3. Fetch booking with salon
  const booking = await Booking.findById(bookingId).populate('salon');
  if (!booking) throw new Error('Booking not found');
  if (booking.razorpayOrderId !== razorpay_order_id) {
    throw new Error('Razorpay order ID does not match the booking');
  }

  const salon = booking.salon;
  const pricingSnapshot = buildPricingSnapshot(booking);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 4. Create immutable payment transaction
    const [transaction] = await PaymentTransaction.create(
      [
        {
          booking: booking._id,
          user: booking.user,
          vendor: salon.vendor,
          salon: salon._id,
          paymentMethod: 'ONLINE',
          transactionType: 'PAYMENT',
          amount: booking.finalAmount,
          amountPaise: booking.finalAmountPaise !== undefined ? booking.finalAmountPaise : Math.round((booking.finalAmount || 0) * 100),
          currency: 'INR',
          status: 'PAID',
          direction: 'CREDIT',
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          signatureVerified: true,
          description: `Online payment for Booking #${booking._id}`,
          pricing: pricingSnapshot,
          recordedByRole: 'system',
        },
      ],
      { session }
    );

    // 5. Create vendor ledger entry — net amount payable to vendor (legacy/reporting)
    await VendorLedger.create(
      [
        {
          vendor: salon.vendor,
          salon: salon._id,
          booking: booking._id,
          paymentTransaction: transaction._id,
          entryType: 'ONLINE_RECEIVED',
          amount: pricingSnapshot.vendorNetAmount,
          direction: 'CREDIT',
          paymentMethod: 'ONLINE',
          description: `Vendor share from online payment for Booking #${booking._id}`,
        },
      ],
      { session }
    );

    // 5b. Credit vendor wallet (integer paise) — same session for atomicity
    const vendorNetPaise = pricingSnapshot.vendorNetAmountPaise; // using the robust snapshot
    if (vendorNetPaise > 0) {
      await walletSvc().creditWalletFromPayment({
        vendorId: salon.vendor,
        salonId: salon._id,
        bookingId: booking._id,
        paymentTransactionId: transaction._id,
        amountPaise: vendorNetPaise,
        description: `Online payment credited for Booking #${booking._id}`,
        session,
      });
    }

    // 5c. Credit user wallet with online cashback if eligible
    const userCashbackPaise = booking.cashbackEarnedPaise || 0;
    let newCashbackStatus = booking.cashbackStatus;
    if (userCashbackPaise > 0) {
      const userWalletService = require('./userWalletService');
      await userWalletService.creditCashback({
        userId: booking.user,
        bookingId: booking._id,
        amountPaise: userCashbackPaise,
        description: `Cashback for online payment (Booking #${booking._id})`,
        session,
      });
      newCashbackStatus = 'CREDITED';
    }

    // 6. Update booking — PAID → CONFIRMED per business rules
    await Booking.findByIdAndUpdate(
      bookingId,
      {
        paymentStatus: 'PAID',
        razorpayPaymentId: razorpay_payment_id,
        status: 'CONFIRMED',
        paymentTransactionId: transaction._id,
        cashbackStatus: newCashbackStatus,
      },
      { session, new: true }
    );

    await session.commitTransaction();
    session.endSession();

    return { success: true, alreadyProcessed: false, transaction };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// recordCashPayment — IDEMPOTENT, vendor-only
// ─────────────────────────────────────────────────────────────────────────────
const recordCashPayment = async (bookingId, vendorId) => {
  const booking = await Booking.findById(bookingId).populate('salon');
  if (!booking) throw new Error('Booking not found');

  // Security: verify vendor owns this salon
  if (booking.salon.vendor.toString() !== vendorId.toString()) {
    throw new Error('Not authorized to record payment for this booking');
  }

  // Booking must be a CASH booking
  if (booking.paymentMethod !== 'CASH') {
    throw new Error('This booking is not a cash payment booking');
  }

  // Idempotency: already paid?
  if (booking.paymentStatus === 'PAID') {
    const existingTxn = await PaymentTransaction.findOne({
      booking: bookingId,
      transactionType: 'CASH_PAYMENT',
      status: 'PAID',
    });
    return { success: true, alreadyProcessed: true, transaction: existingTxn };
  }

  // Booking must be in an eligible state
  if (!['CONFIRMED', 'COMPLETED'].includes(booking.status)) {
    throw new Error(
      'Cash payment can only be recorded for confirmed or completed bookings'
    );
  }

  const salon = booking.salon;
  const pricingSnapshot = buildPricingSnapshot(booking);
  // Admin's receivable from vendor = commission + platform fee
  const adminReceivable = (booking.commission || 0) + (booking.platformFee || 0);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create cash payment transaction (gross amount vendor received)
    const [transaction] = await PaymentTransaction.create(
      [
        {
          booking: booking._id,
          user: booking.user,
          vendor: salon.vendor,
          salon: salon._id,
          paymentMethod: 'CASH',
          transactionType: 'CASH_PAYMENT',
          amount: booking.finalAmount,
          amountPaise: booking.finalAmountPaise !== undefined ? booking.finalAmountPaise : Math.round((booking.finalAmount || 0) * 100),
          currency: 'INR',
          status: 'PAID',
          direction: 'CREDIT',
          description: `Cash collected from customer for Booking #${booking._id}`,
          pricing: pricingSnapshot,
          recordedBy: vendorId,
          recordedByRole: 'vendor',
        },
      ],
      { session }
    );

    // Ledger entry: vendor physically received full cash
    await VendorLedger.create(
      [
        {
          vendor: salon.vendor,
          salon: salon._id,
          booking: booking._id,
          paymentTransaction: transaction._id,
          entryType: 'CASH_RECEIVED',
          amount: booking.finalAmount,
          amountPaise: booking.finalAmountPaise !== undefined ? booking.finalAmountPaise : Math.round((booking.finalAmount || 0) * 100),
          direction: 'CREDIT',
          paymentMethod: 'CASH',
          description: `Cash collected for Booking #${booking._id}`,
        },
      ],
      { session }
    );

    // Ledger entry: vendor owes admin commission + platform fee
    if (adminReceivable > 0) {
      await VendorLedger.create(
        [
          {
            vendor: salon.vendor,
            salon: salon._id,
            booking: booking._id,
            paymentTransaction: transaction._id,
            entryType: 'COMMISSION_DEBIT',
            amount: adminReceivable,
            direction: 'DEBIT',
            paymentMethod: 'CASH',
            description: `Admin receivable (Commission ₹${booking.commission} + Platform Fee ₹${booking.platformFee}) for Booking #${booking._id}`,
          },
        ],
        { session }
      );
    }

    // Ledger entry: New VendorCashLedger to track physical cash holding
    const grossAmountPaise = booking.finalAmountPaise !== undefined ? booking.finalAmountPaise : Math.round((booking.finalAmount || 0) * 100);
    const adminSharePaise = Math.round(adminReceivable * 100);
    const vendorNetSharePaise = Math.max(0, grossAmountPaise - adminSharePaise);

    await VendorCashLedger.create(
      [
        {
          vendor: salon.vendor,
          salon: salon._id,
          booking: booking._id,
          grossAmountPaise,
          adminSharePaise,
          vendorNetSharePaise,
          cashStatus: 'UNSETTLED',
          settledAmountPaise: 0,
          remainingUnsettledAmountPaise: grossAmountPaise,
          remainingVendorNetSharePaise: vendorNetSharePaise,
        }
      ],
      { session }
    );

    // Update booking payment status
    await Booking.findByIdAndUpdate(
      bookingId,
      { paymentStatus: 'PAID', paymentTransactionId: transaction._id },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Fire & forget sync to update limits/suspension after cash is added
    syncVendorCashSuspension(salon.vendor).catch(err => 
      console.error('Failed to sync vendor cash suspension:', err)
    );

    return { success: true, alreadyProcessed: false, transaction };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// initiateRefund — IDEMPOTENT
// ─────────────────────────────────────────────────────────────────────────────
const initiateRefund = async ({ bookingId, userId, userRole, reason }) => {
  const booking = await Booking.findById(bookingId).populate('salon');
  if (!booking) throw new Error('Booking not found');

  // Authorization
  if (userRole === 'user' && booking.user.toString() !== userId.toString()) {
    throw new Error('Not authorized to request refund for this booking');
  }
  if (
    userRole === 'vendor' &&
    booking.salon.vendor.toString() !== userId.toString()
  ) {
    throw new Error('Not authorized to request refund for this booking');
  }

  if (booking.paymentStatus !== 'PAID') {
    throw new Error('Cannot refund a booking that has not been paid');
  }
  if (booking.paymentMethod === 'ONLINE' && !booking.razorpayPaymentId) {
    throw new Error('No Razorpay payment ID found for this booking');
  }

  // Idempotency: refund already initiated or completed?
  const existingRefund = await RefundTransaction.findOne({
    booking: bookingId,
    refundStatus: { $in: ['REFUND_PENDING', 'REFUNDED'] },
  });
  if (existingRefund) {
    throw new Error('A refund has already been initiated for this booking');
  }

  // ⚠️ Refund amount calculated server-side — NEVER trust frontend
  const { cancellationFeePaise } = await calculateCancellationFee(booking);
  const paidAmountPaise = booking.finalAmountPaise !== undefined ? booking.finalAmountPaise : Math.round(booking.finalAmount * 100);
  const refundAmountPaise = Math.max(0, paidAmountPaise - cancellationFeePaise);

  const originalTxn = await PaymentTransaction.findOne({
    booking: bookingId,
    transactionType: 'PAYMENT',
    status: 'PAID',
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create refund record FIRST (before calling Razorpay)
    const [refundTxn] = await RefundTransaction.create(
      [
        {
          paymentTransaction: originalTxn?._id,
          booking: booking._id,
          razorpayPaymentId: booking.razorpayPaymentId,
          refundAmount: refundAmountPaise / 100,
          refundAmountPaise,
          originalAmount: paidAmountPaise / 100,
          originalAmountPaise: paidAmountPaise,
          cancellationFee: cancellationFeePaise / 100,
          cancellationFeePaise,
          refundReason: reason || 'Booking cancelled',
          refundStatus: 'REFUND_PENDING',
          initiatedBy: userId,
          initiatedByRole: userRole,
        },
      ],
      { session }
    );

    // Reverse vendor ledger impact
    const vendorNetAmount = booking.vendorPayout || 0;
    if (vendorNetAmount > 0) {
      await VendorLedger.create(
        [
          {
            vendor: booking.salon.vendor,
            salon: booking.salon._id,
            booking: booking._id,
            refundTransaction: refundTxn._id,
            entryType: 'REFUND_REVERSAL',
            amount: vendorNetAmount,
            direction: 'DEBIT',
            paymentMethod: booking.paymentMethod,
            description: `Refund reversal: Booking #${booking._id} cancelled`,
          },
        ],
        { session }
      );

      const vendorNetPaise = booking.vendorPayoutPaise !== undefined ? booking.vendorPayoutPaise : Math.round(vendorNetAmount * 100);
      let walletDebitAmountPaise = vendorNetPaise;

      // Handle CASH refund states
      if (booking.paymentMethod === 'CASH') {
        const VendorCashLedger = require('../models/VendorCashLedger');
        const cashLedger = await VendorCashLedger.findOne({ booking: booking._id }).session(session);
        if (cashLedger) {
          // Calculate how much Vendor Net Share was actually settled (and thus credited to the wallet)
          const settledVendorShare = cashLedger.vendorNetSharePaise - cashLedger.remainingVendorNetSharePaise;
          walletDebitAmountPaise = settledVendorShare;

          // Zero out the remaining unsettled exposure
          cashLedger.cashStatus = 'REVERSED';
          cashLedger.remainingUnsettledAmountPaise = 0;
          cashLedger.remainingVendorNetSharePaise = 0;
          await cashLedger.save({ session });
        } else {
          walletDebitAmountPaise = 0;
        }
      }

      // Debit vendor wallet safely for the portion that was already credited (or full if ONLINE)
      if (walletDebitAmountPaise > 0) {
        await walletSvc().debitWalletForRefund({
          vendorId: booking.salon.vendor,
          salonId: booking.salon._id,
          bookingId: booking._id,
          refundTransactionId: refundTxn._id,
          amountPaise: walletDebitAmountPaise,
          description: `Wallet debit for refund: Booking #${booking._id}`,
          session,
        });
      }
    }

    // Update booking
    await Booking.findByIdAndUpdate(
      bookingId,
      {
        paymentStatus: 'REFUND_PENDING',
        status: 'CANCELLED',
        cancellationFee: cancellationFeePaise / 100,
        cancellationFeePaise,
        cancellationReason: reason || 'Booking cancelled',
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Call Razorpay refund API (outside session — not rollback-critical)
    if (refundAmountPaise > 0 && razorpay && booking.paymentMethod === 'ONLINE') {
      try {
        const rzpRefund = await razorpay.payments.refund(booking.razorpayPaymentId, {
          amount: refundAmountPaise,
          speed: 'normal',
          notes: {
            bookingId: booking._id.toString(),
            reason: reason || 'Booking cancelled',
          },
        });

        const newStatus =
          rzpRefund.status === 'processed' ? 'REFUNDED' : 'REFUND_PENDING';

        await RefundTransaction.findByIdAndUpdate(refundTxn._id, {
          razorpayRefundId: rzpRefund.id,
          refundStatus: newStatus,
          completedAt: newStatus === 'REFUNDED' ? new Date() : undefined,
        });

        if (newStatus === 'REFUNDED') {
          await Booking.findByIdAndUpdate(bookingId, { paymentStatus: 'REFUNDED' });
        }
      } catch (rzpError) {
        // Log but don't throw — the refund record is created, can be retried via webhook
        console.error('Razorpay refund API error:', rzpError.message || rzpError);
      }
    }

    return { success: true, refundAmount, cancellationFee, paidAmount };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// handleWebhook — IDEMPOTENT Razorpay webhook processor
// ─────────────────────────────────────────────────────────────────────────────
const handleWebhook = async (payload, signature) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('[Webhook] RAZORPAY_WEBHOOK_SECRET not configured. Skipping verification.');
    return;
  }

  // Verify webhook authenticity
  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');

  if (signature !== expectedSig) {
    throw new Error('Invalid webhook signature');
  }

  const event = payload.event;

  // ── payment.captured ─────────────────────────────────────────────────────
  if (event === 'payment.captured') {
    const payment = payload.payload.payment.entity;
    
    // Route subscription payments
    if (payment.notes && payment.notes.type === 'VENDOR_SUBSCRIPTION') {
      const subscriptionService = require('./subscriptionService');
      await subscriptionService.handleSubscriptionWebhook(payload);
      return;
    }

    const orderId = payment.order_id;

    // Find booking by Razorpay order ID
    const booking = await Booking.findOne({ razorpayOrderId: orderId }).populate('salon');
    if (!booking) {
      // It might be a CashSettlement
      const CashSettlement = require('../models/CashSettlement');
      const settlement = await CashSettlement.findOne({ razorpayOrderId: orderId });
      
      if (settlement) {
        if (settlement.status === 'PAID') return; // Already processed
        if (payment.status === 'captured' && payment.amount === settlement.amountPaise) {
          const { processCashSettlementAllocation } = require('./cashSettlementService');
          await processCashSettlementAllocation(settlement._id, payment.id);
        }
        return;
      }
      
      console.warn(`[Webhook] No booking or settlement found for orderId: ${orderId}`);
      return;
    }

    // Idempotency — already processed?
    const exists = await PaymentTransaction.findOne({
      razorpayOrderId: orderId,
      status: 'PAID',
    });
    if (exists) return;

    // Only act if not already paid (frontend might have verified faster)
    if (booking.paymentStatus !== 'PAID') {
      const salon = booking.salon;
      const pricingSnapshot = buildPricingSnapshot(booking);

      const txn = await PaymentTransaction.create({
        booking: booking._id,
        user: booking.user,
        vendor: salon.vendor,
        salon: salon._id,
        paymentMethod: 'ONLINE',
        transactionType: 'PAYMENT',
        amount: booking.finalAmount,
        amountPaise: booking.finalAmountPaise !== undefined ? booking.finalAmountPaise : Math.round((booking.finalAmount || 0) * 100),
        currency: 'INR',
        status: 'PAID',
        direction: 'CREDIT',
        razorpayOrderId: orderId,
        razorpayPaymentId: payment.id,
        signatureVerified: true,
        description: `[Webhook] Online payment confirmed for Booking #${booking._id}`,
        pricing: pricingSnapshot,
        recordedByRole: 'system',
      });

      await VendorLedger.create({
        vendor: salon.vendor,
        salon: salon._id,
        booking: booking._id,
        paymentTransaction: txn._id,
        entryType: 'ONLINE_RECEIVED',
        amount: pricingSnapshot.vendorNetAmount,
        direction: 'CREDIT',
        paymentMethod: 'ONLINE',
        description: `[Webhook] Vendor share for Booking #${booking._id}`,
      });

      // Credit vendor wallet from webhook (no session — webhook is outside session scope)
      const webhookVendorPaise = pricingSnapshot.vendorNetAmountPaise !== undefined ? pricingSnapshot.vendorNetAmountPaise : Math.round(pricingSnapshot.vendorNetAmount * 100);
      if (webhookVendorPaise > 0) {
        try {
          await walletSvc().creditWalletFromPayment({
            vendorId: salon.vendor,
            salonId: salon._id,
            bookingId: booking._id,
            paymentTransactionId: txn._id,
            amountPaise: webhookVendorPaise,
            description: `[Webhook] Wallet credit for Booking #${booking._id}`,
            session: null,
          });
        } catch (walletErr) {
          console.error('[Webhook] Wallet credit failed (non-critical):', walletErr.message);
        }
      }

      await Booking.findByIdAndUpdate(booking._id, {
        paymentStatus: 'PAID',
        razorpayPaymentId: payment.id,
        status: 'CONFIRMED',
        paymentTransactionId: txn._id,
      });
    }
  }

  // ── refund.processed ─────────────────────────────────────────────────────
  if (event === 'refund.processed') {
    const refund = payload.payload.refund.entity;

    // Find by razorpayRefundId or razorpayPaymentId
    const refundTxn = await RefundTransaction.findOne({
      $or: [
        { razorpayRefundId: refund.id },
        { razorpayPaymentId: refund.payment_id, refundStatus: 'REFUND_PENDING' },
      ],
    });

    if (refundTxn && refundTxn.refundStatus !== 'REFUNDED') {
      await RefundTransaction.findByIdAndUpdate(refundTxn._id, {
        razorpayRefundId: refund.id,
        refundStatus: 'REFUNDED',
        completedAt: new Date(),
      });
      await Booking.findByIdAndUpdate(refundTxn.booking, {
        paymentStatus: 'REFUNDED',
      });
    }
  }

  // ── payment.failed ────────────────────────────────────────────────────────
  if (event === 'payment.failed') {
    const payment = payload.payload.payment.entity;
    const orderId = payment.order_id;
    const booking = await Booking.findOne({ razorpayOrderId: orderId });
    if (booking && booking.paymentStatus === 'PENDING') {
      // Leave booking in PENDING — do NOT mark FAILED automatically
      // User may retry; booking slot will expire via cleanup if not paid
      console.log(`[Webhook] Payment failed for booking ${booking._id}. Booking remains PENDING.`);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getVendorFinancialSummary — aggregated, backend-only
// ─────────────────────────────────────────────────────────────────────────────
const getVendorFinancialSummary = async (vendorId, salonId) => {
  const Vendor = require('../models/Vendor');
  const salons = await Salon.find({ vendor: vendorId }, '_id');
  const salonIds = salons.map((s) => s._id);

  let matchCondition = { vendor: new mongoose.Types.ObjectId(vendorId) };
  
  if (salonId) {
    if (!salonIds.some(id => id.toString() === salonId.toString())) {
      throw new Error('Not authorized for this salon');
    }
    matchCondition.salon = new mongoose.Types.ObjectId(salonId);
  }

  // Aggregate from VendorLedger
  const ledgerSummary = await VendorLedger.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: '$entryType',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Aggregate settled amounts (Old System)
  const VendorSettlement = require('../models/VendorSettlement');
  const settlements = await VendorSettlement.aggregate([
    { $match: { vendor: new mongoose.Types.ObjectId(vendorId) } },
    {
      $group: {
        _id: '$direction',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Aggregate Paid Withdrawals (New System)
  const WithdrawalRequest = require('../models/WithdrawalRequest');
  const paidWithdrawals = await WithdrawalRequest.aggregate([
    { $match: { vendor: new mongoose.Types.ObjectId(vendorId), status: 'PAID' } },
    {
      $group: {
        _id: null,
        totalAmountPaise: { $sum: '$amountPaise' },
      },
    },
  ]);
  const newSystemPaidOut = (paidWithdrawals[0]?.totalAmountPaise || 0) / 100;

  // Map results
  const getAmount = (type) => {
    const entry = ledgerSummary.find((e) => e._id === type);
    return entry ? entry.totalAmount : 0;
  };

  const onlineReceived = getAmount('ONLINE_RECEIVED');
  const cashReceived = getAmount('CASH_RECEIVED');
  const commissionDebit = getAmount('COMMISSION_DEBIT');
  const refundReversal = getAmount('REFUND_REVERSAL');
  const settlementCredit = getAmount('SETTLEMENT_CREDIT'); // admin paid vendor
  const cashSettlementPaid = getAmount('CASH_SETTLEMENT_PAID'); // vendor paid admin online

  const settledToVendor =
    (settlements.find((s) => s._id === 'ADMIN_TO_VENDOR')?.totalAmount || 0) + newSystemPaidOut;
  const settledToAdmin =
    (settlements.find((s) => s._id === 'VENDOR_TO_ADMIN')?.totalAmount || 0) + cashSettlementPaid;

  const VendorWallet = require('../models/VendorWallet');
  const wallet = await VendorWallet.findOne({ vendor: vendorId });
  const adminReceivableOutstanding = wallet ? wallet.recoveryOutstanding / 100 : 0;
  const vendorReceivableOutstanding = wallet ? (wallet.availableBalance + wallet.pendingBalance) / 100 : 0;

  return {
    onlineCollected: onlineReceived,
    cashCollected: cashReceived,
    commissionDeducted: commissionDebit,
    refundReversal,
    vendorNetEarnings: onlineReceived + cashReceived - commissionDebit - refundReversal,
    settledToVendor,
    settledToAdmin,
    // What vendor still owes admin (cash dues outstanding)
    adminReceivableOutstanding,
    // What admin still owes vendor (online share not yet settled)
    vendorReceivableOutstanding,
  };
};

module.exports = {
  createRazorpayOrder,
  verifyAndRecordPayment,
  recordCashPayment,
  initiateRefund,
  handleWebhook,
  getVendorFinancialSummary,
};
