import api from '../../../services/api/axiosInstance';

// Auth & Profile
export const loginVendor = (data) => api.post('/auth/login/vendor', data);
export const registerVendor = (data) => api.post('/auth/register/vendor', data);
export const getProfile = (token) => api.get('/auth/profile', token ? { headers: { Authorization: `Bearer ${token}` } } : {});
export const updateProfile = (data) => api.put('/vendors/profile', data);
export const getVendorProfile = () => api.get('/vendors/me');
export const updateVendorKyc = (data) => api.put('/vendors/kyc', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateVendorBank = (data) => api.put('/vendors/bank', data);
export const getVendorDocument = (field) => api.get(`/vendors/documents/${field}`, { responseType: 'blob' });
export const updateFcmToken = (data) => api.put('/vendors/fcm-token', data);
export const removeFcmToken = (data) => api.post('/vendors/fcm-token/remove', data);
export const sendTestNotification = () => api.post('/vendors/test-notification');

// Salons
export const getVendorSalons = (params) => api.get('/salons/vendor/my-salons', { params });
export const withdrawFunds = (data) => api.post('/wallet/withdraw', data);
export const verifyWalletOwnership = (data) => api.post('/wallet/verify-ownership', data);
export const setDefaultWithdrawalMethod = (id) => api.put(`/wallet/methods/${id}/default`);
export const createSalon = (data) => api.post('/salons', data);
export const updateSalon = (id, data) => api.put(`/salons/${id}`, data);
export const getSalonById = (id) => api.get(`/salons/detail/${id}`);

// Calls
export const getCallHistory = () => api.get('/call/history');

// Staff
export const getSalonStaff = (salonId, params) => api.get(`/staff/salon/${salonId}`, { params });
export const getVendorStaff = (params) => api.get('/staff/vendor/my', { params });
export const addStaff = (data) => api.post('/staff', data);
export const updateStaff = (id, data) => api.put(`/staff/${id}`, data);
export const deleteStaff = (id) => api.delete(`/staff/${id}`);
export const toggleStaffStatus = (id) => api.patch(`/staff/${id}/toggle-status`);
export const updateSchedule = (id, data) => api.put(`/staff/${id}/schedule`, data);

// Services
export const getServices = (params) => api.get('/services', { params });
export const getVendorServices = (params) => api.get('/services/vendor/my', { params });
export const createService = (data) => api.post('/services', data);
export const updateService = (id, data) => api.put(`/services/${id}`, data);
export const deleteService = (id) => api.delete(`/services/${id}`);
export const toggleServiceStatus = (id) => api.patch(`/services/${id}/toggle-status`);

// Categories
export const getCategories = () => api.get('/categories');
export const getSubcategories = (params) => api.get('/subcategories', { params });

// Bookings
export const getSalonBookings = (salonId, params) => api.get(`/bookings/salon/${salonId}`, { params });
export const getVendorRecentBookings = (params) => api.get('/bookings/vendor/recent', { params });
export const getVendorStats = (params) => api.get('/bookings/vendor/stats', { params });
export const getVendorAnalytics = (params) => api.get('/bookings/vendor/analytics', { params });
export const getBookingById = (id) => api.get(`/bookings/${id}`);
export const acceptBooking = (id) => api.patch(`/bookings/${id}/accept`);
export const rejectBooking = (id, data) => api.patch(`/bookings/${id}/reject`, data);
export const requestCompletionOtp = (id) => api.post(`/bookings/${id}/request-otp`);
export const completeBooking = (id, otp) => api.patch(`/bookings/${id}/complete`, { otp });

// Reviews
export const getVendorReviews = (params) => api.get('/reviews/vendor', { params });

// Packages
export const getVendorPackages = (params) => api.get('/packages/vendor/my', { params });
export const createPackage = (data) => api.post('/packages', data);
export const updatePackage = (id, data) => api.put(`/packages/${id}`, data);
export const deletePackage = (id) => api.delete(`/packages/${id}`);
export const togglePackageStatus = (id) => api.patch(`/packages/${id}/toggle-status`);

// Offers
export const getVendorOffers = (params) => api.get('/offers/vendor/my', { params });
export const createOffer = (data) => api.post('/offers', data);
export const updateOffer = (id, data) => api.put(`/offers/${id}`, data);
export const deleteOffer = (id) => api.delete(`/offers/${id}`);
export const toggleOfferStatus = (id) => api.patch(`/offers/${id}/toggle-status`);

// Subscription
export const checkSubscription = () => api.get('/subscriptions/check');
export const getSubscriptionPlans = () => api.get('/subscriptions');
export const startFreeTrial = () => api.post('/subscriptions/trial');
export const createSubscriptionOrder = (planId) => api.post('/subscriptions/order', { planId });
export const verifySubscriptionPayment = (data) => api.post('/subscriptions/verify', data);

// Chat
export const initiateChat = (data) => api.post('/chat/initiate', data);
export const getChats = () => api.get('/chat');
export const getMessages = (chatId, params) => api.get(`/chat/${chatId}/messages`, { params });
export const sendMessage = (chatId, data) => api.post(`/chat/${chatId}/messages`, data);
export const markChatAsRead = (chatId) => api.patch(`/chat/${chatId}/read`);

// Notifications
export const getNotifications = (params) => api.get('/notifications', { params });
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all');
export const clearAllNotifications = () => api.delete('/notifications/clear-all');
export const getUnreadCount = () => api.get('/notifications/unread-count');
