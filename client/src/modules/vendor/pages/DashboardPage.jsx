import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useBranch } from '../../../context/BranchContext';
import { getVendorSalons, getVendorServices, getVendorStaff, getVendorStats, getVendorRecentBookings, getVendorAnalytics } from '../services/vendorApi';
import { useSocket } from '../../../context/SocketContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { formatPaise } from '../../../utils/money';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const STATUS_COLORS = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
  REJECTED: '#6b7280'
};

const DashboardPage = () => {
  const { vendor, loading: authLoading } = useAuth();
  const { socket } = useSocket();
  const { selectedSalon, loadingBranches, salons } = useBranch();
  
  // KPI Stats
  const [stats, setStats] = useState({ 
    total: 0, pending: 0, confirmed: 0, completed: 0, todayRevenue: 0, 
    totalEarnings: 0, totalGrossCustomerPaid: 0, onlinePayments: 0, cashPayments: 0,
    staff: 0, services: 0 
  });
  const [loading, setLoading] = useState(true);

  // Analytics
  const [analyticsRange, setAnalyticsRange] = useState('30d');
  const [analyticsData, setAnalyticsData] = useState({
    bookingTrend: [],
    revenueTrend: [],
  });
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Recent Bookings
  const [recentBookings, setRecentBookings] = useState([]);
  const [bookingPagination, setBookingPagination] = useState({ currentPage: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Race condition sequence counters
  const fetchAnalyticsSeq = useRef(0);
  const fetchBookingsSeq = useRef(0);
  const loadDashboardSeq = useRef(0);

  useEffect(() => { 
    if (vendor && !loadingBranches) {
      loadDashboard(); 
    }
  }, [vendor, loadingBranches, selectedSalon]);

  useEffect(() => {
    if (vendor && !loadingBranches) {
      fetchAnalytics();
    }
  }, [vendor, analyticsRange, selectedSalon, loadingBranches]);

  // Handle new bookings via socket
  useEffect(() => {
    if (socket) {
      const handleNewBooking = () => {
        loadDashboard();
        fetchAnalytics();
      };
      socket.on('booking:new', handleNewBooking);
      return () => {
        if (socket.off) socket.off('booking:new', handleNewBooking);
      };
    }
  }, [socket]);

  const fetchBookings = async (page = 1) => {
    const seq = ++fetchBookingsSeq.current;
    setLoadingBookings(true);
    try {
      const params = { page, limit: 5 };
      if (selectedSalon) params.salon = selectedSalon._id;
      const res = await getVendorRecentBookings(params);
      
      if (seq !== fetchBookingsSeq.current) return; // Prevent race condition

      if (res.data?.success) {
        setRecentBookings(res.data.data);
        setBookingPagination(res.data.pagination);
      }
    } catch (e) {
      if (seq !== fetchBookingsSeq.current) return;
      console.error('Failed to load recent bookings', e);
    }
    if (seq === fetchBookingsSeq.current) {
      setLoadingBookings(false);
    }
  };

  const fetchAnalytics = async () => {
    const seq = ++fetchAnalyticsSeq.current;
    setLoadingAnalytics(true);
    try {
      const params = { range: analyticsRange };
      if (selectedSalon) params.salon = selectedSalon._id;
      
      const [analyticsRes, statsRes] = await Promise.all([
        getVendorAnalytics(params).catch(() => ({ data: { data: {} } })),
        getVendorStats(params).catch(() => ({ data: { data: {} } }))
      ]);
      
      if (seq !== fetchAnalyticsSeq.current) return; // Prevent race condition

      if (analyticsRes.data?.success) {
        setAnalyticsData(analyticsRes.data.data);
      }
      
      if (statsRes.data?.success) {
        const backendStats = statsRes.data.data;
        setStats(prev => ({
          ...prev,
          total: backendStats.totalBookings || 0,
          pending: backendStats.pendingBookings || 0,
          confirmed: backendStats.confirmedBookings || 0,
          completed: backendStats.completedBookings || 0,
          todayRevenuePaise: backendStats.todayRevenuePaise,
          todayRevenue: backendStats.todayRevenue || 0,
          totalEarningsPaise: backendStats.totalEarningsPaise,
          totalEarnings: backendStats.totalEarnings || 0,
          totalGrossCustomerPaidPaise: backendStats.totalGrossCustomerPaidPaise,
          totalGrossCustomerPaid: backendStats.totalGrossCustomerPaid || 0,
          onlinePaymentsPaise: backendStats.onlinePaymentsPaise,
          onlinePayments: backendStats.onlinePayments || 0,
          cashPaymentsPaise: backendStats.cashPaymentsPaise,
          cashPayments: backendStats.cashPayments || 0
        }));
      }
    } catch (e) {
      if (seq !== fetchAnalyticsSeq.current) return;
      console.error('Failed to load analytics', e);
    }
    
    if (seq === fetchAnalyticsSeq.current) {
      setLoadingAnalytics(false);
    }
  };

  const loadDashboard = async () => {
    const seq = ++loadDashboardSeq.current;
    try {
      const params = { limit: 1 }; // We only need the total count, not the data arrays
      if (selectedSalon) params.salon = selectedSalon._id;
      
      const [servicesRes, staffRes] = await Promise.all([
        getVendorServices(params).catch(() => ({ data: { data: { total: 0 } } })),
        getVendorStaff(params).catch(() => ({ data: { data: { total: 0 } } }))
      ]);

      if (seq !== loadDashboardSeq.current) return; // Prevent race condition

      setStats(prev => ({
        ...prev,
        services: servicesRes.data?.data?.total || 0,
        staff: staffRes.data?.data?.total || 0
      }));

      await fetchBookings(1);
    } catch (e) {
      if (seq !== loadDashboardSeq.current) return;
      console.error('Failed to load dashboard base info', e);
    }
    
    if (seq === loadDashboardSeq.current) {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Earnings', subLabel: '(Net)', value: formatPaise(stats.totalEarningsPaise, stats.totalEarnings), icon: 'account_balance_wallet', color: 'text-success', bg: 'bg-success/10', link: '/vendor/financials' },
    { label: 'Customer Paid', subLabel: '(Gross)', value: formatPaise(stats.totalGrossCustomerPaidPaise, stats.totalGrossCustomerPaid), icon: 'payments', color: 'text-blue-500', bg: 'bg-blue-500/10', link: '/vendor/financials' },
    { label: 'Online Payments', value: formatPaise(stats.onlinePaymentsPaise, stats.onlinePayments), icon: 'credit_card', color: 'text-purple-500', bg: 'bg-purple-500/10', link: '/vendor/financials' },
    { label: 'Cash Payments', value: formatPaise(stats.cashPaymentsPaise, stats.cashPayments), icon: 'money', color: 'text-emerald-500', bg: 'bg-emerald-500/10', link: '/vendor/financials' },
    { label: 'Total Bookings', value: stats.total, icon: 'calendar_month', color: 'text-indigo-500', bg: 'bg-indigo-500/10', link: '/vendor/bookings' },
  ];

  const statusColorsList = { 
    PENDING: 'bg-yellow-50 text-yellow-800 border-yellow-200', 
    CONFIRMED: 'bg-blue-50 text-blue-800 border-blue-200', 
    COMPLETED: 'bg-green-50 text-green-800 border-green-200', 
    CANCELLED: 'bg-red-50 text-red-800 border-red-200', 
    REJECTED: 'bg-gray-50 text-gray-800 border-gray-200' 
  };

  if (loading || authLoading || loadingBranches || !vendor) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-10 w-64 bg-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {[1,2,3,4,5].map(i => (
             <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse border border-border"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div className="min-w-0 flex flex-col">
          <span className="text-[13px] md:text-[16px] text-muted-text font-medium mb-0.5">Welcome back,</span>
          <h1 className="font-headline-md text-[18px] sm:text-[22px] md:text-[26px] text-on-surface font-bold truncate">
            {vendor?.businessName || vendor?.name}
          </h1>
          <p className="text-[12px] md:text-[14px] text-muted-text mt-0.5 truncate">
            Managing {salons.length} salon{salons.length !== 1 ? 's' : ''}
          </p>
        </div>
        <select 
          value={analyticsRange}
          onChange={(e) => setAnalyticsRange(e.target.value)}
          className="px-3 py-2 bg-surface border border-border rounded-xl outline-none text-xs sm:text-sm font-medium hover:border-primary/50 transition-colors cursor-pointer w-full md:w-auto"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="3m">Last 3 Months</option>
          <option value="6m">Last 6 Months</option>
          <option value="12m">Last 12 Months</option>
        </select>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-6">
        {statCards.map((stat, idx) => (
          <Link key={idx} to={stat.link} className={`bg-surface rounded-2xl p-4 md:p-5 shadow-sm border border-border transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-primary/20 animate-slide-up-fade stagger-${(idx % 8) + 1} flex flex-col justify-between`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.bg} ${stat.color} shrink-0`}>
              <span className="material-symbols-outlined text-[20px]">{stat.icon}</span>
            </div>
            <div>
              <h3 className="font-headline-lg text-[20px] md:text-[22px] text-on-surface font-bold leading-tight">{stat.value}</h3>
              <p className="font-label-md text-muted-text mt-1 leading-tight">
                {stat.label} <br/> {stat.subLabel && <span className="text-xs opacity-75">{stat.subLabel}</span>}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Revenue Card (Total) */}
      <div className="bg-surface rounded-2xl p-5 md:p-6 shadow-sm border border-border transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-primary/20 flex items-center justify-between animate-slide-up-fade stagger-6">
        <div className="min-w-0 pr-4">
          <p className="font-label-md text-muted-text truncate">Today's Revenue (Completed Bookings)</p>
          <h3 className="font-headline-lg text-[24px] md:text-[28px] text-success font-bold mt-1 truncate">{formatPaise(stats.todayRevenuePaise, stats.todayRevenue)}</h3>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-success/10 text-success shrink-0">
          <span className="material-symbols-outlined text-[24px]">payments</span>
        </div>
      </div>

      {/* Analytics Charts */}
      {loadingAnalytics ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
           <div className="h-80 bg-slate-100 rounded-2xl animate-pulse border border-border"></div>
           <div className="h-80 bg-slate-100 rounded-2xl animate-pulse border border-border"></div>
        </div>
      ) : (
        <>
          {/* Main Charts: Trend & Revenue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 min-w-0">
            <div className="bg-surface rounded-2xl p-4 md:p-6 border border-border shadow-sm min-w-0 overflow-hidden">
              <h3 className="font-semibold text-on-surface text-base md:text-lg mb-4">Booking Overview</h3>
              <div className="h-60 md:h-72 w-full min-w-0">
                {analyticsData.bookingTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData.bookingTrend}>
                      <defs>
                        <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} tickMargin={8} minTickGap={20} />
                      <YAxis tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} width={30} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        labelStyle={{ fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="bookings" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBookings)" name="Bookings" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-text">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-30">show_chart</span>
                    <p className="text-sm text-center">No booking data available.</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-surface rounded-2xl p-4 md:p-6 border border-border shadow-sm min-w-0 overflow-hidden">
              <h3 className="font-semibold text-on-surface text-base md:text-lg mb-4">Revenue Overview</h3>
              <div className="h-60 md:h-72 w-full min-w-0">
                {analyticsData.revenueTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData.revenueTrend}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} tickMargin={8} minTickGap={20} />
                      <YAxis tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val}`} width={40} />
                      <RechartsTooltip 
                        formatter={(value) => [`₹${value}`, 'Net Earnings']}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        labelStyle={{ fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Net Earnings" />
                      <Area type="monotone" dataKey="grossCustomerPaid" stroke="#8b5cf6" strokeWidth={3} fillOpacity={0} name="Gross Customer Paid" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-text">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-30">payments</span>
                    <p className="text-sm text-center">No revenue data available.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Recent Bookings */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm min-w-0">
        <div className="px-4 md:px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-on-surface text-base md:text-lg">Recent Bookings & Activities</h3>
        </div>
        {loadingBookings ? (
          <div className="px-6 py-12 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-3xl animate-spin">progress_activity</span>
          </div>
        ) : recentBookings.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-text flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl text-muted-text/30 mb-2">calendar_today</span>
            <p className="text-sm">No bookings yet</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border overflow-hidden">
              {recentBookings.map(b => (
                <div key={b._id} className="px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-variant/20 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{b.user?.name || 'Customer'}</p>
                    <p className="text-xs text-muted-text mt-1 truncate">
                      {b.salon?.name} • {new Date(b.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {b.startTime}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-sm text-on-surface">{formatPaise(b.finalAmountPaise, b.finalAmount)}</span>
                    <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] font-semibold border ${statusColorsList[b.status]}`}>{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Controls */}
            {bookingPagination.totalPages > 1 && (
              <div className="px-4 md:px-6 py-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-text">
                  Page {bookingPagination.currentPage} of {bookingPagination.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    disabled={!bookingPagination.hasPreviousPage}
                    onClick={() => fetchBookings(bookingPagination.currentPage - 1)}
                    className="px-3 py-2 text-xs font-semibold rounded-lg border border-border disabled:opacity-50 disabled:bg-surface-variant hover:bg-surface-variant transition-colors"
                  >
                    Prev
                  </button>
                  <button 
                    disabled={!bookingPagination.hasNextPage}
                    onClick={() => fetchBookings(bookingPagination.currentPage + 1)}
                    className="px-3 py-2 text-xs font-semibold rounded-lg border border-border disabled:opacity-50 disabled:bg-surface-variant hover:bg-surface-variant transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
export default DashboardPage;
