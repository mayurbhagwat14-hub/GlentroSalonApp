import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getComplexAvailability, getSalonStaff } from '../../services/userApi';
import { useAuth } from '../../../../context/AuthContext';
import { goBack } from '../../../../utils/navigation';
import { Skeleton, SkeletonText } from '../../../../components/common/Skeleton';

const BookingPage = () => {
  const { id: salonId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const salon = state?.salon;
  const selectedServices = state?.selectedServices || [];
  const [availableStaff, setAvailableStaff] = useState(state?.staff || []);

  const [serviceStaff, setServiceStaff] = useState(state?.serviceStaff || {});
  const [date, setDate] = useState(state?.date || '');
  const [time, setTime] = useState(state?.time || '');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!state?.staff && salonId) {
      getSalonStaff(salonId)
        .then(res => setAvailableStaff(res.data.data || []))
        .catch(err => console.error('Failed to load staff in BookingPage', err));
    }
  }, [salonId, state]);

  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

  // Generate next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  // Real-time clock for active filtering
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (date && totalDuration) loadAvailability();
  }, [date, serviceStaff]);

  const loadAvailability = async () => {
    setSlotsLoading(true);
    try {
      const servicesPayload = selectedServices.map(s => ({
        serviceId: s._id,
        duration: s.duration,
        staffId: serviceStaff[s._id] || null
      }));
      const res = await getComplexAvailability(salonId, { date, services: servicesPayload });
      setAvailableSlots(res.data.data.allAvailableSlots || []);
    } catch (e) { setAvailableSlots([]); }
    setSlotsLoading(false);
  };

  if (!salon || selectedServices.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <h2 className="text-[20px] font-headline-sm text-on-surface mb-2">No services selected</h2>
        <button onClick={() => goBack(navigate, `/salon/${salonId}`)} className="text-primary hover:underline">Go Back</button>
      </div>
    );
  }

  const handleProceed = () => {
    if (!date || !time) return;

    const bookingState = {
      salon, selectedServices, staff: availableStaff, serviceStaff, date, time,
      packageId: state?.packageId, packageDoc: state?.packageDoc
    };

    if (!user) {
      // Save booking progress so user can continue after login
      sessionStorage.setItem('pendingBookingReturn', JSON.stringify({
        path: `/salon/${salonId}/book`,
        state: bookingState
      }));
      showToast('Please login to proceed with booking', 'info');
      setTimeout(() => navigate('/login', { state: { from: `/salon/${salonId}/book` } }), 1200);
      return;
    }

    navigate(`/salon/${salonId}/checkout`, { state: bookingState });
  };

  const groupSlots = () => {
    const morning = [];
    const afternoon = [];
    const evening = [];

    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = date === todayStr;
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

    let isSelectedTimeStillValid = false;

    availableSlots.forEach(slot => {
      const [hours, mins] = slot.split(':').map(Number);
      const slotMinutes = hours * 60 + mins;

      // Filter out past slots dynamically
      if (isToday && slotMinutes <= currentMinutes) {
        return;
      }

      if (slot === time) isSelectedTimeStillValid = true;

      if (hours < 12) morning.push(slot);
      else if (hours < 16) afternoon.push(slot);
      else evening.push(slot);
    });

    // Auto clear selected time if it expires while sitting on the page
    if (time && !isSelectedTimeStillValid && isToday) {
      setTime('');
    }

    return { morning, afternoon, evening };
  };

  const { morning, afternoon, evening } = groupSlots();

  // Calculate if we have any valid slots left after real-time filtering
  const hasValidSlots = morning.length > 0 || afternoon.length > 0 || evening.length > 0;

  const formatTime = (time24) => {
    const [h, m] = time24.split(':');
    let h12 = parseInt(h);
    const ampm = h12 >= 12 ? 'PM' : 'AM';
    h12 = h12 % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  return (
    <div className="bg-background min-h-screen text-on-surface pb-[180px] w-full max-w-container-max mx-auto relative">
      {/* Transactional Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md px-4 md:px-margin-desktop pt-[max(1.25rem,calc(env(safe-area-inset-top,0px)+0.75rem))] md:pt-4 pb-3.5 flex items-center justify-between border-b border-border shadow-sm">
        <button 
          type="button"
          onClick={() => {
            if (window.history.length > 2) {
              navigate(-1);
            } else {
              navigate(`/salon/${salonId}`, { replace: true });
            }
          }} 
          className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-variant text-on-surface hover:bg-surface-container-high transition-colors -ml-2 cursor-pointer relative z-50"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline-sm text-[20px] text-on-surface">Select Date & Time</h1>
        <div className="w-10"></div>
      </header>

      <main className="pt-4">
        {/* Staff Selection (Optional) */}
        {availableStaff.length > 0 && selectedServices.map(s => (
          <section key={s._id} className="mb-6 px-4 md:px-margin-desktop">
            <p className="font-label-sm text-[12px] text-muted-text uppercase tracking-wider mb-2">Staff for {s.name}</p>
            <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-white shadow-sm">
              <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-border bg-surface-variant flex items-center justify-center">
                <span className="material-symbols-outlined text-muted-text">person</span>
              </div>
              <div className="flex-1">
                <select
                  value={serviceStaff[s._id] || ''}
                  onChange={(e) => {
                    setServiceStaff({ ...serviceStaff, [s._id]: e.target.value || null });
                    setTime('');
                  }}
                  className="w-full bg-transparent border-0 font-headline-sm text-[16px] text-on-surface p-0 focus:ring-0 cursor-pointer"
                >
                  <option value="">Any Available Specialist</option>
                  {availableStaff.map(st => (
                    <option key={st._id} value={st._id}>{st.name}</option>
                  ))}
                </select>
                <p className="font-body-sm text-[14px] text-muted-text mt-1">{s.name}</p>
              </div>
            </div>
          </section>
        ))}

        {/* Horizontal Date Picker */}
        <section className="mb-8">
          <div className="px-4 md:px-margin-desktop flex justify-between items-end mb-4">
            <h3 className="font-headline-sm text-[20px] text-on-surface">Select Date</h3>
          </div>
          <div className="flex overflow-x-auto gap-3 px-4 md:px-margin-desktop pb-2 hide-scrollbar">
            {dates.map(d => {
              const dateStr = d.toISOString().split('T')[0];
              const isSelected = date === dateStr;
              return (
                <button
                  key={dateStr}
                  onClick={() => { setDate(dateStr); setTime(''); }}
                  className={`flex flex-col items-center justify-center w-[64px] h-[84px] shrink-0 rounded-[18px] transition-transform active:scale-95 shadow-sm border ${isSelected ? 'bg-primary text-white border-primary shadow-md transform scale-[1.02]' : 'bg-white border-border text-on-surface hover:bg-soft-primary'}`}
                >
                  <span className={`font-label-sm text-[12px] uppercase ${isSelected ? 'opacity-90' : 'text-muted-text'}`}>
                    {d.toLocaleDateString('en', { weekday: 'short' })}
                  </span>
                  <span className="font-headline-md text-[24px] mt-1">{d.getDate()}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Time Slots Grid */}
        <section className="flex flex-col gap-6 px-4 md:px-margin-desktop">
          {!date ? (
            <div className="text-center py-8 text-muted-text bg-surface-variant/30 rounded-xl border border-dashed border-border">
              Please select a date to view available times
            </div>
          ) : slotsLoading ? (
            <div className="flex flex-col gap-6">
              <div>
                <SkeletonText lines={1} className="w-24 mb-3" lineClassName="h-4" />
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              </div>
              <div>
                <SkeletonText lines={1} className="w-24 mb-3 mt-2" lineClassName="h-4" />
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
          ) : !hasValidSlots ? (
            <div className="text-center py-8 text-muted-text bg-surface-variant/30 rounded-xl border border-dashed border-border">
              No available time slots for this date
            </div>
          ) : (
            <>
              {morning.length > 0 && (
                <div>
                  <h4 className="font-label-md text-[14px] text-on-surface mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-muted-text">light_mode</span> Morning
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {morning.map(slot => (
                      <button key={slot} onClick={() => setTime(slot)}
                        className={`py-3 rounded-xl border font-label-md text-[14px] text-center shadow-sm transition-colors ${time === slot ? 'bg-primary border-primary text-white shadow-md' : 'border-primary bg-white text-primary hover:bg-soft-primary'}`}>
                        {formatTime(slot)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {afternoon.length > 0 && (
                <div>
                  <h4 className="font-label-md text-[14px] text-on-surface mb-3 flex items-center gap-2 mt-2">
                    <span className="material-symbols-outlined text-muted-text">wb_sunny</span> Afternoon
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {afternoon.map(slot => (
                      <button key={slot} onClick={() => setTime(slot)}
                        className={`py-3 rounded-xl border font-label-md text-[14px] text-center shadow-sm transition-colors ${time === slot ? 'bg-primary border-primary text-white shadow-md' : 'border-primary bg-white text-primary hover:bg-soft-primary'}`}>
                        {formatTime(slot)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {evening.length > 0 && (
                <div>
                  <h4 className="font-label-md text-[14px] text-on-surface mb-3 flex items-center gap-2 mt-2">
                    <span className="material-symbols-outlined text-muted-text">bedtime</span> Evening
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {evening.map(slot => (
                      <button key={slot} onClick={() => setTime(slot)}
                        className={`py-3 rounded-xl border font-label-md text-[14px] text-center shadow-sm transition-colors ${time === slot ? 'bg-primary border-primary text-white shadow-md' : 'border-primary bg-white text-primary hover:bg-soft-primary'}`}>
                        {formatTime(slot)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* Sticky Footer CTA */}
      <div className="fixed bottom-0 md:bottom-0 left-0 w-full max-w-container-max md:left-1/2 md:-translate-x-1/2 bg-surface/95 backdrop-blur-xl border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom,16px))] md:pb-6 shadow-elevated z-40">
        <button
          onClick={handleProceed}
          disabled={!date || !time}
          className="w-full bg-primary text-white py-4 rounded-xl font-label-md text-[16px] shadow-sm active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Proceed to Checkout
        </button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-white text-sm font-medium animate-fade-in ${
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

export default BookingPage;

