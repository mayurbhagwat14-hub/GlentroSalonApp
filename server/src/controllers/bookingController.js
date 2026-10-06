const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const BookingService = require('../models/BookingService');
const Salon = require('../models/Salon');
const PaymentTransaction = require('../models/PaymentTransaction');
const bookingService = require('../services/bookingService');
const { getSalonAvailability, getComplexAvailability } = require('../services/availabilityService');
const { createNotification, notifyBookingCreated, notifyBookingAccepted, notifyBookingRejected, notifyBookingCancelled } = require('../services/notificationService');
const { getIO } = require('../config/socket');

// @desc    Create booking (User)
const createBooking = async (req, res, next) => {
  try {
    const { salon, services, bookingDate, startTime, couponCode, paymentMethod, packageId, useWallet } = req.body;
    const result = await bookingService.createBooking({
      userId: req.user.id, salonId: salon, services, bookingDate, startTime, couponCode, paymentMethod, packageId, useWallet
    });

    // Send notification to vendor & admin
    try {
      await notifyBookingCreated(result.booking, result.vendorId);

      // Create admin notification in database
      await createNotification({
        recipientRole: 'admin',
        recipientModel: 'User',
        type: 'BOOKING_CREATED',
        title: 'New Booking Received',
        message: `New booking #${result.booking.bookingNumber || result.booking._id.toString().slice(-6)} placed for ${result.booking.salon?.name || 'Salon'} (${result.booking.startTime || ''}).`,
        data: {
          bookingId: result.booking._id,
          salonId: result.booking.salon?._id || result.booking.salon,
          bookingNumber: result.booking.bookingNumber,
        },
      });

      const io = getIO();
      // Real-time socket emission to vendor
      io.to(`vendor:${result.vendorId}`).emit('booking:new', { booking: result.booking });
      // Real-time socket emission to admin room
      io.to('admin').emit('booking:new', {
        booking: result.booking,
        title: 'New Booking Alert',
        message: `New booking #${result.booking.bookingNumber || result.booking._id.toString().slice(-6)} received.`,
      });
    } catch (e) { console.log('Notification error:', e.message); }

    res.status(201).json({ success: true, message: 'Booking created successfully', data: { booking: result.booking, services: result.services } });
  } catch (error) {
    if (error.message.includes('not available') || error.message.includes('not found')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Preview booking total (calculates full financial breakdown)
const calculateTotal = async (req, res, next) => {
  try {
    const { salon, services, couponCode, packageId, useWallet } = req.body;
    const result = await bookingService.previewBookingTotal({
      userId: req.user?.id, salonId: salon, services, couponCode, packageId, useWallet
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get user's bookings
const getMyBookings = async (req, res, next) => {
  try {
    const DEFAULT_LIMIT = 10;
    const MAX_LIMIT = 50;

    let { status, page = 1, limit = DEFAULT_LIMIT } = req.query;
    
    // Sanitize and cap pagination
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const query = { user: req.user.id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const bookings = await Booking.find(query)
      .populate('salon', 'name address images phone')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit);
      
    const totalItems = await Booking.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) { next(error); }
};

// @desc    Get salon bookings (Vendor)
const getSalonBookings = async (req, res, next) => {
  try {
    const salon = await Salon.findOne({ _id: req.params.salonId, vendor: req.user.id });
    if (!salon) return res.status(404).json({ success: false, message: 'Salon not found or not authorized' });

    const { status, date, page = 1, limit = 20 } = req.query;
    const query = { salon: req.params.salonId };
    if (status) query.status = status;
    if (date) {
      const d = new Date(date);
      query.bookingDate = { $gte: new Date(d.setHours(0, 0, 0, 0)), $lte: new Date(d.setHours(23, 59, 59, 999)) };
    }

    const bookings = await Booking.find(query).populate('user', 'name email phone').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    const total = await Booking.countDocuments(query);

    res.json({ success: true, data: { bookings, total, page: parseInt(page), totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

// @desc    Get booking detail
const getBookingById = async (req, res, next) => {
  try {
    let query = Booking.findById(req.params.id)
      .populate('salon', 'name address phone vendor images')
      .populate('user', 'name email phone')
      .populate('coupon', 'code discountType discountValue');

    if (req.user && req.user.role === 'user') {
      query = query.select('+completionOtp +otpExpiresAt');
    }

    const booking = await query;
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Authorization check
    if (req.user.role === 'user') {
      if (!booking.user || booking.user._id.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this booking' });
      }
    }
    
    if (req.user.role === 'vendor') {
      if (!booking.salon) {
        return res.status(403).json({ success: false, message: 'Not authorized: booking has no salon' });
      }
      if (booking.salon.vendor.toString() !== req.user.id.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: `Not authorized: salon vendor (${booking.salon.vendor.toString()}) does not match your ID (${req.user.id.toString()})` 
        });
      }
    }

    const services = await BookingService.find({ booking: booking._id }).populate('service', 'name price duration category').populate('staff', 'name avatar');
    const review = await require('../models/Review').findOne({ booking: booking._id });
    
    // Fetch existing staff reviews for this booking so frontend can show "Already rated" state
    const staffReviews = await require('../models/StaffReview').find({ booking: booking._id })
      .select('bookingService staff rating review createdAt');

    res.json({ success: true, data: { booking, services, review, staffReviews } });
  } catch (error) { next(error); }
};

// @desc    Accept booking (Vendor)
const acceptBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.acceptBooking(req.params.id, req.user.id);
    try {
      await notifyBookingAccepted(booking);
      const io = getIO();
      io.to(`user:${booking.user}`).emit('booking:update', { eventType: 'ACCEPTED', booking });
    } catch (e) { console.log('Notification error:', e.message); }
    res.json({ success: true, message: 'Booking accepted', data: booking });
  } catch (error) {
    if (error.message.includes('not authorized') || error.message.includes('Cannot')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Reject booking (Vendor)
const rejectBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.rejectBooking(req.params.id, req.user.id, req.body.reason);
    try {
      await notifyBookingRejected(booking);
      const io = getIO();
      io.to(`user:${booking.user}`).emit('booking:update', { eventType: 'REJECTED', booking });
    } catch (e) { console.log('Notification error:', e.message); }
    res.json({ success: true, message: 'Booking rejected', data: booking });
  } catch (error) {
    if (error.message.includes('not authorized') || error.message.includes('Cannot')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Cancel booking (User / Vendor / Admin)
const cancelBooking = async (req, res, next) => {
  try {
    const reason = req.body?.reason || req.body?.cancellationReason || '';
    const booking = await bookingService.cancelBooking(req.params.id, req.user.id, req.user.role, reason);
    try {
      const populatedBooking = await Booking.findById(booking._id).populate('salon');
      const io = getIO();
      const vendorId = populatedBooking?.salon?.vendor?.toString();
      const userId = booking.user?.toString();

      if (req.user.role === 'user') {
        if (vendorId) {
          await notifyBookingCancelled(booking, vendorId, 'vendor');
          io.to(`vendor:${vendorId}`).emit('booking:update', { eventType: 'CANCELLED', booking });
        }
      } else if (req.user.role === 'vendor') {
        if (userId) {
          await notifyBookingCancelled(booking, userId, 'user');
          io.to(`user:${userId}`).emit('booking:update', { eventType: 'CANCELLED', booking });
        }
      } else {
        // Admin or system cancellation
        if (vendorId) {
          await notifyBookingCancelled(booking, vendorId, 'vendor');
          io.to(`vendor:${vendorId}`).emit('booking:update', { eventType: 'CANCELLED', booking });
        }
        if (userId) {
          await notifyBookingCancelled(booking, userId, 'user');
          io.to(`user:${userId}`).emit('booking:update', { eventType: 'CANCELLED', booking });
        }
      }
      io.to('admin').emit('booking:update', { eventType: 'CANCELLED', booking });
    } catch (e) { console.log('Notification error:', e.message); }
    res.json({ success: true, message: 'Booking cancelled successfully', data: booking });
  } catch (error) {
    if (error.message.includes('not authorized') || error.message.includes('Cannot')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Complete booking (Vendor or User with OTP)
const completeBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.completeBooking(req.params.id, req.user.id, req.user.role, req.body.otp);

    // Realtime notification via Socket.IO
    try {
      const io = getIO();
      const populatedBooking = await Booking.findById(booking._id).populate('salon');
      io.to(`user:${booking.user}`).emit('booking:update', { eventType: 'COMPLETED', booking });
      if (populatedBooking?.salon?.vendor) {
        io.to(`vendor:${populatedBooking.salon.vendor}`).emit('booking:update', { eventType: 'COMPLETED', booking });
      }
    } catch (sockErr) {
      console.log('Socket notification error on complete:', sockErr.message);
    }

    // In-app notification for user
    try {
      await createNotification({
        recipientId: booking.user,
        recipientModel: 'User',
        recipientRole: 'user',
        type: 'BOOKING_COMPLETED',
        title: 'Service Completed!',
        message: 'Your salon appointment has been marked complete. Tap to share your rating & review!',
        data: { bookingId: booking._id, salonId: booking.salon },
      });
    } catch (notifErr) {
      console.log('In-app notification error on complete:', notifErr.message);
    }

    res.json({ success: true, message: 'Booking completed successfully', data: booking });
  } catch (error) {
    if (
      error.message.includes('not authorized') ||
      error.message.includes('Cannot') ||
      error.message.includes('OTP') ||
      error.message.includes('Invalid') ||
      error.message.includes('expired') ||
      error.message.includes('attempts')
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Mark booking as No-Show (Vendor)
const markNoShow = async (req, res, next) => {
  try {
    const booking = await bookingService.markNoShow(req.params.id, req.user.id);
    res.json({ success: true, message: 'Booking marked as no-show', data: booking });
  } catch (error) {
    if (error.message.includes('not authorized') || error.message.includes('Cannot') || error.message.includes('time')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Request OTP for booking completion (Vendor)
const requestCompletionOtp = async (req, res, next) => {
  try {
    const result = await bookingService.requestCompletionOtp(req.params.id, req.user.id);

    // Realtime Socket.IO emission to User App
    try {
      const io = getIO();
      if (result.userId) {
        io.to(`user:${result.userId}`).emit('booking:completion-requested', {
          bookingId: result.bookingId,
          otp: result.otp,
          salonName: result.salonName,
        });
        io.to(`user:${result.userId}`).emit('booking:update', {
          eventType: 'COMPLETION_REQUESTED',
          bookingId: result.bookingId,
          otp: result.otp,
        });
      }
    } catch (sockErr) {
      console.log('Socket notification error on OTP request:', sockErr.message);
    }

    // Create in-app notification for User
    try {
      if (result.userId) {
        await createNotification({
          recipientId: result.userId,
          recipientModel: 'User',
          recipientRole: 'user',
          type: 'BOOKING_COMPLETION_REQUESTED',
          title: 'Service Completion Code',
          message: `${result.salonName} has completed your service. Your confirmation code is ${result.otp}.`,
          data: { bookingId: result.bookingId, otp: result.otp },
        });
      }
    } catch (notifErr) {
      console.log('In-app notification error on OTP request:', notifErr.message);
    }

    res.json({ success: true, message: result.message, bookingId: result.bookingId });
  } catch (error) {
    if (error.message.includes('not authorized') || error.message.includes('Cannot') || error.message.includes('found')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Get availability for salon
const getAvailability = async (req, res, next) => {
  try {
    if (req.method === 'POST' && req.body.services) {
      const { date, services } = req.body;
      if (!date || !services || !services.length) return res.status(400).json({ success: false, message: 'Date and services are required' });
      const availability = await getComplexAvailability(req.params.salonId, date, services);
      return res.json({ success: true, data: availability });
    }

    const { date, duration = 30 } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
    const availability = await getSalonAvailability(req.params.salonId, date, parseInt(duration));
    res.json({ success: true, data: availability });
  } catch (error) { next(error); }
};

// @desc    Get all bookings (Admin)
const getAllBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const bookings = await Booking.find(query).populate('salon', 'name').populate('user', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    const total = await Booking.countDocuments(query);

    res.json({ success: true, data: { bookings, total, page: parseInt(page), totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

// @desc    Get all recent bookings across all vendor's salons (Vendor Dashboard)
const getVendorRecentBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 5, salon, status } = req.query;
    const salons = await Salon.find({ vendor: req.user.id }, '_id');
    const salonIds = salons.map(s => s._id);

    let targetSalonIds = salonIds;
    if (salon) {
      if (!salonIds.some(id => id.toString() === salon.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized for this salon' });
      }
      targetSalonIds = [new mongoose.Types.ObjectId(salon)];
    }

    const query = { salon: { $in: targetSalonIds } };
    if (status) {
      query.status = status;
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await Booking.find(query)
      .populate('salon', 'name address')
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalItems = await Booking.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPreviousPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard statistics for vendor
const getVendorStats = async (req, res, next) => {
  try {
    const { salon } = req.query;
    const salons = await Salon.find({ vendor: req.user.id }, '_id');
    const salonIds = salons.map(s => s._id);

    let targetSalonIds = salonIds;
    if (salon) {
      if (!salonIds.some(id => id.toString() === salon.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized for this salon' });
      }
      targetSalonIds = [new mongoose.Types.ObjectId(salon)];
    }

    const range = req.query.range || '30d';
    let startDate = new Date();

    if (range === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (range === '30d') startDate.setDate(startDate.getDate() - 30);
    else if (range === '3m') startDate.setMonth(startDate.getMonth() - 3);
    else if (range === '6m') startDate.setMonth(startDate.getMonth() - 6);
    else if (range === '12m') startDate.setFullYear(startDate.getFullYear() - 1);
    else startDate.setDate(startDate.getDate() - 30);

    const dateFilter = { createdAt: { $gte: startDate } };

    // Get counts per status
    const statsPipeline = [
      { $match: { ...dateFilter, salon: { $in: targetSalonIds } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ];

    const revenuePipeline = [
      {
        $match: {
          ...dateFilter,
          salon: { $in: targetSalonIds },
          status: 'PAID' // PaymentTransaction status
        }
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$pricing.vendorNetAmount' },
          totalGrossCustomerPaid: { $sum: '$amount' },
          onlinePayments: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'ONLINE'] }, '$amount', 0] } },
          cashPayments: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'CASH'] }, '$amount', 0] } }
        }
      }
    ];

    // Today's revenue for a specific card (unaffected by range filter)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayRevenuePipeline = [
      {
        $match: {
          salon: { $in: targetSalonIds },
          status: 'PAID',
          createdAt: { $gte: startOfToday }
        }
      },
      {
        $group: {
          _id: null,
          todayRevenue: { $sum: '$pricing.vendorNetAmount' }
        }
      }
    ];

    const [statusStats, revenueStats, todayStats] = await Promise.all([
      Booking.aggregate(statsPipeline),
      PaymentTransaction.aggregate(revenuePipeline),
      PaymentTransaction.aggregate(todayRevenuePipeline)
    ]);

    let pendingBookings = 0;
    let confirmedBookings = 0;
    let completedBookings = 0;
    let totalBookings = 0;

    statusStats.forEach(stat => {
      totalBookings += stat.count;
      if (stat._id === 'PENDING') pendingBookings = stat.count;
      if (stat._id === 'CONFIRMED') confirmedBookings = stat.count;
      if (stat._id === 'COMPLETED') completedBookings = stat.count;
    });

    const revenue = revenueStats[0] || { totalEarnings: 0, totalGrossCustomerPaid: 0, onlinePayments: 0, cashPayments: 0 };
    const todayRevenue = todayStats[0]?.todayRevenue || 0;

    res.json({
      success: true,
      data: {
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        totalEarnings: revenue.totalEarnings,
        totalGrossCustomerPaid: revenue.totalGrossCustomerPaid,
        onlinePayments: revenue.onlinePayments,
        cashPayments: revenue.cashPayments,
        todayRevenue
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get analytics for vendor
const getVendorAnalytics = async (req, res, next) => {
  try {
    const { range = '7d', salon } = req.query;
    let days = 7;
    if (range === '30d') days = 30;
    else if (range === '3m') days = 90;
    else if (range === '6m') days = 180;
    else if (range === '12m') days = 365;

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - days);

    const salons = await Salon.find({ vendor: req.user.id }, '_id name');
    const salonIds = salons.map(s => s._id);

    let targetSalonIds = salonIds;
    if (salon) {
      if (!salonIds.some(id => id.toString() === salon.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized for this salon' });
      }
      targetSalonIds = [new mongoose.Types.ObjectId(salon)];
    }

    // 1. Booking Trend (Group by day or month)
    const groupByFormat = days > 90 ? "%Y-%m" : "%Y-%m-%d";

    const bookingTrendPipeline = [
      {
        $match: {
          salon: { $in: targetSalonIds },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: groupByFormat, date: "$createdAt" } },
          bookings: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    // 2. Revenue Trend (from PaymentTransaction)
    const revenueTrendPipeline = [
      {
        $match: {
          salon: { $in: targetSalonIds },
          status: 'PAID',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: groupByFormat, date: "$createdAt" } },
          revenue: { $sum: "$pricing.vendorNetAmount" },
          grossCustomerPaid: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ];

    // 3. Booking Status
    const statusPipeline = [
      {
        $match: {
          salon: { $in: targetSalonIds },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$status",
          value: { $sum: 1 }
        }
      },
      {
        $project: {
          name: "$_id",
          value: 1,
          _id: 0
        }
      }
    ];

    // 4. Salon Performance
    const salonPerformancePipeline = [
      {
        $match: {
          salon: { $in: targetSalonIds },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$salon",
          bookings: { $sum: 1 },
          revenue: {
            $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$finalAmount", 0] }
          }
        }
      }
    ];

    // 5. Top Services & Staff Performance (from BookingService)
    const serviceStaffPipeline = [
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking',
          foreignField: '_id',
          as: 'bookingDoc'
        }
      },
      { $unwind: '$bookingDoc' },
      {
        $match: {
          'bookingDoc.salon': { $in: salonIds },
          'bookingDoc.createdAt': { $gte: startDate }
        }
      }
    ];

    const topServicesPipeline = [
      ...serviceStaffPipeline,
      {
        $group: {
          _id: "$service",
          bookings: { $sum: 1 }
        }
      },
      { $sort: { bookings: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: '_id',
          as: 'serviceDoc'
        }
      },
      { $unwind: '$serviceDoc' },
      {
        $project: {
          name: "$serviceDoc.name",
          bookings: 1,
          _id: 0
        }
      }
    ];

    const staffPerformancePipeline = [
      ...serviceStaffPipeline,
      {
        $match: {
          'staff': { $ne: null },
          'bookingDoc.status': 'COMPLETED'
        }
      },
      {
        $group: {
          _id: "$staff",
          bookings: { $sum: 1 }
        }
      },
      { $sort: { bookings: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'staffs',
          localField: '_id',
          foreignField: '_id',
          as: 'staffDoc'
        }
      },
      { $unwind: { path: '$staffDoc', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ["$staffDoc.name", "Unknown"] },
          bookings: 1,
          _id: 0
        }
      }
    ];

    const [
      rawBookingTrend,
      rawRevenueTrend,
      bookingStatus,
      rawSalonPerformance,
      topServices,
      staffPerformance
    ] = await Promise.all([
      Booking.aggregate(bookingTrendPipeline),
      PaymentTransaction.aggregate(revenueTrendPipeline),
      Booking.aggregate(statusPipeline),
      Booking.aggregate(salonPerformancePipeline),
      BookingService.aggregate(topServicesPipeline),
      BookingService.aggregate(staffPerformancePipeline)
    ]);

    // Format trends to ensure dates are nicely mapped
    const bookingTrend = rawBookingTrend.map(item => ({ date: item._id, bookings: item.bookings }));
    const revenueTrend = rawRevenueTrend.map(item => ({ date: item._id, revenue: item.revenue }));

    // Format salon performance to inject real salon names
    const salonPerformance = rawSalonPerformance.map(item => {
      const salonMatch = salons.find(s => s._id.toString() === item._id.toString());
      return {
        name: salonMatch ? salonMatch.name : 'Unknown Salon',
        bookings: item.bookings,
        revenue: item.revenue
      };
    });

    res.json({
      success: true,
      data: {
        bookingTrend,
        revenueTrend,
        bookingStatus,
        salonPerformance,
        topServices,
        staffPerformance
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBooking,
  calculateTotal,
  getMyBookings,
  getSalonBookings,
  getBookingById,
  acceptBooking,
  rejectBooking,
  cancelBooking,
  completeBooking,
  markNoShow,
  requestCompletionOtp,
  getAvailability,
  getAllBookings,
  getVendorRecentBookings,
  getVendorStats,
  getVendorAnalytics
};
