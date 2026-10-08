const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/salon-booking',
  JWT_SECRET: process.env.JWT_SECRET || 'default_secret',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '30d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  SOCKET_URL: process.env.SOCKET_URL || 'http://localhost:5000',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT || '',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || '',
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 5242880,
  UPLOAD_PATH: process.env.UPLOAD_PATH || 'uploads',
  
  // Forgot Password
  PASSWORD_RESET_OTP_EXPIRY_MINUTES: parseInt(process.env.PASSWORD_RESET_OTP_EXPIRY_MINUTES) || 10,
  PASSWORD_RESET_MAX_OTP_ATTEMPTS: parseInt(process.env.PASSWORD_RESET_MAX_OTP_ATTEMPTS) || 5,
  PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: parseInt(process.env.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS) || 60,
  PASSWORD_RESET_MAX_RESENDS: parseInt(process.env.PASSWORD_RESET_MAX_RESENDS) || 3,
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES) || 10,
  
  // SMTP
  EMAIL_PROVIDER_MODE: process.env.EMAIL_PROVIDER_MODE || 'development',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT || '',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
  SMTP_FROM: process.env.SMTP_FROM || '',

  // Redis — REDIS_ENABLED must be parsed as a real boolean.
  // 'true' → true, 'false' → false, missing → false.
  // Do NOT use: if (process.env.REDIS_ENABLED) — 'false' is still truthy.
  REDIS_ENABLED: process.env.REDIS_ENABLED === 'true',
  REDIS_URL: process.env.REDIS_URL || '',
  REDIS_CACHE_TTL_SECONDS: parseInt(process.env.REDIS_CACHE_TTL_SECONDS) || 300,
};
