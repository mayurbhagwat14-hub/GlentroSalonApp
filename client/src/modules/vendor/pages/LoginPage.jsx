import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { loginVendor, sendOtpAPI, verifyLoginOtpAPI } from '../services/vendorApi';
import { useSettings } from '../../../context/SettingContext';
import { getImageUrl } from '../../../utils/imageUtils';

const LoginPage = () => {
  const [loginMode, setLoginMode] = useState('password'); // 'password' | 'otp'
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [otpStep, setOtpStep] = useState('phone'); // 'phone' | 'otp'
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const { vendor, setAuth } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    if (vendor) {
      navigate('/vendor', { replace: true });
    }
  }, [vendor, navigate]);

  // Resend countdown timer
  useEffect(() => {
    let timer = null;
    if (otpStep === 'otp' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [otpStep, countdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const savedToken = localStorage.getItem('glentro_fcm_token');
      const payload = { ...formData, platform: 'web' };
      if (savedToken) {
        payload.fcmtoken = savedToken;
      }
      const res = await loginVendor(payload);
      setAuth('vendor', res.data.data.vendor, res.data.data.token);
      navigate('/vendor');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const cleanDigits = phone.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 10) {
      return setError('Please enter a valid 10-digit registered mobile number');
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await sendOtpAPI({ phone: cleanDigits, role: 'vendor' });
      setMaskedPhone(res.data?.data?.maskedPhone || `+91 ${cleanDigits.slice(0, 2)}******${cleanDigits.slice(8)}`);
      setOtpStep('otp');
      setCountdown(60);
      setCanResend(false);
      setSuccess(res.data?.message || 'OTP sent on registered number');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please check your registered partner number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const cleanDigits = phone.replace(/\D/g, '');
    if (!otp || otp.trim().length < 4) {
      return setError('Please enter the OTP sent to your phone');
    }
    setLoading(true);
    setError('');
    try {
      const savedToken = localStorage.getItem('glentro_fcm_token');
      const payload = { phone: cleanDigits, otp: otp.trim(), role: 'vendor', platform: 'web' };
      if (savedToken) {
        payload.fcmtoken = savedToken;
      }
      const res = await verifyLoginOtpAPI(payload);
      setAuth('vendor', res.data.data.vendor, res.data.data.token);
      navigate('/vendor');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const vendorAuthImage = settings?.vendorLoginPageImage
    ? getImageUrl(settings.vendorLoginPageImage)
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
      {/* Rich dark wine / burgundy gradient overlay matching vendor brand */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#3B001D] from-35% via-[#3B001D]/85 to-[#240012]/45 backdrop-blur-sm" />

      {/* LEFT SIDE: Visuals for Vendor (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center p-12 z-10">
        {/* Main Showcase Container */}
        <div className="relative w-full max-w-[420px] aspect-[1/1.2] rounded-[32px] shadow-2xl z-10 overflow-hidden border border-white/20">
          <img
            src={vendorAuthImage}
            alt="Salon Management Studio"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 flex flex-col justify-between p-8 text-white">
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 self-start text-xs font-semibold tracking-wide">
              <span className="material-symbols-outlined text-[16px] text-amber-300">verified</span>
              <span>Salon Partner Network</span>
            </div>

            {/* Bottom Copy */}
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2 drop-shadow-md">
                Empower Your Salon
              </h2>
              <p className="text-white/80 text-xs sm:text-sm leading-relaxed mb-4">
                Streamline appointments, staff rosters, dynamic pricing, and live revenue payouts in one unified platform.
              </p>

              {/* Stats Chips */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/15 text-[11px] font-medium text-white/90">
                <span className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-rose-300">lock_clock</span>
                  0% Double Bookings
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-rose-300">groups</span>
                  Staff Rosters
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-rose-300">payments</span>
                  Direct Payouts
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
          <span className="material-symbols-outlined text-white text-2xl">badge</span>
        </div>
        <div
          className="absolute top-[16%] right-[14%] w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20"
          style={{ animationDuration: '6s', animationDelay: '0.5s' }}
        >
          <span className="material-symbols-outlined text-white text-3xl">trending_up</span>
        </div>
        <div
          className="absolute bottom-[10%] right-[12%] w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20"
          style={{ animationDuration: '4.5s', animationDelay: '1.5s' }}
        >
          <span className="material-symbols-outlined text-white text-2xl">payments</span>
        </div>
      </div>

      {/* RIGHT SIDE: Vendor Login Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 z-20">
        <div className="w-full max-w-[480px] bg-white/85 backdrop-blur-xl rounded-[32px] p-8 sm:p-10 shadow-[0_8px_32px_0_rgba(59,0,29,0.3)] border border-white/60 relative">
          {/* Mobile-only compact banner */}
          <div className="block lg:hidden mb-6 -mx-8 -mt-8 sm:-mx-10 sm:-mt-10 rounded-t-[32px] overflow-hidden relative h-[140px]">
            <img
              src={vendorAuthImage}
              alt="Vendor Portal"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end p-5">
              <span className="text-white text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-900/60 backdrop-blur-md border border-white/20">
                Salon Partner Network
              </span>
            </div>
          </div>

          {/* Back Button */}
          <button
            onClick={() => navigate('/')}
            aria-label="Back to home"
            className="absolute top-8 left-8 text-gray-400 hover:text-[#810041] transition-colors p-1 rounded-full hover:bg-white/50 z-10"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>

          {/* Top Right Home Action */}
          <div className="absolute top-8 right-8 flex items-center gap-4">
            <Link
              to="/"
              className="text-sm font-medium text-gray-500 hover:text-[#810041] transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">home</span>
              <span className="hidden sm:inline">Home</span>
            </Link>
          </div>

          {/* Brand Header */}
          <div className="mb-8 mt-2 pr-20">
            <div className="flex items-center gap-2 mb-4">
              {settings?.appLogo && !logoError ? (
                <img
                  src={getImageUrl(settings.appLogo)}
                  alt={`${appName} Logo`}
                  onError={() => setLogoError(true)}
                  className="h-8 md:h-10 object-contain"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#810041] to-[#b5145b] flex items-center justify-center text-white shadow-md shadow-rose-900/25">
                  <span className="material-symbols-outlined text-[20px]">storefront</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="font-headline font-bold text-xl text-[#121c2a]">
                  {appName}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-[#810041] border border-rose-200/80 text-[10px] font-bold uppercase tracking-wider">
                  Vendor
                </span>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-1.5">
              Welcome Back
            </h1>
            <p className="text-gray-600 text-sm leading-relaxed">
              Sign in to manage your salon, staff, and appointments.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2 animate-fade-in">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm flex items-center gap-2 animate-fade-in">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{success}</span>
            </div>
          )}

          {/* Login Mode Tabs: Password vs OTP */}
          <div className="flex p-1 mb-6 bg-rose-50/60 rounded-2xl border border-rose-200/50">
            <button
              type="button"
              onClick={() => {
                setLoginMode('password');
                setError('');
                setSuccess('');
              }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                loginMode === 'password'
                  ? 'bg-white text-[#810041] shadow-sm border border-rose-900/10'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">lock</span>
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('otp');
                setError('');
                setSuccess('');
              }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                loginMode === 'otp'
                  ? 'bg-white text-[#810041] shadow-sm border border-rose-900/10'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">sms</span>
              Login with OTP
            </button>
          </div>

          {/* Form */}
          {loginMode === 'password' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    mail
                  </span>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="vendor@email.com"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#810041]/20 focus:border-[#810041] transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex justify-between items-center mb-1.5 px-1">
                  <label className="text-[13px] font-medium text-gray-700">Password</label>
                  <Link
                    to="/forgot-password"
                    state={{ returnUrl: '/vendor/login' }}
                    className="text-[13px] font-medium text-[#810041] hover:text-[#5e0030] transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter your password"
                    required
                    className="w-full pl-12 pr-12 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#810041]/20 focus:border-[#810041] transition-all shadow-sm"
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#810041] via-[#9e0551] to-[#b5145b] text-white font-semibold text-[15px] shadow-lg shadow-rose-950/25 hover:shadow-rose-950/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In as Vendor</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Vendor OTP Login Flow */
            <div className="space-y-5 animate-fade-in">
              {otpStep === 'phone' ? (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 px-0.5">
                      Registered Partner Mobile Number
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 select-none">
                        +91
                      </span>
                      <input
                        type="tel"
                        value={phone}
                        maxLength={10}
                        onChange={(e) => {
                          setPhone(e.target.value.replace(/\D/g, ''));
                          setError('');
                        }}
                        placeholder="Enter 10-digit number"
                        required
                        className="w-full pl-14 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm tracking-wider font-medium focus:outline-none focus:ring-2 focus:ring-[#810041]/20 focus:border-[#810041] transition-all shadow-sm"
                      />
                    </div>
                    <p className="text-[12px] text-gray-500 mt-1.5 px-1">
                      We will send a 6-digit verification OTP on your registered partner number.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || phone.length < 10}
                    className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#810041] via-[#9e0551] to-[#b5145b] text-white font-semibold text-[15px] shadow-lg shadow-rose-950/25 hover:shadow-rose-950/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <span>Send OTP</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  {/* OTP Sent Banner */}
                  <div className="p-3.5 rounded-xl bg-rose-50/90 border border-rose-200/80 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-[#810041]">
                      <span className="material-symbols-outlined text-[20px] text-[#b5145b]">mark_chat_unread</span>
                      <div>
                        <div className="font-semibold">OTP sent on registered number:</div>
                        <div className="text-gray-600 font-medium">{maskedPhone}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep('phone');
                        setOtp('');
                        setError('');
                      }}
                      className="text-xs font-semibold text-[#810041] hover:underline py-0.5"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 px-0.5">
                      Enter 6-Digit OTP
                    </label>
                    <input
                      type="text"
                      value={otp}
                      maxLength={6}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/\D/g, ''));
                        setError('');
                      }}
                      placeholder="••••••"
                      autoFocus
                      required
                      className="w-full text-center py-3.5 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 text-2xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#810041]/20 focus:border-[#810041] transition-all shadow-sm"
                    />
                  </div>

                  {/* Resend Countdown */}
                  <div className="flex items-center justify-between text-xs px-1 text-gray-500">
                    <span>Didn't receive the OTP?</span>
                    {canResend ? (
                      <button
                        type="button"
                        onClick={handleSendOTP}
                        disabled={loading}
                        className="font-bold text-[#810041] hover:underline cursor-pointer"
                      >
                        Resend OTP
                      </button>
                    ) : (
                      <span className="font-medium text-gray-400">
                        Resend in <span className="font-bold text-gray-600">{countdown}s</span>
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length < 4}
                    className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#810041] via-[#9e0551] to-[#b5145b] text-white font-semibold text-[15px] shadow-lg shadow-rose-950/25 hover:shadow-rose-950/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Enter Dashboard</span>
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Footer Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 mb-4">
              New to {appName}?{' '}
              <Link
                to="/vendor/register"
                className="font-bold text-[#810041] hover:text-[#5e0030] transition-colors underline decoration-[#810041]/30 hover:decoration-[#5e0030]"
              >
                Register Business
              </Link>
            </p>

            {/* Legal Links */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-500 mt-6 pt-4 border-t border-gray-100">
              <Link
                to="/privacy-policy?guest=true"
                state={{ from: '/vendor/login' }}
                className="hover:text-[#810041] hover:underline transition-colors"
              >
                Privacy Policy
              </Link>
              <span className="text-gray-300">•</span>
              <Link
                to="/terms-and-conditions?guest=true"
                state={{ from: '/vendor/login' }}
                className="hover:text-[#810041] hover:underline transition-colors"
              >
                Terms & Conditions
              </Link>
              <span className="text-gray-300">•</span>
              <Link
                to="/help-support?guest=true"
                state={{ from: '/vendor/login' }}
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

export default LoginPage;
