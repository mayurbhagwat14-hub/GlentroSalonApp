import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, isSupported, getToken, deleteToken, onMessage } from 'firebase/messaging';

// Read all Firebase configuration strictly from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app = null;
let messaging = null;

/**
 * Initialize Firebase App
 */
const loadFirebaseApp = () => {
  if (app) return app;
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('[FCM] Firebase config is missing apiKey or projectId');
    return null;
  }

  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    return app;
  } catch (err) {
    console.error('[FCM] Firebase App initialization error:', err);
    return null;
  }
};

/**
 * Initialize Firebase Messaging
 */
const loadFirebaseMessaging = async () => {
  if (messaging) return messaging;
  const firebaseApp = loadFirebaseApp();
  if (!firebaseApp) return null;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('[FCM] Firebase Cloud Messaging is not supported in this browser environment.');
      return null;
    }
    messaging = getMessaging(firebaseApp);
    return messaging;
  } catch (err) {
    console.error('[FCM] Firebase Messaging SDK error:', err);
    return null;
  }
};

/**
 * Request notification permission and retrieve the FCM device token
 * @returns {Promise<string|null>} FCM registration token or null
 */
export const requestNotificationPermission = async () => {
  try {
    console.log('[FCM] Requesting notification permission...');
    const msg = await loadFirebaseMessaging();
    if (!msg) {
      console.warn('[FCM] Messaging could not be loaded');
      return null;
    }

    if (!('Notification' in window)) {
      console.warn('[FCM] This browser does not support desktop notifications.');
      return null;
    }

    let permission = Notification.permission;
    console.log('[FCM] Current permission status:', permission);

    if (permission === 'denied') {
      console.warn('[FCM] Notification permission was previously denied by user.');
      return null;
    }

    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
      console.log('[FCM] User response to permission prompt:', permission);
      if (permission !== 'granted') {
        console.warn('[FCM] Notification permission was not granted.');
        return null;
      }
    }

    let swRegistration = undefined;
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { updateViaCache: 'none' });
        await swRegistration.update().catch(() => {});
        await navigator.serviceWorker.ready;
        console.log('[FCM] Service Worker registered and ready');
      } catch (swErr) {
        console.warn('[FCM] Service worker registration note:', swErr.message);
      }
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    console.log('[FCM] Requesting token with VAPID key:', vapidKey ? 'configured' : 'missing');

    const tokenOptions = {
      ...(vapidKey ? { vapidKey } : {}),
      ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {})
    };

    const currentProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    const previousProjectId = localStorage.getItem('glentro_fcm_project_id');

    // If Firebase project changed, delete old cached token from browser IndexedDB
    if (previousProjectId !== currentProjectId) {
      console.log('[FCM] Firebase project changed to', currentProjectId, '— clearing old token cache...');
      try {
        await deleteToken(msg);
      } catch (delErr) {
        console.warn('[FCM] Old token delete note:', delErr.message);
      }
      localStorage.removeItem('glentro_fcm_token');
      localStorage.setItem('glentro_fcm_project_id', currentProjectId);
    }

    const currentToken = await getToken(msg, tokenOptions);
    if (currentToken) {
      console.log('[FCM] Token successfully retrieved:', currentToken.substring(0, 15) + '...');
      return currentToken;
    } else {
      console.warn('[FCM] No registration token returned from Firebase.');
      return null;
    }
  } catch (error) {
    console.error('[FCM] Error retrieving FCM registration token:', error);
    return null;
  }
};

/**
 * Listen for incoming messages when the web app is in the foreground
 * @param {Function} callback - Handles incoming payload
 * @returns {Function} Unsubscribe function
 */
export const onForegroundMessage = (callback) => {
  let unsubscribeFn = null;

  loadFirebaseMessaging().then((msg) => {
    if (!msg) return;
    try {
      unsubscribeFn = onMessage(msg, (payload) => {
        console.log('[FCM] Foreground message received:', payload);
        callback(payload);
      });
    } catch (err) {
      console.warn('[FCM] Unable to attach foreground message listener:', err.message);
    }
  });

  return () => {
    if (typeof unsubscribeFn === 'function') {
      unsubscribeFn();
    }
  };
};

export { app };
