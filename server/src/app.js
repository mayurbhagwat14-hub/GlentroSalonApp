const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { CLIENT_URL, NODE_ENV } = require('./config/env');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { globalLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const salonRoutes = require('./routes/salonRoutes');
const staffRoutes = require('./routes/staffRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const subcategoryRoutes = require('./routes/subcategoryRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const couponRoutes = require('./routes/couponRoutes');
const packageRoutes = require('./routes/packageRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const commissionRoutes = require('./routes/commissionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const cashSettlementRoutes = require('./routes/cashSettlementRoutes');
const locationRoutes = require('./routes/locationRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const settingRoutes = require('./routes/settingRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const contentRoutes = require('./routes/contentRoutes');
const accountRecoveryRoutes = require('./routes/accountRecoveryRoutes');
const faqRoutes = require('./routes/faqRoutes');
const bookingIssueRoutes = require('./routes/bookingIssueRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const callRoutes = require('./routes/callRoutes');
const loginSlideRoutes = require('./routes/loginSlideRoutes');
const staffReviewRoutes = require('./routes/staffReviewRoutes');
const landingRoutes = require('./routes/landingRoutes');
const userWalletRoutes = require('./routes/userWalletRoutes');
const app = express();

// Trust proxy for rate limiting behind reverse proxies (like Nginx, Vercel, Render)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Parse CLIENT_URL safely handling comma-separated lists and trailing slashes
const getAllowedOrigins = () => {
  if (!CLIENT_URL) return [];
  return CLIENT_URL.split(',').map(url => {
    let clean = url.trim();
    if (clean.endsWith('/')) clean = clean.slice(0, -1);
    return clean;
  }).filter(Boolean);
};

const allowedOrigins = getAllowedOrigins();

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    let cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    
    if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    // Do NOT throw an Error here — throwing causes the cors library to send
    // a 500 response without CORS headers, making browsers report a CORS error
    // instead of the real problem. Return false so cors sends a clean 403.
    console.warn(`[CORS] Blocked origin: ${origin} | Allowed: ${allowedOrigins.join(', ')}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// CORS — must run before ALL other middleware including error handlers
app.use(cors(corsOptions));

// Handle OPTIONS preflight explicitly so CORS headers are always sent
app.options('*', cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files -// Serve uploads folder statically (Uses environment variable or defaults to local dir)
const uploadsDir = process.env.UPLOAD_PATH 
  ? require('path').resolve(process.env.UPLOAD_PATH)
  : path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Apply Global Rate Limiter to all API routes
app.use('/api', globalLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/salons', salonRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/vendor/cash-settlement', cashSettlementRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/account-recovery', accountRecoveryRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/booking-issues', bookingIssueRoutes);
app.use('/api/vendor', resourceRoutes);
app.use('/api/call', callRoutes);
app.use('/api/login-slides', loginSlideRoutes);
app.use('/api/staff-reviews', staffReviewRoutes);
app.use('/api/landing', landingRoutes);
app.use('/api/user/wallet', userWalletRoutes);
// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Salon Booking API is running', timestamp: new Date().toISOString() });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
