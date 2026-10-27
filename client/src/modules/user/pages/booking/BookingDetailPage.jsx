import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getBookingById, cancelBooking, verifyBookingCompletion } from '../../services/userApi';
import { submitStaffReview } from '../../services/staffReviewApi';
import { goBack } from '../../../../utils/navigation';
import Button from '../../../../components/common/Button';
import Loader from '../../../../components/common/Loader';
import { Skeleton, SkeletonText } from '../../../../components/common/Skeleton';
import Modal from '../../../../components/common/Modal';
import PageHeader from '../../../../components/common/PageHeader';
import { formatPaise } from '../../../../utils/money';
import { useCall } from '../../../../context/CallContext';
import { useSocket } from '../../../../context/SocketContext';
import { checkCallAvailability } from '../../../../services/callService';
import toast from 'react-hot-toast';
import { getImageUrl } from '../../../../utils/imageUtils';

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
  REJECTED: 'bg-gray-100 text-gray-800 border-gray-200',
};

const paymentStatusConfig = {
  PENDING: { label: 'Pending', cls: 'bg-yellow-100 text-yellow-700' },
  PAID: { label: 'Paid', cls: 'bg-green-100 text-green-700' },
  REFUND_PENDING: { label: 'Refund Pending', cls: 'bg-orange-100 text-orange-700' },
  PARTIALLY_REFUNDED: { label: 'Partially Refunded', cls: 'bg-blue-100 text-blue-700' },
  REFUNDED: { label: 'Refunded', cls: 'bg-blue-100 text-blue-700' },
  FAILED: { label: 'Failed', cls: 'bg-red-100 text-red-700' },
};

const BookingDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromCheckout = location.state?.fromCheckout;

  const handleBack = () => {
    if (fromCheckout) {
      navigate('/', { replace: true });
    } else {
      goBack(navigate, '/bookings');
    }
  };
  const [booking, setBooking] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  
  // Reviews State
  const [review, setReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [callAvailability, setCallAvailability] = useState({ canCall: false });

  // Staff Reviews State
  const [staffReviews, setStaffReviews] = useState([]); // already-submitted staff reviews
  const [staffRatingForms, setStaffRatingForms] = useState({}); // { [bookingServiceId]: { rating, review, submitting, submitted } }

  // Calling feature
  const {
    startCall, clearError, callError
  } = useCall();

  // Socket for real-time completion & status updates
  const { socket } = useSocket();

  // OTP Completion State
  const [completionOtpCode, setCompletionOtpCode] = useState('');
  const [userOtpInput, setUserOtpInput] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  useEffect(() => { loadBooking(); }, [id]);

  // Real-time socket listener for OTP request and completion
  useEffect(() => {
    if (!socket) return;
    const handleCompletionRequested = (data) => {
      if (data.bookingId === id) {
        setCompletionOtpCode(data.otp);
        loadBooking();
        toast.success(`Service completed! Your code is ${data.otp}`, { duration: 6000 });
      }
    };
    const handleBookingUpdate = (data) => {
      const updatedId = data.booking?._id || data.bookingId;
      if (updatedId === id) {
        if (data.eventType === 'COMPLETION_REQUESTED' && data.otp) {
          setCompletionOtpCode(data.otp);
        }
        loadBooking();
      }
    };

    socket.on('booking:completion-requested', handleCompletionRequested);
    socket.on('booking:update', handleBookingUpdate);

    return () => {
      socket.off('booking:completion-requested', handleCompletionRequested);
      socket.off('booking:update', handleBookingUpdate);
    };
  }, [socket, id]);

  // Poll call availability every 60 seconds for CONFIRMED bookings
  useEffect(() => {
    if (booking?.status !== 'CONFIRMED') return;
    const check = async () => {
      const avail = await checkCallAvailability(booking._id);
      setCallAvailability(avail);
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [booking?._id, booking?.status]);

  const loadBooking = async () => {
    try {
      const res = await getBookingById(id);
      const bData = res.data.data.booking;
      setBooking(bData);
      if (bData?.completionOtp) {
        setCompletionOtpCode(bData.completionOtp);
      }
      setServices(res.data.data.services);
      setReview(res.data.data.review);
      // Staff reviews returned from updated getBookingById
      const existingStaffReviews = res.data.data.staffReviews || [];
      setStaffReviews(existingStaffReviews);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleConfirmCompletion = async () => {
    const codeToSubmit = (userOtpInput || completionOtpCode || '').trim();
    if (!codeToSubmit) {
      toast.error('Please enter the 4-digit completion code');
      return;
    }
    setIsVerifyingOtp(true);
    try {
      await verifyBookingCompletion(id, codeToSubmit);
      toast.success('🎉 Service completed successfully! Please rate your experience.');
      setCompletionOtpCode('');
      setUserOtpInput('');
      loadBooking();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Invalid confirmation code');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelBooking(id, { reason: cancelReason });
      toast.success('Booking cancelled successfully');
      setCancelModal(false);
      loadBooking();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Cancellation failed');
    } finally {
      setCancelling(false);
    }
  };

  const handlePayment = async () => {
    try {
      // 1. Create order
      const orderRes = await import('../../services/userApi').then(m => m.createPaymentOrder({ bookingId: id }));
      const { order, key_id } = orderRes.data.data;

      // 2. Initialize Razorpay
      const options = {
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'SalonBook',
        description: 'Booking Payment',
        order_id: order.id,
        handler: async function (response) {
          try {
            // 3. Verify payment
            await import('../../services/userApi').then(m => m.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingId: id
            }));
            alert('Payment successful!');
            loadBooking();
          } catch (e) {
            alert('Payment verification failed');
          }
        },
        prefill: {
          name: booking.user?.name,
          email: booking.user?.email,
          contact: booking.user?.phone
        },
        theme: {
          color: '#14b8a6' // primary-500
        }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.open();
    } catch (e) {
      alert(e.response?.data?.message || 'Payment initiation failed');
    }
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in w-full px-4 pt-4 pb-[100px]">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <SkeletonText lines={1} className="w-32" lineClassName="h-6" />
      </div>
      <Skeleton className="w-full h-32 rounded-2xl" />
      <Skeleton className="w-full h-24 rounded-2xl" />
      <Skeleton className="w-full h-24 rounded-2xl" />
      <Skeleton className="w-full h-40 rounded-2xl" />
      <Skeleton className="w-full h-48 rounded-2xl" />
      <div className="flex gap-3">
        <Skeleton className="flex-1 h-12 rounded-xl" />
        <Skeleton className="flex-1 h-12 rounded-xl" />
      </div>
    </div>
  );
  if (!booking) return <div className="text-center py-20"><h2>Booking not found</h2></div>;

  const canCancel = ['PENDING', 'CONFIRMED'].includes(booking.status);

  const handleChat = async () => {
    try {
      if (!booking?.salon?.vendor) {
        alert('Vendor information not found for this salon');
        return;
      }
      const { initiateChat } = await import('../../services/userApi');
      const res = await initiateChat({
        recipientId: booking.salon.vendor,
        recipientRole: 'vendor',
        chatType: 'user-vendor',
        salonId: booking.salon._id,
        bookingId: booking._id
      });
      if (res.data.success && res.data.data._id) {
        navigate(`/chat/${res.data.data._id}`);
      }
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to initiate chat');
    }
  };

  const handleNativeCall = () => {
    if (!booking?.salon?.phone) {
      alert('Phone number is unavailable for this salon.');
      return;
    }
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      alert('Calling is available from a mobile device. Phone Number: ' + booking.salon.phone);
      return;
    }
    window.location.href = `tel:${booking.salon.phone}`;
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (reviewForm.rating < 1 || reviewForm.rating > 5) {
      alert('Please select a star rating between 1 and 5');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const { submitReview } = await import('../../services/userApi');
      const res = await submitReview({
        salonId: booking.salon._id,
        bookingId: booking._id,
        rating: reviewForm.rating,
        comment: reviewForm.comment
      });
      alert('Review submitted successfully!');
      setReview(res.data.data.review);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in w-full pb-14 sm:pb-8">
      <PageHeader title="Booking Details" fallbackPath="/bookings" onBack={handleBack} />
      <button onClick={handleBack} className="hidden md:flex items-center gap-2 text-text-secondary hover:text-primary-600 text-sm">
        ← {fromCheckout ? 'Back to Home' : 'Back to bookings'}
      </button>

      {/* Status Header */}
      <div className={`rounded-2xl p-6 border-2 ${statusColors[booking.status]} text-center`}>
        <p className="text-sm font-medium mb-1">Booking Status</p>
        <h2 className="text-2xl font-bold">{booking.status}</h2>
        <p className="text-xs mt-1 opacity-80">#{booking._id.slice(-8).toUpperCase()}</p>
      </div>

      {/* In-App Service Completion Confirmation Card */}
      {booking.status === 'CONFIRMED' && (booking.completionOtp || completionOtpCode) && (
        <div className="bg-gradient-to-br from-primary-900 to-primary-950 text-white rounded-2xl p-5 shadow-lg border border-primary-700/50 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400 text-[24px]">verified</span>
              <h3 className="font-bold text-base text-white">Service Completion Code</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30 animate-pulse">
              Action Required
            </span>
          </div>

          <p className="text-xs text-primary-200">
            The salon has completed your appointment! Enter the 4-digit completion code below (or share it with the stylist) to confirm and complete your service.
          </p>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col items-center justify-center border border-white/10">
            <span className="text-xs uppercase tracking-widest text-primary-300 font-semibold mb-1">Your 4-Digit PIN</span>
            <div className="text-3xl font-extrabold tracking-[0.3em] font-mono text-amber-300 py-1">
              {booking.completionOtp || completionOtpCode}
            </div>
            <span className="text-[11px] text-primary-300 mt-1">Valid for 15 minutes</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              maxLength={4}
              value={userOtpInput}
              onChange={(e) => setUserOtpInput(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 4-digit code"
              className="flex-1 px-4 py-3 bg-white text-gray-900 rounded-xl text-center font-mono text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-gray-400 placeholder:text-sm placeholder:font-sans placeholder:tracking-normal"
            />
            <button
              type="button"
              onClick={() => {
                const code = booking.completionOtp || completionOtpCode;
                if (code) {
                  setUserOtpInput(code);
                }
              }}
              className="px-3 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white rounded-xl border border-white/20 transition-all"
            >
              Auto-Fill
            </button>
          </div>

          <Button
            onClick={handleConfirmCompletion}
            loading={isVerifyingOtp}
            disabled={isVerifyingOtp}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-gray-950 font-bold py-3.5 shadow-md"
          >
            Confirm & Complete Service
          </Button>
        </div>
      )}

      {/* Salon Info */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <h3 className="font-semibold">{booking.salon?.name}</h3>
        <p className="text-sm text-text-secondary mt-1 flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">location_on</span> {booking.salon?.address}
        </p>
        <p className="text-sm text-text-secondary flex items-center gap-1 mt-0.5">
          <span className="material-symbols-outlined text-[16px]">call</span> {booking.salon?.phone}
        </p>
      </div>

      {/* Date & Time */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-muted mb-1">Date</p>
            <p className="font-semibold">{new Date(booking.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-1">Time</p>
            <p className="font-semibold">{booking.startTime} - {booking.endTime}</p>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <h3 className="font-semibold mb-3">Services</h3>
        {services.map(bs => (
          <div key={bs._id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
            <div>
              <p className="text-sm font-medium">{bs.service?.name}</p>
              <p className="text-xs text-text-muted">
                {bs.staff?.name && (
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">person</span> {bs.staff.name} • 
                  </span>
                )}
                {bs.startTime}-{bs.endTime} • {bs.duration} min
              </p>
            </div>
            <span className="font-medium text-sm">{formatPaise(bs.pricePaise, bs.price)}</span>
          </div>
        ))}
      </div>

      {/* Payment */}
      <div className="bg-primary-50 rounded-2xl p-5 border border-primary-100">
        <div className="flex justify-between items-center mb-3">
          <div className="flex flex-col">
            <h3 className="font-semibold">Payment Summary</h3>
            <span className="text-xs text-text-muted mt-0.5">
              Method: {booking.paymentMethod === 'ONLINE' ? 'Online (Razorpay)' : 'Cash / Pay at Salon'}
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
            (paymentStatusConfig[booking.paymentStatus] || paymentStatusConfig.PENDING).cls
          }`}>
            {(paymentStatusConfig[booking.paymentStatus] || paymentStatusConfig.PENDING).label}
          </span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Total Service Amount</span>
            <span>{formatPaise((booking.pricing?.totalServiceAmountPaise || ((booking.totalAmountPaise || 0) + (booking.platformFeePaise || 0))), (booking.totalAmount || 0) + (booking.platformFee || 0))}</span>
          </div>
          {booking.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatPaise(booking.discountAmountPaise, booking.discountAmount)}</span></div>}
          {(booking.pricing?.gstAmountPaise > 0 || booking.pricing?.gstAmount > 0) && (
            <div className="flex justify-between text-text-secondary">
              <span>Service GST</span>
              <span>{formatPaise(booking.pricing.gstAmountPaise, booking.pricing.gstAmount)}</span>
            </div>
          )}
          {(booking.walletAmountApplied > 0 || booking.pricing?.walletAmountApplied > 0) && (
            <div className="flex justify-between text-primary font-medium">
              <span>Glentro Wallet Applied</span>
              <span>-{formatPaise(booking.walletAmountAppliedPaise || booking.pricing?.walletAmountAppliedPaise, booking.walletAmountApplied)}</span>
            </div>
          )}
          {booking.cancellationFee > 0 && <div className="flex justify-between text-red-600"><span>Cancellation Fee</span><span>{formatPaise(booking.cancellationFeePaise, booking.cancellationFee)}</span></div>}
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-primary-200"><span>Total</span><span className="text-primary-700">{formatPaise(booking.finalAmountPaise, booking.finalAmount)}</span></div>
          {booking.cashbackEarned > 0 && (
            <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex justify-between items-center text-emerald-800 font-medium">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">savings</span>
                <span>Online Cashback Earned</span>
              </div>
              <span className="font-bold text-emerald-700">+{formatPaise(booking.cashbackEarnedPaise, booking.cashbackEarned)}</span>
            </div>
          )}
        </div>
        {/* Show refund details if applicable */}
        {['REFUND_PENDING', 'REFUNDED'].includes(booking.paymentStatus) && (
          <div className="mt-3 pt-3 border-t border-primary-200">
            <p className="text-xs font-semibold text-blue-700">
              {booking.paymentStatus === 'REFUNDED'
                ? (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-green-600">check_circle</span>
                      Refund of {formatPaise(booking.finalAmountPaise - (booking.cancellationFeePaise || 0), booking.finalAmount - (booking.cancellationFee || 0))} has been processed to your original payment method.
                    </span>
                  )
                : `⏳ Refund of ${formatPaise(booking.finalAmountPaise - (booking.cancellationFeePaise || 0), booking.finalAmount - (booking.cancellationFee || 0))} is being processed (typically 5–7 business days).`}
            </p>
          </div>
        )}
      </div>

      {/* Rate Your Stylists (separate from salon review) */}
      {booking.status === 'COMPLETED' && (() => {
        // Only show for services where a staff member was actually assigned
        const reviewableServices = services.filter(bs => bs.staff && bs.staff._id);
        if (reviewableServices.length === 0) return null;

        return (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h3 className="font-semibold mb-1">Rate Your Stylists</h3>
            <p className="text-xs text-text-muted mb-4">How was each stylist who served you?</p>
            <div className="flex flex-col gap-5">
              {reviewableServices.map((bs) => {
                const existingReview = staffReviews.find(
                  (sr) => sr.bookingService?.toString() === bs._id?.toString() ||
                           sr.bookingService === bs._id
                );

                const formState = staffRatingForms[bs._id] || { rating: 0, review: '', submitting: false, submitted: false };
                const isSubmitted = existingReview || formState.submitted;

                return (
                  <div key={bs._id} className="flex flex-col gap-3 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                    {/* Staff info */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-primary-50 flex items-center justify-center shrink-0">
                        {bs.staff?.avatar ? (
                          <img src={getImageUrl(bs.staff.avatar)} alt={bs.staff.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-[18px] text-primary-400">person</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{bs.staff?.name}</p>
                        <p className="text-xs text-text-muted">{bs.service?.name}</p>
                      </div>
                    </div>

                    {/* Already reviewed */}
                    {isSubmitted ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center text-yellow-400">
                          {[1,2,3,4,5].map(star => (
                            <span key={star} className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: star <= (existingReview?.rating || formState.rating) ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                          ))}
                        </div>
                        <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Rated
                        </span>
                      </div>
                    ) : (
                      /* Rating form */
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(star => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setStaffRatingForms(prev => ({
                                ...prev,
                                [bs._id]: { ...formState, rating: star }
                              }))}
                              className={`material-symbols-outlined text-2xl transition-colors ${
                                star <= formState.rating ? 'text-yellow-400' : 'text-gray-300'
                              }`}
                              style={{ fontVariationSettings: star <= formState.rating ? "'FILL' 1" : "'FILL' 0" }}
                            >
                              star
                            </button>
                          ))}
                        </div>
                        <textarea
                          placeholder="Share your experience with this stylist (optional)"
                          value={formState.review}
                          onChange={e => setStaffRatingForms(prev => ({
                            ...prev,
                            [bs._id]: { ...formState, review: e.target.value }
                          }))}
                          className="w-full bg-gray-50 border border-gray-200 focus:border-primary-400 focus:ring-1 focus:ring-primary-400 rounded-xl p-3 text-sm resize-none h-16"
                        />
                        <Button
                          type="button"
                          disabled={formState.rating === 0 || formState.submitting}
                          loading={formState.submitting}
                          onClick={async () => {
                            if (formState.rating < 1 || formState.rating > 5) {
                              toast.error('Please select a star rating');
                              return;
                            }
                            setStaffRatingForms(prev => ({
                              ...prev,
                              [bs._id]: { ...formState, submitting: true }
                            }));
                            try {
                              await submitStaffReview(booking._id, {
                                bookingServiceId: bs._id,
                                staffId: bs.staff._id,
                                rating: formState.rating,
                                review: formState.review,
                              });
                              toast.success(`Rated ${bs.staff.name}!`);
                              setStaffRatingForms(prev => ({
                                ...prev,
                                [bs._id]: { ...formState, submitting: false, submitted: true }
                              }));
                            } catch (err) {
                              const msg = err.response?.data?.message || 'Failed to submit rating';
                              toast.error(msg);
                              setStaffRatingForms(prev => ({
                                ...prev,
                                [bs._id]: { ...formState, submitting: false }
                              }));
                            }
                          }}
                          className="text-sm px-4 py-2"
                        >
                          Submit Rating
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Review Section (Salon Review) */}
      {booking.status === 'COMPLETED' && (
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-semibold mb-3">Rate Your Experience</h3>
          {review ? (
            <div className="space-y-2">
              <div className="flex items-center text-yellow-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="material-symbols-outlined text-xl" style={{fontVariationSettings: star <= review.rating ? "'FILL' 1" : "'FILL' 0"}}>star</span>
                ))}
              </div>
              {review.comment && <p className="text-sm text-text-secondary">"{review.comment}"</p>}
              <div className="text-xs font-medium text-green-600 flex items-center gap-1 mt-2">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Review Submitted
              </div>
            </div>
          ) : (
            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <p className="text-sm text-text-secondary">How was your overall experience at {booking.salon?.name}?</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                    className={`material-symbols-outlined text-3xl transition-colors ${star <= reviewForm.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                    style={{fontVariationSettings: star <= reviewForm.rating ? "'FILL' 1" : "'FILL' 0"}}
                  >
                    star
                  </button>
                ))}
              </div>
              <textarea 
                placeholder="Share details of your experience (optional)"
                value={reviewForm.comment}
                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 focus:border-primary-400 focus:ring-1 focus:ring-primary-400 rounded-xl p-3 text-sm resize-none h-24"
              />
              <Button type="submit" loading={isSubmittingReview} disabled={reviewForm.rating === 0} className="w-full">
                Submit Review
              </Button>
            </form>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {booking.paymentStatus !== 'PAID' && canCancel && booking.paymentMethod === 'ONLINE' && (
          <Button onClick={handlePayment} className="flex-1 bg-gradient-to-r from-primary-600 to-primary-500 text-white">Pay {formatPaise(booking.finalAmountPaise, booking.finalAmount)}</Button>
        )}
        {canCancel && <Button variant="danger" onClick={() => setCancelModal(true)} className="flex-1">Cancel Booking</Button>}
        {booking.status === 'CONFIRMED' && (
          <Button variant="secondary" onClick={handleChat} className="flex-1">Chat</Button>
        )}
        {booking.status === 'CONFIRMED' && callAvailability.canCall && (
          <Button
            variant="primary"
            onClick={handleNativeCall}
            className="flex-1 flex items-center gap-1.5 justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">call</span>
            Call
          </Button>
        )}
      </div>

      {/* Call not available info */}
      {booking.status === 'CONFIRMED' && !callAvailability.canCall && callAvailability.reason && callAvailability.reason !== 'APPOINTMENT_PASSED' && (
        <p className="text-xs text-center text-text-muted mt-1 flex items-center justify-center gap-1">
          {callAvailability.reason === 'CALL_DISABLED_BY_ADMIN'
            ? (
                <>
                  <span className="material-symbols-outlined text-[14px] text-red-500">phonelink_erase</span>
                  Calling is currently disabled.
                </>
              )
            : null}
        </p>
      )}

      {/* Call Error Toast */}
      {callError && (
        <div className="fixed bottom-24 left-4 right-4 z-50 bg-red-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center justify-between">
          <span>{callError}</span>
          <button onClick={clearError} className="ml-3 font-bold">✕</button>
        </div>
      )}

      {/* Cancel Modal */}
      <Modal isOpen={cancelModal} onClose={() => setCancelModal(false)} title="Cancel Booking">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">Are you sure you want to cancel this booking? A cancellation fee may apply if less than 60 minutes before the appointment.</p>
          <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation (optional)"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400 resize-none" rows={3} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setCancelModal(false)} className="flex-1">Keep Booking</Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelling} className="flex-1">Confirm Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BookingDetailPage;
