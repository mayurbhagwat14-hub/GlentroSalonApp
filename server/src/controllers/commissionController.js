const Commission = require('../models/Commission');
const PlatformFee = require('../models/PlatformFee');
const Vendor = require('../models/Vendor');
const { calculateCharges } = require('../services/commissionService');

const getCommissions = async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;
    let query = {};
    if (search) {
      const Vendor = require('../models/Vendor');
      const matchingVendors = await Vendor.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { businessName: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      query.vendor = { $in: matchingVendors.map(v => v._id) };
    }

    if (page && limit) {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await Commission.countDocuments(query);
      const commissions = await Commission.find(query)
        .populate('vendor', 'name businessName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      return res.json({
        success: true,
        data: {
          commissions,
          total,
          page: parseInt(page),
          totalPages: Math.ceil(total / limit)
        }
      });
    }

    const commissions = await Commission.find(query).populate('vendor', 'name businessName email');
    res.json({ success: true, data: commissions });
  } catch (error) { next(error); }
};

const setCommission = async (req, res, next) => {
  try {
    const { vendor, percentage, notes } = req.body;
    let commission = await Commission.findOne({ vendor });
    if (commission) {
      commission.percentage = percentage;
      commission.notes = notes || '';
      await commission.save();
    } else {
      commission = await Commission.create({ vendor, percentage, notes });
    }
    // Also update vendor model
    await Vendor.findByIdAndUpdate(vendor, { commissionRate: percentage });
    res.json({ success: true, message: 'Commission set', data: commission });
  } catch (error) { next(error); }
};

const getPlatformFee = async (req, res, next) => {
  try {
    let fee = await PlatformFee.findOne({ isActive: true });
    if (!fee) {
      fee = await PlatformFee.create({ feePercentage: 5, cancellationFeePercentage: 25, adminCommissionPercentage: 10 });
    }
    res.json({ success: true, data: fee });
  } catch (error) { next(error); }
};

const getPublicPlatformFee = async (req, res, next) => {
  try {
    let fee = await PlatformFee.findOne({ isActive: true });
    if (!fee) {
      fee = await PlatformFee.create({
        feeType: 'PERCENTAGE',
        feePercentage: 5,
        feeAmount: 30,
        cancellationFeePercentage: 25,
        adminCommissionPercentage: 10,
      });
    }
    // Only expose public-safe fields (no internal financials)
    res.json({
      success: true,
      data: {
        feeType: fee.feeType || 'PERCENTAGE',
        feePercentage: fee.feePercentage,
        feeAmount: fee.feeAmount !== undefined ? fee.feeAmount : 30,
        onlineCashbackEnabled: fee.onlineCashbackEnabled || false,
        cashbackType: fee.cashbackType || 'FIXED',
        cashbackPercentage: fee.cashbackPercentage || 5,
        cashbackAmount: fee.cashbackAmount !== undefined ? fee.cashbackAmount : 20,
        callEnabled: fee.callEnabled,
        callWindowMinutes: fee.callWindowMinutes,
        cancellationChargeEnabled: fee.cancellationChargeEnabled,
        freeCancellationWindowMinutes: fee.freeCancellationWindowMinutes,
        cancellationChargeType: fee.cancellationChargeType,
        cancellationFixedAmount: fee.cancellationFixedAmount,
        cancellationFeePercentage: fee.cancellationFeePercentage,
      }
    });
  } catch (error) { next(error); }
};

