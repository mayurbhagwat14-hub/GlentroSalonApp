import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { loginUser, sendOtpAPI, verifyLoginOtpAPI } from '../../../../services/api/authApi';
import { requestAccountRecovery } from '../../services/userApi';
import { useSettings } from '../../../../context/SettingContext';
import { getImageUrl } from '../../../../utils/imageUtils';
import LoginSlider from '../../components/LoginSlider';

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

  // Account Recovery State (from original implementation)
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [recoveryReason, setRecoveryReason] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const { state } = useLocation();
  const { user, setAuth } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (state?.from) {
        navigate(state.from, { state: state.bookingState, replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, navigate, state]);

  // Resend Countdown Timer
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleAuthSuccess = (userData, token) => {
    setAuth('user', userData, token);

    // Check if user was redirected from booking page (date/time selection)
    const pendingBookingReturnStr = sessionStorage.getItem('pendingBookingReturn');
    if (pendingBookingReturnStr) {
      try {
        const { path, state: bookingState } = JSON.parse(pendingBookingReturnStr);
        sessionStorage.removeItem('pendingBookingReturn');
        navigate(path, { state: bookingState, replace: true });
        return;
      } catch (e) {
        console.error('Failed to parse pendingBookingReturn', e);
        sessionStorage.removeItem('pendingBookingReturn');
      }
    }

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
  };

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
      const res = await loginUser(payload);
      handleAuthSuccess(res.data.data.user, res.data.data.token);
    } catch (err) {
      if (err.response?.data?.code === 'ACCOUNT_DELETED') {
        setError(err.response.data.message);
        setShowRecoveryForm(true);
      } else if (err.response?.data?.code === 'ACCOUNT_RECOVERY_PENDING') {
        setError(err.response.data.message);
        setShowRecoveryForm(false);
      } else {
        setError(err.response?.data?.message || 'Login failed. Please try again.');
        setShowRecoveryForm(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const cleanDigits = phone.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 10) {
      return setError('Please enter a valid 10-digit mobile number');
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await sendOtpAPI({ phone: cleanDigits, role: 'user' });
      setMaskedPhone(res.data?.data?.maskedPhone || `+91 ${cleanDigits.slice(0, 2)}******${cleanDigits.slice(8)}`);
      setOtpStep('otp');
      setCountdown(60);
      setCanResend(false);
      setSuccess(res.data?.message || 'OTP sent on registered number');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please check your registered number.');
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
      const payload = { phone: cleanDigits, otp: otp.trim(), role: 'user', platform: 'web' };
      if (savedToken) {
        payload.fcmtoken = savedToken;
      }
      const res = await verifyLoginOtpAPI(payload);
      handleAuthSuccess(res.data.data.user, res.data.data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await requestAccountRecovery({ email: formData.email, reason: recoveryReason });
      setSuccess(res.data.message);
      setShowRecoveryForm(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit recovery request.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 2 && !state?.from) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const loginImage = settings?.loginPageImage ? getImageUrl(settings.loginPageImage) : 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=2070&auto=format&fit=crop';

  return (
    <div className="min-h-screen flex w-full relative overflow-x-hidden font-inter">

      {/* Background with Split Effect */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${loginImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'right'
        }}
      ></div>
      {/* Heavy gradient overlay: Solid purple left, translucent right */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#2D0B5A] from-40% via-[#2D0B5A]/80 to-[#2D0B5A]/20 backdrop-blur-sm"></div>

      {/* LEFT SIDE: Visuals — dynamic slider on desktop (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center p-12 z-10">
        {/* Main Slider Container */}
        <div className="relative w-full max-w-[400px] aspect-[1/1.2] rounded-[32px] shadow-2xl z-10 bg-surface overflow-hidden">
          <LoginSlider />
        </div>

        {/* Floating Glass Elements (Placed outside the overflow-hidden container) */}
        <div className="absolute top-[15%] left-[15%] w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20" style={{ animationDuration: '4s' }}>
          <span className="material-symbols-outlined text-white text-3xl">cut</span>
        </div>
        <div className="absolute bottom-[10%] left-[15%] w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20" style={{ animationDuration: '5s', animationDelay: '1s' }}>
          <span className="material-symbols-outlined text-white text-2xl">content_cut</span>
        </div>
        <div className="absolute top-[15%] right-[15%] w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20" style={{ animationDuration: '6s', animationDelay: '0.5s' }}>
          <span className="material-symbols-outlined text-white text-3xl">sanitizer</span>
        </div>
        <div className="absolute bottom-[10%] right-[15%] w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center animate-bounce z-20" style={{ animationDuration: '4.5s', animationDelay: '1.5s' }}>
          <span className="material-symbols-outlined text-white text-2xl">clean_hands</span>
        </div>
      </div>

      {/* RIGHT SIDE: Login Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 z-20 pt-[max(1.5rem,calc(env(safe-area-inset-top,0px)+1rem))] pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+1rem))]">

        <div className="w-full max-w-[480px] bg-white/80 backdrop-blur-xl rounded-[32px] p-8 sm:p-10 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/60 relative">

          {/* Mobile-only compact slider strip above login card */}
          <div className="block lg:hidden mb-6 -mx-8 -mt-8 sm:-mx-10 sm:-mt-10 rounded-t-[32px] overflow-hidden" style={{ height: 180 }}>
            <LoginSlider />
          </div>

          {/* Back Button */}
          <button
            onClick={handleBack}
            className="absolute top-8 left-8 text-gray-400 hover:text-[#2D0B5A] transition-colors p-1 rounded-full hover:bg-white/50 z-10"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>

          {/* Top Right Actions */}
          <div className="absolute top-8 right-8 flex items-center gap-4">
            <Link to="/" className="text-sm font-medium text-gray-500 hover:text-[#2D0B5A] transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">home</span>
              <span className="hidden sm:inline">Home</span>
            </Link>
          </div>

          {/* Heading */}
          <div className="mb-8 mt-2 pr-24">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-6">
              {settings?.appLogo && !logoError ? (
                <img
                  src={getImageUrl(settings.appLogo)}
                  alt={`${settings?.appName || 'GlentroSalon'} Logo`}
                  onError={() => setLogoError(true)}
                  className="h-8 md:h-10 object-contain"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#31105D] to-[#8854C0] flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {(settings?.appName || 'GlentroSalon').charAt(0)}
                </div>
              )}
              <span className="font-headline-md text-xl font-bold text-[#2D0B5A]">
                {settings?.appName || 'GlentroSalon'}
              </span>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {showRecoveryForm ? 'Account Recovery' : 'Welcome Back'}
            </h1>
            <p className="text-gray-600 text-sm leading-relaxed">
              {showRecoveryForm
                ? 'Please provide a reason to recover your deleted account.'
                : 'Sign in to continue your beauty journey.'}
            </p>
          </div>

          {/* Error & Success Messages */}
          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2 animate-fade-in">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm flex items-center gap-2 animate-fade-in">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {success}
            </div>
          )}

          {state?.deleted && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">info</span>
              Your account has been deactivated successfully.
            </div>
          )}

          {/* Login Mode Tabs: Password vs OTP */}
          {!showRecoveryForm && (
            <div className="flex p-1 mb-6 bg-gray-100/90 rounded-2xl border border-gray-200/60">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('password');
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  loginMode === 'password'
                    ? 'bg-white text-[#2D0B5A] shadow-sm border border-black/5'
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
                    ? 'bg-white text-[#2D0B5A] shadow-sm border border-black/5'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">sms</span>
                Login with OTP
              </button>
            </div>
          )}

          {/* Form */}
          {!showRecoveryForm ? (
            loginMode === 'password' ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Input Group */}
                <div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">mail</span>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Email / Mobile Number"
                      required
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1578]/20 focus:border-[#4A1578] transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* Password Input Group */}
                <div>
                  <div className="flex justify-between items-center mb-1.5 px-1">
                    <label className="text-[13px] font-medium text-gray-700">Password</label>
                    <Link to="/forgot-password" className="text-[13px] font-medium text-[#4A1578] hover:text-[#2D0B5A] transition-colors">
                      Forgot Password?
                    </Link>
                  </div>
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

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#31105D] to-[#8854C0] text-white font-semibold text-[15px] shadow-lg shadow-purple-900/20 hover:shadow-purple-900/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Signing In...</>
                  ) : (
                    'Continue'
                  )}
                </button>
              </form>
            ) : (
              /* OTP Login Flow */
              <div className="space-y-5 animate-fade-in">
                {otpStep === 'phone' ? (
                  <form onSubmit={handleSendOTP} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5 px-0.5">
                        Registered Mobile Number
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
                          className="w-full pl-14 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm tracking-wider font-medium focus:outline-none focus:ring-2 focus:ring-[#4A1578]/20 focus:border-[#4A1578] transition-all shadow-sm"
                        />
                      </div>
                      <p className="text-[12px] text-gray-500 mt-1.5 px-1">
                        We will send a 6-digit verification OTP on this registered number.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || phone.length < 10}
                      className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#31105D] to-[#8854C0] text-white font-semibold text-[15px] shadow-lg shadow-purple-900/20 hover:shadow-purple-900/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Sending OTP...</>
                      ) : (
                        <>Send OTP <span className="material-symbols-outlined text-[18px]">arrow_forward</span></>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOTP} className="space-y-4">
                    {/* OTP Sent Banner */}
                    <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-100 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-[#2D0B5A]">
                        <span className="material-symbols-outlined text-[20px] text-[#8854C0]">mark_chat_unread</span>
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
                        className="text-xs font-semibold text-[#8854C0] hover:text-[#2D0B5A] underline py-0.5"
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
                        className="w-full text-center py-3.5 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 text-2xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#4A1578]/20 focus:border-[#4A1578] transition-all shadow-sm"
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
                          className="font-bold text-[#4A1578] hover:underline cursor-pointer"
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
                      className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#31105D] to-[#8854C0] text-white font-semibold text-[15px] shadow-lg shadow-purple-900/20 hover:shadow-purple-900/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Verifying...</>
                      ) : (
                        <>Verify & Login <span className="material-symbols-outlined text-[18px]">verified</span></>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )
          ) : (
            <form onSubmit={handleRecoverySubmit} className="space-y-5 animate-fade-in">
              <p className="text-sm text-gray-600 leading-relaxed mb-2 text-center">
                If you deleted your account by mistake, you can request an admin to restore it.
                Please provide a reason below.
              </p>
              <div>
                <textarea
                  className="w-full p-4 rounded-xl border border-gray-200 bg-white focus:border-[#4A1578] focus:ring-2 focus:ring-[#4A1578]/20 outline-none transition-all shadow-sm resize-none h-28 text-sm text-gray-800"
                  placeholder="Why do you want to restore your account?"
                  value={recoveryReason}
                  onChange={(e) => setRecoveryReason(e.target.value)}
                  required
                  maxLength={500}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRecoveryForm(false);
                    setError('');
                  }}
                  disabled={recoveryLoading}
                  className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-[15px] hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#31105D] to-[#8854C0] text-white font-semibold text-[15px] shadow-lg shadow-purple-900/20 hover:shadow-purple-900/40 transition-all duration-200 disabled:opacity-70 flex items-center justify-center"
                >
                  {recoveryLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}

          {/* Footer Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 mb-4">
              Don't have an account?{' '}
              <Link to="/register" className="font-bold text-[#2D0B5A] hover:text-[#60209c] transition-colors underline decoration-[#2D0B5A]/30 hover:decoration-[#60209c]">
                Create Account
              </Link>
            </p>

            {/* Legal & Support Links */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-500 mt-6 pt-4 border-t border-gray-100">
              <Link to="/privacy-policy?guest=true" state={{ from: '/login' }} className="hover:text-[#4A1578] hover:underline transition-colors">Privacy Policy</Link>
              <span className="text-gray-300">•</span>
              <Link to="/terms-and-conditions?guest=true" state={{ from: '/login' }} className="hover:text-[#4A1578] hover:underline transition-colors">Terms & Conditions</Link>
              <span className="text-gray-300">•</span>
              <Link to="/help-support?guest=true" state={{ from: '/login' }} className="hover:text-[#4A1578] hover:underline transition-colors">Help & Support</Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
