import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { registerVendor } from '../services/vendorApi';
import { useSettings } from '../../../context/SettingContext';
import { getImageUrl } from '../../../utils/imageUtils';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const { vendor, setAuth } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    if (vendor) {
      navigate('/vendor', { replace: true });
    }
  }, [vendor, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!acceptedTerms) {
      return setError('Please accept the Terms of Service & Privacy Policy.');
    }
    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match.');
    }

    setLoading(true);
    setError('');
    try {
      const { confirmPassword, ...data } = formData;
      const savedToken = localStorage.getItem('glentro_fcm_token');
      const payload = { ...data, platform: 'web' };
      if (savedToken) {
        payload.fcmtoken = savedToken;
      }
      const res = await registerVendor(payload);
      setAuth('vendor', res.data.data.vendor, res.data.data.token);
      navigate('/vendor');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const vendorAuthImage = settings?.vendorRegisterPageImage
    ? getImageUrl(settings.vendorRegisterPageImage)
    : settings?.vendorAuthImage
    ? getImageUrl(settings.vendorAuthImage)
    : 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1974&auto=format&fit=crop';

  const appName = settings?.appName || 'GlentroSalon';

  return (
    <div className="min-h-screen flex w-full relative overflow-x-hidden font-inter">
      {/* Background with Split Effect */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${vendorAuthImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Deep wine / burgundy gradient overlay */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#3B001D] from-35% via-[#3B001D]/85 to-[#240012]/45 backdrop-blur-sm" />

      {/* LEFT SIDE: Visuals for Vendor (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center p-12 z-10">
        {/* Main Showcase Container */}
        <div className="relative w-full max-w-[420px] aspect-[1/1.2] rounded-[32px] shadow-2xl z-10 overflow-hidden border border-white/20">
          <img
            src={vendorAuthImage}
            alt="Salon Partner Workspace"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 flex flex-col justify-between p-8 text-white">
            {/* Top Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 self-start text-xs font-semibold tracking-wide">
              <span className="material-symbols-outlined text-[16px] text-amber-300">workspace_premium</span>
              <span>Join As Partner</span>
            </div>

            {/* Bottom Copy */}
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2 drop-shadow-md">
                Grow With Our Platform
              </h2>
              <p className="text-white/80 text-xs sm:text-sm leading-relaxed mb-4">
                List your salon in front of thousands of nearby customers, manage appointments, and unlock automated digital payments.
              </p>

              {/* Stat Chips */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/15 text-[11px] font-medium text-white/90">
                <span className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-rose-300">verified</span>
                  Zero Platform Setup Fee
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-rose-300">insights</span>
                  Instant Analytics
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Glass Badges */}
        <div
          className="absolute top-[14%] left-[12%] w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20"
          style={{ animationDuration: '4s' }}
        >
          <span className="material-symbols-outlined text-white text-3xl">storefront</span>
        </div>
        <div
          className="absolute bottom-[12%] left-[14%] w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20"
          style={{ animationDuration: '5s', animationDelay: '1s' }}
        >
          <span className="material-symbols-outlined text-white text-2xl">star</span>
        </div>
        <div
          className="absolute top-[16%] right-[14%] w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20"
          style={{ animationDuration: '6s', animationDelay: '0.5s' }}
        >
          <span className="material-symbols-outlined text-white text-3xl">insights</span>
        </div>
        <div
          className="absolute bottom-[10%] right-[12%] w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20"
          style={{ animationDuration: '4.5s', animationDelay: '1.5s' }}
        >
          <span className="material-symbols-outlined text-white text-2xl">how_to_reg</span>
        </div>
      </div>

      {/* RIGHT SIDE: Vendor Registration Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12 z-20 py-10">
        <div className="w-full max-w-[500px] bg-white/85 backdrop-blur-xl rounded-[32px] p-6 sm:p-10 shadow-[0_8px_32px_0_rgba(59,0,29,0.3)] border border-white/60 relative">
          {/* Back Button */}
          <button
            onClick={() => navigate('/vendor/login')}
            aria-label="Back to vendor login"
            className="absolute top-6 left-6 sm:top-8 sm:left-8 text-gray-400 hover:text-[#810041] transition-colors p-1 rounded-full hover:bg-white/50 z-10"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>

          {/* Top Right Home Action */}
          <div className="absolute top-6 right-6 sm:top-8 sm:right-8 flex items-center gap-4">
            <Link
              to="/"
              className="text-sm font-medium text-gray-500 hover:text-[#810041] transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">home</span>
              <span className="hidden sm:inline">Home</span>
            </Link>
          </div>

          {/* Brand Header */}
          <div className="mb-6 mt-4 pr-16">
            <div className="flex items-center gap-2 mb-3">
              {settings?.appLogo && !logoError ? (
                <img
                  src={getImageUrl(settings.appLogo)}
                  alt={`${appName} Logo`}
                  onError={() => setLogoError(true)}
                  className="h-7 sm:h-8 object-contain"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#810041] to-[#b5145b] flex items-center justify-center text-white shadow-md shadow-rose-900/25">
                  <span className="material-symbols-outlined text-[18px]">storefront</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="font-headline font-bold text-lg text-[#121c2a]">
                  {appName}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-[#810041] border border-rose-200/80 text-[10px] font-bold uppercase tracking-wider">
                  Partner
                </span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
              Register Your Salon
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
              Create your vendor account to manage staff and accept bookings.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs sm:text-sm flex items-center gap-2 animate-fade-in">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  person
                </span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Owner / Manager Full Name"
                  required
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#810041]/20 focus:border-[#810041] transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Business / Salon Name */}
            <div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  storefront
                </span>
                <input
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleChange}
                  placeholder="Salon / Business Name"
                  required
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#810041]/20 focus:border-[#810041] transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  mail
                </span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Business Email"
                  required
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#810041]/20 focus:border-[#810041] transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  call
                </span>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Phone Number"
                  required
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#810041]/20 focus:border-[#810041] transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  lock
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create Password (min. 6 characters)"
                  required
                  className="w-full pl-12 pr-12 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#810041]/20 focus:border-[#810041] transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  lock_reset
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm Password"
                  required
                  className="w-full pl-12 pr-12 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#810041]/20 focus:border-[#810041] transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Terms and Conditions Checkbox */}
            <div className="flex items-start gap-2.5 pt-1 px-1">
              <input
                type="checkbox"
                id="vendor-terms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#810041] focus:ring-[#810041] accent-[#810041]"
              />
              <label htmlFor="vendor-terms" className="text-xs text-gray-600 leading-snug">
                I agree to the{' '}
                <Link
                  to="/terms-and-conditions?guest=true"
                  state={{ from: '/vendor/register' }}
                  className="text-[#810041] font-medium hover:underline"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  to="/privacy-policy?guest=true"
                  state={{ from: '/vendor/register' }}
                  className="text-[#810041] font-medium hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#810041] via-[#9e0551] to-[#b5145b] text-white font-semibold text-[15px] shadow-lg shadow-rose-950/25 hover:shadow-rose-950/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Registering Business...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[19px]">how_to_reg</span>
                  <span>Register Salon Partner</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 text-center">
            <p className="text-xs sm:text-sm text-gray-600 mb-3">
              Already have a partner account?{' '}
              <Link
                to="/vendor/login"
                className="font-bold text-[#810041] hover:text-[#5e0030] transition-colors underline decoration-[#810041]/30 hover:decoration-[#5e0030]"
              >
                Sign In
              </Link>
            </p>

            {/* Legal Links */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-gray-500 pt-3 border-t border-gray-100">
              <Link
                to="/privacy-policy?guest=true"
                state={{ from: '/vendor/register' }}
                className="hover:text-[#810041] hover:underline transition-colors"
              >
                Privacy Policy
              </Link>
              <span className="text-gray-300">•</span>
              <Link
                to="/terms-and-conditions?guest=true"
                state={{ from: '/vendor/register' }}
                className="hover:text-[#810041] hover:underline transition-colors"
              >
                Terms & Conditions
              </Link>
              <span className="text-gray-300">•</span>
              <Link
                to="/help-support?guest=true"
                state={{ from: '/vendor/register' }}
                className="hover:text-[#810041] hover:underline transition-colors"
              >
                Help & Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
