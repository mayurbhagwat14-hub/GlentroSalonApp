import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Loader from '../../../components/common/Loader';
import AuthLayout from '../layouts/AuthLayout';
import MainLayout from '../layouts/MainLayout';
import LegalPageLayout from '../layouts/LegalPageLayout';
import ProtectedRoute from '../../../components/common/ProtectedRoute';
import ErrorBoundary from '../../../components/common/ErrorBoundary';
import { useAuth } from '../../../context/AuthContext';
import LandingPage from '../../landing/pages/LandingPage';

import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import HomePage from '../pages/home/HomePage';
import SearchPage from '../pages/home/SearchPage';

const SalonListPage = lazy(() => import('../pages/salon/SalonListPage'));
const SalonDetailPage = lazy(() => import('../pages/salon/SalonDetailPage'));
const ContentPage = lazy(() => import('../pages/profile/ContentPage'));
const BookingPage = lazy(() => import('../pages/booking/BookingPage'));
const CheckoutPage = lazy(() => import('../pages/booking/CheckoutPage'));
const BookingListPage = lazy(() => import('../pages/booking/BookingListPage'));
const BookingDetailPage = lazy(() => import('../pages/booking/BookingDetailPage'));
const ChatListPage = lazy(() => import('../pages/chat/ChatListPage'));
const ChatPage = lazy(() => import('../pages/chat/ChatPage'));
const NotificationsPage = lazy(() => import('../pages/notifications/NotificationsPage'));
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage'));
const FavoritesPage = lazy(() => import('../pages/profile/FavoritesPage'));
const SupportPage = lazy(() => import('../pages/profile/SupportPage'));
const BookingIssuesPage = lazy(() => import('../pages/profile/BookingIssuesPage'));
const CallHistoryPage = lazy(() => import('../pages/profile/CallHistoryPage'));
import OffersPage from '../pages/home/OffersPage';

const SuspenseWrapper = ({ children }) => (
  <Suspense
    fallback={
      <div className="w-full min-h-[35vh] flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="w-7 h-7 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-2"></div>
        <span className="text-xs font-medium text-text-secondary">Loading...</span>
      </div>
    }
  >
    {children}
  </Suspense>
);

/**
 * RootRoute: Controls the root '/' entry point.
 * - Authenticated User: Shows User Dashboard (HomePage inside MainLayout)
 * - Authenticated Vendor: Redirects to Vendor Dashboard (/vendor)
 * - Authenticated Admin: Redirects to Admin Dashboard (/admin)
 * - Unauthenticated: Renders the production Landing Page
 */
const RootRoute = () => {
  const { user, vendor, admin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f9f9ff]">
        <div className="w-12 h-12 border-4 border-purple-200 border-t-[#54238f] rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">Checking session...</p>
      </div>
    );
  }

  if (vendor) {
    return <Navigate to="/vendor" replace />;
  }

  // Authenticated customer goes to customer home dashboard
  if (user) {
    return (
      <MainLayout>
        <HomePage />
      </MainLayout>
    );
  }

  // Admins and unauthenticated visitors can view the landing page
  return <LandingPage />;
};

export default function UserRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Public Routes under MainLayout */}
      <Route element={<MainLayout />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/salons" element={<SuspenseWrapper><SalonListPage /></SuspenseWrapper>} />
        <Route path="/salon/:id" element={<SuspenseWrapper><SalonDetailPage /></SuspenseWrapper>} />
        <Route path="/salon/:id/book" element={<SuspenseWrapper><BookingPage /></SuspenseWrapper>} />
        <Route path="/salon/:id/checkout" element={<SuspenseWrapper><CheckoutPage /></SuspenseWrapper>} />
        <Route path="/booking-issues" element={<SuspenseWrapper><BookingIssuesPage /></SuspenseWrapper>} />
      </Route>

      {/* Protected Routes under MainLayout */}
      <Route element={<ProtectedRoute role="user"><MainLayout /></ProtectedRoute>}>
        <Route path="/bookings" element={<SuspenseWrapper><BookingListPage /></SuspenseWrapper>} />
        <Route path="/booking/:id" element={<ErrorBoundary><SuspenseWrapper><BookingDetailPage /></SuspenseWrapper></ErrorBoundary>} />
        <Route path="/chat" element={<SuspenseWrapper><ChatListPage /></SuspenseWrapper>} />
        <Route path="/chat/:chatId" element={<SuspenseWrapper><ChatPage /></SuspenseWrapper>} />
        <Route path="/notifications" element={<SuspenseWrapper><NotificationsPage /></SuspenseWrapper>} />
        <Route path="/profile" element={<SuspenseWrapper><ProfilePage /></SuspenseWrapper>} />
        <Route path="/favorites" element={<SuspenseWrapper><FavoritesPage /></SuspenseWrapper>} />
        <Route path="/call-history" element={<SuspenseWrapper><CallHistoryPage /></SuspenseWrapper>} />
      </Route>

      {/* Guest/Public Legal Pages */}
      <Route element={<LegalPageLayout />}>
        <Route path="/privacy-policy" element={<SuspenseWrapper><ContentPage type="privacy_policy" titleFallback="Privacy Policy" /></SuspenseWrapper>} />
        <Route path="/terms-and-conditions" element={<SuspenseWrapper><ContentPage type="terms_conditions" titleFallback="Terms & Conditions" /></SuspenseWrapper>} />
        <Route path="/help-support" element={<SuspenseWrapper><SupportPage /></SuspenseWrapper>} />
        <Route path="/support" element={<SuspenseWrapper><SupportPage /></SuspenseWrapper>} />
      </Route>
    </Routes>
  );
}
