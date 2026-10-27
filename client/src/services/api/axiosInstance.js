import axios from 'axios';
import { toast } from 'react-hot-toast';

const rawApiUrl = import.meta.env.VITE_API_URL || '';
const API_BASE_URL = rawApiUrl 
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`) 
  : '/api';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

const getStoredToken = (key) => {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key) || null;
  } catch (e) {
    return null;
  }
};

// Lightweight in-memory cache for semi-static GET endpoints (60s TTL)
const CACHE_TTL_MS = 60 * 1000;
const memoryCache = new Map();
const cacheableEndpoints = [
  '/categories',
  '/subcategories',
  '/banners/public',
  '/content/',
  '/faqs',
  '/commissions/platform-fee/public'
];

export const clearApiCache = () => memoryCache.clear();

axiosInstance.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  const url = config.url || '';

  // Serve from memory cache if available for cacheable GET requests
  if (method === 'get') {
    const isCacheable = cacheableEndpoints.some(ep => url.includes(ep));
    if (isCacheable) {
      const cacheKey = `${url}_${JSON.stringify(config.params || {})}`;
      const cached = memoryCache.get(cacheKey);
      if (cached && (Date.now() - cached.time < CACHE_TTL_MS)) {
        config.adapter = () => Promise.resolve({
          data: JSON.parse(JSON.stringify(cached.data)),
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {}
        });
        return config;
      }
    }
  } else if (['post', 'put', 'patch', 'delete'].includes(method)) {
    // Clear cache on data modifications to prevent stale data
    memoryCache.clear();
  }

  // If authorization was explicitly specified, do not overwrite it
  if (config.headers?.Authorization || config.headers?.authorization) {
    return config;
  }

  let token = null;
  const path = typeof window !== 'undefined' ? window.location.pathname : '';

  const isAdminReq = path.startsWith('/admin') || url.startsWith('/admin') || url.includes('/admin/') || url.includes('/landing/preview');
  const isVendorReq = path.startsWith('/vendor') || url.startsWith('/vendor') || url.includes('/vendor/') || url.includes('/salons/vendor') || url.includes('/staff/vendor') || url.includes('/vendors/');

  if (isAdminReq) {
    token = getStoredToken('admin_token');
  } else if (isVendorReq) {
    token = getStoredToken('vendor_token');
  } else {
    // Strictly user route - NEVER fallback to vendor or admin token to prevent cross-account collisions
    token = getStoredToken('token');
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => Promise.reject(error));

axiosInstance.interceptors.response.use(
  (response) => {
    const method = (response.config?.method || 'get').toLowerCase();
    const url = response.config?.url || '';
    if (method === 'get' && response.data?.success) {
      const isCacheable = cacheableEndpoints.some(ep => url.includes(ep));
      if (isCacheable) {
        const cacheKey = `${url}_${JSON.stringify(response.config.params || {})}`;
        memoryCache.set(cacheKey, {
          data: response.data,
          time: Date.now()
        });
      }
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      const authHeader = error.config?.headers?.Authorization || error.config?.headers?.authorization || '';
      const sentToken = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

      // Only perform logout if an actual token was sent in the request and rejected
      if (sentToken) {
        const url = error.config?.url || '';
        const path = typeof window !== 'undefined' ? window.location.pathname : '';

        // Ignore 401 errors on login/verification attempt endpoints (invalid credentials should not clear sessions)
        const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/verify-otp') || url.includes('/auth/verify-login-otp') || url.includes('/auth/register');
        if (isAuthAttempt) {
          return Promise.reject(error);
        }

        const errMsg = (error.response?.data?.message || '').toLowerCase();
        const isAuthProfileCheck = url.includes('/auth/profile');
        const isExplicitTokenError = errMsg.includes('token expired') || 
                                     errMsg.includes('invalid token') || 
                                     errMsg.includes('account has been deactivated') || 
                                     errMsg.includes('user not found');

        // Only log out if it is an explicit auth verification failure or token expiration.
        // Arbitrary feature errors must NOT trigger a session wipe!
        if (!isAuthProfileCheck && !isExplicitTokenError) {
          return Promise.reject(error);
        }

        const adminToken = getStoredToken('admin_token');
        const vendorToken = getStoredToken('vendor_token');
        const userToken = getStoredToken('token');

        // Scope the logout strictly to the role matching the rejected token AND relevant route
        if (adminToken && sentToken === adminToken && (path.startsWith('/admin') || url.includes('/admin'))) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin');
          sessionStorage.removeItem('admin_token');
          sessionStorage.removeItem('admin');
          window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { role: 'admin' } }));
        } else if (vendorToken && sentToken === vendorToken && (path.startsWith('/vendor') || url.includes('/vendor') || url.includes('/salons/vendor') || url.includes('/staff/vendor'))) {
          localStorage.removeItem('vendor_token');
          localStorage.removeItem('vendor');
          sessionStorage.removeItem('vendor_token');
          sessionStorage.removeItem('vendor');
          window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { role: 'vendor' } }));
        } else if (userToken && sentToken === userToken && !path.startsWith('/vendor') && !path.startsWith('/admin')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { role: 'user' } }));
        }
      }
    } else if (error.response?.status === 429) {
      // Handle rate limit exceeded
      toast.error('Too many requests. Please wait a moment and try again.');
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
