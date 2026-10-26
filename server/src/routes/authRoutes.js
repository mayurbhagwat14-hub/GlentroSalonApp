const router = require('express').Router();
const { 
  registerUser, 
  loginUser, 
  registerVendor, 
  loginVendor, 
  loginAdmin, 
  getProfile,
  sendLoginOTP,
  verifyLoginOTP,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { registerUserValidation, registerVendorValidation, loginValidation } = require('../utils/validators');
const { authLimiter, passwordResetLimiter, otpLimiter } = require('../middleware/rateLimiter');
const { forgotPassword, verifyOTP, resetPassword } = require('../controllers/passwordController');

// Standard Auth Routes
router.post('/register/user', authLimiter, registerUserValidation, validate, registerUser);
router.post('/login/user', authLimiter, loginValidation, validate, loginUser);
router.post('/register/vendor', authLimiter, registerVendorValidation, validate, registerVendor);
router.post('/login/vendor', authLimiter, loginValidation, validate, loginVendor);
router.post('/login/admin', authLimiter, loginValidation, validate, loginAdmin);
router.get('/profile', protect, getProfile);

// OTP Login Routes (User & Vendor)
router.post('/send-otp', otpLimiter, sendLoginOTP);
router.post('/verify-login-otp', otpLimiter, verifyLoginOTP);

// Password Reset Routes
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/verify-otp', otpLimiter, verifyOTP);
router.post('/reset-password', passwordResetLimiter, resetPassword);

module.exports = router;
