import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { getPackages, getSalons, getCategories } from '../../services/userApi';
import { useLocationContext } from '../../../../context/LocationContext';
import { goBack } from '../../../../utils/navigation';
import { getImageUrl } from '../../../../utils/imageUtils';
import { SkeletonText } from '../../../../components/common/Skeleton';
import toast from 'react-hot-toast';
import { formatPaise } from '../../../../utils/money';

const OffersPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromProfile = location.state?.fromProfile;
  const [searchParams] = useSearchParams();
  const { selectedLocation } = useLocationContext();

  const initialSalon = searchParams.get('salon') || '';
  const initialSearch = searchParams.get('search') || '';

  // State for data
  const [offers, setOffers] = useState([]);
  const [salons, setSalons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedSalon, setSelectedSalon] = useState(initialSalon);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minDiscount, setMinDiscount] = useState('');
  const [sortOption, setSortOption] = useState('recommended');
  
  // Responsive filter visibility
  const [isFilterExpanded, setIsFilterExpanded] = useState(!!initialSalon);

  // Fetch initial dropdown items (Salons and Categories)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [salonsRes, categoriesRes] = await Promise.all([
          getSalons({ limit: 100 }).catch(() => ({ data: { data: { salons: [] } } })),
          getCategories().catch(() => ({ data: { data: [] } }))
        ]);
        setSalons(salonsRes.data?.data?.salons || []);
        setCategories(categoriesRes.data?.data || []);
      } catch (err) {
        console.error('Failed to load filter metadata', err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch Offers based on filters, search, and sorting
  useEffect(() => {
    loadOffers();
  }, [
    selectedLocation,
    selectedSalon,
    selectedCategory,
    selectedGender,
    minPrice,
    maxPrice,
    minDiscount,
    sortOption,
    searchQuery
  ]);

  const loadOffers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        checkValidity: 'true',
        status: 'ACTIVE',
        isActive: 'true',
        page: 1,
        limit: 50
      };

      if (searchQuery.trim()) params.search = searchQuery;
      if (selectedSalon) params.salon = selectedSalon;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedGender) params.gender = selectedGender;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (minDiscount) params.minDiscount = minDiscount;
      
      // Pass location parameters if selected
      if (selectedLocation?.lat && selectedLocation?.lng) {
        params.lat = selectedLocation.lat;
        params.lng = selectedLocation.lng;
      } else if (selectedLocation?.city) {
        params.city = selectedLocation.city;
      }

      params.sort = sortOption;

      const res = await getPackages(params);
      let fetched = res.data?.data?.packages || [];

      // Smart Fallback: if city has 0 packages, fetch nationwide active packages so screen isn't blank
      if (fetched.length === 0 && (params.lat || params.city)) {
        const fallbackParams = { ...params };
        delete fallbackParams.lat;
        delete fallbackParams.lng;
        delete fallbackParams.city;
        const fallbackRes = await getPackages(fallbackParams).catch(() => ({ data: { data: { packages: [] } } }));
        fetched = fallbackRes.data?.data?.packages || [];
      }

      setOffers(fetched);
    } catch (err) {
      console.error(err);
      setError('Unable to load offers at this time. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSelectedSalon('');
    setSelectedCategory('');
    setSelectedGender('');
    setMinPrice('');
    setMaxPrice('');
    setMinDiscount('');
    setSortOption('recommended');
    setSearchQuery('');
    toast.success('Filters cleared');
  };

  const handleBookOffer = (pkg) => {
    if (!pkg.salon?._id) return;
    navigate(`/salon/${pkg.salon._id}/book`, {
      state: {
        salon: pkg.salon,
        selectedServices: pkg.services,
        packageId: pkg._id,
        packageDoc: pkg
      }
    });
  };

  const hasActiveFilters = Boolean(
    selectedSalon || selectedCategory || selectedGender || minPrice || maxPrice || minDiscount || searchQuery
  );

  return (
    <div className="animate-fade-in space-y-5 w-full px-4 md:px-0 pb-[120px] md:pb-14 pt-2 min-h-screen bg-background">
      
      {/* Sleek Professional Hero Header Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4A1D7F] via-[#54238F] to-[#6D3EA8] text-white p-5 sm:p-6 shadow-sm">
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button 
                onClick={() => goBack(navigate, '/')} 
                className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-full border border-white/15 text-white cursor-pointer"
                aria-label="Go back"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </button>
              {fromProfile && (
                <button 
                  onClick={() => navigate(-1)} 
                  className="hidden md:flex w-9 h-9 items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-full border border-white/15 text-white cursor-pointer"
                  aria-label="Go back"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
              )}
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-semibold tracking-wider uppercase text-white/90">
                Exclusive Offers
              </span>
            </div>

            {offers.length > 0 && (
              <span className="text-xs text-white/80 bg-white/10 px-3 py-1 rounded-full border border-white/15 font-medium">
                {offers.length} Deals Available
              </span>
            )}
          </div>

          <div className="max-w-xl space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Exclusive Salon Packages
            </h1>
            <p className="text-xs sm:text-sm text-white/80 leading-relaxed font-normal">
              Curated beauty and wellness bundles from verified top-rated salons.
            </p>
          </div>
        </div>
      </section>

      {/* Clean Professional Category & Gender Pills */}
      <section className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => { setSelectedCategory(''); setSelectedGender(''); }}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer ${
            !selectedCategory && !selectedGender
              ? 'bg-[#54238F] text-white shadow-sm'
              : 'bg-white hover:bg-surface-variant text-on-surface border border-border/80'
          }`}
        >
          All
        </button>

        {/* Gender Filters */}
        {[
          { id: 'unisex', label: 'Unisex' },
          { id: 'female', label: 'Women' },
          { id: 'male', label: 'Men' }
        ].map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedGender(selectedGender === g.id ? '' : g.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer ${
              selectedGender === g.id
                ? 'bg-[#54238F] text-white shadow-sm'
                : 'bg-white hover:bg-surface-variant text-on-surface border border-border/80'
            }`}
          >
            {g.label}
          </button>
        ))}

        {/* Category Pills */}
        {categories.map((c) => (
          <button
            key={c._id}
            onClick={() => setSelectedCategory(selectedCategory === c._id ? '' : c._id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer ${
              selectedCategory === c._id
                ? 'bg-[#54238F] text-white shadow-sm'
                : 'bg-white hover:bg-surface-variant text-on-surface border border-border/80'
            }`}
          >
            {c.name}
          </button>
        ))}
      </section>

      {/* Search & Advanced Filters Bar */}
      <section className="bg-white rounded-2xl p-3.5 border border-border/80 shadow-sm flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Input */}
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text text-[18px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by package, service or salon name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/80 text-sm bg-background-alt text-on-surface placeholder:text-muted-text focus:outline-none focus:border-[#54238F] focus:ring-1 focus:ring-[#54238F] transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                isFilterExpanded || hasActiveFilters
                  ? 'bg-[#54238F] text-white border-[#54238F]' 
                  : 'bg-white text-on-surface border-border hover:bg-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400"></span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2.5 text-error bg-error/10 hover:bg-error/20 border border-error/20 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                title="Reset all filters"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {isFilterExpanded && (
          <div className="pt-3 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
            {/* Salon Filter */}
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-1">Salon</label>
              <select
                value={selectedSalon}
                onChange={(e) => setSelectedSalon(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border text-xs bg-background-alt text-on-surface focus:outline-none focus:border-[#54238F]"
              >
                <option value="">All Salons</option>
                {salons.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border text-xs bg-background-alt text-on-surface focus:outline-none focus:border-[#54238F]"
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>

            {/* Minimum Discount Filter */}
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-1">Discount</label>
              <select
                value={minDiscount}
                onChange={(e) => setMinDiscount(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border text-xs bg-background-alt text-on-surface focus:outline-none focus:border-[#54238F]"
              >
                <option value="">Any</option>
                <option value="15">15%+ Off</option>
                <option value="25">25%+ Off</option>
                <option value="35">35%+ Off</option>
                <option value="50">50%+ Off</option>
              </select>
            </div>

            {/* Price Range Filter */}
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-1">Price Range (₹)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border text-xs bg-background-alt text-on-surface focus:outline-none focus:border-[#54238F]"
                />
                <span className="text-muted-text text-xs">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border text-xs bg-background-alt text-on-surface focus:outline-none focus:border-[#54238F]"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Sorting bar & Location status */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 px-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-text">
          <span className="material-symbols-outlined text-[16px] text-[#54238F]">location_on</span>
          <span className="truncate max-w-xs sm:max-w-md">
            {selectedLocation?.formattedAddress 
              ? `Near ${selectedLocation.formattedAddress}` 
              : 'Showing active deals'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs ml-auto sm:ml-0">
          <label className="font-medium text-muted-text shrink-0">Sort By:</label>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-white text-on-surface font-medium text-xs focus:outline-none focus:border-[#54238F] cursor-pointer"
          >
            <option value="recommended">Recommended</option>
            <option value="discount_high">Highest Discount</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="rating_high">Top Rated</option>
            {selectedLocation?.lat && <option value="nearest">Nearest</option>}
          </select>
        </div>
      </section>

      {/* Dynamic Offers Grid */}
      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-border shadow-sm flex flex-col gap-3 animate-pulse h-[350px]">
              <div className="h-40 bg-surface-container rounded-xl w-full"></div>
              <SkeletonText lines={2} className="w-full mt-2" lineClassName="h-4" />
              <div className="flex justify-between items-center mt-auto pt-3 border-t border-border/50">
                <SkeletonText lines={1} className="w-1/3" lineClassName="h-6" />
                <div className="h-9 bg-surface-container rounded-xl w-24"></div>
              </div>
            </div>
          ))
        ) : error ? (
          <div className="col-span-full py-16 text-center bg-white border border-border rounded-2xl p-6 flex flex-col items-center max-w-lg mx-auto shadow-sm">
            <span className="material-symbols-outlined text-4xl text-error mb-2">error</span>
            <p className="font-semibold text-on-surface text-base">{error}</p>
            <button 
              onClick={loadOffers}
              className="mt-4 px-4 py-2 bg-[#54238F] text-white text-xs font-semibold rounded-xl hover:bg-[#4A1D7F] transition-all cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : offers.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white border border-dashed border-border rounded-2xl flex flex-col items-center max-w-lg mx-auto p-8 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#F5EEFC] flex items-center justify-center text-[#54238F] mb-3">
              <span className="material-symbols-outlined text-[32px]">local_offer</span>
            </div>
            <p className="font-bold text-on-surface text-lg">No Offers Found</p>
            <p className="text-xs text-muted-text mt-1 max-w-xs leading-relaxed">
              No packages found matching your current filters. Try resetting your search.
            </p>
            <button 
              onClick={handleClearFilters}
              className="mt-5 px-5 py-2.5 bg-[#54238F] hover:bg-[#4A1D7F] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          offers.map(p => {
            const daysLeft = p.validTo ? Math.ceil((new Date(p.validTo) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            
            const savingsAmount = p.totalPrice && p.discountedPrice 
              ? Math.max(0, p.totalPrice - p.discountedPrice) 
              : 0;

            const discount = p.discountPercent || (p.totalPrice ? Math.round(((p.totalPrice - p.discountedPrice) / p.totalPrice) * 100) : 0);

            return (
              <div 
                key={p._id} 
                className="bg-white rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden group relative"
              >
                {/* Visual Image Header */}
                <div className="h-40 w-full relative overflow-hidden bg-surface-container shrink-0">
                  <img
                    src={p.image ? getImageUrl(p.image) : (p.salon?.images?.[0] ? getImageUrl(p.salon.images[0]) : "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80")}
                    alt={p.name}
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80";
                    }}
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none"></div>

                  {/* Discount Badge */}
                  {discount > 0 && (
                    <div className="absolute top-3 left-3 bg-[#54238F] text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-md z-10 tracking-wide uppercase">
                      {discount}% OFF
                    </div>
                  )}

                  {/* Urgency Badge */}
                  {daysLeft !== null && daysLeft <= 5 && daysLeft >= 0 && (
                    <div className="absolute top-3 right-3 bg-amber-600/95 text-white text-[10px] font-medium px-2 py-0.5 rounded shadow">
                      {daysLeft === 0 ? 'Ends Today' : `${daysLeft}d left`}
                    </div>
                  )}

                  {/* Salon Tag on Image */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex justify-between items-center text-white text-xs z-10">
                    <span className="bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md flex items-center gap-1 font-medium truncate max-w-[70%] text-[11px]">
                      <span className="material-symbols-outlined text-[13px]">store</span>
                      <span className="truncate">{p.salon?.name || 'Salon'}</span>
                    </span>

                    {p.salon?.ratings?.average > 0 && (
                      <span className="bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-0.5 font-bold text-amber-300 text-[11px] shrink-0">
                        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span>{p.salon.ratings.average.toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    {/* Package Title */}
                    <h3 className="font-bold text-on-surface text-[15px] group-hover:text-[#54238F] transition-colors line-clamp-1">
                      {p.name}
                    </h3>
                    
                    {/* Description */}
                    {p.description && (
                      <p className="text-xs text-muted-text line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                    )}

                    {/* Included Services Tags */}
                    {p.services?.length > 0 && (
                      <div className="pt-1">
                        <div className="flex flex-wrap gap-1 max-h-[48px] overflow-hidden">
                          {p.services.slice(0, 3).map(s => (
                            <span 
                              key={s._id} 
                              className="text-[10px] font-medium px-2 py-0.5 bg-surface-container-low text-on-surface-variant border border-border/60 rounded"
                            >
                              {s.name}
                            </span>
                          ))}
                          {p.services.length > 3 && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 text-muted-text">
                              +{p.services.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pricing and Book action row */}
                  <div className="pt-3 border-t border-border mt-3 flex items-end justify-between">
                    <div className="flex flex-col">
                      {savingsAmount > 0 && (
                        <span className="text-[10px] font-medium text-emerald-700">
                          Save ₹{savingsAmount}
                        </span>
                      )}
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-bold text-[#54238F]">
                          {formatPaise(p.discountedPricePaise, p.discountedPrice)}
                        </span>
                        {p.totalPrice && (
                          <span className="text-xs text-muted-text line-through">
                            {formatPaise(p.totalPricePaise, p.totalPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleBookOffer(p)}
                      className="bg-[#54238F] hover:bg-[#4A1D7F] text-white font-medium text-xs px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1 active:scale-95 shrink-0 cursor-pointer"
                    >
                      <span>Book</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
};

export default OffersPage;
