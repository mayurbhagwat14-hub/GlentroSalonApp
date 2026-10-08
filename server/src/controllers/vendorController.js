const Vendor = require('../models/Vendor');
const Salon = require('../models/Salon');
const { sanitizeVendorForPublic, sanitizeVendorForVendor, sanitizeVendorForAdmin } = require('../utils/kycUtils');
const { processAndStoreImage, deleteImageSafe } = require('../services/imageService');

// @desc    Get all vendors (Admin)
const getVendors = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, isApproved, isActive } = req.query;
    const query = {};
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { businessName: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    if (isApproved !== undefined) query.isApproved = isApproved === 'true';
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const vendors = await Vendor.find(query).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    const total = await Vendor.countDocuments(query);

    res.json({ success: true, data: { vendors, total, page: parseInt(page), totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

// @desc    Get vendor by ID (Admin gets full data, Vendor gets own masked data, others get public)
const getVendorById = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id).select('-password');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    const salons = await Salon.find({ vendor: vendor._id });

    let sanitizedVendor;
    if (req.user.role === 'admin') {
      sanitizedVendor = sanitizeVendorForAdmin(vendor);
    } else if (req.user.role === 'vendor' && req.user.id.toString() === vendor._id.toString()) {
      sanitizedVendor = sanitizeVendorForVendor(vendor);
    } else {
      sanitizedVendor = sanitizeVendorForPublic(vendor);
    }

    res.json({ success: true, data: { vendor: sanitizedVendor, salons } });
  } catch (error) { next(error); }
};

// @desc    Get vendor's own profile (masked sensitive data)
// @route   GET /api/vendors/me
const getOwnProfile = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.user.id).select('-password');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    const salons = await Salon.find({ vendor: vendor._id }).select('name city status isActive isApproved');
    const sanitized = sanitizeVendorForVendor(vendor);
    res.json({ success: true, data: { vendor: sanitized, salons } });
  } catch (error) { next(error); }
};

// @desc    Update vendor profile (personal + business info)
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, email, businessName, businessType, businessDescription, businessEmail, businessContact, registeredAddress, city, state, country } = req.body;
    let newImage = null;

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    let oldImage = vendor.avatar;

    if (req.file) {
      newImage = await processAndStoreImage(req.file.buffer, 'vendor');
    }

    const updateData = {};
    // Personal fields
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (businessName !== undefined) updateData.businessName = businessName;
    // Business fields
    if (businessType !== undefined) updateData.businessType = businessType;
    if (businessDescription !== undefined) updateData.businessDescription = businessDescription;
    if (businessEmail !== undefined) updateData.businessEmail = businessEmail;
    if (businessContact !== undefined) updateData.businessContact = businessContact;
    if (registeredAddress !== undefined) updateData.registeredAddress = registeredAddress;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (country !== undefined) updateData.country = country;

    if (newImage) {
      updateData.avatar = newImage;
    } else if (req.body.avatar === '') {
      updateData.avatar = '';
    }

    const updatedVendor = await Vendor.findByIdAndUpdate(req.user.id, updateData, { new: true, runValidators: true }).select('-password');
    
    // Cleanup old image
    if ((newImage || req.body.avatar === '') && oldImage && !oldImage.startsWith('data:')) {
      deleteImageSafe(oldImage);
    }

    res.json({ success: true, message: 'Profile updated', data: sanitizeVendorForVendor(updatedVendor) });
  } catch (error) { next(error); }
};

