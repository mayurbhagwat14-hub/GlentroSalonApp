import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useSettings } from '../../../context/SettingContext';
import { useNotifications } from '../../../context/NotificationContext';
import { getImageUrl } from '../../../utils/imageUtils';
import BranchSwitcher from '../components/BranchSwitcher';
import VendorBottomNav from '../components/VendorBottomNav';

const VendorLayout = () => {
  const { vendor: user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const { unreadCount } = useNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const hideHeader = location.pathname.includes('/vendor/chat/') || location.pathname.includes('/vendor/booking/');

  const navItems = [
    { to: '/vendor', label: 'Dashboard', icon: 'grid_view' },
    { to: '/vendor/analytics', label: 'Analytics', icon: 'monitoring' },
    { to: '/vendor/salons', label: 'My Salons', icon: 'store' },
    { to: '/vendor/bookings', label: 'Bookings', icon: 'calendar_today' },
    { to: '/vendor/chats', label: 'Chats', icon: 'chat' },
    { to: '/vendor/staff', label: 'Staff', icon: 'group' },
    { to: '/vendor/services', label: 'Services', icon: 'cut' },
    { to: '/vendor/resources', label: 'Facilities', icon: 'hot_tub' },
    { to: '/vendor/packages', label: 'Offers & Packages', icon: 'redeem' },
    { to: '/vendor/financials', label: 'Financials', icon: 'account_balance_wallet' },
    { to: '/vendor/subscription', label: 'Subscription', icon: 'workspace_premium' },
    { to: '/vendor/call-history', label: 'Call Logs', icon: 'phone_in_talk' },
    { to: '/vendor/reviews', label: 'Reviews', icon: 'star_rate' },
    { to: '/vendor/notifications', label: 'Notifications', icon: 'notifications', count: unreadCount },
    { to: '/vendor/profile', label: 'Profile', icon: 'person' },
  ];

  return (
    <div className="h-screen w-full bg-background flex font-inter overflow-hidden">
      {/* Sidebar (Drawer on Mobile) */}
      <aside className={`fixed lg:relative inset-y-0 left-0 z-50 w-[260px] bg-[#1b0639] border-r border-white/10 transform transition-transform duration-300 ease-in-out flex flex-col h-[100dvh] lg:h-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10 shrink-0 mt-[env(safe-area-inset-top)]">
          {settings?.appLogo ? (
            <img src={getImageUrl(settings.appLogo)} alt="App Logo" className="w-10 h-10 rounded-lg object-contain bg-white/5 p-1" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-primary border border-white/20 shadow-inner shrink-0">
              <span className="material-symbols-outlined text-[24px]">spa</span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-headline-sm text-[18px] text-white leading-tight font-bold tracking-wide truncate">{settings?.appName || 'Glentro Salon'}</h1>
            <p className="font-label-sm text-[11px] text-white/70 tracking-wider truncate">Vendor Portal</p>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto hide-scrollbar pb-24 lg:pb-6">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/vendor'} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `flex items-center justify-between px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200 ${isActive ? 'bg-primary text-white shadow-md' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <div className="flex items-center gap-3 truncate">
                <span className="material-symbols-outlined text-[20px] shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.count > 0 && (
                <span className="bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shrink-0">
                  {item.count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 mt-auto shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-4">
          <button onClick={() => { logout('vendor'); navigate('/'); }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-medium text-white/80 hover:bg-error hover:text-white transition-colors duration-200">
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Overlay for Mobile Drawer */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {!hideHeader && (
          <header className="shrink-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border min-h-[58px] pt-[max(0.5rem,calc(env(safe-area-inset-top,0px)+0.25rem))] lg:h-[72px] lg:pt-0 px-3 lg:px-6 flex items-center justify-between">
            <div className="flex items-center gap-2 lg:gap-4 min-w-0 flex-1">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl text-muted-text hover:bg-surface-variant active:bg-surface-variant flex items-center shrink-0">
                <span className="material-symbols-outlined">menu</span>
              </button>
              
              {/* Branch Switcher Component */}
              <div className="min-w-0 flex-1 lg:max-w-xs">
                <BranchSwitcher />
              </div>
            </div>
            
            <div className="flex items-center gap-3 lg:gap-4 ml-2 shrink-0">
              <div onClick={() => navigate('/vendor/profile')} className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-on-surface leading-tight truncate max-w-[120px]">{user?.businessName || user?.name}</p>
                  <p className="text-[10px] text-muted-text uppercase tracking-wider font-semibold mt-0.5">{user?.businessName ? 'Vendor' : 'Owner'}</p>
                </div>
                <img src={getImageUrl(user?.avatar) || `https://ui-avatars.com/api/?name=${user?.name}&background=7c3aed&color=fff`} alt={user?.name} className="w-8 h-8 lg:w-10 lg:h-10 rounded-full object-cover border-2 border-primary/20 shadow-sm shrink-0" />
              </div>
            </div>
          </header>
        )}

        {/* --- Global Suspension Banner --- */}
        {user?.accountStatus === 'suspended' && user?.suspensionReasons?.includes('CASH_LIMIT_EXCEEDED') && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-between shrink-0 z-20 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-red-600">warning</span>
              <p className="text-xs lg:text-sm font-medium text-red-800">
                Account suspended (cash limit exceeded).
              </p>
            </div>
            <button
              onClick={() => navigate('/vendor/financials')}
              className="text-xs lg:text-sm font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-700 transition-colors whitespace-nowrap shrink-0"
            >
              Settle Now
            </button>
          </div>
        )}

        <main className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full pb-[calc(5rem+env(safe-area-inset-bottom,16px))] lg:pb-0 ${hideHeader ? '' : 'p-3 lg:p-6 pt-2 lg:pt-6 flex flex-col'}`}>
          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation for Mobile */}
      {!hideHeader && <VendorBottomNav />}
    </div>
  );
};

export default VendorLayout;
