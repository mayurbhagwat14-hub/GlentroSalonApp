import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getMyBookings } from '../../services/userApi';
import Loader from '../../../../components/common/Loader';
import PageHeader from '../../../../components/common/PageHeader';
import { BookingListSkeleton } from '../../components/skeletons/BookingListSkeleton';
import { formatPaise } from '../../../../utils/money';

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-gray-100 text-gray-700',
};

const BookingListPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const fromProfile = location.state?.fromProfile;

  useEffect(() => { loadBookings(); }, [filter, page]);

  const handleFilterChange = (newFilter) => {
    if (filter !== newFilter) {
      setFilter(newFilter);
      setPage(1); // Reset to page 1 on filter change
    }
  };

  const loadBookings = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (filter) params.status = filter;
      
      const res = await getMyBookings(params);
      const responseData = res.data;

      // Shape 1 (new): { success, data: [...], pagination: {...} }
      // Shape 2 (old): { success, data: { bookings: [...], total, page, totalPages } }
      let extractedBookings = [];
      let extractedPagination = null;

      if (Array.isArray(responseData?.data)) {
        // New shape
        extractedBookings = responseData.data;
        extractedPagination = responseData.pagination || null;
      } else if (responseData?.data?.bookings) {
        // Old shape
        extractedBookings = responseData.data.bookings;
        const total = responseData.data.total || 0;
        const totalPages = responseData.data.totalPages || 1;
        extractedPagination = {
          currentPage: responseData.data.page || page,
          pageSize: 10,
          totalItems: total,
          totalPages,
          hasNextPage: (responseData.data.page || page) < totalPages,
          hasPreviousPage: (responseData.data.page || page) > 1,
        };
      }

      setBookings(extractedBookings);
      if (extractedPagination) setPagination(extractedPagination);
    } catch (e) {
      console.error('Failed to load bookings:', e?.response?.data || e.message);
      setBookings([]);
    }
    setLoading(false);
  };

  const filters = ['', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in w-full px-3 sm:px-4 md:px-0 pb-20 md:pb-12 pt-1 md:pt-4">
      <div className="md:hidden"><PageHeader title="My Bookings" fallbackPath="/" /></div>
      <div className="hidden md:flex items-center gap-4">
        {fromProfile && (
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors flex items-center justify-center">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        <h1 className="font-headline-xl text-[32px] font-bold text-on-surface">My Bookings</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {filters.map(f => (
          <button key={f} onClick={() => handleFilterChange(f)}
            className={`px-4 py-2 rounded-full text-[14px] font-label-md whitespace-nowrap transition-all ${
              filter === f ? 'bg-primary text-white shadow-sm' : 'bg-surface text-muted-text border border-border hover:border-primary'}`}>
            {f || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <BookingListSkeleton />
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 flex flex-col items-center">
          <span className="material-symbols-outlined text-4xl text-muted-text/30 mb-2">calendar_month</span>
          <h3 className="text-lg font-semibold">No bookings found</h3>
          <p className="text-text-secondary text-sm mt-1">Book your first appointment!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(booking => (
            <div key={booking._id} onClick={() => navigate(`/booking/${booking._id}`)}
              className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-text-primary">{booking.salon?.name || 'Salon'}</h3>
                  <div className="text-sm text-text-secondary mt-1 flex flex-wrap items-center gap-y-1 gap-x-3">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-muted-text">calendar_month</span>
                      {new Date(booking.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-muted-text">schedule</span>
                      {booking.startTime} - {booking.endTime}
                    </span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[booking.status]}`}>
                  {booking.status}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <span className="text-sm text-text-muted">Booking #{booking._id.slice(-6).toUpperCase()}</span>
                <span className="font-semibold text-primary-600">{formatPaise(booking.finalAmountPaise, booking.finalAmount)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Pagination Controls */}
      {!loading && pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 pb-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={!pagination.hasPreviousPage || loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-surface text-on-surface border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-variant transition-colors"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-text-secondary">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!pagination.hasNextPage || loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-surface text-on-surface border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-variant transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default BookingListPage;
