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

// Clean up legacy shared auth keys from localStorage once so they don't leak across tabs
try {
  const legacyToken = localStorage.getItem('token');
  const legacyUser = localStorage.getItem('user');
  const legacyVendorToken = localStorage.getItem('vendor_token');
  const legacyVendor = localStorage.getItem('vendor');
  const legacyAdminToken = localStorage.getItem('admin_token');
  const legacyAdmin = localStorage.getItem('admin');

  // Migrate to current tab's sessionStorage if empty
  if (!sessionStorage.getItem('token') && legacyToken) {
    sessionStorage.setItem('token', legacyToken);
    if (legacyUser) sessionStorage.setItem('user', legacyUser);
  }
  if (!sessionStorage.getItem('vendor_token') && legacyVendorToken) {
    sessionStorage.setItem('vendor_token', legacyVendorToken);
    if (legacyVendor) sessionStorage.setItem('vendor', legacyVendor);
  }
  if (!sessionStorage.getItem('admin_token') && legacyAdminToken) {
    sessionStorage.setItem('admin_token', legacyAdminToken);
    if (legacyAdmin) sessionStorage.setItem('admin', legacyAdmin);
  }

  // Purge shared localStorage auth keys
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('vendor_token');
  localStorage.removeItem('vendor');
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin');
} catch (e) {
  // Safe ignore in restricted environments
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [vendor, setVendor] = useState(() => {
    const saved = sessionStorage.getItem('vendor');
    return saved ? JSON.parse(saved) : null;
  });
  const [admin, setAdmin] = useState(() => {
    const saved = sessionStorage.getItem('admin');
    return saved ? JSON.parse(saved) : null;
  });

  const [userToken, setUserToken] = useState(sessionStorage.getItem('token'));
  const [vendorToken, setVendorToken] = useState(sessionStorage.getItem('vendor_token'));
  const [adminToken, setAdminToken] = useState(sessionStorage.getItem('admin_token'));

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfiles = async () => {
      const promises = [];
      if (userToken) promises.push(getUserProfile(userToken).then(r => setUser(r.data.data.user)).catch((e) => console.error('Failed to load user profile', e)));
      if (vendorToken) promises.push(getVendorProfile(vendorToken).then(r => setVendor(r.data.data.user)).catch((e) => console.error('Failed to load vendor profile', e)));
      if (adminToken) promises.push(getAdminProfile(adminToken).then(r => setAdmin(r.data.data.user)).catch((e) => console.error('Failed to load admin profile', e)));

      await Promise.allSettled(promises);
      setLoading(false);
    };
    loadProfiles();
  }, [userToken, vendorToken, adminToken]);

  // Tab-isolated login function: saves credentials and saves FCM token to database
  const setAuth = useCallback((role, userData, token) => {
    if (role === 'user') {
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(userData));
      setUserToken(token);
      setUser(userData);
    } else if (role === 'vendor') {
      sessionStorage.setItem('vendor_token', token);
      sessionStorage.setItem('vendor', JSON.stringify(userData));
      setVendorToken(token);
      setVendor(userData);
    } else if (role === 'admin') {
      sessionStorage.setItem('admin_token', token);
      sessionStorage.setItem('admin', JSON.stringify(userData));
      setAdminToken(token);
      setAdmin(userData);
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

  // Tab-isolated logout function: removes FCM token from DB and removes credentials from session
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

    if (role === 'user') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('location_prompt_dismissed');
      setUserToken(null);
      setUser(null);
    } else if (role === 'vendor') {
      sessionStorage.removeItem('vendor_token');
      sessionStorage.removeItem('vendor');
      sessionStorage.removeItem('vendor_selected_salon');
      setVendorToken(null);
      setVendor(null);
    } else if (role === 'admin') {
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin');
      setAdminToken(null);
      setAdmin(null);
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
