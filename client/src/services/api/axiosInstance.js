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

axiosInstance.interceptors.request.use((config) => {
  // If authorization was explicitly specified, do not overwrite it
  if (config.headers?.Authorization || config.headers?.authorization) {
    return config;
  }

  let token = null;
  const path = window.location.pathname;
  const url = config.url || '';

  if (path.startsWith('/admin') || url.includes('/admin') || url.includes('/landing/preview')) {
    token = getStoredToken('admin_token');
  } else if (path.startsWith('/vendor') || url.includes('/vendor') || url.includes('/salons/vendor') || url.includes('/staff/vendor')) {
    token = getStoredToken('vendor_token');
  } else {
    // For user or shared routes, use user token; if user is a logged-in vendor, fallback to vendor token
    token = getStoredToken('token') || getStoredToken('vendor_token') || getStoredToken('admin_token');
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => Promise.reject(error));

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authHeader = error.config?.headers?.Authorization || error.config?.headers?.authorization || '';
      const sentToken = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

      // Only perform logout if an actual token was sent in the request and rejected
      if (sentToken) {
        const adminToken = getStoredToken('admin_token');
        const vendorToken = getStoredToken('vendor_token');
        const userToken = getStoredToken('token');

        if (adminToken && sentToken === adminToken) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin');
          sessionStorage.removeItem('admin_token');
          sessionStorage.removeItem('admin');
          window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { role: 'admin' } }));
        } else if (vendorToken && sentToken === vendorToken) {
          localStorage.removeItem('vendor_token');
          localStorage.removeItem('vendor');
          sessionStorage.removeItem('vendor_token');
          sessionStorage.removeItem('vendor');
          window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { role: 'vendor' } }));
        } else if (userToken && sentToken === userToken) {
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
