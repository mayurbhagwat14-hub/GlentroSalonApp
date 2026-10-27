import { NavLink } from 'react-router-dom';
import { useNotifications } from '../../../context/NotificationContext';

const VendorBottomNav = () => {
  const { unreadCount } = useNotifications();

  const navItems = [
    { to: '/vendor', label: 'Home', icon: 'grid_view' },
    { to: '/vendor/bookings', label: 'Bookings', icon: 'calendar_today' },
    { to: '/vendor/chats', label: 'Chats', icon: 'chat' },
    { to: '/vendor/profile', label: 'Profile', icon: 'person', badge: unreadCount > 0 },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-border z-40 pb-[max(0.6rem,env(safe-area-inset-bottom,14px))]">
      <nav className="flex justify-around items-center h-[60px] px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/vendor'}
            className={({ isActive }) => 
              `relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-primary' : 'text-muted-text hover:text-on-surface'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`relative flex items-center justify-center w-12 h-8 rounded-full transition-all ${isActive ? 'bg-primary/10' : ''}`}>
                  <span className={`material-symbols-outlined text-[24px] ${isActive ? 'font-fill' : ''}`}>
                    {item.icon}
                  </span>
                  {item.badge && (
                    <span className="absolute top-1 right-2 w-2 h-2 bg-error rounded-full border border-surface"></span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold tracking-wide ${isActive ? 'text-primary' : ''}`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default VendorBottomNav;
