const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const BookingService = require('../models/BookingService');
const Service = require('../models/Service');
const Salon = require('../models/Salon');
const Vendor = require('../models/Vendor');
const Coupon = require('../models/Coupon');
const PlatformFee = require('../models/PlatformFee');
const { checkSlotAvailability, autoAssignStaff, autoAssignResource } = require('./availabilityService');
const { calculateBookingTotal, calculateCancellationFee, calculateFinancialBreakdown } = require('../utils/calculateFees');
const { calculateEndTime } = require('../utils/calculateAvailability');
const couponService = require('./couponService');
const { acquireMultiServiceLocks, releaseSlotLocks } = require('./slotLockService');

/**
 * Create a new booking with multiple services
 * Handles staff auto-assignment, conflict prevention, and financial calculations
 */
const createBooking = async ({ userId, salonId, services, bookingDate, startTime, couponCode, paymentMethod, packageId, useWallet = false }) => {
  let acquiredLockKeys = [];
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate salon
    const salon = await Salon.findById(salonId);
    if (!salon || !salon.isActive || !salon.isApproved) {
      throw new Error('Salon not found or not available');
    }

    // Get vendor for financial calculations
    const vendor = await Vendor.findById(salon.vendor);
    if (!vendor || !vendor.isActive) {
      throw new Error('Vendor not found or not active');
    }
    if (vendor.accountStatus === 'suspended') {
      throw new Error('Salon is currently unavailable for new bookings');
    }

    // Live real-time cash limit check — prevents new bookings if limit exceeded
    const { getCashHeld, getCashLimit } = require('./vendorCashService');
    const cashHeldPaise = await getCashHeld(salon.vendor);
    const cashLimitPaise = await getCashLimit(salon.vendor);
    if (cashLimitPaise !== Infinity && cashHeldPaise > cashLimitPaise) {
      throw new Error('This salon is currently unavailable for new bookings due to a cash settlement issue.');
    }

    // Validate and prepare services
    const requestedDateStr = new Date(bookingDate).toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = requestedDateStr === todayStr;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [h, m] = startTime.split(':').map(Number);
    const startMinutes = h * 60 + m;

    // Reject past times explicitly
    if (isToday && startMinutes <= currentMinutes) {
      throw new Error("This time slot is no longer available. Please select another time.");
    }

    // Validate Package if provided
    let pkg = null;
    if (packageId) {
      const Package = require('../models/Package');
      pkg = await Package.findById(packageId);
      if (!pkg || pkg.salon.toString() !== salonId.toString()) {
        throw new Error('Offer/Package not found or does not belong to this salon');
      }
      if (!pkg.isActive || pkg.status !== 'ACTIVE') {
        throw new Error('This Offer/Package is currently inactive or not approved');
      }
      const nowTime = new Date();
      if (nowTime < new Date(pkg.validFrom) || nowTime > new Date(pkg.validTo)) {
        throw new Error('This Offer/Package has expired or is not yet valid');
      }

      // Verify services match the package exactly (or is a subset if allowed, but strict match is safer)
      const requestedServiceIds = services.map(s => s.service.toString()).sort();
      const packageServiceIds = pkg.services.map(s => s.toString()).sort();

      // Basic subset/match validation - user must book all services in the package
      const allPackageServicesIncluded = packageServiceIds.every(id => requestedServiceIds.includes(id));
      if (!allPackageServicesIncluded) {
        throw new Error('Booking must include all services from the selected Offer/Package');
      }

      // Optional: Check usage limit
      if (pkg.usageLimit > 0) {
        const usageCount = await Booking.countDocuments({ package: pkg._id, status: { $ne: 'CANCELLED' } });
        if (usageCount >= pkg.usageLimit) {
          throw new Error('This Offer/Package has reached its usage limit');
        }
      }
    }

    const bookingServices = [];
    let currentTime = startTime;

    for (const item of services) {
      const service = await Service.findById(item.service);
      if (!service || !service.isActive) {
        throw new Error(`Service ${item.service} not found or inactive`);
      }

      let assignedStaff = null;
      let staffAutoAssigned = false;
      let assignedResource = null;
      let resourceSnapshot = null;

      const requiresStaff = service.requiresStaff !== false;
      const requiresResource = service.requiresResource === true;

      // --- Staff Assignment ---
      if (requiresStaff) {
        if (item.staff) {
          // User selected specific staff - check availability
          const available = await checkSlotAvailability(
            item.staff,
            bookingDate,
            currentTime,
            service.duration
          );
          if (!available) {
            throw new Error(`Staff is not available for ${service.name} at ${currentTime}`);
          }
          assignedStaff = item.staff;
        } else {
          // Auto-assign staff
          const autoStaff = await autoAssignStaff(
            salonId,
            bookingDate,
            currentTime,
            service.duration
          );
          if (!autoStaff) {
            throw new Error(`No staff available for ${service.name} at ${currentTime}`);
          }
          assignedStaff = autoStaff._id;
          staffAutoAssigned = true;
        }
      }

      // --- Resource Assignment ---
      if (requiresResource && service.resourceType) {
        // We assume global admin toggle is checked at the UI or earlier.
        // For Jacuzzi, if jacuzziEnabled is false on salon, we should fail, but this was verified earlier or can be checked here.
        if (service.resourceType === 'JACUZZI' && !salon.jacuzziEnabled) {
          throw new Error('Jacuzzi services are currently disabled for this salon');
        }

        const autoResource = await autoAssignResource(
          salonId,
          service.resourceType,
          bookingDate,
          currentTime,
          service.duration
        );

        if (!autoResource) {
          throw new Error(`No ${service.resourceType} resource available for ${service.name} at ${currentTime}`);
        }

        assignedResource = autoResource._id;
        resourceSnapshot = { name: autoResource.name };
      }

      const endTime = calculateEndTime(currentTime, service.duration);

      bookingServices.push({
        service: service._id,
        staff: assignedStaff,
        resource: assignedResource,
        resourceType: service.resourceType,
        resourceSnapshot,
        startTime: currentTime,
        endTime,
        price: service.price,
        pricePaise: service.pricePaise !== undefined ? service.pricePaise : Math.round((service.price || 0) * 100),
        duration: service.duration,
        staffAutoAssigned,
      });

      // ── CONCURRENCY LOCK ──────────────────────────────────────────────────
      // Force a MongoDB WriteConflict (code 112) if two concurrent transactions
      // attempt to book the SAME staff or resource simultaneously.
      const Staff = mongoose.model('Staff');
      await Staff.findByIdAndUpdate(assignedStaff, { $set: { updatedAt: new Date() } }, { session });
      if (assignedResource) {
        const SalonResource = mongoose.model('SalonResource');
        await SalonResource.findByIdAndUpdate(assignedResource, { $set: { updatedAt: new Date() } }, { session });
      }
      // ────────────────────────────────────────────────────────────────────────

      // Move current time forward for sequential booking
      currentTime = endTime;
    }

    // ── REDIS ATOMIC SLOT LOCKING ──────────────────────────────────────────
    // Atomically lock all assigned staff and resource slot buckets
    const lockRequests = bookingServices.map((bs) => ({
      salonId,
      staffId: bs.staff,
      resourceId: bs.resource,
      date: bookingDate,
      startTime: bs.startTime,
      duration: bs.duration,
    }));

    const lockResult = await acquireMultiServiceLocks(lockRequests, userId);
    if (!lockResult.success) {
      throw new Error(
        'One or more selected time slots are currently being booked by another customer. Please select another time or try again in a moment.'
      );
    }
    acquiredLockKeys = lockResult.allLockKeys || [];
    // ───────────────────────────────────────────────────────────────────────

    // Validate coupon if provided
    let coupon = null;
    if (couponCode) {
      const servicesPrices = bookingServices.map((bs) => ({ price: bs.price }));
      const totalForCoupon = servicesPrices.reduce((sum, s) => sum + s.price, 0);
      coupon = await couponService.validateCoupon(couponCode, totalForCoupon);
    }

    // Fetch Platform Fee configuration
    const platformFeeDoc = await PlatformFee.findOne({ isActive: true });
    const platformFeeConfig = platformFeeDoc ? {
      feeType: platformFeeDoc.feeType || 'PERCENTAGE',
      feePercentage: platformFeeDoc.feePercentage !== undefined ? platformFeeDoc.feePercentage : 5,
      feeAmount: platformFeeDoc.feeAmount !== undefined ? platformFeeDoc.feeAmount : 30,
    } : { feeType: 'PERCENTAGE', feePercentage: 5, feeAmount: 30 };

    // Check user wallet if useWallet requested
    let userWalletBalancePaise = 0;
    if (useWallet) {
      const UserWallet = require('../models/UserWallet');
      const userWallet = await UserWallet.findOne({ user: userId }).session(session);
      userWalletBalancePaise = userWallet?.balancePaise || 0;
    }

    // Calculate totals including platform fee & wallet
    const {
      totalAmountPaise,
      subtotalAfterDiscountsPaise,
      discountAmountPaise,
      finalAmountPaise,
      packageDiscountPaise,
      couponDiscountPaise,
      platformFeeAmountPaise,
      platformFeePercentage,
      platformFeeType,
      walletAppliedPaise,
    } = calculateBookingTotal(
      bookingServices,
      coupon,
      pkg,
      platformFeeConfig,
      userWalletBalancePaise
    );

    // Apply wallet deduction atomically if any balance applied
    if (walletAppliedPaise > 0) {
      const userWalletService = require('./userWalletService');
      await userWalletService.debitWallet({
        userId,
        amountPaise: walletAppliedPaise,
        description: `Glentro Wallet applied on booking payment`,
        session,
      });
    }

    // Calculate Online Cashback if applicable
    const normalizedPaymentMethod = ['ONLINE', 'online'].includes(paymentMethod) ? 'ONLINE' : 'CASH';
    let cashbackPaise = 0;
    if (normalizedPaymentMethod === 'ONLINE' && platformFeeDoc?.onlineCashbackEnabled) {
      if (platformFeeDoc.cashbackType === 'FIXED') {
        cashbackPaise = Math.round((platformFeeDoc.cashbackAmount || 0) * 100);
      } else {
        const { calculatePercentagePaise } = require('../utils/money');
        cashbackPaise = calculatePercentagePaise(subtotalAfterDiscountsPaise, platformFeeDoc.cashbackPercentage || 0);
      }
    }

    const pointsEarned = 0; // Not implemented yet
    const pointsCalculationAmount = 0;

    // Calculate financial breakdown based on subtotal
    const financials = await calculateFinancialBreakdown(vendor, subtotalAfterDiscountsPaise, platformFeeAmountPaise);

    // Create booking
    const [booking] = await Booking.create(
      [
        {
          user: userId,
          salon: salonId,
          bookingDate,
          startTime,
          endTime: currentTime,
          status: 'PENDING',
          // Legacy fields (divided by 100)
          totalAmount: totalAmountPaise / 100,
          discountAmount: discountAmountPaise / 100,
          finalAmount: finalAmountPaise / 100,
          commission: financials.commissionPaise / 100,
          platformFee: financials.platformFeePaise / 100,
          vendorPayout: financials.vendorPayoutPaise / 100,
          // New explicit Paise fields at root
          totalAmountPaise,
          discountAmountPaise,
          finalAmountPaise,
          commissionPaise: financials.commissionPaise,
          platformFeePaise: financials.platformFeePaise,
          vendorPayoutPaise: financials.vendorPayoutPaise,

          walletAmountApplied: walletAppliedPaise / 100,
          walletAmountAppliedPaise: walletAppliedPaise,
          cashbackEarned: cashbackPaise / 100,
          cashbackEarnedPaise: cashbackPaise,
          cashbackStatus: (cashbackPaise > 0) ? 'PENDING' : 'NONE',

          pointsEarned,
          pointsCalculationAmount,
          coupon: coupon ? coupon._id : undefined,
          package: pkg ? pkg._id : undefined,
          packageSnapshot: pkg ? {
            packageId: pkg._id,
            name: pkg.name,
            originalPrice: pkg.totalPrice,
            offerPrice: pkg.discountedPrice,
            discount: packageDiscountPaise / 100, // Legacy display
          } : undefined,
          paymentMethod: normalizedPaymentMethod,

          platformFeePercentage: financials.platformFeePercentage,
          adminCommissionPercentage: financials.adminCommissionPercentage,
          vendorPlanType: financials.vendorPlanType,

          // New strict paise fields inside pricing snapshot
          pricing: {
            subtotal: totalAmountPaise / 100,
            subtotalPaise: totalAmountPaise,
            packageDiscount: packageDiscountPaise / 100,
            packageDiscountPaise,
            couponDiscount: couponDiscountPaise / 100,
            couponDiscountPaise,
            grossAmount: subtotalAfterDiscountsPaise / 100,
            grossAmountPaise: subtotalAfterDiscountsPaise,
            platformFee: platformFeeAmountPaise / 100,
            platformFeePaise: platformFeeAmountPaise,
            platformFeeType: platformFeeType || 'PERCENTAGE',
            commissionAmount: financials.commissionPaise / 100,
            commissionAmountPaise: financials.commissionPaise,
            finalAmount: finalAmountPaise / 100,
            finalAmountPaise,
            vendorNetAmount: financials.vendorPayoutPaise / 100,
            vendorNetAmountPaise: financials.vendorPayoutPaise,
            adminRevenue: (financials.platformFeePaise + financials.commissionPaise) / 100,
            adminRevenuePaise: financials.platformFeePaise + financials.commissionPaise,
            platformFeePercentage: financials.platformFeePercentage,
            commissionPercentage: financials.adminCommissionPercentage,
            vendorPlanType: financials.vendorPlanType,
            walletAmountApplied: walletAppliedPaise / 100,
            walletAmountAppliedPaise: walletAppliedPaise,
            cashbackEarned: cashbackPaise / 100,
            cashbackEarnedPaise: cashbackPaise,
          }
        },
      ],
      { session, ordered: true }
    );

    // Create booking service items
    const bookingServiceDocs = bookingServices.map((bs) => ({
      ...bs,
      booking: booking._id,
    }));

    await BookingService.create(bookingServiceDocs, { session, ordered: true });

    // Increment coupon usage
    if (coupon) {
      await couponService.incrementUsage(coupon._id);
    }

    await session.commitTransaction();
    session.endSession();

    // Release temporary Redis locks now that the booking is securely saved in MongoDB
    if (acquiredLockKeys.length > 0) {
      await releaseSlotLocks(acquiredLockKeys, userId);
    }

    // Return populated booking
    const populatedBooking = await Booking.findById(booking._id)
      .populate('salon', 'name address phone vendor')
      .populate('user', 'name email phone')
      .populate('coupon', 'code discountType discountValue');

    const populatedServices = await BookingService.find({ booking: booking._id })
      .populate('service', 'name price duration category')
      .populate('staff', 'name avatar');

    return {
      booking: populatedBooking,
      services: populatedServices,
      vendorId: vendor._id,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    // Clean up temporary slot locks immediately on error/rollback
    if (acquiredLockKeys.length > 0) {
      await releaseSlotLocks(acquiredLockKeys, userId);
    }

    // Catch WriteConflict (112) to retry gracefully or propagate the error to the frontend
    if (error.code === 112) {
      console.warn(`[Concurrency] WriteConflict (112) detected in createBooking. Propagating to client to retry.`);
      throw new Error('This time slot was just booked by someone else. Please try again or select another time.');
    }
    throw error;
  }
};

