import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingContext';
import { getCategories, initiateChat } from '../../modules/user/services/userApi';
import { getImageUrl } from '../../utils/imageUtils';

const Footer = () => {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await getCategories();
        if (res.data?.success && res.data?.data) {
          // Take up to 5 categories for the footer
          setCategories(res.data.data.slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to fetch categories for footer:', error);
      }
    };
    fetchCategories();
  }, []);

  const currentYear = new Date().getFullYear();

  const handleContactAdmin = async () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    try {
      const res = await initiateChat({
        recipientRole: 'admin',
        chatType: 'user-admin',
      });
      navigate(`/chat/${res.data.data._id}`);
    } catch (e) {
      console.error('Unable to connect with Admin', e);
    }
  };

  return (
    <footer className="hidden md:block bg-[#1b0639] text-white pt-12 pb-8 mt-12 w-full border-t border-white/10">
      <div className="max-w-container-max mx-auto px-6 md:px-margin-desktop">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          
          {/* Brand Section */}
          <div className="flex flex-col space-y-4 lg:w-1/4">
            <div 
              className="cursor-pointer inline-block"
              onClick={() => navigate('/')}
            >
              {settings?.appLogo ? (
                <img src={getImageUrl(settings.appLogo)} alt={`${settings?.appName || 'GlentroSalon'} Logo`} className="h-10 object-contain" />
              ) : (
                <span className="font-headline-md text-[24px] font-bold text-white">{settings?.appName || 'GlentroSalon'}</span>
              )}
            </div>
            <p className="text-white/70 font-label-md leading-relaxed max-w-sm mt-2">
              Discover top-rated salons, exclusive offers and professional services near you. Book your next appointment with ease.
            </p>
          </div>

          {/* Links Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-8 lg:w-3/4">
            {/* Quick Links */}
            <div className="flex flex-col space-y-4">
              <h3 className="font-headline-sm text-base md:text-lg text-white font-semibold mb-2">Quick Links</h3>
              <Link to="/" className="text-white/70 hover:text-white transition-colors w-fit font-label-sm md:font-label-md">Home</Link>
              <Link to="/search" className="text-white/70 hover:text-white transition-colors w-fit font-label-sm md:font-label-md">Search Salons</Link>
              <Link to="/offers" className="text-white/70 hover:text-white transition-colors w-fit font-label-sm md:font-label-md">Special Offers</Link>
              <Link to="/salons" className="text-white/70 hover:text-white transition-colors w-fit font-label-sm md:font-label-md">All Salons</Link>
            </div>

            {/* Services / Explore */}
            <div className="flex flex-col space-y-4">
              <h3 className="font-headline-sm text-base md:text-lg text-white font-semibold mb-2">Explore Services</h3>
              {categories.length > 0 ? (
                categories.map((category) => (
                  <Link 
                    key={category._id} 
                    to={`/search?q=${encodeURIComponent(category.name)}`}
                    className="text-white/70 hover:text-white transition-colors w-fit font-label-sm md:font-label-md"
                  >
                    {category.name}
                  </Link>
                ))
              ) : (
                <span className="text-white/40 font-label-sm md:font-label-md">Loading services...</span>
              )}
            </div>

            {/* Account */}
            <div className="flex flex-col space-y-4">
              <h3 className="font-headline-sm text-base md:text-lg text-white font-semibold mb-2">My Account</h3>
              <Link to="/profile" className="text-white/70 hover:text-white transition-colors w-fit font-label-sm md:font-label-md">Profile</Link>
              <Link to="/bookings" className="text-white/70 hover:text-white transition-colors w-fit font-label-sm md:font-label-md">My Bookings</Link>
              <Link to="/favorites" className="text-white/70 hover:text-white transition-colors w-fit font-label-sm md:font-label-md">Favorites</Link>
              <Link to="/chat" className="text-white/70 hover:text-white transition-colors w-fit font-label-sm md:font-label-md">Messages</Link>
            </div>
            
            {/* Help & Support */}
            <div className="flex flex-col space-y-4">
              <h3 className="font-headline-sm text-base md:text-lg text-white font-semibold mb-2">Help & Support</h3>
              <Link to="/support" className="text-white/70 hover:text-white transition-colors w-fit font-label-sm md:font-label-md">Help & Support</Link>
              <Link to="/booking-issues" className="text-white/70 hover:text-white transition-colors w-fit font-label-sm md:font-label-md">Booking Issues</Link>
              <Link to="/privacy-policy" className="text-white/70 hover:text-white transition-colors w-fit font-label-sm md:font-label-md">Privacy Policy</Link>
              <Link to="/terms-and-conditions" className="text-white/70 hover:text-white transition-colors w-fit font-label-sm md:font-label-md">Terms & Conditions</Link>
              <button onClick={handleContactAdmin} className="text-white/70 hover:text-white transition-colors text-left w-fit font-label-sm md:font-label-md">Live Chat (Support)</button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-white/50 font-label-sm">
          <p>&copy; {currentYear} {settings?.appName || 'GlentroSalon'}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
