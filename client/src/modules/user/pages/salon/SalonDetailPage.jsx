import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getSalonById, 
  getSalonReviews,
  getPackages,
  getSalonResources
} from '../../services/userApi';
import { useAuth } from '../../../../context/AuthContext';
import { goBack } from '../../../../utils/navigation';
import Loader from '../../../../components/common/Loader';
import { getImageUrl } from '../../../../utils/imageUtils';
import toast from 'react-hot-toast';
import Button from '../../../../components/common/Button';
import { SalonDetailSkeleton } from '../../components/skeletons/SalonDetailSkeleton';
import { Skeleton, SkeletonAvatar, SkeletonText } from '../../../../components/common/Skeleton';
import { useFavorites } from '../../../../context/FavoriteContext';
import { formatPaise } from '../../../../utils/money';
import TopStylists from '../../components/TopStylists';

const SalonDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [salon, setSalon] = useState(null);
  const [services, setServices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [staff, setStaff] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('services');
  const [selectedServices, setSelectedServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Favorites State
  const { isFavorite, toggleFavoriteStatus } = useFavorites();
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);

  // Reviews State
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => { 
    loadSalon(); 
  }, [id]);

  useEffect(() => {
    if (activeTab === 'reviews') {
      loadReviews();
    }
  }, [activeTab]);

  const loadSalon = async () => {
    try {
      const res = await getSalonById(id);
      const { salon: s, services: svc, staff: st } = res.data.data;
      setSalon(s); 
      setServices(svc); 
      setStaff(st);

      // Load packages (offers)
      const pkgsRes = await getPackages({ salon: id, status: 'ACTIVE', isActive: true, checkValidity: true });
      setPackages(pkgsRes.data.data.packages);

      // Load resources
      const resRes = await getSalonResources(id);
      if (resRes.data.success && resRes.data.data.length > 0) {
        setResources(resRes.data.data);
      }
    } catch (e) { 
      console.error(e); 
    }
    setLoading(false);
  };



  const loadReviews = async () => {
    setReviewsLoading(true);
    try {
      const res = await getSalonReviews(id, { limit: 20 });
      setReviews(res.data.data);
    } catch (e) {
      console.error('Failed to load reviews', e);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    setIsFavoriteLoading(true);
    await toggleFavoriteStatus(id);
    setIsFavoriteLoading(false);
  };

  const toggleService = (service) => {
    setSelectedServices(prev =>
      prev.find(s => s._id === service._id) ? prev.filter(s => s._id !== service._id) : [...prev, service]
    );
  };

  const totalPricePaise = selectedServices.reduce((sum, s) => sum + (s.pricePaise ?? Math.round((s.price || 0) * 100)), 0);
  const totalPriceLegacy = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);

  const filteredServices = services.filter(service => 
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (service.category?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <SalonDetailSkeleton />;
  if (!salon) return <div className="text-center py-20 bg-background min-h-screen pt-32"><h2 className="text-[20px] font-semibold text-on-surface">Salon not found</h2></div>;

  return (
    <div className="bg-background text-on-background font-body-md antialiased overflow-x-hidden min-h-screen">
      {/* Main Container */}
      <main className="relative w-full max-w-container-max mx-auto bg-background pb-[100px] shadow-2xl min-h-screen">
        {/* Hero Section */}
        <section className="relative h-[320px] w-full bg-surface-variant">
          <img 
            src={salon.images?.[0] ? getImageUrl(salon.images[0]) : "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80"} 
            alt={salon.name} 
            className="object-cover w-full h-full" 
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/10"></div>
          {/* Floating Actions */}
          <div className="absolute top-[max(1.5rem,env(safe-area-inset-top))] left-4 right-4 flex justify-between items-center z-10">
            <button onClick={() => goBack(navigate, '/salons')} className="w-10 h-10 rounded-full bg-surface/90 backdrop-blur-sm flex items-center justify-center shadow-sm text-on-surface hover:bg-surface transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex gap-3">
                <button 
                  onClick={handleToggleFavorite}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${
                    isFavorite(id)
                      ? 'bg-red-500 text-white border-transparent' 
                      : 'bg-white text-muted-text border border-border hover:bg-surface-variant hover:text-red-500'
                  } disabled:opacity-50`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: isFavorite(id) ? "'FILL' 1" : "'FILL' 0", color: isFavorite(id) ? 'white' : 'inherit' }}>
                    favorite
                  </span>
                </button>
            </div>
          </div>
        </section>

        {/* Content Canvas (Overlapping Hero) */}
        <div className="relative -mt-10 bg-background rounded-t-[32px] pt-8 px-4 md:px-margin-desktop flex flex-col gap-8 z-20">
          {/* Salon Header */}
          <header className="flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex gap-4 items-center">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-border shadow-sm flex-shrink-0 bg-white flex items-center justify-center font-headline-md text-primary text-[24px]">
                  {salon.name.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <h1 className="font-headline-lg-mobile text-[24px] font-bold text-on-surface">{salon.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center text-rating">
                      <span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                      <span className="font-label-sm text-[12px] ml-1 text-on-surface">
                        {salon.ratings?.average > 0 
                          ? `${salon.ratings.average.toFixed(1)} (${salon.ratings.count})` 
                          : 'New'}
                      </span>
                    </div>
                    <span className="text-outline text-[12px]">•</span>
                    <span className="font-body-sm text-[14px] text-muted-text">{salon.address}</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Navigation Tabs */}
          <nav className="w-full border-b border-border">
            <div className="flex overflow-x-auto hide-scrollbar gap-6 pb-4">
              {['services', 'about', 'staff', 'reviews', ...(resources.length > 0 ? ['facilities'] : [])].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative font-label-md text-[14px] whitespace-nowrap transition-colors capitalize ${activeTab === tab ? 'text-primary' : 'text-muted-text hover:text-primary'}`}
                >
                  {tab}
                  {activeTab === tab && <div className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>}
                </button>
              ))}
            </div>
          </nav>

          {/* Tab Content: Services */}
          {activeTab === 'services' && (
            <section className="animate-fade-in space-y-6">
              {packages.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-headline-sm text-[20px] font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">local_offer</span>
                    Offers & Packages
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {packages.map(pkg => (
                      <div key={pkg._id} className="bg-surface rounded-2xl p-5 border border-border shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-on-surface text-[18px]">{pkg.name}</h4>
                            <span className="text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-lg shrink-0">
                              Save {formatPaise(pkg.totalPricePaise - pkg.discountedPricePaise, pkg.totalPrice - pkg.discountedPrice)}
                            </span>
                          </div>
                          
                          {pkg.description && <p className="text-sm text-muted-text mb-4 line-clamp-2">{pkg.description}</p>}
                          
                          <div className="space-y-2 mb-5">
                            <p className="text-[12px] font-bold text-muted-text uppercase tracking-wider">Includes:</p>
                            <div className="flex flex-col gap-1.5">
                              {pkg.services?.map(s => (
                                <div key={s._id} className="flex justify-between items-center text-sm">
                                  <span className="text-on-surface">• {s.name}</span>
                                  <span className="text-muted-text line-through text-xs">{formatPaise(s.pricePaise, s.price)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-end justify-between pt-4 border-t border-border mt-auto">
                          <div>
                            <p className="text-xs text-muted-text mb-0.5">Offer Price</p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-[22px] font-bold text-primary">{formatPaise(pkg.discountedPricePaise, pkg.discountedPrice)}</span>
                              <span className="text-sm text-muted-text line-through">{formatPaise(pkg.totalPricePaise, pkg.totalPrice)}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => navigate(`/salon/${salon._id}/book`, {
                              state: { 
                                salon, 
                                selectedServices: pkg.services, 
                                staff, 
                                packageId: pkg._id,
                                packageDoc: pkg 
                              }
                            })}
                            className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
                          >
                            Book Offer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h3 className="font-headline-sm text-[20px] font-bold text-on-surface">All Services</h3>
                  <div className="relative w-full sm:w-64">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-text text-[20px]">search</span>
                    <input 
                      type="text" 
                      placeholder="Search services..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-surface-variant text-on-surface rounded-xl border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-[14px]"
                    />
                  </div>
                </div>

                {services.length === 0 ? (
                  <p className="text-center text-muted-text py-8 bg-surface-variant rounded-xl border border-dashed border-border">No services available</p>
                ) : filteredServices.length === 0 ? (
                  <div className="text-center py-8 bg-surface-variant rounded-xl border border-dashed border-border flex flex-col items-center">
                    <span className="material-symbols-outlined text-4xl text-muted-text mb-2">search_off</span>
                    <p className="text-on-surface font-semibold">No matches found</p>
                    <p className="text-muted-text text-sm mt-1">We couldn't find any service matching "{searchQuery}". Please try another term.</p>
                  </div>
                ) : 
                filteredServices.map(service => {
                  const isSelected = selectedServices.some(s => s._id === service._id);
                  return (
                    <div key={service._id} className="flex justify-between items-center p-4 rounded-xl bg-surface border border-border shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => toggleService(service)}>
                      <div className="flex flex-col flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-headline-sm text-[18px] font-semibold text-on-surface">{service.name}</h3>
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-surface-variant text-primary">{service.gender}</span>
                        </div>
                        <p className="font-body-sm text-[14px] text-muted-text mb-2 line-clamp-2">{service.category?.name || 'General'}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="font-label-md text-[14px] text-primary font-bold">{formatPaise(service.pricePaise, service.price)}</span>
                          <span className="text-outline text-[12px]">•</span>
                          <span className="font-body-sm text-[14px] text-muted-text flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">schedule</span> {service.duration} min
                          </span>
                        </div>
                      </div>
                      <button 
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors shadow-sm ${isSelected ? 'bg-primary text-white' : 'bg-soft-primary text-primary hover:bg-primary hover:text-white'}`}
                      >
                        <span className="material-symbols-outlined">{isSelected ? 'check' : 'add'}</span>
                      </button>
                    </div>
                  )
                })
              }
              </div>
            </section>
          )}

          {/* Tab Content: About */}
          {activeTab === 'about' && (
            <section className="animate-fade-in flex-col gap-6 flex">
              <div>
                <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-2">About Us</h3>
                <p className="font-body-sm text-[14px] text-muted-text leading-relaxed">
                  {salon.description || "Welcome to our premium salon. We specialize in personalized styling, advanced color techniques, and restorative treatments designed to elevate your natural essence in a serene, luxurious environment."}
                </p>
              </div>
              <hr className="border-border"/>
              <div className="flex gap-4 items-start">
                <span className="material-symbols-outlined text-primary mt-1">location_on</span>
                <div>
                  <h4 className="font-label-md text-[14px] font-bold text-on-surface">Location</h4>
                  <p className="font-body-sm text-[14px] text-muted-text mt-1">{salon.address}, {salon.city}</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <span className="material-symbols-outlined text-primary mt-1">schedule</span>
                <div className="w-full">
                  <h4 className="font-label-md text-[14px] font-bold text-on-surface mb-2">Opening Hours</h4>
                  <div className="flex justify-between font-body-sm text-[14px] mb-1">
                    <span className="text-muted-text">Daily</span>
                    <span className="text-on-surface font-medium">{salon.openingTime} - {salon.closingTime}</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Tab Content: Staff */}
          {activeTab === 'staff' && (
            <section className="animate-fade-in">
              {/* Top Stylists — Wilson-score ranked staff with >= 1 review */}
              <TopStylists salonId={id} salon={salon} staff={staff} />

              {/* All Staff */}
              <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-4">
                {staff.length > 0 ? 'All Staff' : 'Our Specialists'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {staff.length === 0 ? <p className="text-muted-text col-span-2">No staff listed yet.</p> : staff.map(s => (
                  <div key={s._id} className="flex flex-col items-center p-4 rounded-xl bg-surface border border-border shadow-sm">
                    <div className="w-20 h-20 rounded-full overflow-hidden mb-3 bg-surface-variant flex items-center justify-center">
                      {s.avatar ? (
                        <img src={getImageUrl(s.avatar)} alt={s.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-4xl text-primary/50">person</span>
                      )}
                    </div>
                    <span className="font-label-md text-[14px] font-bold text-on-surface">{s.name}</span>
                    <span className="font-body-sm text-[12px] text-muted-text mt-1">{s.specializations?.[0] || 'Specialist'}</span>
                    {/* Rating badge: show 'New' if no reviews */}
                    {s.ratings && s.ratings.count > 0 ? (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-[12px] text-yellow-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span className="text-[11px] font-semibold text-on-surface">{s.ratings.average?.toFixed(1)}</span>
                        <span className="text-[10px] text-muted-text">({s.ratings.count})</span>
                      </div>
                    ) : (
                      <span className="mt-1 text-[10px] font-semibold text-muted-text bg-surface-variant px-2 py-0.5 rounded-full">New</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tab Content: Facilities */}
          {activeTab === 'facilities' && resources.length > 0 && (
            <section className="animate-fade-in">
              <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-4">Facilities & Resources</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resources.map(r => (
                  <div key={r._id} className="bg-surface rounded-2xl overflow-hidden border border-border shadow-sm flex flex-col">
                    {r.image ? (
                      <div className="w-full h-40 bg-surface-variant">
                        <img src={getImageUrl(r.image)} alt={r.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-40 bg-surface-variant flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-muted-text">hot_tub</span>
                      </div>
                    )}
                    <div className="p-4">
                      <h4 className="font-label-lg text-[16px] font-bold text-on-surface mb-1">{r.name}</h4>
                      <p className="font-body-sm text-[12px] text-muted-text capitalize">{r.type.toLowerCase()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tab Content: Reviews */}
          {activeTab === 'reviews' && (
            <section className="animate-fade-in flex flex-col gap-6">
              
              {/* Reviews List */}
              <div className="flex flex-col gap-4 mt-2">
                <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface">Customer Reviews</h3>
                
                {reviewsLoading ? (
                  <div className="flex flex-col gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="bg-surface border border-border rounded-xl p-4 shadow-sm flex gap-3">
                        <SkeletonAvatar size="w-10 h-10" className="shrink-0" />
                        <div className="flex flex-col w-full gap-2">
                          <SkeletonText lines={1} className="w-1/3" lineClassName="h-4" />
                          <SkeletonText lines={1} className="w-1/4" lineClassName="h-3" />
                          <SkeletonText lines={2} className="w-full mt-2" lineClassName="h-3.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="font-body-sm text-[14px] text-muted-text text-center py-8 bg-surface-variant rounded-xl border border-dashed border-border">
                    No reviews yet. Book an appointment to be the first!
                  </p>
                ) : (
                  reviews.map(review => (
                    <div key={review._id} className="bg-surface border border-border rounded-xl p-4 shadow-sm flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-soft-primary flex items-center justify-center font-bold text-primary overflow-hidden shrink-0">
                        {review.user?.avatar ? (
                          <img src={getImageUrl(review.user.avatar)} alt={review.user.name} className="w-full h-full object-cover" />
                        ) : (
                          review.user?.name?.charAt(0) || 'U'
                        )}
                      </div>
                      <div className="flex flex-col w-full">
                        <div className="flex justify-between items-start">
                          <span className="font-label-md font-bold text-on-surface">{review.user?.name || 'Customer'}</span>
                          <span className="font-body-sm text-[11px] text-muted-text">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center text-rating mt-0.5 mb-2">
                          {[1, 2, 3, 4, 5].map(star => (
                            <span 
                              key={star} 
                              className="material-symbols-outlined text-[14px]" 
                              style={{fontVariationSettings: star <= review.rating ? "'FILL' 1" : "'FILL' 0"}}
                            >
                              star
                            </span>
                          ))}
                        </div>
                        {review.comment && (
                          <p className="font-body-sm text-[14px] text-on-surface-variant">{review.comment}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

        </div>
      </main>

      {/* Sticky Bottom CTA */}
      {selectedServices.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full bg-surface border-t border-border shadow-[0_-10px_30px_rgba(109,62,168,0.08)] z-40 flex justify-center pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-4">
          <div className="w-full max-w-container-max px-4 py-4 flex justify-between items-center bg-surface">
            <div className="flex flex-col">
              <span className="font-label-sm text-[12px] text-muted-text">{selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected</span>
              <span className="font-headline-sm text-[20px] font-bold text-on-surface mt-0.5">{formatPaise(totalPricePaise, totalPriceLegacy)}</span>
            </div>
            <button 
              onClick={() => navigate(`/salon/${id}/book`, { state: { salon, selectedServices, staff } })}
              className="bg-primary text-white font-label-md text-[14px] px-8 py-3.5 rounded-xl shadow-sm hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              Continue Booking <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalonDetailPage;
