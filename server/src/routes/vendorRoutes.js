const router = require('express').Router();
const { 
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
} = require('../controllers/vendorController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Vendor own profile
router.get('/me', protect, authorize('vendor'), getOwnProfile);
router.put('/profile', protect, authorize('vendor'), upload.single('avatar'), updateProfile);
router.put('/kyc', protect, authorize('vendor'), upload.fields([
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
]), updateKyc);
router.put('/bank', protect, authorize('vendor'), updateBankDetails);
router.get('/documents/:field', protect, authorize('vendor', 'admin'), getKycDocument);
router.put('/fcm-token', protect, authorize('vendor'), updateFcmToken);
router.post('/fcm-token', protect, authorize('vendor'), updateFcmToken);
router.post('/fcm-tokens/save', protect, authorize('vendor'), updateFcmToken);
router.post('/fcm-token/remove', protect, authorize('vendor'), removeFcmToken);
router.delete('/fcm-token', protect, authorize('vendor'), removeFcmToken);
router.post('/test-notification', protect, authorize('vendor'), sendTestNotification);

// Admin routes
router.get('/', protect, authorize('admin'), getVendors);
router.get('/:id', protect, authorize('admin', 'vendor'), getVendorById);
router.patch('/:id/approve', protect, authorize('admin'), approveVendor);
router.patch('/:id/reject', protect, authorize('admin'), rejectVendor);
router.patch('/:id/toggle-status', protect, authorize('admin'), toggleVendorStatus);

module.exports = router;