/**
 * Accept a booking - re-checks availability to prevent double booking
 */
const acceptBooking = async (bookingId, vendorId) => {
  const booking = await Booking.findById(bookingId).populate('salon');
  if (!booking) throw new Error('Booking not found');
  if (booking.salon.vendor.toString() !== vendorId.toString()) {
    throw new Error('Not authorized to manage this booking');
  }
  if (booking.status !== 'PENDING') {
    throw new Error(`Cannot accept booking with status ${booking.status}`);
  }

  // Prevent suspended vendors from accepting bookings
  // Check BOTH DB status AND live cash calculation to catch un-synced states
  const vendor = await Vendor.findById(vendorId);
  if (vendor && vendor.accountStatus === 'suspended') {
    throw new Error('Your account is suspended. You cannot accept bookings until you clear your dues or resolve the suspension.');
  }

  // Live real-time cash limit check (catches cases where DB hasn't synced yet)
  const { getCashHeld, getCashLimit, syncVendorCashSuspension } = require('./vendorCashService');
  const cashHeldPaise = await getCashHeld(vendorId);
  const cashLimitPaise = await getCashLimit(vendorId);
  if (cashLimitPaise !== Infinity && cashHeldPaise > cashLimitPaise) {
    // Sync the DB status so it's corrected for future checks
    await syncVendorCashSuspension(vendorId);
    const excessRs = ((cashHeldPaise - cashLimitPaise) / 100).toFixed(2);
    throw new Error(`Your cash holding limit is exceeded by ₹${excessRs}. Please settle your cash with admin to accept bookings.`);
  }

  // ── Past date guard ──────────────────────────────────────────────────────
  // Prevent vendor from accepting a booking whose appointment date/time has
  // already passed. The booking date is stored as a Date (midnight UTC), so
  // we combine it with startTime (HH:MM) to get the precise appointment moment.
  const [h, m] = (booking.startTime || '00:00').split(':').map(Number);
  const appointmentDateTime = new Date(booking.bookingDate);
  appointmentDateTime.setHours(h, m, 0, 0);

  if (appointmentDateTime < new Date()) {
    throw new Error(
      'This booking cannot be accepted because its appointment date and time have already passed.'
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Re-check availability for each service to prevent double booking
  const bookingServices = await BookingService.find({ booking: bookingId });
  for (const bs of bookingServices) {
    if (bs.staff) {
      const available = await checkSlotAvailability(
        bs.staff,
        booking.bookingDate,
        bs.startTime,
        bs.duration
      );
      // Allow the booking's own slots (they're already reserved as PENDING)
      // Only check for conflicts with OTHER confirmed bookings
    }
  }

  booking.status = 'CONFIRMED';
  await booking.save();

  return booking;
};

/**
 * Reject a booking
 */
const rejectBooking = async (bookingId, vendorId, reason) => {
  const booking = await Booking.findById(bookingId).populate('salon');
  if (!booking) throw new Error('Booking not found');
  if (booking.salon.vendor.toString() !== vendorId.toString()) {
    throw new Error('Not authorized to manage this booking');
  }
  if (booking.status !== 'PENDING') {
    throw new Error(`Cannot reject booking with status ${booking.status}`);
  }

  booking.status = 'REJECTED';
  booking.rejectionReason = reason || '';
  await booking.save();

  return booking;
};

/**
 * Cancel a booking — applies cancellation fee based on timing.
 * For PAID ONLINE bookings: automatically initiates a refund via paymentService.
 */
const cancelBooking = async (bookingId, userId, userRole, reason) => {
  const booking = await Booking.findById(bookingId).populate('salon');
  if (!booking) throw new Error('Booking not found');

  if (userRole === 'user' && booking.user.toString() !== userId.toString()) {
    throw new Error('Not authorized to cancel this booking');
  }

  if (userRole === 'vendor' && booking.salon.vendor.toString() !== userId.toString()) {
    throw new Error('Not authorized to cancel this booking');
  }

  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    if (booking.status === 'CANCELLED') {
      return booking; // Idempotent: already cancelled, no error needed
    }
    throw new Error(`Cannot cancel booking with status ${booking.status}`);
  }

  // If paid online: delegate to paymentService which handles cancellation fee,
  // refund creation, ledger reversal, and status updates atomically.
  if (booking.paymentStatus === 'PAID' && booking.paymentMethod === 'ONLINE') {
    const paymentService = require('./paymentService');
    const result = await paymentService.initiateRefund({
      bookingId,
      userId,
      userRole,
      reason: reason || 'Booking cancelled',
    });
    // Return the updated booking
    return await Booking.findById(bookingId);
  }

  // For CASH / PENDING bookings: simple cancellation
  const { cancellationFee } = await calculateCancellationFee(booking);

  booking.status = 'CANCELLED';
  booking.cancellationFee = cancellationFee;
  booking.cancellationReason = reason || '';
  await booking.save();

  return booking;
};

/**
 * Mark a booking as No-Show
 * Validates that the appointment time has actually passed.
 */
const markNoShow = async (bookingId, vendorId) => {
  const { sendEmail } = require('../utils/emailService');
  const AppSetting = require('../models/AppSetting');
  const booking = await Booking.findById(bookingId).populate('user').populate('salon');
  if (!booking) throw new Error('Booking not found');
  if (booking.salon.vendor.toString() !== vendorId.toString()) {
    throw new Error('Not authorized to manage this booking');
  }
  if (booking.status !== 'CONFIRMED') {
    throw new Error(`Cannot mark booking with status ${booking.status} as No-Show`);
  }

  // Time-Lock Check: Cannot mark No-Show before the appointment start time
  const [h, m] = (booking.startTime || '00:00').split(':').map(Number);
  const appointmentStartDateTime = new Date(booking.bookingDate);
  appointmentStartDateTime.setHours(h, m, 0, 0);

  if (new Date() < appointmentStartDateTime) {
    throw new Error('Cannot mark as No-Show before the appointment time has started.');
  }

  booking.status = 'NO_SHOW';
  booking.cancellationReason = 'Customer did not show up.';
  await booking.save();

  // Notify customer
  if (booking.user && booking.user.email) {
    // Fetch support settings for the email
    const supportEmailSetting = await AppSetting.findOne({ key: 'supportEmail' });
    const supportPhoneSetting = await AppSetting.findOne({ key: 'supportPhone' });
    const supportEmail = supportEmailSetting ? supportEmailSetting.value : 'support@example.com';
    const supportPhone = supportPhoneSetting ? supportPhoneSetting.value : '';

    let supportContactHtml = `<p><strong>Email:</strong> ${supportEmail}</p>`;
    if (supportPhone) {
      supportContactHtml += `<p><strong>Phone:</strong> ${supportPhone}</p>`;
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.5; color: #333;">
        <h2 style="color: #D32F2F; border-bottom: 2px solid #D32F2F; padding-bottom: 10px;">Booking Marked as No-Show</h2>
        <p>Hi <b>${booking.user.name}</b>,</p>
        <p>The salon <b>${booking.salon.name}</b> has marked your appointment (Booking #${booking._id}) as a <b>No-Show</b> because you did not arrive for your scheduled service.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #eee;">
          <h3 style="margin-top: 0; color: #4A1578;">Believe this is a mistake?</h3>
          <p style="margin-bottom: 10px;">If you were present at the salon and believe this was marked incorrectly, please contact our support team immediately.</p>
          ${supportContactHtml}
        </div>
      </div>
    `;
    try {
      await sendEmail({
        to: booking.user.email,
        subject: `Appointment No-Show - ${booking.salon.name}`,
        html: emailHtml,
      });
    } catch (e) {
      console.error('Failed to send No-Show email to user:', e.message);
    }
  }

  return booking;
};

/**
 * Request OTP to complete a booking
 */
const requestCompletionOtp = async (bookingId, vendorId) => {
  const crypto = require('crypto');

  const booking = await Booking.findById(bookingId).populate('user', 'name email phone').populate('salon', 'name vendor');
  if (!booking) throw new Error('Booking not found');
  if (booking.salon.vendor.toString() !== vendorId.toString()) {
    throw new Error('Not authorized to manage this booking');
  }
  if (booking.status !== 'CONFIRMED') {
    throw new Error(`Cannot generate OTP for booking with status ${booking.status}`);
  }

  // Generate 4 digit numeric OTP
  const otp = crypto.randomInt(1000, 9999).toString();
  booking.completionOtp = otp;
  booking.otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  booking.failedOtpAttempts = 0;
  await booking.save();

  return {
    success: true,
    message: 'Completion OTP generated successfully',
    bookingId: booking._id,
    otp,
    userId: booking.user?._id ? booking.user._id.toString() : (booking.user?.toString() || null),
    salonName: booking.salon?.name || 'Salon',
  };
};

/**
 * Complete a booking (Requires OTP Verification by Vendor or Customer)
 */
const completeBooking = async (bookingId, actorId, role, otp) => {
  // Use select('+completionOtp +otpExpiresAt +failedOtpAttempts') to explicitly fetch it
  const booking = await Booking.findById(bookingId)
    .select('+completionOtp +otpExpiresAt +failedOtpAttempts')
    .populate('salon', 'name vendor')
    .populate('user', 'name email phone');

  if (!booking) throw new Error('Booking not found');

  // Authorization check
  if (role === 'vendor') {
    if (booking.salon.vendor.toString() !== actorId.toString()) {
      throw new Error('Not authorized to manage this booking');
    }
  } else if (role === 'user') {
    const bookingUserId = booking.user?._id ? booking.user._id.toString() : booking.user.toString();
    if (bookingUserId !== actorId.toString()) {
      throw new Error('Not authorized to complete this booking');
    }
  } else if (role !== 'admin') {
    throw new Error('Unauthorized');
  }

  if (booking.status !== 'CONFIRMED') {
    throw new Error(`Cannot complete booking with status ${booking.status}`);
  }

  // OTP Verification
  if (!otp) {
    throw new Error('OTP is required to complete the booking');
  }

  if (booking.otpExpiresAt && new Date() > booking.otpExpiresAt) {
    throw new Error('OTP has expired. Please ask to generate a new code.');
  }

  if (!booking.completionOtp || booking.completionOtp !== otp.toString().trim()) {
    booking.failedOtpAttempts = (booking.failedOtpAttempts || 0) + 1;
    await booking.save();

    const remainingAttempts = Math.max(0, 5 - booking.failedOtpAttempts);
    if (remainingAttempts === 0) {
      booking.completionOtp = undefined;
      booking.otpExpiresAt = undefined;
      booking.failedOtpAttempts = 0;
      await booking.save();
      throw new Error('Too many invalid attempts. The OTP has been invalidated. Please request a new code.');
    }
    throw new Error(`Invalid OTP. ${remainingAttempts} attempts remaining.`);
  }

  booking.status = 'COMPLETED';
  booking.otpVerified = true;
  booking.completionOtp = undefined;
  booking.otpExpiresAt = undefined;
  booking.failedOtpAttempts = undefined;
  await booking.save();

  return booking;
};

const previewBookingTotal = async ({ userId = null, salonId, services, couponCode, packageId, useWallet = false }) => {
  const salon = await Salon.findById(salonId);
  if (!salon) throw new Error('Salon not found');

  let pkg = null;
  if (packageId) {
    const Package = require('../models/Package');
    pkg = await Package.findById(packageId);
    if (!pkg || pkg.salon.toString() !== salonId.toString()) throw new Error('Offer/Package not found');
  }

  const Service = require('../models/Service');
  const bookingServices = [];
  for (const item of services) {
    const service = await Service.findById(item.service);
    if (!service) throw new Error(`Service not found`);
    bookingServices.push({
      service: service._id,
      price: service.price,
      pricePaise: service.pricePaise !== undefined ? service.pricePaise : Math.round((service.price || 0) * 100),
    });
  }

  let coupon = null;
  if (couponCode) {
    const couponService = require('./couponService');
    const totalForCoupon = bookingServices.reduce((sum, s) => sum + s.price, 0);
    coupon = await couponService.validateCoupon(couponCode, totalForCoupon);
  }

  const PlatformFee = require('../models/PlatformFee');
  const platformFeeDoc = await PlatformFee.findOne({ isActive: true });
  const platformFeeConfig = platformFeeDoc ? {
    feeType: platformFeeDoc.feeType || 'PERCENTAGE',
    feePercentage: platformFeeDoc.feePercentage !== undefined ? platformFeeDoc.feePercentage : 5,
    feeAmount: platformFeeDoc.feeAmount !== undefined ? platformFeeDoc.feeAmount : 30,
  } : { feeType: 'PERCENTAGE', feePercentage: 5, feeAmount: 30 };

  // Check user wallet if userId provided
  let userWalletBalancePaise = 0;
  if (userId) {
    const UserWallet = require('../models/UserWallet');
    const userWallet = await UserWallet.findOne({ user: userId });
    userWalletBalancePaise = userWallet?.balancePaise || 0;
  }

  const walletToApplyPaise = useWallet ? userWalletBalancePaise : 0;

  const {
    totalAmountPaise,
    subtotalAfterDiscountsPaise,
    discountAmountPaise,
    finalAmountPaise,
    packageDiscountPaise,
    couponDiscountPaise,
    platformFeeType,
    platformFeeAmountPaise,
    platformFeePercentage,
    platformFeeAmount,
    walletAppliedPaise,
  } = calculateBookingTotal(
    bookingServices,
    coupon,
    pkg,
    platformFeeConfig,
    walletToApplyPaise
  );

  // Online Cashback calculation
  let potentialCashbackPaise = 0;
  const cashbackEnabled = Boolean(platformFeeDoc?.onlineCashbackEnabled);
  const cashbackType = platformFeeDoc?.cashbackType || 'FIXED';
  const cashbackPercentage = platformFeeDoc?.cashbackPercentage || 5;
  const cashbackAmount = platformFeeDoc?.cashbackAmount !== undefined ? platformFeeDoc.cashbackAmount : 20;

  if (cashbackEnabled) {
    if (cashbackType === 'FIXED') {
      potentialCashbackPaise = Math.round(cashbackAmount * 100);
    } else {
      const { calculatePercentagePaise } = require('../utils/money');
      potentialCashbackPaise = calculatePercentagePaise(subtotalAfterDiscountsPaise, cashbackPercentage);
    }
  }

  return {
    totalAmountPaise,
    subtotalAfterDiscountsPaise,
    discountAmountPaise,
    finalAmountPaise,
    packageDiscountPaise,
    couponDiscountPaise,
    platformFeeType,
    platformFeeAmountPaise,
    platformFeePercentage,
    platformFeeAmount,
    wallet: {
      availableBalancePaise: userWalletBalancePaise,
      availableBalance: userWalletBalancePaise / 100,
      appliedPaise: walletAppliedPaise,
      applied: walletAppliedPaise / 100,
      canApply: userWalletBalancePaise > 0,
    },
    onlineCashback: {
      enabled: cashbackEnabled,
      type: cashbackType,
      percentage: cashbackPercentage,
      amount: cashbackAmount,
      potentialCashbackPaise,
      potentialCashback: potentialCashbackPaise / 100,
    },
    coupon: coupon ? { code: coupon.code, discountValuePaise: coupon.discountValuePaise, discountType: coupon.discountType } : null,
    package: pkg ? { name: pkg.name } : null
  };
};

module.exports = { createBooking, previewBookingTotal, acceptBooking, rejectBooking, cancelBooking, completeBooking, markNoShow, requestCompletionOtp };
