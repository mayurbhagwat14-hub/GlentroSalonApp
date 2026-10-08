const User = require('../models/User');
const Vendor = require('../models/Vendor');
const generateToken = require('../utils/generateToken');

const saveFcmTokenToDoc = async (modelInstance, body) => {
  try {
    const rawWebToken = body.fcmtoken !== undefined ? body.fcmtoken : undefined;
    const rawMobileToken = body.fcmtokenmobile !== undefined ? body.fcmtokenmobile : undefined;
    const legacyToken = body.token !== undefined ? body.token : body.fcmToken;
    const platform = (body.platform || '').toLowerCase();

    const toTokenArray = (val) => {
      if (Array.isArray(val)) return val.map((t) => String(t).trim()).filter(Boolean);
      if (typeof val === 'string' && val.trim()) return [val.trim()];
      return [];
    };

    const isMobile = ['android', 'ios', 'mobile'].includes(platform);
    const updateOps = {};

    if (rawMobileToken !== undefined) {
      const tokens = toTokenArray(rawMobileToken);
      if (tokens.length) {
        updateOps.$addToSet = updateOps.$addToSet || {};
        updateOps.$addToSet.fcmtokenmobile = { $each: tokens };
      }
    }

    if (rawWebToken !== undefined) {
      const tokens = toTokenArray(rawWebToken);
      if (tokens.length) {
        updateOps.$addToSet = updateOps.$addToSet || {};
        const targetField = isMobile ? 'fcmtokenmobile' : 'fcmtoken';
        updateOps.$addToSet[targetField] = { $each: tokens };
      }
    }

    if (legacyToken !== undefined && rawWebToken === undefined && rawMobileToken === undefined) {
      const tokens = toTokenArray(legacyToken);
      if (tokens.length) {
        updateOps.$addToSet = updateOps.$addToSet || {};
        const targetField = isMobile ? 'fcmtokenmobile' : 'fcmtoken';
        updateOps.$addToSet[targetField] = { $each: tokens };
      }
    }

    if (updateOps.$addToSet) {
      await modelInstance.constructor.findByIdAndUpdate(modelInstance._id, updateOps);
    }
  } catch (err) {
    console.error('Error saving FCM token in authController:', err.message);
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register/user
const registerUser = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const user = await User.create({ name, email, phone, password });
    await saveFcmTokenToDoc(user, req.body);
    const token = generateToken(user._id, 'user');

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login/user
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account has been deactivated' });
    }

    if (user.accountStatus === 'deleted') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DELETED',
        message: 'Your account has been deleted. You can request account recovery if you want to restore it.'
      });
    }

    if (user.accountStatus === 'recovery_requested') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_RECOVERY_PENDING',
        message: 'Your account recovery request is currently under review.'
      });
    }

    user.lastLogin = new Date();
    await user.save();
    await saveFcmTokenToDoc(user, req.body);

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      message: 'Login successful',
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new vendor
// @route   POST /api/auth/register/vendor
const registerVendor = async (req, res, next) => {
  try {
    const { 
      name, email, phone, password, businessName,
      businessType, businessDescription, businessEmail, businessContact,
      registeredAddress, city, state, country
    } = req.body;

    const existingVendor = await Vendor.findOne({ email });
    if (existingVendor) {
      return res.status(400).json({ success: false, message: 'Vendor already exists with this email' });
    }

    const vendorData = { name, email, phone, password, businessName };
    if (businessType !== undefined) vendorData.businessType = businessType;
    if (businessDescription !== undefined) vendorData.businessDescription = businessDescription;
    if (businessEmail !== undefined) vendorData.businessEmail = businessEmail;
    if (businessContact !== undefined) vendorData.businessContact = businessContact;
    if (registeredAddress !== undefined) vendorData.registeredAddress = registeredAddress;
    if (city !== undefined) vendorData.city = city;
    if (state !== undefined) vendorData.state = state;
    if (country !== undefined) vendorData.country = country;

    const vendor = await Vendor.create(vendorData);
    await saveFcmTokenToDoc(vendor, req.body);
    const token = generateToken(vendor._id, 'vendor');

    res.status(201).json({
      success: true,
      message: 'Vendor registration successful. Awaiting admin approval.',
      data: { vendor, token },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login vendor
// @route   POST /api/auth/login/vendor
const loginVendor = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const vendor = await Vendor.findOne({ email });
    if (!vendor) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await vendor.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!vendor.isActive) {
      return res.status(401).json({ success: false, message: 'Account has been deactivated' });
    }

    await saveFcmTokenToDoc(vendor, req.body);
    const token = generateToken(vendor._id, 'vendor');

    res.json({
      success: true,
      message: 'Login successful',
      data: { vendor, token },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login admin
// @route   POST /api/auth/login/admin
const loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const admin = await User.findOne({ email, role: 'admin' });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const token = generateToken(admin._id, 'admin');

    res.json({
      success: true,
      message: 'Admin login successful',
      data: { user: admin, token },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
const getProfile = async (req, res, next) => {
  try {
    let user;
    if (req.user.role === 'vendor') {
      user = await Vendor.findById(req.user.id).select('-password');
    } else {
      user = await User.findById(req.user.id).select('-password');
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: { user, role: req.user.role },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  registerVendor,
  loginVendor,
  loginAdmin,
  getProfile,
};
