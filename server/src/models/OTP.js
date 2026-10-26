const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    sparse: true,
    index: true,
  },
  phone: {
    type: String,
    sparse: true,
    index: true,
  },
  purpose: {
    type: String,
    enum: ['password_reset', 'login', 'registration'],
    default: 'login',
  },
  accountType: {
    type: String,
    enum: ['user', 'vendor'],
    required: true,
  },
  otpHash: {
    type: String,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  resendCount: {
    type: Number,
    default: 0,
  },
  verifiedAt: {
    type: Date,
    default: null,
  },
  usedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '0s' }, // TTL index
  }
}, {
  timestamps: true,
});

const OTP = mongoose.model('OTP', otpSchema);
module.exports = OTP;
