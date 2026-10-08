const http = require('http');
const dotenv = require('dotenv');
// Reload nodemon for updated Firebase credentials: glentro-195f2 (v3 platform routing)
const app = require('./app');
const connectDB = require('./config/db');
const { initializeSocket } = require('./config/socket');
const { PORT, NODE_ENV } = require('./config/env');
const { initRedis } = require('./config/redis');
const { syncAllSalons } = require('./services/geoService');

// Import socket handlers
const { setupChatSocket } = require('./sockets/chatSocket');
const { setupNotificationSocket } = require('./sockets/notificationSocket');
const { setupBookingSocket } = require('./sockets/bookingSocket');

// Import background jobs
const { startBookingExpiryCron } = require('./services/bookingExpiryCron');
const startBookingSettlementCron = require('./services/bookingSettlementCron');

const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  // Initialize Redis (safe no-op if REDIS_ENABLED=false or unavailable)
  await initRedis();

  // Synchronize salon locations into Redis Geospatial index (background safe)
  syncAllSalons().catch((err) => console.warn(`Initial Redis GEO sync warning: ${err.message}`));

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize Socket.IO
  const io = await initializeSocket(server);

  // Setup socket event handlers
  setupChatSocket(io);
  setupNotificationSocket(io);
  setupBookingSocket(io);

  // Start background jobs
  startBookingExpiryCron();
  startBookingSettlementCron();

  // Start listening
  server.listen(PORT, () => {
    console.log(`\n🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
    console.log(`🔌 Socket.IO: http://localhost:${PORT}`);
    console.log(`❤️  Health: http://localhost:${PORT}/api/health\n`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error(`Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
};

startServer();
