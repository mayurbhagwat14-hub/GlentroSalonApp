const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

/**
 * Protect routes - verify JWT token
 * Attaches req.user with { id, role, name, email }
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token provided',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Find user based on role
    let user;
    if (decoded.role === 'vendor') {
      user = await Vendor.findById(decoded.id).select('-password');
    } else {
      user = await User.findById(decoded.id).select('-password');
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found',
      });
    }

    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated',
      });
    }

    req.user = {
      id: user._id,
      role: decoded.role,
      name: user.name,
      email: user.email,
      accountStatus: user.accountStatus || 'active'
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, invalid token',
    });
  }
};

/**
 * Require active user - ensure account is not deleted/recovery_requested
 * Must be used AFTER protect middleware
 */
const requireActiveUser = (req, res, next) => {
  if (req.user && req.user.accountStatus !== 'active') {
    if (req.user.accountStatus === 'deleted') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DELETED',
        message: 'Your account has been deleted. You can request account recovery if you want to restore it.'
      });
    }
    if (req.user.accountStatus === 'recovery_requested') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_RECOVERY_PENDING',
        message: 'Your account recovery request is currently under review.'
      });
    }
  }
  next();
};

module.exports = { protect, requireActiveUser };
