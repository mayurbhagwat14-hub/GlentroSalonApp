const admin = require('firebase-admin');
const { 
  FIREBASE_SERVICE_ACCOUNT,
  FIREBASE_PROJECT_ID, 
  FIREBASE_CLIENT_EMAIL, 
  FIREBASE_PRIVATE_KEY, 
  FIREBASE_DATABASE_URL 
} = require('../config/env');

let initialized = false;

// 1. Try FIREBASE_SERVICE_ACCOUNT JSON first
if (FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = typeof FIREBASE_SERVICE_ACCOUNT === 'string' 
      ? JSON.parse(FIREBASE_SERVICE_ACCOUNT) 
      : FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    const options = {
      credential: admin.credential.cert(serviceAccount),
    };

    if (FIREBASE_DATABASE_URL) {
      options.databaseURL = FIREBASE_DATABASE_URL;
    }

    if (!admin.apps.length) {
      admin.initializeApp(options);
    }
    initialized = true;
    console.log('Firebase Admin initialized successfully using FIREBASE_SERVICE_ACCOUNT');
  } catch (err) {
    console.error('Error initializing Firebase Admin with FIREBASE_SERVICE_ACCOUNT:', err.message);
  }
}

// 2. Fallback to individual env variables if not initialized yet
if (!initialized && FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
  try {
    const certConfig = {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };

    const options = {
      credential: admin.credential.cert(certConfig),
    };

    if (FIREBASE_DATABASE_URL) {
      options.databaseURL = FIREBASE_DATABASE_URL;
    }

    if (!admin.apps.length) {
      admin.initializeApp(options);
    }
    initialized = true;
    console.log('Firebase Admin initialized successfully using individual env variables');
  } catch (error) {
    console.error('Firebase Admin initialization error:', error.message);
  }
}

if (!initialized) {
  console.warn('Firebase credentials not found in environment variables. Push notifications will not work.');
}

module.exports = admin;
