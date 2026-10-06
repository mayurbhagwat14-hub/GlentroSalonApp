/**
 * paymentController.js — thin HTTP layer over paymentService.
 *
 * All financial logic lives in paymentService.js.
 * Controllers only validate request structure, call the service,
 * and return clean HTTP responses.
 *
 * SECURITY: RAZORPAY_KEY_SECRET is never read or logged here.
 */

const paymentService = require('../services/paymentService');
const PaymentTransaction = require('../models/PaymentTransaction');
const RefundTransaction = require('../models/RefundTransaction');
const VendorLedger = require('../models/VendorLedger');
const VendorSettlement = require('../models/VendorSettlement');
const Booking = require('../models/Booking');
const Salon = require('../models/Salon');
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/create-order  (user only)
// ─────────────────────────────────────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    if (!req.body.bookingId) {
      return res.status(400).json({ success: false, message: 'bookingId is required' });
    }
    const result = await paymentService.createRazorpayOrder(req.body.bookingId, req.user.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    const errorMsg = error?.error?.description || error?.message || 'Failed to create payment order';
    console.error('[createOrder]', errorMsg);
    res.status(400).json({ success: false, message: errorMsg });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/verify  (user only)
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return res.status(400).json({ success: false, message: 'All payment fields are required' });
    }
    const result = await paymentService.verifyAndRecordPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
      userId: req.user.id,
    });
    res.status(200).json({
      success: true,
      message: result.alreadyProcessed ? 'Payment already verified' : 'Payment verified successfully',
      data: { transaction: result.transaction },
    });
  } catch (error) {
    const errorMsg = error?.error?.description || error?.message || 'Payment verification failed';
    console.error('[verifyPayment]', errorMsg);
    res.status(400).json({ success: false, message: errorMsg });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/webhook  (Razorpay → server, no auth token)
// Raw body MUST be passed (see app.js)
// ─────────────────────────────────────────────────────────────────────────────
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing webhook signature' });
    }
    // req.body is raw Buffer (handled in paymentRoutes before json middleware)
    const payload = req.body;
    await paymentService.handleWebhook(payload, signature);
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[webhook]', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/cash  (vendor only)
// ─────────────────────────────────────────────────────────────────────────────
exports.recordCashPayment = async (req, res) => {
  try {
    if (!req.body.bookingId) {
      return res.status(400).json({ success: false, message: 'bookingId is required' });
    }
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ success: false, message: 'Only vendors can record cash payments' });
    }
    const result = await paymentService.recordCashPayment(req.body.bookingId, req.user.id);
    res.status(200).json({
      success: true,
      message: result.alreadyProcessed
        ? 'Cash payment has already been recorded for this booking'
        : 'Cash payment recorded successfully',
      data: { transaction: result.transaction },
    });
  } catch (error) {
    console.error('[recordCashPayment]', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/:bookingId/refund  (user/vendor/admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.initiateRefund = async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await paymentService.initiateRefund({
      bookingId: req.params.bookingId,
      userId: req.user.id,
      userRole: req.user.role,
      reason,
    });
    res.status(200).json({
      success: true,
      message: 'Refund initiated successfully',
      data: result,
    });
  } catch (error) {
    console.error('[initiateRefund]', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/status/:bookingId  (user who owns booking, or admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.getPaymentStatus = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId).select(
      'paymentStatus paymentMethod status finalAmount razorpayOrderId user'
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Authorization: user who owns booking or admin or vendor who owns the salon
    if (req.user.role === 'user' && booking.user.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    if (req.user.role === 'vendor') {
      const salon = await require('../models/Salon').findById(booking.salon).select('vendor');
      if (!salon || salon.vendor.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    const transaction = await PaymentTransaction.findOne({ booking: req.params.bookingId })
      .sort({ createdAt: -1 })
      .select('-razorpaySignature -metadata');

    const refundTransaction = await RefundTransaction.findOne({ booking: req.params.bookingId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        bookingStatus: booking.status,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        finalAmount: booking.finalAmount,
        transaction,
        refundTransaction,
      },
    });
  } catch (error) {
    console.error('[getPaymentStatus]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/transactions  (admin only) — paginated, filterable
// ─────────────────────────────────────────────────────────────────────────────
exports.getAdminTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      paymentMethod,
      transactionType,
      status,
      vendorId,
      salonId,
      startDate,
      endDate,
      search,
    } = req.query;

    const query = {};
    if (paymentMethod) query.paymentMethod = paymentMethod.toUpperCase();
    if (transactionType) query.transactionType = transactionType.toUpperCase();
    if (status) query.status = status.toUpperCase();
    if (vendorId) query.vendor = vendorId;
    if (salonId) query.salon = salonId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      PaymentTransaction.find(query)
        .populate('booking', 'bookingDate startTime status paymentStatus')
        .populate('user', 'name email phone')
        .populate('vendor', 'name email businessName')
        .populate('salon', 'name address')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-razorpaySignature'),
      PaymentTransaction.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('[getAdminTransactions]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/admin-financial-summary  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAdminFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const matchStage = { status: 'PAID' };
    if (Object.keys(dateFilter).length) matchStage.createdAt = dateFilter;

    const [txnSummary, refundSummary, settlementSummary, withdrawalSummary, cashSettlementSummary] = await Promise.all([
      PaymentTransaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$paymentMethod',
            totalGross: { $sum: '$amount' },
            totalAdminRevenue: { $sum: '$pricing.adminRevenue' },
            totalVendorNet: { $sum: '$pricing.vendorNetAmount' },
            totalCommission: { $sum: '$pricing.commissionAmount' },
            totalPlatformFee: { $sum: '$pricing.platformFee' },
            count: { $sum: 1 },
          },
        },
      ]),
      RefundTransaction.aggregate([
        { $match: { refundStatus: { $in: ['REFUND_PENDING', 'REFUNDED'] } } },
        {
          $group: {
            _id: '$refundStatus',
            totalRefunded: { $sum: '$refundAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
      VendorSettlement.aggregate([
        {
          $group: {
            _id: '$direction',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      // New System: Admin -> Vendor (Withdrawals)
      mongoose.model('WithdrawalRequest').aggregate([
        { $match: { status: 'PAID' } },
        {
          $group: {
            _id: null,
            totalAmountPaise: { $sum: '$amountPaise' },
          },
        },
      ]),
      // New System: Vendor -> Admin (Cash Settlements)
      mongoose.model('CashSettlement').aggregate([
        { $match: { status: 'PAID' } },
        {
          $group: {
            _id: null,
            totalAmountPaise: { $sum: '$amountPaise' },
          },
        },
      ]),
    ]);

    const online = txnSummary.find((t) => t._id === 'ONLINE') || {};
    const cash = txnSummary.find((t) => t._id === 'CASH') || {};
    const refunded = refundSummary.find((r) => r._id === 'REFUNDED')?.totalRefunded || 0;
    const refundPending = refundSummary.find((r) => r._id === 'REFUND_PENDING')?.totalRefunded || 0;
    const settledToVendor =
      (settlementSummary.find((s) => s._id === 'ADMIN_TO_VENDOR')?.totalAmount || 0) + 
      ((withdrawalSummary[0]?.totalAmountPaise || 0) / 100);
      
    const settledToAdmin =
      (settlementSummary.find((s) => s._id === 'VENDOR_TO_ADMIN')?.totalAmount || 0) + 
      ((cashSettlementSummary[0]?.totalAmountPaise || 0) / 100);

    res.json({
      success: true,
      data: {
        onlinePayments: {
          grossCollection: online.totalGross || 0,
          adminRevenue: online.totalAdminRevenue || 0,
          vendorPayable: online.totalVendorNet || 0,
          commission: online.totalCommission || 0,
          platformFee: online.totalPlatformFee || 0,
          count: online.count || 0,
        },
        cashPayments: {
          grossCollection: cash.totalGross || 0,
          adminRevenue: cash.totalAdminRevenue || 0,
          vendorNet: cash.totalVendorNet || 0,
          commission: cash.totalCommission || 0,
          platformFee: cash.totalPlatformFee || 0,
          count: cash.count || 0,
        },
        refunds: {
          totalRefunded: refunded,
          pendingRefunds: refundPending,
        },
        settlements: {
          totalSettledToVendors: settledToVendor,
          totalReceivedFromVendors: settledToAdmin,
        },
        netAdminRevenue:
          (online.totalAdminRevenue || 0) +
          (cash.totalAdminRevenue || 0) -
          refunded,
      },
    });
  } catch (error) {
    console.error('[getAdminFinancialSummary]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/vendor-financial-summary  (vendor only)
// ─────────────────────────────────────────────────────────────────────────────
exports.getVendorFinancialSummary = async (req, res) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ success: false, message: 'Vendor access only' });
    }
    const { salon } = req.query;
    const summary = await paymentService.getVendorFinancialSummary(req.user.id, salon);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('[getVendorFinancialSummary]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/vendor-ledger  (vendor only)
// ─────────────────────────────────────────────────────────────────────────────
exports.getVendorLedger = async (req, res) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ success: false, message: 'Vendor access only' });
    }
    const { page = 1, limit = 20, entryType, salon } = req.query;
    const query = { vendor: req.user.id };
    if (entryType) query.entryType = entryType;
    if (salon) query.salon = salon;

    const [entries, total] = await Promise.all([
      VendorLedger.find(query)
        .populate('booking', 'bookingDate startTime status')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      VendorLedger.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        entries,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('[getVendorLedger]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/admin-settlement  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
exports.recordAdminSettlement = async (req, res) => {
  try {
    const { vendorId, amount, method, direction, reference, notes } = req.body;
    if (!vendorId || !amount || !method || !direction) {
      return res.status(400).json({ success: false, message: 'vendorId, amount, method and direction are required' });
    }

    const settlement = await VendorSettlement.create({
      vendor: vendorId,
      amount,
      method,
      direction,
      reference,
      notes,
      recordedBy: req.user.id,
      recordedByRole: 'admin',
    });

    // Also create a ledger entry for the vendor
    const entryType =
      direction === 'ADMIN_TO_VENDOR' ? 'SETTLEMENT_CREDIT' : 'SETTLEMENT_DEBIT';
    const dir = direction === 'ADMIN_TO_VENDOR' ? 'CREDIT' : 'DEBIT';

    await VendorLedger.create({
      vendor: vendorId,
      settlement: settlement._id,
      entryType,
      amount,
      direction: dir,
      description: `Settlement recorded by Admin — ${direction} ₹${amount}`,
    });

    res.status(201).json({
      success: true,
      message: 'Settlement recorded successfully',
      data: settlement,
    });
  } catch (error) {
    console.error('[recordAdminSettlement]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/admin-settlements  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAdminSettlements = async (req, res) => {
  try {
    const { page = 1, limit = 20, vendorId, direction } = req.query;
    const query = {};
    if (vendorId) query.vendor = vendorId;
    if (direction) query.direction = direction;

    const [settlements, total] = await Promise.all([
      VendorSettlement.find(query)
        .populate('vendor', 'name email businessName')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      VendorSettlement.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        settlements,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('[getAdminSettlements]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