// @desc    Submit/update KYC documents (Vendor)
// @route   PUT /api/vendors/kyc
const updateKyc = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const { aadhaarNumber, panNumber } = req.body;
    const updateData = {};

    if (aadhaarNumber) updateData['kyc.aadhaarNumber'] = aadhaarNumber;
    if (panNumber) updateData['kyc.panNumber'] = panNumber;

    // Handle KYC document uploads
    if (req.files) {
      if (req.files.aadhaarFront && req.files.aadhaarFront[0]) {
        const filename = await processAndStoreImage(req.files.aadhaarFront[0].buffer, 'kyc');
        if (vendor.kyc?.aadhaarFront) deleteImageSafe(vendor.kyc.aadhaarFront);
        updateData['kyc.aadhaarFront'] = filename;
      }
      if (req.files.aadhaarBack && req.files.aadhaarBack[0]) {
        const filename = await processAndStoreImage(req.files.aadhaarBack[0].buffer, 'kyc');
        if (vendor.kyc?.aadhaarBack) deleteImageSafe(vendor.kyc.aadhaarBack);
        updateData['kyc.aadhaarBack'] = filename;
      }
      if (req.files.panCard && req.files.panCard[0]) {
        const filename = await processAndStoreImage(req.files.panCard[0].buffer, 'kyc');
        if (vendor.kyc?.panCard) deleteImageSafe(vendor.kyc.panCard);
        updateData['kyc.panCard'] = filename;
      }
    }

    // Set KYC status to submitted if documents are being uploaded
    if (Object.keys(updateData).length > 0) {
      if (vendor.kycStatus === 'pending' || vendor.kycStatus === 'rejected') {
        updateData.kycStatus = 'submitted';
      }
    }

    const updated = await Vendor.findByIdAndUpdate(req.user.id, updateData, { new: true }).select('-password');
    res.json({ success: true, message: 'KYC documents updated', data: sanitizeVendorForVendor(updated) });
  } catch (error) { next(error); }
};

// @desc    Update bank/payout details (Vendor)
// @route   PUT /api/vendors/bank
const updateBankDetails = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const { accountHolderName, accountNumber, confirmAccountNumber, ifscCode, bankName, bankBranch, upiId } = req.body;

    // Validate account number confirmation
    if (accountNumber && confirmAccountNumber && accountNumber !== confirmAccountNumber) {
      return res.status(400).json({ success: false, message: 'Account numbers do not match' });
    }

    const updateData = {};
    if (accountHolderName !== undefined) updateData['bank.accountHolderName'] = accountHolderName;
    if (accountNumber !== undefined) updateData['bank.accountNumber'] = accountNumber;
    if (ifscCode !== undefined) updateData['bank.ifscCode'] = ifscCode;
    if (bankName !== undefined) updateData['bank.bankName'] = bankName;
    if (bankBranch !== undefined) updateData['bank.bankBranch'] = bankBranch;
    if (upiId !== undefined) updateData['bank.upiId'] = upiId;

    const updated = await Vendor.findByIdAndUpdate(req.user.id, updateData, { new: true }).select('-password');
    res.json({ success: true, message: 'Bank details updated', data: sanitizeVendorForVendor(updated) });
  } catch (error) { next(error); }
};

// @desc    Serve KYC document (authenticated access only)
// @route   GET /api/vendors/documents/:field
const getKycDocument = async (req, res, next) => {
  try {
    const { field } = req.params;
    const allowedFields = ['aadhaarFront', 'aadhaarBack', 'panCard'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({ success: false, message: 'Invalid document type' });
    }

    let vendor;
    if (req.user.role === 'admin') {
      // Admin can access any vendor's documents via query param
      const vendorId = req.query.vendorId;
      if (!vendorId) return res.status(400).json({ success: false, message: 'vendorId is required' });
      vendor = await Vendor.findById(vendorId);
    } else if (req.user.role === 'vendor') {
      // Vendor can only access their own documents
      vendor = await Vendor.findById(req.user.id);
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const filePath = vendor.kyc?.[field];
    if (!filePath) return res.status(404).json({ success: false, message: 'Document not found' });

    // Resolve and serve the file
    const path = require('path');
    const fs = require('fs');
    const fullPath = path.join(__dirname, '..', '..', 'uploads', filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, message: 'Document file not found' });
    }

    res.sendFile(fullPath);
  } catch (error) { next(error); }
};

// @desc    Approve vendor (Admin)
const approveVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true }).select('-password');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    // Also approve their salons
    await Salon.updateMany({ vendor: vendor._id }, { isApproved: true });
    res.json({ success: true, message: 'Vendor approved', data: vendor });
  } catch (error) { next(error); }
};

// @desc    Reject vendor (Admin)
const rejectVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, { isApproved: false }, { new: true }).select('-password');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, message: 'Vendor rejected', data: vendor });
  } catch (error) { next(error); }
};

