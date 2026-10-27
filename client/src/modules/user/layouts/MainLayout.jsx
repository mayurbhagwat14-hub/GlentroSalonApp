import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNav from '../../../components/common/TopNav';
import BottomNav from '../../../components/common/BottomNav';
import Footer from '../../../components/common/Footer';

const MainLayout = ({ children }) => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  // Hide BottomNav only on sub-flow/detail pages (checkout, book slot, salon detail, chat room, booking detail)
  // NOTE: Main tabs like /bookings, /chat, /search, /profile MUST keep BottomNav!
  const isFlowPage = 
    pathname.endsWith('/checkout') || 
    pathname.endsWith('/book') || 
    /^\/salon\/[^/]+$/.test(pathname) ||
    /^\/chat\/[^/]+$/.test(pathname) ||
    /^\/booking\/[^/]+$/.test(pathname);

  return (
    <div className={`bg-background text-on-background antialiased min-h-screen ${
      isFlowPage ? 'pb-[env(safe-area-inset-bottom,16px)]' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]'
    } md:pb-0 pt-0 md:pt-[calc(4.5rem+env(safe-area-inset-top))] max-w-[100vw] overflow-x-hidden flex flex-col`}>
      <TopNav />

      {/* Main Content */}
      <main className="w-full px-4 md:px-margin-desktop max-w-container-max mx-auto box-border flex-grow pt-0">
        {children || <Outlet />}
      </main>

      {!isFlowPage && <Footer />}
      {!isFlowPage && <BottomNav />}
    </div>
  );
};

export default MainLayout;
