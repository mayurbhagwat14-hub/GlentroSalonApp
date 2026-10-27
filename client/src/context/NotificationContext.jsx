import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import api from '../services/api/axiosInstance';
import { useAuth } from './AuthContext';
import { requestNotificationPermission, onForegroundMessage } from '../config/firebase';
import toast from 'react-hot-toast';

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState(null);
  const { socket } = useSocket();
  const { user, vendor, admin, userToken, vendorToken, adminToken } = useAuth();

  // Fetch unread count on mount
  useEffect(() => {
    if (!userToken && !vendorToken && !adminToken) return;
    const fetchCount = async () => {
      try {
        const res = await api.get('/notifications/unread-count');
        if (res.data?.success) {
          setUnreadCount(res.data.data.count || 0);
        }
      } catch (err) { /* ignore */ }
    };
    fetchCount();
  }, [userToken, vendorToken, adminToken]);

  // Request FCM token and register with backend when authenticated
  useEffect(() => {
    const isVendorSection = typeof window !== 'undefined' && window.location.pathname.startsWith('/vendor');
    const isAdminSection = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

    if (isVendorSection && !vendorToken) return;
    if (!isVendorSection && !isAdminSection && !userToken) return;

    let isMounted = true;
    const registerFcm = async () => {
      try {
        console.log('[NotificationContext] Checking and registering FCM token...');
        const fcmToken = await requestNotificationPermission();
        if (fcmToken && isMounted) {
          localStorage.setItem('glentro_fcm_token', fcmToken);
          if (isVendorSection && vendorToken) {
            console.log('[NotificationContext] Sending FCM token to vendor endpoint');
            await api.put('/vendors/fcm-token', { fcmtoken: fcmToken, platform: 'web' }, {
              headers: { Authorization: `Bearer ${vendorToken}` }
            });
          } else if (!isVendorSection && !isAdminSection && userToken) {
            console.log('[NotificationContext] Sending FCM token to user endpoint');
            await api.put('/users/fcm-token', { fcmtoken: fcmToken, platform: 'web' }, {
              headers: { Authorization: `Bearer ${userToken}` }
            });
          }
        } else {
          console.warn('[NotificationContext] FCM token not obtained (permission might be pending or denied)');
        }
      } catch (err) {
        console.warn('[NotificationContext] FCM token registration error:', err.message);
      }
    };

    registerFcm();
    return () => {
      isMounted = false;
    };
  }, [userToken, vendorToken]);

  // Listen for foreground FCM notifications
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload.notification?.title || payload.data?.title || 'Notification';
      const message = payload.notification?.body || payload.data?.message || '';

      setUnreadCount((prev) => prev + 1);
      setLatestNotification({
        title,
        message,
        data: payload.data || {},
        createdAt: new Date().toISOString(),
      });

      toast(
        (t) => (
          <div className="flex flex-col gap-0.5 cursor-pointer" onClick={() => toast.dismiss(t.id)}>
            <span className="font-semibold text-sm text-slate-900">{title}</span>
            <span className="text-xs text-slate-600 line-clamp-2">{message}</span>
          </div>
        ),
        { icon: '', duration: 4000 }
      );

      // Trigger native browser notification popup banner (Windows / Chrome)
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body: message,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            data: payload.data || {},
          });
        } catch (err) {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(title, {
                body: message,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                data: payload.data || {},
              });
            }).catch(() => {});
          }
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Listen for real-time notifications via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification) => {
      setUnreadCount((prev) => prev + 1);
      setLatestNotification(notification);
    };

    const handleNewBooking = (data) => {
      setUnreadCount((prev) => prev + 1);
      setLatestNotification({
        _id: data.booking?._id || Date.now().toString(),
        type: 'BOOKING_CREATED',
        title: data.title || 'New Booking Received',
        message: data.message || `Booking #${data.booking?.bookingNumber || ''} has arrived.`,
        data: data.booking || {},
        createdAt: new Date().toISOString(),
      });
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('booking:new', handleNewBooking);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('booking:new', handleNewBooking);
    };
  }, [socket]);

  const decrementCount = useCallback(() => {
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const resetCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearLatest = useCallback(() => {
    setLatestNotification(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ unreadCount, latestNotification, decrementCount, resetCount, clearLatest }}>
      {children}
    </NotificationContext.Provider>
  );
};
