const User = require('../models/User');
const { processAndStoreImage, deleteImageSafe } = require('../services/imageService');

// @desc    Get all users (Admin)
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;
    const query = { role: 'user' };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await User.countDocuments(query);

    res.json({ success: true, data: { users, total, page: parseInt(page), totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

// @desc    Get user by ID
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) { next(error); }
};

// @desc    Update user profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, city, email } = req.body;
    let newImage = null;

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let oldImage = currentUser.avatar;

    // We only process if there is a file. If req.body.avatar is empty, it might mean user removed it (if we support that feature).
    if (req.file) {
      newImage = await processAndStoreImage(req.file.buffer, 'user');
    }

    const updateData = { name, phone, city };
    if (email) updateData.email = email;
    if (newImage) {
      updateData.avatar = newImage;
    } else if (req.body.avatar === '') {
      // If frontend explicitly sends empty string, they want to remove the photo
      updateData.avatar = '';
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateData, { new: true, runValidators: true }).select('-password');
    
    // Cleanup old image if it was replaced or removed, AND if it's not a Base64 string (handled during migration)
    if ((newImage || req.body.avatar === '') && oldImage && !oldImage.startsWith('data:')) {
      deleteImageSafe(oldImage);
    }

    res.json({ success: true, message: 'Profile updated', data: updatedUser });
  } catch (error) {
    if (req.file && error) {
       // newImage would be deleted here if we had access to it, but processAndStoreImage could have failed.
       // It's safe to just let it pass if DB update failed, as newImage might not have been created yet or we can't reliably delete it without the filename.
    }
    next(error);
  }
};

// @desc    Update user location
const updateLocation = async (req, res, next) => {
  try {
    const { latitude, longitude, city, formattedAddress } = req.body;
    
    // Validate coordinates
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    const user = await User.findByIdAndUpdate(req.user.id, {
      location: { type: 'Point', coordinates: [lng, lat] },
      ...(city && { city }),
      ...(formattedAddress && { formattedAddress }),
    }, { new: true }).select('-password');
    res.json({ success: true, message: 'Location updated', data: user });
  } catch (error) { next(error); }
};

// @desc    Toggle user active status (Admin)
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, data: user });
  } catch (error) { next(error); }
};

// @desc    Update FCM token
const updateFcmToken = async (req, res, next) => {
  try {
    const rawWebToken = req.body.fcmtoken !== undefined ? req.body.fcmtoken : undefined;
    const rawMobileToken = req.body.fcmtokenmobile !== undefined ? req.body.fcmtokenmobile : undefined;
    const legacyToken = req.body.token !== undefined ? req.body.token : req.body.fcmToken;
    const platform = (req.body.platform || '').toLowerCase();

    const updateOps = {};

    // Helper to format tokens into a clean array of non-empty strings
    const toTokenArray = (val) => {
      if (Array.isArray(val)) {
        return val.map((t) => String(t).trim()).filter(Boolean);
      }
      if (typeof val === 'string' && val.trim()) {
        return [val.trim()];
      }
      return [];
    };

    if (rawWebToken !== undefined) {
      const tokens = toTokenArray(rawWebToken);
      if (tokens.length > 0) {
        updateOps.$addToSet = updateOps.$addToSet || {};
        updateOps.$addToSet.fcmtoken = { $each: tokens };
      }
    }

    if (rawMobileToken !== undefined) {
      const tokens = toTokenArray(rawMobileToken);
      if (tokens.length > 0) {
        updateOps.$addToSet = updateOps.$addToSet || {};
        updateOps.$addToSet.fcmtokenmobile = { $each: tokens };
      }
    }

    // Support legacy payload: { token: '...', platform: 'web'|'android'|'ios' }
    if (legacyToken !== undefined && rawWebToken === undefined && rawMobileToken === undefined) {
      const tokens = toTokenArray(legacyToken);
      if (tokens.length > 0) {
        updateOps.$addToSet = updateOps.$addToSet || {};
        const isMobile = ['android', 'ios', 'mobile'].includes(platform);
        const targetField = isMobile ? 'fcmtokenmobile' : 'fcmtoken';
        updateOps.$addToSet[targetField] = { $each: tokens };
      }
    }

    if (!updateOps.$addToSet) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid fcmtoken (web) or fcmtokenmobile (mobile) token is required' 
      });
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateOps, { new: true });

    res.json({
      success: true,
      message: 'FCM token saved successfully',
      role: 'user',
      data: {
        fcmtoken: updatedUser?.fcmtoken || [],
        fcmtokenmobile: updatedUser?.fcmtokenmobile || []
      }
    });
  } catch (error) { next(error); }
};

