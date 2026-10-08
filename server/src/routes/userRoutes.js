const router = require('express').Router();
const { 
  getUsers, 
  getUserById, 
  updateProfile, 
  updateLocation, 
  toggleUserStatus, 
  updateFcmToken, 
  removeFcmToken,
  sendTestNotification,
  deleteAccount 
} = require('../controllers/userController');
const { protect, requireActiveUser } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/', protect, authorize('admin'), getUsers);
router.get('/:id', protect, authorize('admin'), getUserById);
router.put('/profile', protect, requireActiveUser, authorize('user', 'admin'), upload.single('avatar'), updateProfile);
router.put('/location', protect, requireActiveUser, authorize('user'), updateLocation);
router.patch('/:id/toggle-status', protect, authorize('admin'), toggleUserStatus);
router.put('/fcm-token', protect, requireActiveUser, updateFcmToken);
router.post('/fcm-token', protect, requireActiveUser, updateFcmToken);
router.post('/fcm-tokens/save', protect, requireActiveUser, updateFcmToken);
router.post('/fcm-token/remove', protect, requireActiveUser, removeFcmToken);
router.delete('/fcm-token', protect, requireActiveUser, removeFcmToken);
router.post('/test-notification', protect, requireActiveUser, sendTestNotification);
router.delete('/account', protect, requireActiveUser, authorize('user'), deleteAccount);

module.exports = router;
