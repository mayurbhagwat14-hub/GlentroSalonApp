import { format } from 'date-fns';
import StatusBadge from './StatusBadge';

const BookingDetailsModal = ({ booking, onClose }) => {
  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-dark-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-surface rounded-3xl shadow-xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-surface-elevated">
          <div>
            <h2 className="font-headline-sm text-[20px] text-on-surface">Booking #{booking._id.slice(-6).toUpperCase()}</h2>
            <p className="font-body-sm text-[13px] text-muted-text mt-1">
              Placed on {format(new Date(booking.createdAt), 'MMM dd, yyyy h:mm a')}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-variant text-muted-text hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          <div className="flex items-center justify-between">
            <StatusBadge status={booking.status} />
            <span className="px-3 py-1 bg-surface-variant rounded-full font-label-sm text-[12px] text-on-surface">
              Payment: <span className="capitalize font-semibold text-primary">{booking.paymentStatus}</span> ({['ONLINE', 'online'].includes(booking.paymentMethod) ? 'Online' : 'Pay at Salon'})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer Info */}
            <div className="p-4 bg-background-alt rounded-2xl border border-border">
              <h3 className="font-label-md text-[13px] text-muted-text uppercase tracking-wider mb-3">Customer</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {booking.user?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-headline-sm text-[15px] text-on-surface">{booking.user?.name}</p>
                  <p className="font-body-sm text-[13px] text-muted-text">{booking.user?.email}</p>
                </div>
              </div>
            </div>

            {/* Vendor Info */}
            <div className="p-4 bg-background-alt rounded-2xl border border-border">
              <h3 className="font-label-md text-[13px] text-muted-text uppercase tracking-wider mb-3">Salon / Vendor</h3>
              <div>
                <p className="font-headline-sm text-[15px] text-on-surface">{booking.salon?.name}</p>
                <p className="font-body-sm text-[13px] text-muted-text">{booking.salon?.address}, {booking.salon?.city}</p>
                {booking.vendor?.businessName && (
                  <p className="font-label-sm text-[12px] text-primary mt-2">Vendor: {booking.vendor.businessName}</p>
                )}
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">calendar_month</span>
            </div>
            <div>
              <p className="font-label-md text-[13px] text-primary uppercase tracking-wider">Schedule</p>
              <p className="font-headline-sm text-[16px] text-on-surface mt-1">
                {format(new Date(booking.bookingDate), 'MMMM dd, yyyy')} • {booking.startTime} - {booking.endTime}
              </p>
            </div>
          </div>

          {/* Services List */}
          <div>
            <h3 className="font-headline-sm text-[16px] text-on-surface mb-4">Services Rendered</h3>
            <div className="space-y-3">
              {booking.services?.map((bs, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-background-alt rounded-xl border border-border">
                  <div className="flex flex-col">
                    <span className="font-headline-sm text-[14px] text-on-surface">{bs.service?.name || 'Unknown Service'}</span>
                    <span className="font-label-sm text-[12px] text-muted-text">
                      {bs.duration} mins • Staff: {bs.staff?.name || (bs.staffAutoAssigned ? 'Auto Assigned' : 'Unassigned')}
                    </span>
                  </div>
                  <span className="font-headline-sm text-[15px] text-on-surface">₹{bs.price}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Financials */}
          <div>
            <h3 className="font-headline-sm text-[16px] text-on-surface mb-4">Payment Summary</h3>
            <div className="bg-surface-elevated p-5 rounded-2xl border border-border space-y-3">
              <div className="flex justify-between font-body-sm text-[14px] text-muted-text">
                <span>Subtotal</span>
                <span>₹{booking.totalAmount}</span>
              </div>
              
              {booking.discountAmount > 0 && (
                <div className="flex justify-between font-body-sm text-[14px] text-success">
                  <span>Discount</span>
                  <span>- ₹{booking.discountAmount}</span>
                </div>
              )}
              
              {(booking.pricing?.packageDiscount > 0 || booking.packageSnapshot?.discount > 0) && (
                <div className="flex justify-between font-body-sm text-[14px] text-on-surface font-medium">
                  <span>Package Offer</span>
                  <span>₹{booking.packageSnapshot?.offerPrice || (booking.totalAmount - (booking.pricing?.packageDiscount || booking.packageSnapshot?.discount))}</span>
                </div>
              )}

              <div className="flex justify-between font-body-sm text-[14px] text-primary">
                <span>Platform Fee</span>
                <span>+ ₹{booking.platformFee || 0}</span>
              </div>

              {booking.walletAmountApplied > 0 && (
                <div className="flex justify-between font-body-sm text-[14px] text-primary">
                  <span>Paid via Glentro Wallet</span>
                  <span>- ₹{booking.walletAmountApplied}</span>
                </div>
              )}
              
              <div className="h-px bg-border my-2" />
              
              <div className="flex justify-between font-headline-sm text-[16px] text-on-surface">
                <span>Total Paid by Customer</span>
                <span>₹{booking.finalAmount}</span>
              </div>

              {booking.cashbackEarned > 0 && (
                <div className="flex justify-between font-body-sm text-[13px] text-emerald-600 font-medium">
                  <span>Online Cashback Given</span>
                  <span>+ ₹{booking.cashbackEarned}</span>
                </div>
              )}

              <div className="h-px bg-border my-2" />

              <div className="flex justify-between font-body-sm text-[13px] text-muted-text">
                <span>Platform Commission</span>
                <span className="text-danger">- ₹{booking.commission || 0}</span>
              </div>
              <div className="flex justify-between font-headline-sm text-[15px] text-primary mt-2">
                <span>Vendor Payout</span>
                <span>₹{booking.vendorPayout || (booking.finalAmount - (booking.commission || 0) - (booking.platformFee || 0))}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default BookingDetailsModal;