const updatePlatformFee = async (req, res, next) => {
  try {
    const {
      feeType, feePercentage, feeAmount,
      onlineCashbackEnabled, cashbackType, cashbackPercentage, cashbackAmount,
      cancellationFeePercentage, adminCommissionPercentage,
      // New call policy fields
      callEnabled, callWindowMinutes,
      // New cancellation policy fields
      cancellationChargeEnabled, freeCancellationWindowMinutes,
      cancellationChargeType, cancellationFixedAmount,
    } = req.body;

    let fee = await PlatformFee.findOne({ isActive: true });
    if (fee) {
      if (feeType !== undefined) fee.feeType = feeType;
      if (feePercentage !== undefined) fee.feePercentage = feePercentage;
      if (feeAmount !== undefined) fee.feeAmount = feeAmount;
      if (onlineCashbackEnabled !== undefined) fee.onlineCashbackEnabled = onlineCashbackEnabled;
      if (cashbackType !== undefined) fee.cashbackType = cashbackType;
      if (cashbackPercentage !== undefined) fee.cashbackPercentage = cashbackPercentage;
      if (cashbackAmount !== undefined) fee.cashbackAmount = cashbackAmount;
      if (cancellationFeePercentage !== undefined) fee.cancellationFeePercentage = cancellationFeePercentage;
      if (adminCommissionPercentage !== undefined) fee.adminCommissionPercentage = adminCommissionPercentage;
      // Call policy
      if (callEnabled !== undefined) fee.callEnabled = callEnabled;
      if (callWindowMinutes !== undefined) fee.callWindowMinutes = callWindowMinutes;
      // Cancellation policy
      if (cancellationChargeEnabled !== undefined) fee.cancellationChargeEnabled = cancellationChargeEnabled;
      if (freeCancellationWindowMinutes !== undefined) fee.freeCancellationWindowMinutes = freeCancellationWindowMinutes;
      if (cancellationChargeType !== undefined) fee.cancellationChargeType = cancellationChargeType;
      if (cancellationFixedAmount !== undefined) fee.cancellationFixedAmount = cancellationFixedAmount;
      fee.updatedBy = req.user.id;
      await fee.save();
    } else {
      fee = await PlatformFee.create({
        feeType: feeType || 'PERCENTAGE',
        feePercentage: feePercentage !== undefined ? feePercentage : 5,
        feeAmount: feeAmount !== undefined ? feeAmount : 30,
        onlineCashbackEnabled: onlineCashbackEnabled !== undefined ? onlineCashbackEnabled : false,
        cashbackType: cashbackType || 'FIXED',
        cashbackPercentage: cashbackPercentage !== undefined ? cashbackPercentage : 5,
        cashbackAmount: cashbackAmount !== undefined ? cashbackAmount : 20,
        cancellationFeePercentage: cancellationFeePercentage || 25,
        adminCommissionPercentage: adminCommissionPercentage || 10,
        callEnabled: callEnabled !== undefined ? callEnabled : true,
        callWindowMinutes: callWindowMinutes || 60,
        cancellationChargeEnabled: cancellationChargeEnabled !== undefined ? cancellationChargeEnabled : true,
        freeCancellationWindowMinutes: freeCancellationWindowMinutes || 60,
        cancellationChargeType: cancellationChargeType || 'PERCENTAGE',
        cancellationFixedAmount: cancellationFixedAmount || 0,
        updatedBy: req.user.id,
      });
    }
    res.json({ success: true, message: 'Platform fee updated', data: fee });
  } catch (error) { next(error); }
};

const calculateVendorCharges = async (req, res, next) => {
  try {
    const { vendorId, amount } = req.body;
    const charges = await calculateCharges(vendorId, amount);
    res.json({ success: true, data: charges });
  } catch (error) { next(error); }
};

const deleteCommission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const commission = await Commission.findById(id);
    if (!commission) {
      return res.status(404).json({ success: false, message: 'Commission rate not found' });
    }
    
    // Also reset vendor model commission rate
    await Vendor.findByIdAndUpdate(commission.vendor, { commissionRate: null });
    
    await commission.deleteOne();
    res.json({ success: true, message: 'Commission rate deleted successfully' });
  } catch (error) { next(error); }
};

module.exports = { getCommissions, setCommission, getPlatformFee, getPublicPlatformFee, updatePlatformFee, calculateVendorCharges, deleteCommission };
