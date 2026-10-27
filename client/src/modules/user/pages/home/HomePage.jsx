import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNearbySalons, getSalons, getCategories, getServices, getBanners, getPackages } from '../../services/userApi';
import { useAuth } from '../../../../context/AuthContext';
import { useNotifications } from '../../../../context/NotificationContext';
import { useLocationContext } from '../../../../context/LocationContext';
import LocationSelectionModal from '../../../../components/common/LocationSelectionModal';
import LocationPermissionModal from '../../../../components/common/LocationPermissionModal';
import { getImageUrl } from '../../../../utils/imageUtils';
import { HomeSkeleton } from '../../components/skeletons/HomeSkeleton';
import { useFavorites } from '../../../../context/FavoriteContext';

const HomePage = () => {
  const [salons, setSalons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [banners, setBanners] = useState([]);
  const [featuredOffers, setFeaturedOffers] = useState([]);
  const [currentOfferIndex, setCurrentOfferIndex] = useState(0);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const videoRefs = useRef([]);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [salonListTitle, setSalonListTitle] = useState('Nearby Salons');
  const { selectedLocation, requestCurrentLocation } = useLocationContext();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const { isFavorite, toggleFavoriteStatus } = useFavorites();

  // Banner Auto-Rotation
  useEffect(() => {
    let interval;
    if (banners.length > 1) {
      interval = setInterval(() => {
        setCurrentBannerIndex((prevIndex) => (prevIndex + 1) % banners.length);
      }, 6000);
    }
    return () => clearInterval(interval);
  }, [banners.length]);

  // Featured Offers Auto-Rotation
  useEffect(() => {
    let interval;
    if (featuredOffers.length > 1) {
      interval = setInterval(() => {
        setCurrentOfferIndex((prevIndex) => (prevIndex + 1) % featuredOffers.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [featuredOffers.length]);

  // Auto-play active video and pause inactive ones
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (video) {
        video.muted = true;
        video.defaultMuted = true;
        if (idx === currentBannerIndex) {
          video.currentTime = 0;
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.log('Autoplay play blocked or error:', err);
            });
          }
        } else {
          video.pause();
        }
      }
    });
  }, [currentBannerIndex, banners]);

  // Mobile interaction trigger: resumes video if browser initially blocked autoplay
  useEffect(() => {
    const resumeVideo = () => {
      const activeVideo = videoRefs.current[currentBannerIndex];
      if (activeVideo && activeVideo.paused) {
        activeVideo.muted = true;
        activeVideo.play().catch(() => {});
      }
    };
    window.addEventListener('touchstart', resumeVideo, { passive: true });
    window.addEventListener('scroll', resumeVideo, { passive: true });
    window.addEventListener('click', resumeVideo, { passive: true });
    return () => {
      window.removeEventListener('touchstart', resumeVideo);
      window.removeEventListener('scroll', resumeVideo);
      window.removeEventListener('click', resumeVideo);
    };
  }, [currentBannerIndex]);

  // Tab Visibility change listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      const activeVideo = videoRefs.current[currentBannerIndex];
      if (!activeVideo) return;
      if (document.hidden) {
        activeVideo.pause();
      } else {
        activeVideo.muted = true;
        activeVideo.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentBannerIndex]);

  // Trigger permission modal on first load if no location exists
  useEffect(() => {
    const checkLocationPermission = async () => {
      if (!selectedLocation && !sessionStorage.getItem('location_prompt_dismissed')) {
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            if (result.state === 'granted') {
              // Silently fetch location if already granted
              requestCurrentLocation();
            } else {
              // For 'prompt' or 'denied', show the modal so user can choose to select manually
              setIsPermissionModalOpen(true);
            }
          } catch (error) {
            // Fallback for browsers that don't fully support permissions API
            setIsPermissionModalOpen(true);
          }
        } else {
          setIsPermissionModalOpen(true);
        }
      }
    };
    checkLocationPermission();
  }, [selectedLocation, requestCurrentLocation]);

  useEffect(() => {
    loadInitialData();
  }, [selectedLocation]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      let salonPromise;
      if (selectedLocation?.lat && selectedLocation?.lng) {
        salonPromise = getNearbySalons({ lat: selectedLocation.lat, lng: selectedLocation.lng, limit: 10 }).catch(() => ({ data: { data: { salons: [] } } }));
        setSalonListTitle('Nearby Salons');
      } else {
        salonPromise = getSalons({ city: selectedLocation?.city, limit: 10 }).catch(() => ({ data: { data: { salons: [] } } }));
        setSalonListTitle(selectedLocation?.city ? 'Popular Salons in ' + selectedLocation.city : 'Popular Salons');
      }

      const offersParams = { limit: 10, checkValidity: 'true', status: 'ACTIVE', isActive: 'true' };
      if (selectedLocation?.lat && selectedLocation?.lng) {
        offersParams.lat = selectedLocation.lat;
        offersParams.lng = selectedLocation.lng;
      } else if (selectedLocation?.city) {
        offersParams.city = selectedLocation.city;
      }

      const [catRes, salonRes, serviceRes, bannerRes, offersRes] = await Promise.all([
        getCategories().catch(() => ({ data: { data: [] } })),
        salonPromise,
        getServices({ limit: 40 }).catch(() => ({ data: { data: { services: [] } } })),
        getBanners().catch(() => ({ data: { data: [] } })),
        getPackages(offersParams).catch(() => ({ data: { data: { packages: [] } } }))
      ]);

      setCategories(catRes.data?.data?.slice(0, 4) || []);
      
      // Deduplicate services by clean name so each popular service is unique
      const rawServices = serviceRes.data?.data?.services || [];
      const seenNames = new Set();
      const uniqueServices = [];
      for (const s of rawServices) {
        const cleanName = s.name.trim().toLowerCase();
        if (!seenNames.has(cleanName)) {
          seenNames.add(cleanName);
          uniqueServices.push(s);
        }
      }
      setServices(uniqueServices.slice(0, 8));
      setBanners(bannerRes.data?.data || []);

      let fetchedSalons = salonRes.data?.data?.salons || [];

      // Smart Fallback: If nearby search returned 0 salons, fetch popular public salons across India
      if (fetchedSalons.length === 0) {
        const publicSalonsRes = await getSalons({ limit: 10 }).catch(() => ({ data: { data: { salons: [] } } }));
        fetchedSalons = publicSalonsRes.data?.data?.salons || [];
        if (selectedLocation?.city) {
          setSalonListTitle(`Popular Salons (Near & Across India)`);
        } else {
          setSalonListTitle('Popular Salons');
        }
      }

      setSalons(fetchedSalons);

      let fetchedOffers = offersRes.data?.data?.packages || [];
      if (fetchedOffers.length === 0) {
        const fallbackOffersRes = await getPackages({ limit: 10, checkValidity: 'true', status: 'ACTIVE', isActive: 'true' }).catch(() => ({ data: { data: { packages: [] } } }));
        fetchedOffers = fallbackOffersRes.data?.data?.packages || [];
      }
      setFeaturedOffers(fetchedOffers);
    } catch (err) {
      console.error('Error loading home data:', err);
    } finally {
      setLoading(false);
      setFeaturedOfferLoading(false);
    }
  };

  if (loading) return <HomeSkeleton />;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const activeBanner = banners.length > 0 ? banners[currentBannerIndex] : null;

  const getServiceFallback = (name = '') => {
    const lower = name.toLowerCase();
    if (lower.includes('beard')) {
      return {
        image: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=400&q=80',
        icon: 'face'
      };
    }
    if (lower.includes('women') || (lower.includes('hair') && lower.includes('cut') && !lower.includes('men'))) {
      return {
        image: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=400&q=80',
        icon: 'content_cut'
      };
    }
    if (lower.includes('hair') || lower.includes('cut')) {
      return {
        image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=400&q=80',
        icon: 'content_cut'
      };
    }
    if (lower.includes('facial') || lower.includes('clean')) {
      return {
        image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=400&q=80',
        icon: 'auto_awesome'
      };
    }
    if (lower.includes('massage') || lower.includes('head')) {
      return {
        image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=400&q=80',
        icon: 'self_improvement'
      };
    }
    if (lower.includes('color') || lower.includes('dye')) {
      return {
        image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=400&q=80',
        icon: 'palette'
      };
    }
    if (lower.includes('mani') || lower.includes('pedi') || lower.includes('nail')) {
      return {
        image: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=400&q=80',
        icon: 'brush'
      };
    }
    if (lower.includes('jacuzzi') || lower.includes('spa')) {
      return {
        image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=400&q=80',
        icon: 'hot_tub'
      };
    }
    return {
      image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=400&q=80',
      icon: 'spa'
    };
  };

  return (
    <div className="bg-[#F8F7F5] text-on-surface font-body-md antialiased pb-4 -mx-4 md:mx-0 md:bg-transparent md:pt-4">
      {/* Hero Section */}
      <div className="relative w-full h-[320px] bg-inverse-surface flex flex-col pt-10 pb-6 px-6 overflow-hidden rounded-b-[24px] md:rounded-[24px]">
        {banners.length > 0 ? (
          banners.map((banner, index) => (
            banner.type === 'video' ? (
              <video
                key={banner._id || index}
                ref={el => {
                  if (el) {
                    el.muted = true;
                    el.defaultMuted = true;
                  }
                  videoRefs.current[index] = el;
                }}
                src={getImageUrl(banner.video)}
                poster={banner.image ? getImageUrl(banner.image) : undefined}
                className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-1000 ease-in-out ${index === currentBannerIndex ? 'opacity-55 z-0' : 'opacity-0 -z-10'}`}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                onEnded={(e) => {
                  e.currentTarget.currentTime = 0;
                  e.currentTarget.play().catch(() => {});
                }}
                onPause={(e) => {
                  if (index === currentBannerIndex && !document.hidden) {
                    e.currentTarget.play().catch(() => {});
                  }
                }}
                onCanPlay={(e) => {
                  if (index === currentBannerIndex) {
                    e.currentTarget.muted = true;
                    e.currentTarget.play().catch(() => {});
                  }
                }}
              />
            ) : (
              <img
                key={banner._id || index}
                alt={banner.title || "Hero Background"}
                className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-1000 ease-in-out ${index === currentBannerIndex ? 'opacity-65 z-0' : 'opacity-0 -z-10'}`}
                src={getImageUrl(banner.image)}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80";
                }}
              />
            )
          ))
        ) : (
          <img
            alt="Hero Background Fallback"
            className="absolute inset-0 w-full h-full object-cover object-top opacity-60 z-0"
            src="https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#1A1A1A]/90 z-0"></div>

        {/* Header Nav (Mobile Only) */}
        <header className="relative z-10 w-full flex md:hidden justify-between items-center -mt-2.5">
          <div
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center gap-2 bg-black/20 backdrop-blur-md rounded-full px-3 py-2 border border-white/10 cursor-pointer"
          >
            <span className="material-symbols-outlined text-white text-[18px]">location_on</span>
            <span className="font-label-sm text-white max-w-[150px] truncate">
              {selectedLocation?.formattedAddress || selectedLocation?.city || 'Select Location'}
            </span>
            <span className="material-symbols-outlined text-white text-[18px]">expand_more</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative cursor-pointer" onClick={() => navigate('/notifications')}>
              <span className="material-symbols-outlined text-white text-[24px]">notifications</span>
              {unreadCount > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-hot-pink rounded-full border border-white/20"></span>}
            </div>

            <div
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.2)] cursor-pointer overflow-hidden"
            >
              {user?.avatar ? (
                <img src={getImageUrl(user.avatar)} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="font-headline-sm text-white">{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
              )}
            </div>
          </div>
        </header>

        {/* Title & Description */}
        <div className="relative z-10 mt-auto mb-12">
          <h1 className="font-headline-md text-white font-serif tracking-tight leading-[1.15] max-w-[290px] text-[28px] sm:text-[32px] drop-shadow-md">
            {activeBanner?.title || <>Find & Book The<br />Best Salons Near You</>}
          </h1>
          {activeBanner?.description && (
            <p className="font-body-sm text-white/95 mt-1.5 line-clamp-2 max-w-[280px] text-xs leading-relaxed drop-shadow">
              {activeBanner.description}
            </p>
          )}
        </div>
      </div>

      {/* Search Bar Area */}
      <div className="px-6 -mt-7 relative z-20">
        <div className="flex gap-3">
          <div
            onClick={() => navigate('/search')}
            className="flex-1 flex items-center bg-surface-container-lowest rounded-2xl px-4 py-3.5 shadow-[0px_4px_16px_rgba(0,0,0,0.06)] border border-border cursor-pointer"
          >
            <span className="material-symbols-outlined text-muted-text mr-3">search</span>
            <input
              readOnly
              className="w-full bg-transparent border-none p-0 focus:ring-0 font-body-sm text-body-sm text-on-surface placeholder-muted-text outline-none cursor-pointer"
              placeholder="Search for salon, service or category"
              type="text"
            />
          </div>
          <button onClick={() => navigate('/search')} className="bg-surface-container-lowest text-heading-text rounded-2xl p-3.5 shadow-[0px_4px_16px_rgba(0,0,0,0.06)] border border-border flex items-center justify-center hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined">tune</span>
          </button>
        </div>
      </div>

      <main className="px-5 sm:px-6 space-y-5 sm:space-y-6 mt-3">
        {/* Promotional Offers Banner */}
        {/* Dynamic Promotional Offers Banner Carousel */}
        <section className="relative h-52 sm:h-60 rounded-3xl overflow-hidden shadow-md border border-border/10 cursor-pointer active:scale-[0.99] transition-transform duration-150 group">
          {featuredOffers.length > 0 ? (
            <>
              {/* Slide Content */}
              <div 
                key={currentOfferIndex}
                onClick={() => {
                  const offer = featuredOffers[currentOfferIndex];
                  if (offer) {
                    navigate(`/offers?salon=${offer.salon?._id || ''}&search=${encodeURIComponent(offer.name || '')}`);
                  }
                }}
                className="absolute inset-0 w-full h-full animate-fade-in flex flex-col justify-end"
              >
                {/* Slide Background Image */}
                <img
                  src={featuredOffers[currentOfferIndex].image 
                    ? getImageUrl(featuredOffers[currentOfferIndex].image) 
                    : (featuredOffers[currentOfferIndex].salon?.images?.[0] 
                      ? getImageUrl(featuredOffers[currentOfferIndex].salon.images[0]) 
                      : "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80")}
                  alt={featuredOffers[currentOfferIndex].name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80";
                  }}
                />
                
                {/* Dark Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
                
                {/* Slide Content Text overlay */}
                <div className="relative z-10 p-5 flex justify-between items-end gap-4 w-full">
                  <div className="space-y-1 text-white max-w-[72%]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-block bg-primary text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                        {featuredOffers[currentOfferIndex].discountPercent || Math.round(((featuredOffers[currentOfferIndex].totalPrice - featuredOffers[currentOfferIndex].discountedPrice) / featuredOffers[currentOfferIndex].totalPrice) * 100)}% OFF
                      </span>
                      <span className="inline-block bg-white/20 text-white font-semibold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-md">
                        {featuredOffers[currentOfferIndex].salon?.name || 'Partner Salon'}
                      </span>
                    </div>
                    
                    <h3 className="font-headline-sm text-base sm:text-lg font-bold tracking-tight line-clamp-1">
                      {featuredOffers[currentOfferIndex].name}
                    </h3>
                    
                    <p className="text-[10px] sm:text-xs text-white/80 line-clamp-2 leading-relaxed font-body-sm">
                      {featuredOffers[currentOfferIndex].description || 'Exclusive bundle deal on top salon services. Book your slot today!'}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="text-right">
                      <span className="text-[9px] text-white/60 block uppercase tracking-wider leading-none">Deal Price</span>
                      <span className="text-base sm:text-lg font-black text-white">₹{featuredOffers[currentOfferIndex].discountedPrice}</span>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const offer = featuredOffers[currentOfferIndex];
                        if (offer) {
                          navigate(`/offers?salon=${offer.salon?._id || ''}&search=${encodeURIComponent(offer.name || '')}`);
                        }
                      }}
                      className="bg-white text-primary px-3.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold shadow hover:bg-soft-primary transition-colors whitespace-nowrap active:scale-95 duration-100"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              </div>

              {/* Navigation Dots Indicator */}
              {featuredOffers.length > 1 && (
                <div className="absolute right-5 top-5 z-20 flex gap-1 bg-black/25 px-2 py-1 rounded-full backdrop-blur-sm">
                  {featuredOffers.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentOfferIndex(idx);
                      }}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        currentOfferIndex === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
                      }`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            // Fallback default banner if no active featured offers are in DB
            <div 
              onClick={() => navigate('/offers')}
              className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary to-[#8F66FF] p-5 flex flex-col justify-between"
            >
              <div className="absolute right-[-20px] bottom-[-20px] opacity-15 text-[150px] font-bold select-none leading-none group-hover:scale-105 transition-transform duration-500">%</div>
              <div className="relative z-10 flex justify-between items-center h-full w-full">
                <div className="space-y-1.5 max-w-[75%] text-white">
                  <span className="inline-block bg-white/20 text-white font-bold text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Limited Time Deals
                  </span>
                  <h3 className="font-headline-sm text-base sm:text-lg font-bold tracking-tight">
                    Exclusive Salon Offers & Bundles!
                  </h3>
                  <p className="text-[10px] sm:text-xs text-white/90 leading-relaxed font-body-sm line-clamp-2">
                    Pamper yourself with up to 50% discount on top rated hair, spa and beauty packages.
                  </p>
                </div>
                <div className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl border border-white/20 flex items-center justify-center transition-colors shrink-0">
                  <span className="material-symbols-outlined text-white text-[20px]">local_offer</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Top Categories */}
        <section>
          <div className="flex justify-between items-center mb-2.5">
            <h3 className="font-headline-sm text-headline-sm text-heading-text">Top Categories</h3>
          </div>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full">
            {categories.map(cat => (
              <div
                key={cat._id}
                className="flex flex-col items-center gap-1.5 cursor-pointer w-full group"
                onClick={() => navigate(`/search?q=${cat.name}`)}
              >
                <div className="w-[56px] h-[56px] rounded-[16px] bg-[#EDE4FF] flex items-center justify-center text-primary-container shadow-sm hover:bg-primary-fixed group-hover:scale-105 transition-all border border-primary-container/10 overflow-hidden">
                  {cat.image ? (
                    <img 
                      src={getImageUrl(cat.image)} 
                      alt={cat.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=150&q=80";
                      }}
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[24px] font-light">{cat.icon || 'category'}</span>
                  )}
                </div>
                <span className="font-label-md text-[11px] text-heading-text font-medium truncate w-full text-center px-0.5">{cat.name}</span>
              </div>
            ))}

            {/* More Button */}
            <div
              className="flex flex-col items-center gap-1.5 cursor-pointer w-full group"
              onClick={() => navigate('/search')}
            >
              <div className="w-[56px] h-[56px] rounded-[16px] bg-surface-container flex items-center justify-center text-muted-text shadow-sm hover:bg-surface-container-high group-hover:scale-105 transition-all border border-border">
                <span className="material-symbols-outlined text-[24px] font-light">grid_view</span>
              </div>
              <span className="font-label-md text-[11px] text-heading-text font-medium text-center w-full">More</span>
            </div>
          </div>
        </section>

        {/* Nearby Salons */}
        <section>
          <div className="flex justify-between items-end mb-2.5">
            <h3 className="font-headline-sm text-headline-sm text-heading-text">{salonListTitle}</h3>
            <button onClick={() => navigate('/salons')} className="font-label-sm text-label-sm text-primary-container hover:text-primary-dark">View all</button>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-1.5 -mx-5 px-5 sm:-mx-6 sm:px-6">
            {salons.map(salon => (
              <div
                key={salon._id}
                onClick={() => navigate(`/salon/${salon._id}`)}
                className="shrink-0 w-[240px] bg-surface-container-lowest rounded-[18px] border border-border shadow-[0px_2px_8px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col cursor-pointer"
              >
                <div className="relative h-32 w-full">
                  <img
                    alt={salon.name}
                    className="w-full h-full object-cover"
                    src={salon.images?.[0] ? getImageUrl(salon.images[0]) : "https://images.unsplash.com/photo-1521590832167-7bfcfaa6362f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "https://images.unsplash.com/photo-1521590832167-7bfcfaa6362f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80";
                    }}
                  />
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      toggleFavoriteStatus(salon._id); 
                    }}
                    className={`absolute top-2 right-2 w-8 h-8 rounded-full bg-surface-container-lowest/80 backdrop-blur-sm flex items-center justify-center transition-colors ${
                      isFavorite(salon._id) ? 'text-red-500' : 'text-muted-text hover:text-red-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: isFavorite(salon._id) ? "'FILL' 1" : "'FILL' 0", color: isFavorite(salon._id) ? 'red' : 'inherit' }}>
                      favorite
                    </span>
                  </button>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-1.5">
                    <h4 className="font-headline-sm text-[16px] text-heading-text truncate pr-2">{salon.name}</h4>
                    <div className="flex items-center gap-1 bg-surface-container rounded-md px-1.5 py-0.5 shrink-0">
                      <span className="material-symbols-outlined text-rating text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="font-label-sm text-label-sm text-muted-text">
                        {salon.ratings?.average > 0 ? salon.ratings.average.toFixed(1) : 'New'}
                      </span>
                    </div>
                  </div>
                  <p className="font-body-sm text-body-sm text-muted-text mb-3 flex items-center gap-1 truncate">
                    <span className="material-symbols-outlined text-sm shrink-0">location_on</span>
                    <span className="truncate">{salon.address}</span>
                  </p>
                  <div className="mt-auto border-t border-border/50 pt-3">
                    {salon.minServicePrice !== undefined && salon.minServicePrice !== null ? (
                      <p className="font-label-sm text-label-sm text-primary-container">Starting ₹{salon.minServicePrice}</p>
                    ) : (
                      <p className="font-label-sm text-label-sm text-muted-text">Price unavailable</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Popular Services */}
        <section>
          <div className="flex justify-between items-end mb-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Top Treatments</span>
              <h3 className="font-headline-sm text-headline-sm text-heading-text">Popular Services</h3>
            </div>
            <button onClick={() => navigate('/search')} className="font-label-sm text-label-sm text-primary hover:text-primary-dark font-semibold">
              View all
            </button>
          </div>

          <div className="flex gap-3.5 overflow-x-auto hide-scrollbar pb-1 -mx-5 px-5 sm:-mx-6 sm:px-6">
            {services.map(service => {
              const fallback = getServiceFallback(service.name);
              const imgSrc = service.image ? getImageUrl(service.image) : fallback.image;
              return (
                <div
                  key={service._id}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(service.name)}`)}
                  className="shrink-0 w-[145px] sm:w-[160px] bg-white rounded-2xl border border-border/80 shadow-sm hover:shadow-md transition-all duration-300 p-2.5 flex flex-col justify-between group cursor-pointer active:scale-[0.98]"
                >
                  <div className="h-28 w-full rounded-xl overflow-hidden relative bg-surface-container mb-2">
                    <img 
                      src={imgSrc} 
                      alt={service.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = fallback.image;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"></div>
                    <span className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      ₹{service.price}
                    </span>
                  </div>
                  <div className="px-1">
                    <h4 className="text-xs font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                      {service.name}
                    </h4>
                    <span className="text-[10px] text-muted-text flex items-center gap-1 mt-0.5">
                      <span>Explore</span>
                      <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Featured Package Deals Spotlight */}
        {featuredOffers.length > 0 && (
          <section>
            <div className="flex justify-between items-end mb-2.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Special Combos</span>
                <h3 className="font-headline-sm text-headline-sm text-heading-text">Exclusive Value Bundles</h3>
              </div>
              <button onClick={() => navigate('/offers')} className="font-label-sm text-label-sm text-primary hover:text-primary-dark font-semibold">
                View all offers
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredOffers.slice(0, 3).map((pkg) => {
                const discount = pkg.discountPercent || (pkg.totalPrice ? Math.round(((pkg.totalPrice - pkg.discountedPrice) / pkg.totalPrice) * 100) : 0);
                const savings = pkg.totalPrice && pkg.discountedPrice ? pkg.totalPrice - pkg.discountedPrice : 0;
                return (
                  <div 
                    key={pkg._id}
                    onClick={() => navigate(`/offers?salon=${pkg.salon?._id || ''}&search=${encodeURIComponent(pkg.name || '')}`)}
                    className="bg-white rounded-2xl border border-border/80 shadow-sm hover:shadow-md transition-all duration-300 p-4 flex flex-col justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-xs font-medium text-muted-text flex items-center gap-1 truncate max-w-[65%]">
                          <span className="material-symbols-outlined text-[14px] text-primary">store</span>
                          <span className="truncate">{pkg.salon?.name || 'Partner Salon'}</span>
                        </span>
                        {discount > 0 && (
                          <span className="bg-[#54238F] text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                            {discount}% OFF
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-on-surface text-[15px] group-hover:text-primary transition-colors line-clamp-1 mb-1">
                        {pkg.name}
                      </h4>

                      {pkg.services?.length > 0 && (
                        <div className="flex flex-wrap gap-1 my-2">
                          {pkg.services.slice(0, 2).map((s) => (
                            <span key={s._id} className="text-[10px] px-2 py-0.5 bg-[#F5EEFC] text-[#54238F] rounded border border-[#DEC2FF]/50 font-medium">
                              {s.name}
                            </span>
                          ))}
                          {pkg.services.length > 2 && (
                            <span className="text-[10px] px-1 py-0.5 text-muted-text font-medium">
                              +{pkg.services.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-border/60 mt-2 flex items-center justify-between">
                      <div>
                        {savings > 0 && <span className="text-[10px] text-emerald-700 font-semibold block">Save ₹{savings}</span>}
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-black text-primary">₹{pkg.discountedPrice}</span>
                          {pkg.totalPrice && <span className="text-xs text-muted-text line-through">₹{pkg.totalPrice}</span>}
                        </div>
                      </div>
                      <span className="bg-primary/10 group-hover:bg-primary group-hover:text-white text-primary text-xs font-bold px-3 py-1.5 rounded-xl transition-colors">
                        Book
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Why Book with Glentro (Trust & Quality Badges) */}
        <section className="bg-gradient-to-br from-[#FAF9FC] to-[#F3EFFC] rounded-3xl p-4 sm:p-5 border border-[#54238F]/10">
          <div className="text-center max-w-md mx-auto mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">The Glentro Promise</span>
            <h3 className="font-headline-sm text-lg sm:text-xl font-bold text-heading-text mt-0.5">Why Choose Glentro Salons</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-3.5 border border-border/60 shadow-sm text-center flex flex-col items-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                <span className="material-symbols-outlined text-[22px]">verified</span>
              </div>
              <h4 className="text-xs font-bold text-on-surface">100% Verified</h4>
              <p className="text-[10px] text-muted-text mt-0.5 leading-snug">Certified stylists & licensed salons</p>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-3.5 border border-border/60 shadow-sm text-center flex flex-col items-center">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-2">
                <span className="material-symbols-outlined text-[22px]">clean_hands</span>
              </div>
              <h4 className="text-xs font-bold text-on-surface">Sanitized Tools</h4>
              <p className="text-[10px] text-muted-text mt-0.5 leading-snug">Strict hygiene & safety protocols</p>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-3.5 border border-border/60 shadow-sm text-center flex flex-col items-center">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 mb-2">
                <span className="material-symbols-outlined text-[22px]">price_check</span>
              </div>
              <h4 className="text-xs font-bold text-on-surface">Honest Pricing</h4>
              <p className="text-[10px] text-muted-text mt-0.5 leading-snug">No surge fees or hidden costs</p>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-3.5 border border-border/60 shadow-sm text-center flex flex-col items-center">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 mb-2">
                <span className="material-symbols-outlined text-[22px]">bolt</span>
              </div>
              <h4 className="text-xs font-bold text-on-surface">Instant Slots</h4>
              <p className="text-[10px] text-muted-text mt-0.5 leading-snug">Immediate slot confirmation</p>
            </div>
          </div>
        </section>

        {/* Glentro Wallet / Refer & Earn Promotional Card */}
        <section 
          onClick={() => navigate('/profile')}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#4A1D7F] via-[#54238F] to-[#7B3FE4] text-white p-5 sm:p-6 shadow-md cursor-pointer group"
        >
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-pink-500/20 rounded-full blur-2xl pointer-events-none"></div>
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-sm">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-xs text-amber-300">account_balance_wallet</span>
                Glentro Rewards
              </span>
              <h3 className="text-lg font-extrabold text-white">Get ₹150 in Your Wallet</h3>
              <p className="text-xs text-white/85 leading-relaxed">
                Invite your friends to Glentro. They get ₹100 off, and you earn ₹150 wallet cashback on their first appointment.
              </p>
            </div>
            <button className="bg-white text-primary font-bold text-xs px-4 py-2.5 rounded-xl shadow group-hover:bg-soft-primary transition-all whitespace-nowrap active:scale-95">
              View Wallet & Rewards →
            </button>
          </div>
        </section>

        {/* Client Reviews / Social Proof */}
        <section>
          <div className="flex justify-between items-end mb-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Loved by Clients</span>
              <h3 className="font-headline-sm text-headline-sm text-heading-text">What Our Clients Say</h3>
            </div>
            <span className="text-xs text-muted-text font-medium">★ 4.8 / 5 Rating</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                name: "Ananya Sharma",
                salon: "Zazzle Salon",
                review: "Booking through Glentro was seamless. No waiting time at the salon, and the discount on the combo package was fantastic!",
                rating: 5
              },
              {
                name: "Rohan Verma",
                salon: "Toni & Guy",
                review: "The stylist was super professional. Verified salon hygiene standards give so much peace of mind.",
                rating: 5
              },
              {
                name: "Pooja Mehta",
                salon: "Bounce Salon & Spa",
                review: "Great app interface and quick slot booking. Loved the instant appointment confirmation!",
                rating: 5
              }
            ].map((r, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-border/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-2">
                    {Array.from({ length: r.rating }).map((_, starIdx) => (
                      <span key={starIdx} className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    ))}
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed italic">"{r.review}"</p>
                </div>
                <div className="pt-3 border-t border-border/50 mt-3 flex justify-between items-center text-xs">
                  <span className="font-bold text-on-surface">{r.name}</span>
                  <span className="text-[11px] text-muted-text">{r.salon}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Safe & Secure Booking Guarantee Strip */}
        <section className="border-t border-border/80 pt-6 pb-2 text-center text-muted-text text-xs space-y-2">
          <div className="flex flex-wrap justify-center items-center gap-4 text-xs font-medium text-on-surface-variant">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-primary">lock</span>
              100% Secure Payments
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-primary">support_agent</span>
              24/7 Customer Care
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-primary">payments</span>
              Pay via UPI / Card or at Salon
            </span>
          </div>
          <p className="text-[11px] text-muted-text">Glentro © 2026 • Discover & Book Premium Salons Across India</p>
        </section>

      </main>

      {/* Location Modals */}
      <LocationPermissionModal
        isOpen={isPermissionModalOpen}
        onClose={() => {
          setIsPermissionModalOpen(false);
          sessionStorage.setItem('location_prompt_dismissed', 'true');
        }}
        onSelectManually={() => {
          setIsPermissionModalOpen(false);
          sessionStorage.setItem('location_prompt_dismissed', 'true');
          setIsLocationModalOpen(true);
        }}
      />

      <LocationSelectionModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />
    </div>
  );
};

export default HomePage;