// @desc    Delete user account (Soft Delete)
// @route   DELETE /api/users/account
const deleteAccount = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.accountStatus === 'deleted') {
      return res.status(400).json({ success: false, message: 'Account is already deleted' });
    }

    user.accountStatus = 'deleted';
    user.deleteAccount = {
      deletedAt: new Date(),
      deletedBy: 'user',
      reason: reason || null
    };

    // Note: We don't change recoverAccount here because they might have previously 
    // recovered and deleted again, or they might request recovery later. 
    // Wait, if they had a previous recovery request that was rejected, should we clear it? 
    // Better to clear `recoverAccount` to reset state.
    user.recoverAccount = {
      requestedAt: null,
      reason: null,
      recoveredAt: null,
      recoveredBy: null
    };

    await user.save();

    // In a real production app, we would also clear active sessions, tokens, etc.
    // For JWT based flow without token blacklisting, the frontend clearing token is sufficient.
    // If we have FCM tokens, we might want to clear it so we don't send notifications to deleted users.
    await User.findByIdAndUpdate(req.user.id, { fcmtoken: [], fcmtokenmobile: [] });

    res.json({
      success: true,
      message: 'Your account has been deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove FCM token (on logout)
// @route   POST /api/users/fcm-token/remove
const removeFcmToken = async (req, res, next) => {
  try {
    const rawWebToken = req.body.fcmtoken !== undefined ? req.body.fcmtoken : undefined;
    const rawMobileToken = req.body.fcmtokenmobile !== undefined ? req.body.fcmtokenmobile : undefined;
    const legacyToken = req.body.token !== undefined ? req.body.token : req.body.fcmToken;
    const platform = (req.body.platform || '').toLowerCase();

    const pullOps = {};

    if (rawWebToken) {
      pullOps.$pull = pullOps.$pull || {};
      pullOps.$pull.fcmtoken = String(rawWebToken).trim();
    }
    if (rawMobileToken) {
      pullOps.$pull = pullOps.$pull || {};
      pullOps.$pull.fcmtokenmobile = String(rawMobileToken).trim();
    }
    if (legacyToken && !rawWebToken && !rawMobileToken) {
      pullOps.$pull = pullOps.$pull || {};
      const tokenStr = String(legacyToken).trim();
      if (['android', 'ios', 'mobile'].includes(platform)) {
        pullOps.$pull.fcmtokenmobile = tokenStr;
      } else if (platform === 'web') {
        pullOps.$pull.fcmtoken = tokenStr;
      } else {
        pullOps.$pull.fcmtoken = tokenStr;
        pullOps.$pull.fcmtokenmobile = tokenStr;
      }
    }

    if (Object.keys(pullOps).length > 0) {
      await User.findByIdAndUpdate(req.user.id, pullOps);
    }

    res.json({
      success: true,
      message: 'FCM token removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send test notification to saved device tokens in DB
// @route   POST /api/users/test-notification
const sendTestNotification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const webTokens = Array.isArray(user.fcmtoken) ? user.fcmtoken : [];
    const mobileTokens = Array.isArray(user.fcmtokenmobile) ? user.fcmtokenmobile : [];
    const allTokens = [...new Set([...webTokens, ...mobileTokens])].filter(
      (t) => typeof t === 'string' && t.trim() !== ''
    );

    if (allTokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No FCM token found in database for your account. Please allow notification permission on your device first.',
      });
    }

    const admin = require('../utils/firebase');
    if (!admin || !admin.apps || admin.apps.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Firebase Admin is not configured or initialized on the server.',
      });
    }

    const title = '🔔 Test Notification';
    const body = `Hello ${user.name || 'Customer'}! Push notifications are configured and working properly.`;

    const messagePayload = {
      notification: {
        title,
        body,
      },
      webpush: {
        notification: {
          title,
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          requireInteraction: true,
        },
        fcmOptions: {
          link: '/profile',
        },
      },
      data: {
        type: 'TEST_NOTIFICATION',
        title,
        body,
        message: body,
        timestamp: String(Date.now()),
      },
    };

    const result = await admin.messaging().sendEachForMulticast({
      tokens: allTokens,
      ...messagePayload,
    });

    // Automatically clean up stale / unregistered / mismatched project tokens from DB
    const staleTokens = [];
    if (result && Array.isArray(result.responses)) {
      result.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errStr = ((resp.error.code || '') + ' ' + (resp.error.message || '')).toLowerCase();
          if (
            errStr.includes('registration-token-not-registered') ||
            errStr.includes('invalid-registration-token') ||
            errStr.includes('mismatched-credential') ||
            errStr.includes('third party') ||
            errStr.includes('third-party') ||
            errStr.includes('notregistered')
          ) {
            staleTokens.push(allTokens[idx]);
          }
        }
      });
      if (staleTokens.length > 0) {
        await User.findByIdAndUpdate(req.user.id, {
          $pull: {
            fcmtoken: { $in: staleTokens },
            fcmtokenmobile: { $in: staleTokens },
          },
        });
      }
    }

    if (result.successCount === 0 && staleTokens.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Old Firebase project token was cleared. Please refresh the page (F5) once so your new token registers, then click Test again!',
        clearedTokensCount: staleTokens.length,
      });
    }

    res.json({
      success: true,
      message: 'Test notification sent successfully to your saved device(s)!',
      sentToTokensCount: allTokens.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      result,
    });
  } catch (error) {
    console.error('User test notification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send test notification',
    });
  }
};

module.exports = { 
  getUsers, 
  getUserById, 
  updateProfile, 
  updateLocation, 
  toggleUserStatus, 
  updateFcmToken, 
  removeFcmToken,
  sendTestNotification,
  deleteAccount 
};
