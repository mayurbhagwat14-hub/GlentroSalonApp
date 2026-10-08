import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { registerUser } from '../../../../services/api/authApi';
import { useSettings } from '../../../../context/SettingContext';
import { getImageUrl } from '../../../../utils/imageUtils';
import Button from '../../../../components/common/Button';
import Input from '../../../../components/common/Input';

const RegisterPage = () => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [logoError, setLogoError] = useState(false);
  
  const { state } = useLocation();
  const { setAuth } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!acceptedTerms) {
      return setError('You must accept the Terms of Service & Privacy Policy');
    }
    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }
    
    setLoading(true);
    setError('');
    
    try {
      const savedToken = localStorage.getItem('glentro_fcm_token');
      const payload = { ...formData, platform: 'web' };
      if (savedToken) {
        payload.fcmtoken = savedToken;
      }
      const res = await registerUser(payload);
      setAuth('user', res.data.data.user, res.data.data.token);
      
      const pendingBookingStr = sessionStorage.getItem('pendingBooking');
      if (pendingBookingStr) {
        try {
          const pendingBooking = JSON.parse(pendingBookingStr);
          navigate(`/salon/${pendingBooking.salon}/checkout`, { state: pendingBooking, replace: true });
          return;
        } catch (e) {
          console.error('Failed to parse pending booking', e);
        }
      }
      
      if (state?.from) {
        navigate(state.from, { state: state.bookingState, replace: true });
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const registerImage = settings?.registerPageImage ? getImageUrl(settings.registerPageImage) : 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=2070&auto=format&fit=crop';

  return (
    <div className="h-[100dvh] lg:min-h-screen lg:h-auto flex w-full relative overflow-hidden font-inter">
      
      {/* Background with Split Effect */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${registerImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'right'
        }}
      ></div>
      {/* Heavy gradient overlay: Solid purple left, translucent right */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#2D0B5A] from-40% via-[#2D0B5A]/80 to-[#2D0B5A]/20 backdrop-blur-sm"></div>

      {/* LEFT SIDE: Visuals (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center p-12 z-10">
        
        {/* Main Image Container */}
        <div className="relative w-full max-w-[400px] aspect-[1/1.2] rounded-[32px] shadow-2xl z-10 bg-surface overflow-hidden">
          <img 
            src={registerImage} 
            alt="Premium Salon Interior" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
        </div>

        {/* Floating Glass Elements (Placed outside the overflow-hidden container) */}
        <div className="absolute top-[20%] left-[15%] w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20" style={{ animationDuration: '4s' }}>
          <span className="material-symbols-outlined text-white text-3xl">cut</span>
        </div>
        <div className="absolute bottom-[25%] left-[25%] w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20" style={{ animationDuration: '5s', animationDelay: '1s' }}>
          <span className="material-symbols-outlined text-white text-2xl">content_cut</span>
        </div>
        <div className="absolute top-[35%] right-[15%] w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20" style={{ animationDuration: '6s', animationDelay: '0.5s' }}>
          <span className="material-symbols-outlined text-white text-3xl">sanitizer</span>
        </div>
        <div className="absolute bottom-[20%] right-[20%] w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20" style={{ animationDuration: '4.5s', animationDelay: '1.5s' }}>
          <span className="material-symbols-outlined text-white text-2xl">sanitizer</span>
        </div>
      </div>

      {/* RIGHT SIDE: Registration Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12 z-20 h-[100dvh] lg:h-auto lg:min-h-0 pt-[env(safe-area-inset-top,16px)] pb-[env(safe-area-inset-bottom,16px)]">
        
        <div className="w-full h-full lg:h-auto max-h-[850px] overflow-y-auto bg-white/80 backdrop-blur-xl rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/60 relative flex flex-col justify-start sm:justify-center custom-scrollbar">
          
          {/* Back to Login Link */}
          <Link 
            to="/login" 
            className="absolute top-4 right-4 sm:top-8 sm:right-8 text-xs sm:text-sm font-semibold text-[#4A1578] hover:text-[#2D0B5A] transition-colors bg-white/50 px-3 py-1.5 rounded-full z-10"
          >
            Back to Login
          </Link>

          {/* Heading */}
          <div className="mb-4 sm:mb-8 mt-1 sm:mt-2 pr-24">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-3 sm:mb-6">
              {settings?.appLogo && !logoError ? (
                <img
                  src={getImageUrl(settings.appLogo)}
                  alt={`${settings?.appName || 'GlentroSalon'} Logo`}
                  onError={() => setLogoError(true)}
                  className="h-6 sm:h-8 md:h-10 object-contain"
                />
              ) : (
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-[#31105D] to-[#8854C0] flex items-center justify-center text-white font-bold text-sm sm:text-lg shadow-md">
                  {(settings?.appName || 'GlentroSalon').charAt(0)}
                </div>
              )}
              <span className="font-headline-md text-lg sm:text-xl font-bold text-[#2D0B5A]">
                {settings?.appName || 'GlentroSalon'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Start Your Journey</h1>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
              Create your {settings?.appName || 'Glentro'} profile to discover amazing beauty services.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2 animate-fade-in">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Input Groups - Using custom styling to match the reference closely */}
            <div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">person</span>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange} 
                  placeholder="Full Name" 
                  required 
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1578]/20 focus:border-[#4A1578] transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">mail</span>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  placeholder="Email Address" 
                  required 
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1578]/20 focus:border-[#4A1578] transition-all shadow-sm"
                />
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">phone</span>
                <input 
                  type="tel" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
                  placeholder="Mobile Number" 
                  required 
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1578]/20 focus:border-[#4A1578] transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">lock</span>
                <input 
                  type={showPassword ? "text" : "password"} 
                  name="password" 
                  value={formData.password} 
                  onChange={handleChange} 
                  placeholder="Password" 
                  required 
                  className="w-full pl-12 pr-12 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1578]/20 focus:border-[#4A1578] transition-all shadow-sm"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">lock_reset</span>
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  name="confirmPassword" 
                  value={formData.confirmPassword} 
                  onChange={handleChange} 
                  placeholder="Confirm Password" 
                  required 
                  className="w-full pl-12 pr-12 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1578]/20 focus:border-[#4A1578] transition-all shadow-sm"
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="pt-2 pb-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input 
                    type="checkbox" 
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-[#4A1578] focus:ring-[#4A1578] transition-colors cursor-pointer"
                  />
                </div>
                <span className="text-sm text-gray-600 leading-snug">
                  I agree to the {settings?.appName || 'GlentroSalon'} <Link to="/terms-and-conditions?guest=true" state={{ from: '/register' }} className="text-gray-900 font-medium underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900 transition-colors">Terms of Service</Link> & <Link to="/privacy-policy?guest=true" state={{ from: '/register' }} className="text-gray-900 font-medium underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900 transition-colors">Privacy Policy</Link>.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#31105D] to-[#8854C0] text-white font-semibold text-[15px] shadow-lg shadow-purple-900/20 hover:shadow-purple-900/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Creating Account...</>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 mb-4">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-[#2D0B5A] hover:text-[#60209c] transition-colors underline decoration-[#2D0B5A]/30 hover:decoration-[#60209c]">
                Login
              </Link>
            </p>

            {/* Legal & Support Links */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-500 mt-6 pt-4 border-t border-gray-100">
              <Link to="/privacy-policy?guest=true" state={{ from: '/register' }} className="hover:text-[#4A1578] hover:underline transition-colors">Privacy Policy</Link>
              <span className="text-gray-300">•</span>
              <Link to="/terms-and-conditions?guest=true" state={{ from: '/register' }} className="hover:text-[#4A1578] hover:underline transition-colors">Terms & Conditions</Link>
              <span className="text-gray-300">•</span>
              <Link to="/help-support?guest=true" state={{ from: '/register' }} className="hover:text-[#4A1578] hover:underline transition-colors">Help & Support</Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
