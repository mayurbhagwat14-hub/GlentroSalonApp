import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBookingById, acceptBooking, rejectBooking, completeBooking, requestCompletionOtp } from '../services/vendorApi';
import { goBack } from '../../../utils/navigation';
import api from '../../../services/api/axiosInstance';
import { useCall } from '../../../context/CallContext';
import { useSocket } from '../../../context/SocketContext';
import { checkCallAvailability } from '../../../services/callService';
import { toast } from 'react-hot-toast';
import { useConfirm } from '../../../context/ConfirmContext';

const BookingDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);
  const [callAvailability, setCallAvailability] = useState({ canCall: false });
  const { startCall, callError, clearError } = useCall();
  const { confirm } = useConfirm();
  const { socket } = useSocket();

  // OTP completion flow state
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  useEffect(() => {
    if (booking?.status === 'CONFIRMED') {
      checkCallAvailability(booking._id).then(avail => setCallAvailability(avail)).catch(() => {});
    }
  }, [booking]);

  useEffect(() => { load(); }, [id]);

  // Realtime Socket listener for booking completion by customer
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (data) => {
      const updatedId = data.booking?._id || data.bookingId;
      if (updatedId === id) {
        if (data.eventType === 'COMPLETED' || data.booking?.status === 'COMPLETED') {
          toast.success('🎉 Customer has confirmed and completed the booking!');
          setOtpSent(false);
        }
        load();
      }
    };
    socket.on('booking:update', handleUpdate);
    return () => {
      socket.off('booking:update', handleUpdate);
    };
  }, [socket, id]);

  const load = async () => { 
    try { 
      const r = await getBookingById(id); 
      setBooking(r.data.data.booking); 
      setServices(r.data.data.services); 
      setError(null);
    } catch (e) {
      console.error('Failed to load booking:', e);
      setError(e.response?.data?.message || e.message || 'Failed to load booking');
    } 
    setLoading(false); 
  };

  const handleAction = async (action) => {
    try {
      if (action === 'accept') {
        await acceptBooking(id);
        toast.success('Booking accepted successfully');
      } else if (action === 'reject') {
        await rejectBooking(id, { reason: 'Rejected' });
        toast.success('Booking rejected');
      } else if (action === 'complete') {
        // Request OTP to be sent to customer app
        setOtpLoading(true);
        try {
          await requestCompletionOtp(id);
          setOtpSent(true);
          setOtpInput('');
          toast.success('Completion PIN generated and sent to customer’s app!');
        } catch (e) {
          toast.error(e.response?.data?.message || 'Failed to request completion OTP');
        } finally {
          setOtpLoading(false);
        }
        return; // Don't reload yet — wait for customer confirmation or OTP entry
      }
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const handleVerifyOtp = async () => {
    if (!otpInput.trim()) { toast.error('Please enter the 4-digit PIN'); return; }
    setOtpLoading(true);
    try {
      await completeBooking(id, otpInput.trim());
      toast.success('🎉 Booking completed successfully!');
      setOtpSent(false);
      setOtpInput('');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Invalid PIN. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleRecordCash = async () => {
    if (!(await confirm('Confirm recording cash payment of ₹' + booking.finalAmount + ' received from customer?'))) return;
    try {
      await api.post('/payments/cash', { bookingId: id });
      load();
      toast.success('Cash payment recorded successfully');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to record cash payment');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-[100dvh] sm:h-full max-w-4xl mx-auto w-full bg-surface border border-border overflow-hidden rounded-2xl">
        <div className="h-16 bg-background-alt animate-pulse border-b border-border" />
        <div className="flex-1 bg-surface-variant/20 p-6 space-y-6">
          <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 bg-surface rounded-2xl border border-border mt-6 max-w-2xl mx-auto">
        <span className="material-symbols-outlined text-4xl text-error mb-2">error</span>
        <h3 className="text-lg font-semibold text-on-surface">Unable to load booking</h3>
        <p className="text-muted-text text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm">Retry</button>
      </div>
    );
  }

  if (!booking) return <div className="text-center py-20 text-muted-text">Booking not found</div>;

  const statusColors = { 
    PENDING: 'bg-yellow-50 text-yellow-800 border-yellow-200', 
    CONFIRMED: 'bg-blue-50 text-blue-800 border-blue-200', 
    COMPLETED: 'bg-green-50 text-green-800 border-green-200', 
    CANCELLED: 'bg-red-50 text-red-800 border-red-200', 
    REJECTED: 'bg-gray-50 text-gray-800 border-gray-200' 
  };

  const handleChat = async () => {
    try {
      if (!booking?.user?._id) {
        toast.error('Customer information not found');
        return;
      }
      const { initiateChat } = await import('../services/vendorApi');
      const res = await initiateChat({
        recipientId: booking.user._id,
        recipientRole: 'user',
        chatType: 'user-vendor',
        salonId: booking.salon._id
      });
      if (res.data.success && res.data.data._id) {
        navigate(`/vendor/chat/${res.data.data._id}`);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to initiate chat');
    }
  };

  const handleNativeCall = () => {
    if (!booking?.user?.phone) {
      toast.error('Phone number is unavailable for this customer.');
      return;
    }
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      toast.error('Calling is available from a mobile device. Phone Number: ' + booking.user.phone);
      return;
    }
    window.location.href = `tel:${booking.user.phone}`;
  };

  return (
    <div className="flex flex-col min-h-[100dvh] lg:min-h-full bg-surface lg:rounded-2xl lg:border border-border max-w-4xl mx-auto w-full shadow-sm relative pb-[80px] lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-border bg-surface sticky top-0 z-20 pt-[calc(1rem+env(safe-area-inset-top))] lg:pt-4">
        <button onClick={() => goBack(navigate, '/vendor/bookings')} className="p-2 -ml-2 rounded-xl text-on-surface hover:bg-surface-variant transition-colors flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <div className="min-w-0">
          <h2 className="font-semibold text-on-surface text-lg truncate">Booking Details</h2>
          <p className="text-xs text-muted-text font-medium truncate">#{booking._id.slice(-6).toUpperCase()}</p>
        </div>
      </div>

      <div className="flex-1 p-4 lg:p-5 space-y-4 lg:space-y-6 animate-fade-in bg-background-alt/50 pb-[220px] lg:pb-10">
        <div className={`rounded-2xl p-6 text-center border ${statusColors[booking.status]}`}>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-75">Status</p>
          <p className="text-2xl font-bold mt-1">{booking.status}</p>
        </div>
        
        <div className="bg-surface rounded-2xl p-4 lg:p-5 border border-border space-y-4 shadow-sm">
          <h3 className="font-semibold text-on-surface text-base border-b border-border pb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-muted-text">person</span>
            Customer Details
          </h3>
          <div className="text-sm space-y-1.5 text-on-surface">
            <p className="font-semibold text-[15px]">{booking.user?.name}</p>
            <p className="text-muted-text break-all"> {booking.user?.email}</p>
            <p className="text-muted-text"> {booking.user?.phone}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border bg-background-alt/30 -mx-4 lg:-mx-5 -mb-4 lg:-mb-5 p-4 lg:p-5 rounded-b-2xl">
            <div>
              <p className="text-xs text-muted-text font-semibold uppercase tracking-wider">Date</p>
              <p className="font-bold text-on-surface text-[15px] mt-1">
                {new Date(booking.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-text font-semibold uppercase tracking-wider">Time Window</p>
              <p className="font-bold text-on-surface text-[15px] mt-1">{booking.startTime} - {booking.endTime}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-4 lg:p-5 border border-border shadow-sm">
          <h3 className="font-semibold text-on-surface text-base border-b border-border pb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-muted-text">content_cut</span>
            Services Catalog
          </h3>
          <div className="divide-y divide-border">
            {services.map(s => (
              <div key={s._id} className="flex justify-between py-3 text-sm text-on-surface">
                <span className="pr-2">{s.service?.name} ({s.duration} min)</span>
                <span className="font-semibold shrink-0">₹{s.price}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold text-[16px] mt-2 pt-3 border-t border-border">
            <span className="text-on-surface">Services Subtotal</span>
            <span className="text-primary text-lg">₹{booking.totalAmount}</span>
          </div>
        </div>

        <div className="bg-primary/5 rounded-2xl p-4 lg:p-5 border border-primary/20 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
            <div className="flex flex-col">
              <h3 className="font-semibold text-on-surface text-base flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">payments</span>
                Payment Details
              </h3>
              <span className="text-sm text-muted-text mt-1">Method: {booking.paymentMethod === 'ONLINE' ? 'Online (Razorpay)' : 'Cash / Pay at Salon'}</span>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide inline-block ${
                booking.paymentStatus === 'PAID' ? 'bg-success/20 text-success' :
                booking.paymentStatus === 'REFUNDED' ? 'bg-blue-100 text-blue-700' :
                booking.paymentStatus === 'REFUND_PENDING' ? 'bg-orange-100 text-orange-700' :
                'bg-yellow-500/20 text-yellow-700'
              }`}>
                {booking.paymentStatus === 'PAID' ? 'Paid' :
                 booking.paymentStatus === 'REFUNDED' ? 'Refunded' :
                 booking.paymentStatus === 'REFUND_PENDING' ? 'Refund Pending' : 'Pending'}
              </span>
            </div>
          </div>
          <div className="space-y-2 text-sm text-on-surface pt-3 border-t border-primary/10">
            <div className="flex justify-between">
              <span className="text-muted-text">Services Subtotal</span>
              <span className="font-medium">₹{booking.totalAmount}</span>
            </div>
            
            {booking.discountAmount > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span className="font-semibold">-₹{booking.discountAmount}</span>
              </div>
            )}
            
            {(booking.pricing?.packageDiscount > 0 || booking.packageSnapshot?.discount > 0) && (
              <div className="flex justify-between text-on-surface">
                <span>Package Offer Price</span>
                <span className="font-medium">₹{booking.packageSnapshot?.offerPrice || (booking.totalAmount - (booking.pricing?.packageDiscount || booking.packageSnapshot?.discount))}</span>
              </div>
            )}

            {(booking.discountAmount > 0 || booking.pricing?.packageDiscount > 0 || booking.packageSnapshot?.discount > 0) && (
              <div className="flex justify-between text-muted-text text-xs border-t border-dashed border-border pt-2 mt-1">
                <span>Amount Before Platform Fee</span>
                <span>₹{(booking.totalAmount - booking.discountAmount)}</span>
              </div>
            )}

            <div className="flex justify-between text-primary mt-1">
              <span>Platform Fee</span>
              <span className="font-semibold">+₹{booking.platformFee || 0}</span>
            </div>

            <div className="flex justify-between font-bold text-[16px] pt-3 mt-1 border-t border-primary/10">
              <span className="text-on-surface">Customer Payable</span>
              <span className="text-primary text-lg">₹{booking.finalAmount}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-4 lg:p-5 border border-border shadow-sm">
          <h3 className="font-semibold text-on-surface text-base border-b border-border pb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-muted-text">account_balance_wallet</span>
            Financial Settlement
          </h3>
          <div className="space-y-2 text-sm text-on-surface pt-3">
            <div className="flex justify-between"><span className="text-muted-text">Customer Paid</span><span className="font-medium">₹{booking.finalAmount}</span></div>
            <div className="flex justify-between text-error"><span className="text-muted-text">Platform Fee</span><span className="font-semibold">-₹{booking.platformFee || 0}</span></div>
            {booking.vendorPlanType === 'SUBSCRIPTION' ? (
               <div className="flex justify-between text-success"><span className="text-muted-text">Admin Commission</span><span className="font-semibold">-₹0</span></div>
            ) : (
               <div className="flex justify-between text-error"><span className="text-muted-text">Admin Commission</span><span className="font-semibold">-₹{booking.commission || 0}</span></div>
            )}
            <div className="flex justify-between font-bold text-[16px] pt-3 mt-1 border-t border-border">
              <span className="text-on-surface">Your Net Earning</span>
              <span className="text-success text-lg">₹{booking.vendorPayout || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions on Mobile */}
      <div className="fixed lg:static bottom-0 left-0 right-0 bg-surface lg:bg-transparent border-t border-border lg:border-t-0 p-4 lg:p-5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] lg:shadow-none z-30 lg:z-auto pb-[max(1.25rem,env(safe-area-inset-bottom,20px))] lg:pb-0">
        {booking.status === 'CONFIRMED' && (
          <div className="flex flex-col gap-3">
            {callError && (
              <div className="bg-error/10 text-error p-3 rounded-lg text-sm flex justify-between items-center">
                <span>{callError}</span>
                <button onClick={clearError} className="material-symbols-outlined text-[18px] opacity-70 hover:opacity-100">close</button>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={handleChat} className="flex-1 py-3 bg-surface border border-border text-on-surface rounded-xl font-semibold hover:bg-surface-variant transition-colors shadow-sm flex items-center justify-center gap-1.5 min-h-[48px]">
                <span className="material-symbols-outlined text-[18px]">chat</span>
                Chat
              </button>
              {callAvailability.canCall && (
                <button
                  onClick={handleNativeCall}
                  className="flex-1 py-3 bg-emerald-500/10 border border-emerald-400/30 text-emerald-600 rounded-xl font-semibold hover:bg-emerald-500 hover:text-white transition-all shadow-sm flex items-center justify-center gap-1.5 min-h-[48px]"
                >
                  <span className="material-symbols-outlined text-[18px]">call</span>
                  Call
                </button>
              )}
            </div>
          </div>
        )}

        {booking.status === 'PENDING' && (
          <div className="flex gap-3">
            <button onClick={() => handleAction('accept')} className="flex-1 py-3 bg-success/10 border border-success/30 text-success rounded-xl font-semibold hover:bg-success hover:text-white transition-all shadow-sm flex items-center justify-center gap-1.5 min-h-[48px]">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Accept
            </button>
            <button onClick={() => handleAction('reject')} className="flex-1 py-3 bg-error/10 border border-error/30 text-error rounded-xl font-semibold hover:bg-error hover:text-white transition-all shadow-sm flex items-center justify-center gap-1.5 min-h-[48px]">
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              Reject
            </button>
          </div>
        )}
        
        {/* Record Cash Payment */}
        {booking.paymentMethod === 'CASH' &&
          booking.paymentStatus === 'PENDING' &&
          ['CONFIRMED', 'COMPLETED'].includes(booking.status) && (
            <button
              onClick={handleRecordCash}
              className={`w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 min-h-[48px] ${booking.status === 'CONFIRMED' ? 'mt-3' : ''}`}
            >
              <span className="material-symbols-outlined text-[20px]">payments</span>
              Record Cash (₹{booking.finalAmount})
            </button>
          )}

        {booking.status === 'CONFIRMED' && (
          otpSent ? (
            <div className="w-full mt-3 p-5 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl space-y-4 animate-fade-in shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Waiting for Customer Confirmation</p>
                  <p className="text-xs text-muted-text">The 4-digit PIN is shown directly on customer's phone.</p>
                </div>
              </div>

              <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-2">
                <p className="text-xs font-medium text-muted-text">Or enter the 4-digit code if told verbally:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="4-digit PIN"
                    maxLength={4}
                    className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-mono font-bold tracking-widest text-center focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background"
                  />
                  <button
                    onClick={handleVerifyOtp}
                    disabled={otpLoading || otpInput.trim().length !== 4}
                    className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
                  >
                    {otpLoading ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => handleAction('complete')}
                  disabled={otpLoading}
                  className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">refresh</span> Re-send Code
                </button>
                <button
                  onClick={() => { setOtpSent(false); setOtpInput(''); }}
                  className="text-xs text-muted-text hover:text-on-surface underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => handleAction('complete')}
              disabled={otpLoading}
              className="w-full mt-3 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-1.5 min-h-[48px] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">task_alt</span>
              {otpLoading ? 'Generating Code...' : 'Mark Complete'}
            </button>
          )
        )}
      </div>
    </div>
  );
};
export default BookingDetailPage;
