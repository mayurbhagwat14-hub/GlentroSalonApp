import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';

const BottomNav = () => {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    let baseHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    const handleResize = () => {
      const currentHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      
      // Update base height if window gets taller (e.g. orientation change)
      if (currentHeight > baseHeight) {
        baseHeight = currentHeight;
      }
      
      // If current height is at least 150px smaller than the maximum seen height, 
      // we assume the virtual keyboard is open.
      if (baseHeight - currentHeight > 150) {
        setIsKeyboardOpen(true);
      } else {
        setIsKeyboardOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  if (isKeyboardOpen) return null;

  return (
    <nav className="bottom-nav fixed bottom-0 left-0 w-full flex justify-around items-center pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom,14px))] px-4 bg-surface shadow-[0px_-10px_20px_rgba(109,62,168,0.08)] rounded-t-[20px] z-50 md:hidden box-border">
      <NavLink 
        to="/" 
        className={({ isActive }) => 
          `flex flex-col items-center justify-center transition-all active:scale-90 duration-200 ${
            isActive 
              ? 'bg-soft-primary text-primary rounded-2xl px-3 py-1' 
              : 'text-on-surface-variant hover:text-primary'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span className="material-symbols-outlined text-[22px]" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>home</span>
            <span className="font-label-sm text-[11px] mt-1">Home</span>
          </>
        )}
      </NavLink>

      <NavLink 
        to="/search" 
        className={({ isActive }) => 
          `flex flex-col items-center justify-center transition-all active:scale-90 duration-200 ${
            isActive 
              ? 'bg-soft-primary text-primary rounded-2xl px-3 py-1' 
              : 'text-on-surface-variant hover:text-primary'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span className="material-symbols-outlined text-[22px]" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>search</span>
            <span className="font-label-sm text-[11px] mt-1">Search</span>
          </>
        )}
      </NavLink>

      <NavLink 
        to="/bookings" 
        className={({ isActive }) => 
          `flex flex-col items-center justify-center transition-all active:scale-90 duration-200 ${
            isActive 
              ? 'bg-soft-primary text-primary rounded-2xl px-3 py-1' 
              : 'text-on-surface-variant hover:text-primary'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span className="material-symbols-outlined text-[22px]" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>calendar_today</span>
            <span className="font-label-sm text-[11px] mt-1">Bookings</span>
          </>
        )}
      </NavLink>

      <NavLink 
        to="/chat" 
        className={({ isActive }) => 
          `flex flex-col items-center justify-center transition-all active:scale-90 duration-200 ${
            isActive 
              ? 'bg-soft-primary text-primary rounded-2xl px-3 py-1' 
              : 'text-on-surface-variant hover:text-primary'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span className="material-symbols-outlined text-[22px]" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>chat</span>
            <span className="font-label-sm text-[11px] mt-1">Chat</span>
          </>
        )}
      </NavLink>

      <NavLink 
        to="/profile" 
        className={({ isActive }) => 
          `flex flex-col items-center justify-center transition-all active:scale-90 duration-200 ${
            isActive 
              ? 'bg-soft-primary text-primary rounded-2xl px-3 py-1' 
              : 'text-on-surface-variant hover:text-primary'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span className="material-symbols-outlined text-[22px]" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>person</span>
            <span className="font-label-sm text-[11px] mt-1">Profile</span>
          </>
        )}
      </NavLink>
    </nav>
  );
};

export default BottomNav;
