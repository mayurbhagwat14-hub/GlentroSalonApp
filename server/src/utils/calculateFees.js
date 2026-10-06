const PlatformFee = require('../models/PlatformFee');
const { calculatePercentagePaise, roundToNearestRupeePaise } = require('./money');

/**
 * Calculate cancellation fee based on time until appointment
 * 
 * Business Rule:
 * - >= 60 minutes before: No cancellation fee
 * - < 60 minutes before: Cancellation fee applies (percentage from PlatformFee)
 * 
 * @param {Object} booking - Booking document (must have finalAmountPaise)
 * @returns {Object} { canCancel, cancellationFeePaise, feePercentage }
 */
const calculateCancellationFee = async (booking) => {
  const now = new Date();
  const bookingDateTime = new Date(booking.bookingDate);
  const [hours, minutes] = booking.startTime.split(':').map(Number);
  bookingDateTime.setHours(hours, minutes, 0, 0);

  const minutesUntilAppointment = (bookingDateTime - now) / (1000 * 60);

  // Get platform fee settings
  const platformFee = await PlatformFee.findOne({ isActive: true });
  const cancellationFeePercentage = platformFee ? platformFee.cancellationFeePercentage : 25;

  if (minutesUntilAppointment >= 60) {
    return {
      canCancel: true,
      cancellationFeePaise: 0,
      feePercentage: 0,
      minutesUntilAppointment: Math.round(minutesUntilAppointment),
    };
  }

  // Within 59 minutes - fee applies
  // Ensure we use booking.finalAmountPaise, fallback to old finalAmount * 100 if missing
  const basePaise = booking.finalAmountPaise !== undefined ? booking.finalAmountPaise : Math.round((booking.finalAmount || 0) * 100);
  const feePaise = calculatePercentagePaise(basePaise, cancellationFeePercentage);
  
  return {
    canCancel: true,
    cancellationFeePaise: roundToNearestRupeePaise(feePaise), // Final customer charge rounded to whole rupee
    feePercentage: cancellationFeePercentage,
    minutesUntilAppointment: Math.round(minutesUntilAppointment),
  };
};

/**
 * Calculate booking total using strict integer paise math.
 * 
 * @param {Array} services - Array of service objects (must have pricePaise)
 * @param {Object|null} coupon - Coupon document or null (must have discountValuePaise if flat)
 * @param {Object|null} pkg - Package document or null (must have discountedPricePaise)
 * @param {number} platformFeePercentage - Percentage
 * @returns {Object} Financial breakdown in paise
 */
const calculateBookingTotal = (services, coupon = null, pkg = null, platformFeeParam = 0, walletAppliedPaise = 0) => {
  // 1. Calculate original total from services
  // If pricePaise is missing, fallback to price * 100 for backward compatibility during migration
  const originalTotalPaise = services.reduce((sum, s) => sum + (s.pricePaise !== undefined ? s.pricePaise : Math.round((s.price || 0) * 100)), 0);
  
  let baseAmountPaise = originalTotalPaise;
  let packageDiscountPaise = 0;

  // 2. Apply package discount if applicable
  if (pkg) {
    baseAmountPaise = pkg.discountedPricePaise !== undefined ? pkg.discountedPricePaise : Math.round((pkg.discountedPrice || 0) * 100);
    packageDiscountPaise = originalTotalPaise - baseAmountPaise;
    if (packageDiscountPaise < 0) packageDiscountPaise = 0; // Guard
  }

  let couponDiscountPaise = 0;

  // 3. Apply coupon discount if applicable
  if (coupon) {
    if (pkg && coupon.applicableToOffers === false) {
      couponDiscountPaise = 0;
    } else {
      if (coupon.discountType === 'percentage') {
        couponDiscountPaise = calculatePercentagePaise(baseAmountPaise, coupon.discountValue);
        const maxDiscount = coupon.maxDiscountPaise !== undefined ? coupon.maxDiscountPaise : (coupon.maxDiscount ? Math.round(coupon.maxDiscount * 100) : null);
        if (maxDiscount !== null && couponDiscountPaise > maxDiscount) {
          couponDiscountPaise = maxDiscount;
        }
      } else {
        // Flat discount
        couponDiscountPaise = coupon.discountValuePaise !== undefined ? coupon.discountValuePaise : Math.round((coupon.discountValue || 0) * 100);
      }
    }
  }

  // Ensure discount doesn't exceed base amount
  couponDiscountPaise = Math.min(couponDiscountPaise, baseAmountPaise);
  
  const subtotalAfterDiscountsPaise = baseAmountPaise - couponDiscountPaise;
  const totalDiscountPaise = packageDiscountPaise + couponDiscountPaise;

  // 4. Calculate Platform Fee (Fixed ₹ vs Percentage %)
  let feeType = 'PERCENTAGE';
  let feePercentage = 0;
  let feeAmount = 0;
  if (typeof platformFeeParam === 'object' && platformFeeParam !== null) {
    feeType = platformFeeParam.feeType || 'PERCENTAGE';
    feePercentage = Number(platformFeeParam.feePercentage || 0);
    feeAmount = Number(platformFeeParam.feeAmount || 0);
  } else {
    feePercentage = Number(platformFeeParam || 0);
  }

  let platformFeeAmountPaise = 0;
  if (feeType === 'FIXED') {
    platformFeeAmountPaise = Math.round(feeAmount * 100);
  } else {
    platformFeeAmountPaise = calculatePercentagePaise(subtotalAfterDiscountsPaise, feePercentage);
  }
  
  // 5. Apply wallet balance deduction if requested
  const rawBeforeWalletPaise = subtotalAfterDiscountsPaise + platformFeeAmountPaise;
  const actualWalletDeductedPaise = Math.min(walletAppliedPaise || 0, rawBeforeWalletPaise);
  const rawFinalAmountPaise = Math.max(0, rawBeforeWalletPaise - actualWalletDeductedPaise);

  // 6. Apply Final Customer Rounding Business Rule (Round to nearest whole Rupee)
  const finalAmountPaise = roundToNearestRupeePaise(rawFinalAmountPaise);

  return {
    totalAmountPaise: originalTotalPaise,
    subtotalAfterDiscountsPaise,
    discountAmountPaise: totalDiscountPaise,
    couponDiscountPaise,
    packageDiscountPaise,
    platformFeeType: feeType,
    platformFeePercentage: feePercentage,
    platformFeeAmount: feeAmount,
    platformFeeAmountPaise,
    walletAppliedPaise: actualWalletDeductedPaise,
    finalAmountPaise, // Authoritative final payable amount
  };
};

