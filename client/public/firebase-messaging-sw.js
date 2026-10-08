// Firebase Messaging Service Worker for background push notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

try {
  firebase.initializeApp({
    apiKey: "AIzaSyCbmpZHvLgjU0ugAgjmPkaEmUVRiPJVw0Y",
    authDomain: "glentro-195f2.firebaseapp.com",
    projectId: "glentro-195f2",
    storageBucket: "glentro-195f2.firebasestorage.app",
    messagingSenderId: "337165968524",
    appId: "1:337165968524:web:e1970d6c81185c40cd47a9",
  });

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] onBackgroundMessage received:', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || '🔔 Glentro Notification';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || payload.data?.message || 'New notification',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data || {},
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  console.warn('[SW] Firebase compat init notice:', e.message);
}

// Fallback native push event listener to ensure system notification always displays
self.addEventListener('push', (event) => {
  console.log('[SW] Native push event received:', event);
  let title = '🔔 Glentro Notification';
  let body = 'You have a new notification from Glentro';
  let data = {};

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[SW] Push JSON payload:', payload);
      if (payload.notification) {
        title = payload.notification.title || title;
        body = payload.notification.body || body;
      }
      if (payload.data) {
        title = payload.data.title || title;
        body = payload.data.body || payload.data.message || body;
        data = payload.data;
      }
    } catch (err) {
      body = event.data.text() || body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data,
    })
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification click: focus existing window or open new window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || event.notification?.data?.click_action || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
