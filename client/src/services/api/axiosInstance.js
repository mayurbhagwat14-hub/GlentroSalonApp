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
  let token = null;
  const path = window.location.pathname;
  const url = config.url || '';

  if (path.startsWith('/admin') || url.includes('/admin') || url.includes('/landing/preview')) {
    token = getStoredToken('admin_token');
  } else if (path.startsWith('/vendor') || url.includes('/vendor')) {
    token = getStoredToken('vendor_token');
  } else {
    // Default to user token for user routes
    token = getStoredToken('token');
  }
  
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => Promise.reject(error));

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Only clear auth and trigger logout if the request actually included a token
      if (error.config?.headers?.Authorization || error.config?.headers?.authorization) {
        if (url.includes('/admin/')) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin');
          sessionStorage.removeItem('admin_token');
          sessionStorage.removeItem('admin');
          window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { role: 'admin' } }));
        } else if (url.includes('/vendor') || url.includes('/vendors/profile') || url.includes('/salons/vendor/')) {
          localStorage.removeItem('vendor_token');
          localStorage.removeItem('vendor');
          sessionStorage.removeItem('vendor_token');
          sessionStorage.removeItem('vendor');
          window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { role: 'vendor' } }));
        } else {
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
