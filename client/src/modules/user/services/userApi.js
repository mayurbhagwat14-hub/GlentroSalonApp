import api from '../../../services/api/axiosInstance';

// Salon discovery
export const getNearbySalons = (params) => api.get('/salons/nearby', { params });
export const getSalonsByCity = (city, params) => api.get(`/salons/city/${city}`, { params });
export const getSalons = (params) => api.get('/salons/public', { params });
export const getSalonById = (id) => api.get(`/salons/detail/${id}`);
export const getSalonResources = (id) => api.get(`/salons/${id}/resources`);
export const getCities = () => api.get('/salons/cities');
export const getZones = (city) => api.get(`/salons/cities/${city}/zones`);
export const getBanners = () => api.get('/banners/public');

// Favorites
export const getFavoriteSalons = () => api.get('/favorites');
export const checkFavorite = (salonId) => api.get(`/favorites/check/${salonId}`);
export const toggleFavorite = (salonId) => api.post(`/favorites/toggle/${salonId}`);

// Reviews
export const getSalonReviews = (salonId, params) => api.get(`/reviews/salon/${salonId}`, { params });
export const checkReviewEligibility = (salonId) => api.get(`/reviews/eligibility/${salonId}`);
export const submitReview = (data) => api.post('/reviews', data);

// Services
export const getServices = (params) => api.get('/services', { params });

// Staff
export const getSalonStaff = (salonId) => api.get(`/staff/salon/${salonId}`);
export const getStaffAvailability = (staffId, params) => api.get(`/staff/${staffId}/availability`, { params });

// Categories
export const getCategories = () => api.get('/categories');
export const getSubcategories = (params) => api.get('/subcategories', { params });

// Bookings
export const previewBookingTotal = (data) => api.post('/bookings/calculate-total', data);
export const createBooking = (data) => api.post('/bookings', data);
export const getMyBookings = (params) => api.get('/bookings/my', { params });
export const getBookingById = (id) => api.get(`/bookings/${id}`);
export const cancelBooking = (id, data) => api.patch(`/bookings/${id}/cancel`, typeof data === 'string' ? { reason: data } : (data || {}));
export const verifyBookingCompletion = (id, otp) => api.patch(`/bookings/${id}/verify-completion`, { otp });

// Payments
export const createPaymentOrder = (data) => api.post('/payments/create-order', data);
export const verifyPayment = (data) => api.post('/payments/verify', data);

// Wallet
export const getMyWallet = () => api.get('/user/wallet');

export const getAvailability = (salonId, params) => api.get(`/bookings/availability/${salonId}`, { params });
export const getComplexAvailability = (salonId, data) => api.post(`/bookings/availability/${salonId}`, data);

// Content & Policies
export const getContent = (type) => api.get(`/content/${type}`);
export const getActiveFAQs = () => api.get('/faqs');

// Booking Issues
export const createBookingIssue = (data) => api.post('/booking-issues', data);
export const getMyBookingIssues = () => api.get('/booking-issues');

// Coupons
export const validateCoupon = (data) => api.post('/coupons/validate', data);

// Packages
export const getPackages = (params) => api.get('/packages', { params });

// Platform Fee
export const getPublicPlatformFee = () => api.get('/commissions/platform-fee/public');

// Offers
export const getOffers = (params) => api.get('/offers', { params });

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
export const getUnreadCount = () => api.get('/notifications/unread-count');

// Account Settings
export const deleteUserAccount = (data) => api.delete('/users/account', { data });
export const requestAccountRecovery = (data) => api.post('/account-recovery/request', data);

// Calls
export const getCallHistory = () => api.get('/call/history');
