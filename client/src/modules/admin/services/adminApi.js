import api from '../../../services/api/axiosInstance';

export const getDashboardStats = () => api.get('/admin/dashboard');
export const getAnalytics = (range = '30d') => api.get(`/admin/analytics?range=${range}`);

export const getRecentBookings = () => api.get('/admin/recent-bookings');

export const getBookingStats = () => api.get('/admin/booking-stats');

export const getPendingCounts = () => api.get('/admin/pending-counts');

// User Management
export const getUsers = (params) => api.get('/admin/users', { params });
export const updateUserStatus = (id, isActive) => api.put(`/admin/users/${id}/status`, { isActive });

// Account Recovery
export const getAccountRecoveryRequests = (params) => api.get('/admin/account-recovery', { params });
export const getAccountRecoveryRequestById = (id) => api.get(`/admin/account-recovery/${id}`);
export const approveAccountRecovery = (id) => api.patch(`/admin/account-recovery/${id}/approve`);
export const rejectAccountRecovery = (id, data) => api.patch(`/admin/account-recovery/${id}/reject`, data);

// Note: Add Categories, Services, Packages, etc. here as needed

// Vendor Management
export const getVendors = (params) => api.get('/admin/vendors', { params });
export const createVendor = (data) => api.post('/admin/vendors', data);
export const updateVendorStatus = (id, statusData) => api.put(`/admin/vendors/${id}/status`, statusData);

// Content Management
export const getAdminContent = (type) => api.get(`/admin/content/${type}`);
export const updateAdminContent = (type, data) => api.put(`/admin/content/${type}`, data);

// Auth & Profile
export const loginAdmin = (data) => api.post('/auth/login/admin', data);
export const getProfile = (token) => api.get('/auth/profile', token ? { headers: { Authorization: `Bearer ${token}` } } : {});
export const updateProfile = (data) => api.put('/users/profile', data);

// Salons
export const getAllSalons = (params) => api.get('/salons/admin/all', { params });
export const updateSalonStatus = (id, data) => api.put(`/salons/${id}`, data);

// Bookings
export const getAllBookings = (params) => api.get('/admin/bookings', { params });

// Reviews
export const getAllReviews = (params) => api.get('/reviews/admin', { params });
export const deleteReview = (id) => api.delete(`/reviews/${id}`);

// Categories
export const getCategories = (params) => api.get('/categories', { params });
export const createCategory = (data) => api.post('/categories', data, { headers: { 'Content-Type': data instanceof FormData ? 'multipart/form-data' : 'application/json' } });
export const updateCategory = (id, data) => api.put(`/categories/${id}`, data, { headers: { 'Content-Type': data instanceof FormData ? 'multipart/form-data' : 'application/json' } });
export const deleteCategory = (id) => api.delete(`/categories/${id}`);
export const getSubcategories = (params) => api.get('/subcategories', { params });
export const createSubcategory = (data) => api.post('/subcategories', data);
export const updateSubcategory = (id, data) => api.put(`/subcategories/${id}`, data);
export const deleteSubcategory = (id) => api.delete(`/subcategories/${id}`);

// Services
export const getServices = (params) => api.get('/admin/services', { params });

// Commissions
export const getCommissions = (params) => api.get('/commissions', { params });
export const setCommission = (data) => api.post('/commissions', data);
export const deleteCommission = (id) => api.delete(`/commissions/${id}`);
export const getPlatformFee = () => api.get('/commissions/platform-fee');
export const updatePlatformFee = (data) => api.put('/commissions/platform-fee', data);

// Coupons
export const getCoupons = (params) => api.get('/coupons', { params });
export const createCoupon = (data) => api.post('/coupons', data);
export const updateCoupon = (id, data) => api.put(`/coupons/${id}`, data);
export const deleteCoupon = (id) => api.delete(`/coupons/${id}`);

// Offers & Packages
export const getOffers = (params) => api.get('/offers', { params });
export const approveOffer = (id) => api.patch(`/offers/${id}/approve`);
export const rejectOffer = (id, data) => api.patch(`/offers/${id}/reject`, data);

export const getPackages = (params) => api.get('/packages', { params });
export const approvePackage = (id) => api.patch(`/packages/${id}/approve`);
export const rejectPackage = (id, data) => api.patch(`/packages/${id}/reject`, data);
export const updatePackageAdmin = (id, data) => api.patch(`/packages/${id}/admin`, data);
export const deletePackageAdmin = (id) => api.delete(`/packages/${id}/admin`);

// Subscriptions & Settings
export const getSubscriptionSettings = () => api.get('/admin/subscription-settings');
export const updateSubscriptionSettings = (data) => api.put('/admin/subscription-settings', data);

export const getSubscriptionPlans = (params) => api.get('/subscriptions', { params });
export const createSubscriptionPlan = (data) => api.post('/subscriptions', data);
export const updateSubscriptionPlan = (id, data) => api.put(`/subscriptions/${id}`, data);
export const deleteSubscriptionPlan = (id) => api.delete(`/subscriptions/${id}`);
export const getVendorSubscriptionHistory = (vendorId) => api.get(`/subscriptions/vendor/${vendorId}/history`);
export const cancelVendorSubscription = (vendorId, cancelReason) => api.patch(`/subscriptions/vendor/${vendorId}/cancel`, { cancelReason });

// Banners
export const getBanners = () => api.get('/banners');
export const createBanner = (formData) => api.post('/banners', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateBanner = (id, formData) => api.put(`/banners/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteBanner = (id) => api.delete(`/banners/${id}`);
export const toggleBannerStatus = (id) => api.patch(`/banners/${id}/toggle-status`);

// Notifications
export const getNotifications = (params) => api.get('/notifications', { params });
export const getUnreadCount = () => api.get('/notifications/unread-count');
export const markAsRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllAsRead = () => api.patch('/notifications/read-all');
export const clearAllNotifications = () => api.delete('/notifications/clear-all');
export const deleteNotification = (id) => api.delete(`/notifications/${id}`);

// Chat
export const initiateChat = (data) => api.post('/chat/initiate', data);
export const getChats = () => api.get('/chat');
export const getMessages = (chatId, params) => api.get(`/chat/${chatId}/messages`, { params });
export const sendMessage = (chatId, data) => api.post(`/chat/${chatId}/messages`, data);
export const markChatAsRead = (chatId) => api.patch(`/chat/${chatId}/read`);

// Settings
export const updateBulkSettings = (data) => api.put('/settings/bulk', data);

// FAQs
export const getAdminFAQs = () => api.get('/faqs/admin');
export const createFAQ = (data) => api.post('/faqs', data);
export const updateFAQ = (id, data) => api.put(`/faqs/${id}`, data);
export const deleteFAQ = (id) => api.delete(`/faqs/${id}`);

// Booking Issues
export const getAdminBookingIssues = () => api.get('/booking-issues/admin');
export const updateBookingIssueStatus = (id, status) => api.patch(`/booking-issues/${id}/status`, { status });

// Payments & Financials
export const getAdminTransactions = (params) => api.get('/payments/transactions', { params });
export const getAdminFinancialSummary = (params) => api.get('/payments/admin-financial-summary', { params });
export const getAdminSettlements = (params) => api.get('/payments/admin-settlements', { params });
export const recordAdminSettlement = (data) => api.post('/payments/admin-settlement', data);
