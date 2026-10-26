import api from './axiosInstance';

export const registerUser = (data) => api.post('/auth/register/user', data);
export const loginUser = (data) => api.post('/auth/login/user', data);
export const getProfile = (token) => api.get('/auth/profile', token ? { headers: { Authorization: `Bearer ${token}` } } : {});
export const updateProfile = (data) => api.put('/users/profile', data);
export const updateLocation = (data) => api.put('/users/location', data);
export const updateFcmToken = (data) => api.put('/users/fcm-token', data);
export const removeFcmToken = (data) => api.post('/users/fcm-token/remove', data);
export const sendTestNotification = () => api.post('/users/test-notification');

// Password Reset
export const forgotPasswordAPI = (data) => api.post('/auth/forgot-password', data);
export const verifyOTPAPI = (data) => api.post('/auth/verify-otp', data);
export const resetPasswordAPI = (data) => api.post('/auth/reset-password', data);

// OTP Login (User & Vendor)
export const sendOtpAPI = (data) => api.post('/auth/send-otp', data);
export const verifyLoginOtpAPI = (data) => api.post('/auth/verify-login-otp', data);