/**
 * Calculate financial breakdown for a booking in paise
 * 
 * @param {Object} vendor - Vendor document
 * @param {number} subtotalAfterDiscountsPaise - The subtotal in paise
 * @param {number} precalculatedPlatformFeePaise - Platform fee in paise
 * @returns {Object} { commissionPaise, platformFeePaise, vendorPayoutPaise, ... }
 */
const calculateFinancialBreakdown = async (vendor, subtotalAfterDiscountsPaise, precalculatedPlatformFeePaise = 0) => {
  const platformFeeDoc = await PlatformFee.findOne({ isActive: true });
  
  const platformFeePercentage = platformFeeDoc ? platformFeeDoc.feePercentage : 5;
  const platformFeePaise = (precalculatedPlatformFeePaise !== undefined && precalculatedPlatformFeePaise !== null)
    ? precalculatedPlatformFeePaise
    : (platformFeeDoc?.feeType === 'FIXED' ? Math.round((platformFeeDoc.feeAmount || 0) * 100) : calculatePercentagePaise(subtotalAfterDiscountsPaise, platformFeePercentage));

  const globalAdminCommission = platformFeeDoc && platformFeeDoc.adminCommissionPercentage !== undefined ? platformFeeDoc.adminCommissionPercentage : 10;

  let commissionPaise = 0;
  let vendorPlanType = 'COMMISSION';
  let appliedCommissionRate = 0;

  // Use centralized subscription service for exact status
  const subscriptionService = require('../services/subscriptionService');
  const subStatus = await subscriptionService.getVendorSubscriptionStatus(vendor._id);

  if (subStatus.status === 'PAID_ACTIVE') {
    commissionPaise = 0;
    vendorPlanType = 'SUBSCRIPTION';
  } else {
    // Note: TRIAL_ACTIVE, GRACE_PERIOD and EXPIRED all fall into COMMISSION model
    appliedCommissionRate = (vendor.commissionRate !== undefined && vendor.commissionRate > 0) ? vendor.commissionRate : globalAdminCommission;
    commissionPaise = calculatePercentagePaise(subtotalAfterDiscountsPaise, appliedCommissionRate);
  }

  // Vendor Payout is Subtotal minus Commission.
  const vendorPayoutPaise = subtotalAfterDiscountsPaise - commissionPaise;

  return {
    commissionPaise,
    platformFeePaise,
    vendorPayoutPaise,
    platformFeePercentage,
    adminCommissionPercentage: appliedCommissionRate,
    vendorPlanType,
    hasSubscription: vendorPlanType === 'SUBSCRIPTION',
  };
};

module.exports = {
  calculateCancellationFee,
  calculateBookingTotal,
  calculateFinancialBreakdown,
};
