import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { createBooking, validateCoupon, createPaymentOrder, verifyPayment, previewBookingTotal } from '../../services/userApi';
import { useAuth } from '../../../../context/AuthContext';
import { goBack } from '../../../../utils/navigation';
import { getImageUrl } from '../../../../utils/imageUtils';
import { formatPaise } from '../../../../utils/money';

const CheckoutPage = () => {
  const { id: salonId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Hydrate from state OR sessionStorage
  const [bookingContext] = useState(() => {
    if (location.state?.salon) return location.state;
    const saved = sessionStorage.getItem('pendingBooking');
    return saved ? JSON.parse(saved) : null;
  });

  const salon = bookingContext?.salon;
  const selectedServices = bookingContext?.selectedServices || [];
  const serviceStaff = bookingContext?.serviceStaff || {};
  const date = bookingContext?.date || '';
  const time = bookingContext?.time || '';
  const packageId = bookingContext?.packageId || null;
  const packageDoc = bookingContext?.packageDoc || null;

  const [couponCode, setCouponCode] = useState(bookingContext?.couponCode || '');
  const [couponError, setCouponError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false); // prevents double-click race condition
  const [success, setSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('ONLINE');
  const [paymentError, setPaymentError] = useState('');
  const [toast, setToast] = useState(null); // { message, type: 'info'|'error' }

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Preview State (Source of Truth for Frontend)
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [useWallet, setUseWallet] = useState(false);

  useEffect(() => {
    if (salon && date && time && selectedServices.length > 0) {
      loadPreview('', false);
    }
  }, []);

  const loadPreview = async (appliedCouponCode = '', walletActive = useWallet) => {
    // If user not logged in, don't make the API call (would get 401)
    if (!user) {
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    setPaymentError('');
    try {
      const payload = {
        salon: salonId,
        services: selectedServices.map(s => ({
          service: s._id,
          staff: serviceStaff[s._id] || null
        })),
        couponCode: appliedCouponCode || couponCode,
        ...(packageId && { packageId }),
        useWallet: walletActive,
      };
      const res = await previewBookingTotal(payload);
      setPreviewData(res.data.data);
    } catch (e) {
      console.error('Failed to load preview', e);
      setPaymentError(e.response?.data?.message || 'Failed to calculate booking total');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Persist current state to sessionStorage so it survives refresh
  useEffect(() => {
    if (salon && date && time && selectedServices.length > 0) {
      sessionStorage.setItem('pendingBooking', JSON.stringify({
        salon, selectedServices, date, time, serviceStaff, couponCode, packageId, packageDoc
      }));
    }
  }, [salon, selectedServices, date, time, serviceStaff, couponCode, packageId, packageDoc]);

  if (!salon || !date || !time || selectedServices.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <h2 className="text-[20px] font-headline-sm text-on-surface mb-2">Incomplete Booking Details</h2>
        <button onClick={() => navigate(`/salon/${salonId}`)} className="text-primary hover:underline">Return to Salon</button>
      </div>
    );
  }

  const handleValidateCoupon = async () => {
    if (!couponCode) return;
    setCouponError('');
    try {
      await loadPreview(couponCode);
      if (previewData && !previewData.coupon) {
        // If preview returns successfully but doesn't apply coupon (maybe logic failed locally but api passed)
        // Usually preview error will be caught in loadPreview
      }
    } catch (e) {
      setCouponError(e.response?.data?.message || 'Invalid coupon');
    }
  };


  const handleSubmit = async () => {
    // Guard: prevent double submission from rapid clicks
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPaymentError('');

    if (!user) {
      submittingRef.current = false;
      showToast('Please login to confirm your booking', 'info');
      setTimeout(() => navigate('/login', { state: { from: location.pathname } }), 1200);
      return;
    }

    setSubmitting(true);
    try {
      const bookingData = {
        salon: salonId,
        services: selectedServices.map(s => ({
          service: s._id,
          staff: serviceStaff[s._id] || null
        })),
        bookingDate: date,
        startTime: time,
        // Always send normalized ONLINE or CASH
        paymentMethod: paymentMethod === 'ONLINE' ? 'ONLINE' : 'CASH',
        ...(previewData?.coupon && { couponCode: previewData.coupon.code }),
        ...(packageId && { packageId }),
        useWallet,
      };

      const res = await createBooking(bookingData);
      const booking = res.data.data.booking;

      if (paymentMethod === 'CASH') {
        sessionStorage.removeItem('pendingBooking');
        setSuccess(true);
        setTimeout(() => {
          navigate('/', { replace: true });
          setTimeout(() => navigate(`/booking/${booking._id}`, { state: { fromCheckout: true } }), 10);
        }, 1500);
      } else if (paymentMethod === 'ONLINE') {
        // Create Razorpay Order
        const orderRes = await createPaymentOrder({ bookingId: booking._id });
        const { order, key_id } = orderRes.data.data;

        // Initialize Razorpay Checkout
        const options = {
          key: key_id,
          amount: order.amount,
          currency: order.currency,
          name: "SalonBook",
          description: `Payment for Salon Booking`,
          order_id: order.id,
          handler: async function (response) {
            try {
              setSubmitting(true);
              const verifyRes = await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bookingId: booking._id
              });
              if (verifyRes.data.success) {
                sessionStorage.removeItem('pendingBooking');
                setSuccess(true);
                setTimeout(() => {
                  navigate('/', { replace: true });
                  setTimeout(() => navigate(`/booking/${booking._id}`, { state: { fromCheckout: true } }), 10);
                }, 1500);
              }
            } catch (err) {
              setPaymentError(err.response?.data?.message || 'Payment verification failed. Please check your booking status.');
              setSubmitting(false);
              submittingRef.current = false;
            }
          },
          prefill: {
            name: user.name,
            email: user.email,
            contact: user.phone
          },
          theme: { color: "#6D3EA8" },
          modal: {
            ondismiss: function () {
              // User closed popup — do NOT mark as failed
              setPaymentError('Payment was not completed. You can retry from your Booking Details page.');
              setSubmitting(false);
              submittingRef.current = false;
            }
          }
        };
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
          setPaymentError(response.error?.description || 'Payment failed. Please try again.');
          setSubmitting(false);
          submittingRef.current = false;
        });
        rzp.open();
        // Don't reset submitting here — modal handles it
        return;
      }
    } catch (e) {
      setPaymentError(e.response?.data?.message || 'Booking failed. Please try again.');
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 animate-fade-in">
        <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-[40px]">check_circle</span>
        </div>
        <h2 className="text-[24px] font-headline-md text-on-surface mb-2">Booking Confirmed!</h2>
        <p className="text-muted-text font-body-md text-center max-w-sm">
          Your appointment at {salon.name} has been successfully scheduled.
        </p>
      </div>
    );
  }

  const d = new Date(date);
  const dateString = d.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="bg-background text-on-surface font-body-md antialiased min-h-screen flex flex-col pb-[120px]">
      {/* Local Checkout Header */}
      <header className="relative w-full bg-surface shadow-sm flex justify-between items-center px-4 md:px-margin-desktop h-16 rounded-2xl mt-4 mb-2 max-w-md mx-auto">
        <button onClick={() => goBack(navigate, `/salon/${salonId}/book`)} className="text-on-surface-variant hover:bg-soft-primary p-2 rounded-full transition-colors active:scale-95 duration-150 flex items-center justify-center -ml-2">
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <h1 className="font-headline-sm text-[20px] text-primary text-center absolute left-1/2 -translate-x-1/2">Checkout</h1>
        <div className="w-10"></div>
      </header>

      {/* Main Content */}
      <main className="flex-grow pt-6 px-4 md:px-margin-desktop w-full max-w-md mx-auto flex flex-col gap-6">
        {/* Salon Summary Card */}
        <section className="bg-surface rounded-[18px] border border-border shadow-sm p-4 flex gap-4 items-center">
          <div className="w-16 h-16 rounded-lg bg-surface-variant flex-shrink-0 overflow-hidden relative">
            <img
              alt={salon.name}
              className="object-cover w-full h-full"
              src={salon.images?.[0] ? getImageUrl(salon.images[0]) : "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80"}
            />
          </div>
          <div className="flex flex-col">
            <h2 className="font-headline-sm text-[18px] text-on-surface mb-1">{salon.name}</h2>
            <div className="flex items-center gap-1 text-muted-text mb-1">
              <span className="material-symbols-outlined text-[16px]">location_on</span>
              <span className="font-body-sm text-[14px]">{salon.address}</span>
            </div>
          </div>
        </section>

        {/* Appointment Summary */}
        <section className="bg-surface rounded-[18px] border border-border shadow-sm p-5 flex flex-col gap-4">
          <h3 className="font-label-md text-[14px] text-muted-text uppercase tracking-wider">Appointment Summary</h3>

          <div className="flex gap-4 mb-2">
            <div className="bg-soft-primary p-3 rounded-lg flex flex-col items-center justify-center min-w-[70px]">
              <span className="font-label-sm text-[12px] text-primary uppercase">{d.toLocaleDateString('en', { month: 'short' })}</span>
              <span className="font-headline-md text-[24px] text-primary">{d.getDate()}</span>
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-headline-sm text-[18px] text-on-surface">{d.toLocaleDateString('en', { weekday: 'long' })}</span>
              <span className="font-body-md text-[16px] text-muted-text">{time}</span>
            </div>
          </div>

          <div className="h-[1px] w-full bg-border"></div>

          <div className="flex flex-col gap-3 pt-2">
            {selectedServices.map(s => (
              <div key={s._id} className="flex justify-between items-start">
                <div className="flex flex-col pr-4">
                  <span className="font-body-md text-[16px] font-medium text-on-surface">{s.name}</span>
                  <span className="font-body-sm text-[14px] text-muted-text">{s.duration} min</span>
                </div>
                <span className="font-label-md text-[14px] text-on-surface">{formatPaise(s.pricePaise, s.price)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Coupon Section */}
        <section className="flex gap-3">
          <div className="relative flex-grow">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-text">sell</span>
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="w-full bg-surface-variant font-body-md text-[16px] text-on-surface py-3 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary uppercase"
            />
          </div>
          <button
            onClick={handleValidateCoupon}
            disabled={previewLoading || !couponCode}
            className="bg-surface-variant text-primary font-label-md text-[14px] px-6 py-3 rounded-lg hover:bg-soft-primary active:scale-95 transition-all disabled:opacity-50"
          >
            Apply
          </button>
        </section>
        {paymentError && (
          <div className="text-error text-sm px-3 py-2 bg-error/5 border border-error/20 rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {paymentError}
          </div>
        )}
        {couponError && (
          <div className="text-error text-sm px-3 py-2 bg-error/5 border border-error/20 rounded-lg flex items-center gap-2 -mt-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {couponError}
          </div>
        )}
        {previewData?.coupon && (
          <p className="text-success text-sm px-1 -mt-4 font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-success">check_circle</span>
            Saved {formatPaise(previewData.couponDiscountPaise)}
          </p>
        )}

        {/* Price Breakdown */}
        <section className="bg-surface rounded-[18px] border border-border shadow-sm p-5 flex flex-col gap-3">
          {previewLoading ? (
            <div className="text-center py-4 text-muted-text text-sm">Calculating total...</div>
          ) : previewData && (
            <>
              <div className="flex justify-between items-center">
                <span className="font-body-md text-[16px] text-muted-text">Original Total</span>
                <span className="font-body-md text-[16px] text-on-surface">{formatPaise(previewData.totalAmountPaise)}</span>
              </div>
              {previewData.package && (
                <div className="flex justify-between items-center text-success">
                  <span className="font-body-md text-[16px]">{previewData.package.name} Discount</span>
                  <span className="font-body-md text-[16px]">-{formatPaise(previewData.packageDiscountPaise)}</span>
                </div>
              )}
              {previewData.coupon && (
                <div className="flex justify-between items-center text-success">
                  <span className="font-body-md text-[16px]">Coupon Discount</span>
                  <span className="font-body-md text-[16px]">-{formatPaise(previewData.couponDiscountPaise)}</span>
                </div>
              )}
              {previewData.platformFeeAmountPaise > 0 && (
                <div className="flex justify-between items-center">
                  <span className="font-body-md text-[16px] text-muted-text">Platform Fee</span>
                  <span className="font-body-md text-[16px] text-on-surface">{formatPaise(previewData.platformFeeAmountPaise)}</span>
                </div>
              )}
              {previewData.wallet?.appliedPaise > 0 && (
                <div className="flex justify-between items-center text-primary font-medium">
                  <span className="font-body-md text-[16px] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                    Glentro Wallet Applied
                  </span>
                  <span className="font-body-md text-[16px]">-{formatPaise(previewData.wallet.appliedPaise)}</span>
                </div>
              )}
              <div className="h-[1px] w-full bg-border my-2"></div>
              <div className="flex justify-between items-center">
                <span className="font-headline-sm text-[20px] text-on-surface">Total</span>
                <span className="font-headline-sm text-[20px] text-primary">{formatPaise(previewData.finalAmountPaise)}</span>
              </div>
            </>
          )}
        </section>

        {/* Glentro Wallet Card */}
        {previewData?.wallet?.canApply && (
          <section className="bg-surface rounded-[18px] border border-border shadow-sm p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
              </div>
              <div>
                <span className="font-body-md font-semibold text-on-surface block">Glentro Wallet Balance</span>
                <span className="text-xs text-muted-text">
                  Available: ₹{previewData.wallet.availableBalance.toFixed(2)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !useWallet;
                setUseWallet(next);
                loadPreview(couponCode, next);
              }}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                useWallet ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                useWallet ? 'left-7' : 'left-1'
              }`} />
            </button>
          </section>
        )}

        {/* Payment Method */}
        <section className="bg-surface rounded-[18px] border border-border shadow-sm p-5 flex flex-col gap-4">
          <h3 className="font-label-md text-[14px] text-muted-text uppercase tracking-wider">Payment Method</h3>
          <div className="flex flex-col gap-3">
            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${paymentMethod === 'ONLINE' ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-variant'}`}>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${paymentMethod === 'ONLINE' ? 'border-primary' : 'border-on-surface-variant'}`}>
                {paymentMethod === 'ONLINE' && <div className="w-3 h-3 rounded-full bg-primary"></div>}
              </div>
              <input type="radio" name="payment" value="ONLINE" checked={paymentMethod === 'ONLINE'} onChange={() => setPaymentMethod('ONLINE')} className="hidden" />
              <div className="flex flex-col flex-1">
                <span className="font-body-md text-on-surface font-medium">Pay Online (Razorpay)</span>
                <span className="font-body-sm text-muted-text text-[12px]">Credit/Debit Cards, UPI, NetBanking</span>
                {previewData?.onlineCashback?.enabled && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold w-fit">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">savings</span>
                    <span>
                      Get {previewData.onlineCashback.type === 'FIXED' ? `₹${previewData.onlineCashback.amount}` : `${previewData.onlineCashback.percentage}%`} Cashback in your Glentro Wallet!
                    </span>
                  </div>
                )}
              </div>
            </label>
            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${paymentMethod === 'CASH' ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-variant'}`}>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${paymentMethod === 'CASH' ? 'border-primary' : 'border-on-surface-variant'}`}>
                {paymentMethod === 'CASH' && <div className="w-3 h-3 rounded-full bg-primary"></div>}
              </div>
              <input type="radio" name="payment" value="CASH" checked={paymentMethod === 'CASH'} onChange={() => setPaymentMethod('CASH')} className="hidden" />
              <div className="flex flex-col">
                <span className="font-body-md text-on-surface font-medium">Pay at Salon (Cash)</span>
                <span className="font-body-sm text-muted-text text-[12px]">Pay by cash or card after service</span>
              </div>
            </label>
          </div>
        </section>

        {/* Policy Note */}
        <section className="flex items-start gap-2 bg-inverse-on-surface p-4 rounded-lg">
          <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">info</span>
          <p className="font-body-sm text-[14px] text-on-surface-variant">
            {paymentMethod === 'CASH'
              ? "Pay at the salon after your service is completed. You can cancel anytime."
              : "Securely pay online now. Cancellation and refund policies apply."}
          </p>
        </section>
      </main>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-0 left-0 w-full bg-surface shadow-[0px_-10px_20px_rgba(109,62,168,0.08)] px-4 pt-4 pb-[calc(1rem+53px+env(safe-area-inset-bottom))] md:pb-[calc(1rem+env(safe-area-inset-bottom))] z-40 border-t border-border/50">
        <div className="w-full max-w-md mx-auto">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-primary text-white font-label-md text-[16px] py-4 rounded-xl shadow-sm hover:bg-primary-dark active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {submitting ? 'Confirming...' : user ? `Confirm Booking${previewData ? ` - ${formatPaise(previewData.finalAmountPaise)}` : ''}` : 'Login to Book'}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-white text-sm font-medium transition-all animate-fade-in ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-[#6D3EA8]'
        }`}>
          <span className="material-symbols-outlined text-[20px]">
            {toast.type === 'error' ? 'error' : 'lock'}
          </span>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default CheckoutPage;