// @desc    Toggle vendor active status (Admin) — also cascades to salons
const toggleVendorStatus = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    vendor.isActive = !vendor.isActive;
    vendor.accountStatus = vendor.isActive ? 'active' : 'suspended';
    await vendor.save();

    // When vendor is suspended, deactivate all their salons
    if (!vendor.isActive) {
      await Salon.updateMany({ vendor: vendor._id }, { isActive: false, status: 'suspended' });
    }

    res.json({ success: true, message: `Vendor ${vendor.isActive ? 'activated' : 'deactivated'}`, data: vendor });
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

    const isMobile = ['android', 'ios', 'mobile'].includes(platform);

    if (rawMobileToken !== undefined) {
      const tokens = toTokenArray(rawMobileToken);
      if (tokens.length > 0) {
        updateOps.$addToSet = updateOps.$addToSet || {};
        updateOps.$addToSet.fcmtokenmobile = { $each: tokens };
      }
    }

    if (rawWebToken !== undefined) {
      const tokens = toTokenArray(rawWebToken);
      if (tokens.length > 0) {
        updateOps.$addToSet = updateOps.$addToSet || {};
        const targetField = isMobile ? 'fcmtokenmobile' : 'fcmtoken';
        updateOps.$addToSet[targetField] = { $each: tokens };
      }
    }

    if (legacyToken !== undefined && rawWebToken === undefined && rawMobileToken === undefined) {
      const tokens = toTokenArray(legacyToken);
      if (tokens.length > 0) {
        updateOps.$addToSet = updateOps.$addToSet || {};
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

    const updatedVendor = await Vendor.findByIdAndUpdate(req.user.id, updateOps, { new: true });

    res.json({
      success: true,
      message: 'FCM token saved successfully',
      role: 'vendor',
      data: {
        fcmtoken: updatedVendor?.fcmtoken || [],
        fcmtokenmobile: updatedVendor?.fcmtokenmobile || []
      }
    });
  } catch (error) { next(error); }
};

// @desc    Remove FCM token (on logout)
// @route   POST /api/vendors/fcm-token/remove
const removeFcmToken = async (req, res, next) => {
  try {
    const rawWebToken = req.body.fcmtoken !== undefined ? req.body.fcmtoken : undefined;
    const rawMobileToken = req.body.fcmtokenmobile !== undefined ? req.body.fcmtokenmobile : undefined;
    const legacyToken = req.body.token !== undefined ? req.body.token : req.body.fcmToken;
    const platform = (req.body.platform || '').toLowerCase();
    const isMobile = ['android', 'ios', 'mobile'].includes(platform);

    const pullOps = {};

    const targetToken = String(rawWebToken || rawMobileToken || legacyToken || '').trim();
    if (targetToken) {
      pullOps.$pull = pullOps.$pull || {};
      if (isMobile) {
        pullOps.$pull.fcmtokenmobile = targetToken;
      } else if (platform === 'web') {
        pullOps.$pull.fcmtoken = targetToken;
      } else {
        pullOps.$pull.fcmtoken = targetToken;
        pullOps.$pull.fcmtokenmobile = targetToken;
      }
    }

    if (Object.keys(pullOps).length > 0) {
      await Vendor.findByIdAndUpdate(req.user.id, pullOps);
    }

    res.json({
      success: true,
      message: 'FCM token removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send test notification to vendor's saved device tokens in DB
// @route   POST /api/vendors/test-notification
const sendTestNotification = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const webTokens = Array.isArray(vendor.fcmtoken) ? vendor.fcmtoken : [];
    const mobileTokens = Array.isArray(vendor.fcmtokenmobile) ? vendor.fcmtokenmobile : [];
    const allTokens = [...new Set([...webTokens, ...mobileTokens])].filter(
      (t) => typeof t === 'string' && t.trim() !== ''
    );

    if (allTokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No FCM token found in database for your vendor account. Please allow notification permission on your device first.',
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
    const body = `Hello ${vendor.businessName || vendor.name || 'Partner'}! Vendor push notifications are working properly.`;

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
          link: '/vendor/profile',
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
        await Vendor.findByIdAndUpdate(req.user.id, {
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
      message: 'Test notification sent successfully to your saved vendor device(s)!',
      sentToTokensCount: allTokens.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      result,
    });
  } catch (error) {
    console.error('Vendor test notification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send test notification',
    });
  }
};

module.exports = { 
  getVendors, 
  getVendorById, 
  getOwnProfile, 
  updateProfile, 
  updateKyc, 
  updateBankDetails, 
  getKycDocument, 
  approveVendor, 
  rejectVendor, 
  toggleVendorStatus, 
  updateFcmToken,
  removeFcmToken,
  sendTestNotification
};
