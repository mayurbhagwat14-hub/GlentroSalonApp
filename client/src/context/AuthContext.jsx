import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getProfile as getUserProfile, updateFcmToken as updateUserFcmToken, removeFcmToken as removeUserFcmToken } from '../services/api/authApi';
import { getProfile as getVendorProfile, updateFcmToken as updateVendorFcmToken, removeFcmToken as removeVendorFcmToken } from '../modules/vendor/services/vendorApi';
import { getProfile as getAdminProfile } from '../modules/admin/services/adminApi';
import { requestNotificationPermission } from '../config/firebase';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// Safe helper to read from localStorage or sessionStorage
const getStoredItem = (key) => {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key) || null;
  } catch (e) {
    return null;
  }
};

const getStoredJson = (key) => {
  try {
    const item = getStoredItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredJson('user'));
  const [vendor, setVendor] = useState(() => getStoredJson('vendor'));
  const [admin, setAdmin] = useState(() => getStoredJson('admin'));

  const [userToken, setUserToken] = useState(() => getStoredItem('token'));
  const [vendorToken, setVendorToken] = useState(() => getStoredItem('vendor_token'));
  const [adminToken, setAdminToken] = useState(() => getStoredItem('admin_token'));

  // If we already have stored credentials, don't block the screen
  const [loading, setLoading] = useState(false);

  // Background refresh of user/vendor/admin profiles without blocking app render
  useEffect(() => {
    const refreshProfiles = async () => {
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

      if (currentPath.startsWith('/admin')) {
        if (adminToken) {
          getAdminProfile(adminToken)
            .then(r => {
              if (r?.data?.data?.user) {
                setAdmin(r.data.data.user);
                localStorage.setItem('admin', JSON.stringify(r.data.data.user));
              }
            })
            .catch((e) => console.error('Failed to sync admin profile', e));
        }
      } else if (currentPath.startsWith('/vendor')) {
        if (vendorToken) {
          getVendorProfile(vendorToken)
            .then(r => {
              if (r?.data?.data?.user) {
                setVendor(r.data.data.user);
                localStorage.setItem('vendor', JSON.stringify(r.data.data.user));
              }
            })
            .catch((e) => console.error('Failed to sync vendor profile', e));
        }
      } else {
        if (userToken) {
          getUserProfile(userToken)
            .then(r => {
              if (r?.data?.data?.user) {
                setUser(r.data.data.user);
                localStorage.setItem('user', JSON.stringify(r.data.data.user));
              }
            })
            .catch((e) => console.error('Failed to sync user profile', e));
        }
      }
    };
    refreshProfiles();
  }, [userToken, vendorToken, adminToken]);

  // Persistent login function: saves credentials to localStorage and registers FCM token
  const setAuth = useCallback((role, userData, token) => {
    try {
      if (role === 'user') {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(userData));
        setUserToken(token);
        setUser(userData);
      } else if (role === 'vendor') {
        localStorage.setItem('vendor_token', token);
        localStorage.setItem('vendor', JSON.stringify(userData));
        sessionStorage.setItem('vendor_token', token);
        sessionStorage.setItem('vendor', JSON.stringify(userData));
        setVendorToken(token);
        setVendor(userData);
      } else if (role === 'admin') {
        localStorage.setItem('admin_token', token);
        localStorage.setItem('admin', JSON.stringify(userData));
        sessionStorage.setItem('admin_token', token);
        sessionStorage.setItem('admin', JSON.stringify(userData));
        setAdminToken(token);
        setAdmin(userData);
      }
    } catch (e) {
      console.warn('Storage set error:', e);
    }

    // Immediately trigger FCM token registration on login/signup for user or vendor
    if (role === 'user' || role === 'vendor') {
      requestNotificationPermission().then(async (fcmToken) => {
        if (fcmToken) {
          localStorage.setItem('glentro_fcm_token', fcmToken);
          try {
            if (role === 'user') {
              await updateUserFcmToken({ fcmtoken: fcmToken, platform: 'web' });
            } else if (role === 'vendor') {
              await updateVendorFcmToken({ fcmtoken: fcmToken, platform: 'web' });
            }
          } catch (err) {
            console.warn('Error saving FCM token on login/signup:', err.message);
          }
        }
      }).catch((err) => {
        console.warn('FCM permission on login/signup error:', err.message);
      });
    }
  }, []);

  // Explicit logout function: removes FCM token from DB and purges credentials from storage
  const logout = useCallback(async (role) => {
    const savedFcmToken = localStorage.getItem('glentro_fcm_token');
    if (savedFcmToken) {
      try {
        if (role === 'user') {
          await removeUserFcmToken({ fcmtoken: savedFcmToken, platform: 'web' });
        } else if (role === 'vendor') {
          await removeVendorFcmToken({ fcmtoken: savedFcmToken, platform: 'web' });
        }
      } catch (err) {
        console.warn('Error removing FCM token from DB on logout:', err.message);
      }
    }

    try {
      if (role === 'user') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('location_prompt_dismissed');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('location_prompt_dismissed');
        setUserToken(null);
        setUser(null);
      } else if (role === 'vendor') {
        localStorage.removeItem('vendor_token');
        localStorage.removeItem('vendor');
        localStorage.removeItem('vendor_selected_salon');
        sessionStorage.removeItem('vendor_token');
        sessionStorage.removeItem('vendor');
        sessionStorage.removeItem('vendor_selected_salon');
        setVendorToken(null);
        setVendor(null);
      } else if (role === 'admin') {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin');
        sessionStorage.removeItem('admin_token');
        sessionStorage.removeItem('admin');
        setAdminToken(null);
        setAdmin(null);
      }
    } catch (e) {
      console.warn('Storage remove error:', e);
    }
  }, []);

  useEffect(() => {
    const handleAuthUnauthorized = (e) => {
      const role = e.detail?.role;
      if (role) {
        logout(role);
      }
    };
    window.addEventListener('auth:unauthorized', handleAuthUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleAuthUnauthorized);
  }, [logout]);

  return (
    <AuthContext.Provider value={{
      user, vendor, admin,
      userToken, vendorToken, adminToken,
      isAuthenticated: !!user,
      loading,
      setAuth, logout,
      setUser, setVendor, setAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
};
