const Notification = require('../models/Notification');
const { getIO } = require('../config/socket');

/**
 * Create and deliver a notification
 * Saves to MongoDB and emits via Socket.IO in real-time
 */
const createNotification = async ({
  recipientId,
  recipientModel,
  recipientRole,
  type,
  title,
  message,
  data = {},
}) => {
  // Save to database
  const notification = await Notification.create({
    recipient: recipientId,
    recipientModel,
    recipientRole,
    type,
    title,
    message,
    data,
  });

  // Emit via Socket.IO
  try {
    const io = getIO();
    const room = recipientRole === 'admin' ? 'admin' : `${recipientRole}:${recipientId}`;
    io.to(room).emit('notification:new', {
      _id: notification._id,
      type,
      title,
      message,
      data,
      isRead: false,
      createdAt: notification.createdAt,
    });
  } catch (error) {
    // Socket.IO might not be initialized during testing
    console.log('Socket.IO not available for notification delivery');
  }

  // Send Firebase Push Notification
  try {
    const admin = require('../utils/firebase');
    if (admin && admin.apps && admin.apps.length > 0) {
      let recipient;
      if (recipientModel === 'User') {
        const User = require('../models/User');
        recipient = await User.findById(recipientId);
      } else if (recipientModel === 'Vendor') {
        const Vendor = require('../models/Vendor');
        recipient = await Vendor.findById(recipientId);
      }

      // Collect all tokens from web (fcmtoken) and mobile (fcmtokenmobile)
      const webTokens = Array.isArray(recipient?.fcmtoken) ? recipient.fcmtoken : [];
      const mobileTokens = Array.isArray(recipient?.fcmtokenmobile) ? recipient.fcmtokenmobile : [];
      const legacyTokens = recipient?.fcmToken ? [recipient.fcmToken] : [];

      const allTokens = [...new Set([...webTokens, ...mobileTokens, ...legacyTokens])].filter(
        (t) => typeof t === 'string' && t.trim() !== ''
      );

      if (allTokens.length > 0) {
        const payloadData = Object.keys(data || {}).reduce((acc, key) => {
          acc[key] = String(data[key]);
          return acc;
        }, { type: String(type || '') });

        const messagePayload = {
          notification: {
            title: String(title || ''),
            body: String(message || ''),
          },
          webpush: {
            notification: {
              title: String(title || ''),
              body: String(message || ''),
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              requireInteraction: true,
            },
            fcmOptions: {
              link: '/',
            },
          },
          data: payloadData,
        };

        if (allTokens.length === 1) {
          await admin.messaging().send({
            token: allTokens[0],
            ...messagePayload,
          });
        } else {
          await admin.messaging().sendEachForMulticast({
            tokens: allTokens,
            ...messagePayload,
          });
        }
      }
    }
  } catch (error) {
    console.error('Firebase Push Notification error:', error);
  }

  return notification;
};

/**
 * Send booking-created notification to vendor
 */
const notifyBookingCreated = async (booking, vendorId) => {
  return createNotification({
    recipientId: vendorId,
    recipientModel: 'Vendor',
    recipientRole: 'vendor',
    type: 'BOOKING_CREATED',
    title: 'New Booking Received',
    message: `New booking request from ${booking.user?.name || 'a customer'} for ${new Date(booking.bookingDate).toLocaleDateString()}`,
    data: { bookingId: booking._id, salonId: booking.salon },
  });
};

/**
 * Send booking-accepted notification to user
 */
const notifyBookingAccepted = async (booking) => {
  return createNotification({
    recipientId: booking.user,
    recipientModel: 'User',
    recipientRole: 'user',
    type: 'BOOKING_ACCEPTED',
    title: 'Booking Confirmed!',
    message: `Your booking for ${new Date(booking.bookingDate).toLocaleDateString()} at ${booking.startTime} has been confirmed.`,
    data: { bookingId: booking._id, salonId: booking.salon },
  });
};

/**
 * Send booking-rejected notification to user
 */
const notifyBookingRejected = async (booking) => {
  return createNotification({
    recipientId: booking.user,
    recipientModel: 'User',
    recipientRole: 'user',
    type: 'BOOKING_REJECTED',
    title: 'Booking Rejected',
    message: `Your booking for ${new Date(booking.bookingDate).toLocaleDateString()} has been declined.${booking.rejectionReason ? ' Reason: ' + booking.rejectionReason : ''}`,
    data: { bookingId: booking._id, salonId: booking.salon },
  });
};

/**
 * Send booking-cancelled notification
 */
const notifyBookingCancelled = async (booking, recipientId, recipientRole) => {
  const recipientModel = recipientRole === 'vendor' ? 'Vendor' : 'User';
  return createNotification({
    recipientId,
    recipientModel,
    recipientRole,
    type: 'BOOKING_CANCELLED',
    title: 'Booking Cancelled',
    message: `Booking for ${new Date(booking.bookingDate).toLocaleDateString()} at ${booking.startTime} has been cancelled.`,
    data: { bookingId: booking._id, cancellationFee: booking.cancellationFee, salonId: booking.salon },
  });
};

/**
 * Send package approval notification to vendor
 */
const notifyPackageStatus = async (pkg, vendorId, status) => {
  const type = status === 'ACTIVE' ? 'PACKAGE_APPROVED' : 'PACKAGE_REJECTED';
  const title = status === 'ACTIVE' ? 'Package Approved!' : 'Package Rejected';
  return createNotification({
    recipientId: vendorId,
    recipientModel: 'Vendor',
    recipientRole: 'vendor',
    type,
    title,
    message: `Your package "${pkg.name}" has been ${status === 'ACTIVE' ? 'approved' : 'rejected'}.${pkg.adminNote ? ' Note: ' + pkg.adminNote : ''}`,
    data: { packageId: pkg._id },
  });
};

/**
 * Send offer approval notification to vendor
 */
const notifyOfferStatus = async (offer, vendorId, status) => {
  const type = status === 'ACTIVE' ? 'OFFER_APPROVED' : 'OFFER_REJECTED';
  const title = status === 'ACTIVE' ? 'Offer Approved!' : 'Offer Rejected';
  return createNotification({
    recipientId: vendorId,
    recipientModel: 'Vendor',
    recipientRole: 'vendor',
    type,
    title,
    message: `Your offer "${offer.title}" has been ${status === 'ACTIVE' ? 'approved' : 'rejected'}.${offer.adminNote ? ' Note: ' + offer.adminNote : ''}`,
    data: { offerId: offer._id },
  });
};

/**
 * Send admin notification for package/offer approval requests
 */
const notifyAdminApprovalRequest = async (type, itemName, vendorName) => {
  // Find admin user
  const User = require('../models/User');
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) return;

  const notifType = type === 'package' ? 'PACKAGE_APPROVAL_REQUEST' : 'OFFER_APPROVAL_REQUEST';
  return createNotification({
    recipientId: admin._id,
    recipientModel: 'User',
    recipientRole: 'admin',
    type: notifType,
    title: `New ${type === 'package' ? 'Package' : 'Offer'} Approval Request`,
    message: `${vendorName} has submitted "${itemName}" for approval.`,
    data: {},
  });
};

module.exports = {
  createNotification,
  notifyBookingCreated,
  notifyBookingAccepted,
  notifyBookingRejected,
  notifyBookingCancelled,
  notifyPackageStatus,
  notifyOfferStatus,
  notifyAdminApprovalRequest,
};
