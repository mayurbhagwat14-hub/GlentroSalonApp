import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSalons, getNearbySalons, getServices, getCategories } from '../../services/userApi';
import { useLocationContext } from '../../../../context/LocationContext';
import { goBack } from '../../../../utils/navigation';
import PageHeader from '../../../../components/common/PageHeader';
import Loader from '../../../../components/common/Loader';
import { getImageUrl } from '../../../../utils/imageUtils';
import { SalonCardSkeleton } from '../../components/skeletons/HomeSkeleton';

const SearchPage = () => {
  const { selectedLocation } = useLocationContext();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  
  const [searchQuery, setSearchQuery] = useState(q);
  const [debouncedQuery, setDebouncedQuery] = useState(q);
  
  const [suggestions, setSuggestions] = useState([]);
  const [recentSearches, setRecentSearches] = useState(() => JSON.parse(localStorage.getItem('recent_searches_user') || '[]'));
  const [trendingSearches, setTrendingSearches] = useState([]);
  const [trendingSalons, setTrendingSalons] = useState([]);
  
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState(null);
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ gender: '', rating: '' });
  
  const navigate = useNavigate();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Trending & Salons
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        let salonPromise;
        if (selectedLocation?.lat && selectedLocation?.lng) {
          salonPromise = getNearbySalons({ lat: selectedLocation.lat, lng: selectedLocation.lng, limit: 5 });
        } else {
          salonPromise = getSalons({ city: selectedLocation?.city, limit: 5 });
        }
        
        const [catRes, salonRes] = await Promise.allSettled([
          getCategories(),
          salonPromise
        ]);
        if (catRes.status === 'fulfilled' && catRes.value.data?.data) {
          setTrendingSearches(catRes.value.data.data.slice(0, 5).map(c => c.name));
        }
        if (salonRes.status === 'fulfilled' && salonRes.value.data?.data?.salons) {
          setTrendingSalons(salonRes.value.data.data.salons);
        }
      } catch (e) { console.error(e); }
    };
    loadInitialData();
  }, [selectedLocation]);

  // Fetch Suggestions
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.toLowerCase() === q.toLowerCase()) {
      setSuggestions([]);
      return;
    }
    const fetchSuggestions = async () => {
      try {
        const res = await getServices({ search: debouncedQuery, limit: 10 });
        const uniqueNames = [...new Set(res.data.data.services.map(s => s.name))].slice(0, 5);
        setSuggestions(uniqueNames);
      } catch (e) {}
    };
    fetchSuggestions();
  }, [debouncedQuery, q]);

  // Fetch Results
  useEffect(() => {
    if (!q) {
      setResults([]);
      return;
    }
    // Update input box to match URL query
    setSearchQuery(q);
    
    const fetchResults = async () => {
      setLoadingResults(true);
      setError(null);
      try {
        let res;
        const queryParams = { search: q, limit: 20 };
        if (filters.gender) queryParams.gender = filters.gender;
        if (filters.rating) queryParams.rating = filters.rating;

        if (selectedLocation?.lat && selectedLocation?.lng) {
          res = await getNearbySalons({ ...queryParams, lat: selectedLocation.lat, lng: selectedLocation.lng });
        } else {
          res = await getSalons({ ...queryParams, city: selectedLocation?.city });
        }
        setResults(res.data.data.salons);
      } catch (e) {
        setError("Unable to load search results.");
      }
      setLoadingResults(false);
    };
    fetchResults();
  }, [q, selectedLocation, filters]);

  const handleSearch = (queryToSearch) => {
    if (!queryToSearch.trim()) return;
    
    // Save to recent
    const updatedRecent = [queryToSearch, ...recentSearches.filter(s => s.toLowerCase() !== queryToSearch.toLowerCase())].slice(0, 5);
    setRecentSearches(updatedRecent);
    localStorage.setItem('recent_searches_user', JSON.stringify(updatedRecent));
    
    setSearchQuery(queryToSearch);
    setSuggestions([]);
    navigate(`/search?q=${encodeURIComponent(queryToSearch)}`);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    navigate('/search');
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent_searches_user');
  };

  return (
    <div className="animate-fade-in space-y-4 w-full px-3 sm:px-4 md:px-0 pb-20 md:pb-12 pt-1 md:pt-4">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md pb-3 pt-0 md:pt-2 md:mx-0 md:px-0">
        <div className="md:hidden"><PageHeader title="Search" fallbackPath="/" /></div>
        <div className="hidden md:block mb-4 md:mb-2">
           <h1 className="font-headline-xl text-[40px] font-bold text-on-surface leading-tight">Discover Top Salons</h1>
        </div>
        
        <div className="relative max-w-2xl md:max-w-full">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
            className="w-full bg-background-alt border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-10 font-body-md text-on-surface placeholder-outline transition-all shadow-sm"
            placeholder="Search salons, services, or categories"
            autoComplete="off"
          />
          {searchQuery && (
            <button onClick={clearSearch} className="absolute right-14 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          )}
          <button 
            onClick={() => setIsFilterOpen(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>
          
          {/* Autocomplete Dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              {suggestions.map((suggestion, idx) => (
                <div 
                  key={idx}
                  onClick={() => handleSearch(suggestion)}
                  className="px-4 py-3 hover:bg-surface-variant cursor-pointer flex items-center gap-3 border-b border-border/50 last:border-0"
                >
                  <span className="material-symbols-outlined text-outline text-sm">search</span>
                  <span className="font-body-md text-on-surface">{suggestion}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {!q ? (
        <>
          {/* Initial State */}
          {trendingSearches.length > 0 && (
            <section className="space-y-4 w-full">
              <h2 className="font-headline-sm text-[20px] font-semibold text-on-surface">Trending Searches</h2>
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map(tag => (
                  <button 
                    key={tag}
                    onClick={() => handleSearch(tag)}
                    className="px-4 py-2 rounded-full bg-soft-primary text-primary font-label-md text-[14px] font-medium hover:bg-primary hover:text-white transition-colors shadow-sm"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </section>
          )}

          {recentSearches.length > 0 && (
            <section className="space-y-4 w-full">
              <div className="flex justify-between items-center">
                <h2 className="font-headline-sm text-[20px] font-semibold text-on-surface">Recent Searches</h2>
                <button onClick={clearRecent} className="font-label-sm text-[12px] font-medium text-primary hover:underline">Clear All</button>
              </div>
              <div className="flex flex-col gap-1">
                {recentSearches.map(recent => (
                  <div 
                    key={recent}
                    onClick={() => handleSearch(recent)}
                    className="flex items-center justify-between py-3 border-b border-border/50 hover:bg-surface-variant/30 px-2 rounded-lg transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <span className="material-symbols-outlined text-outline group-hover:text-primary">history</span>
                      <span className="font-body-md text-on-surface-variant group-hover:text-on-surface">{recent}</span>
                    </div>
                    <span className="material-symbols-outlined text-outline/50 group-hover:text-on-surface-variant text-sm">north_west</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {trendingSalons.length > 0 && (
            <section className="space-y-4 w-full overflow-hidden mt-8">
              <div className="flex justify-between items-center">
                <h2 className="font-headline-sm text-[20px] font-semibold text-on-surface">Trending Salons</h2>
                <button onClick={() => navigate('/salons')} className="font-label-sm text-[12px] font-medium text-primary hover:underline hidden md:block">View All</button>
              </div>
              <div className="flex overflow-x-auto gap-4 pb-4 px-4 md:px-0 snap-x hide-scrollbar">
                {trendingSalons.map(salon => (
                  <div 
                    key={salon._id}
                    onClick={() => navigate(`/salon/${salon._id}`)}
                    className="flex-none w-64 bg-surface rounded-[18px] border border-border shadow-sm overflow-hidden snap-start hover:shadow-md transition-all duration-300 cursor-pointer group"
                  >
                  <div className="h-32 w-full relative overflow-hidden bg-surface-variant">
                    <img 
                      src={salon.images?.[0] ? getImageUrl(salon.images[0]) : "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80"}
                      alt={salon.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://images.unsplash.com/photo-1521590832167-7bfcfaa6362f?auto=format&fit=crop&w=600&q=80";
                      }}
                    />
                      {salon.ratings?.average > 0 && (
                        <div className="absolute top-2 right-2 bg-surface/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm flex items-center gap-1">
                          <span className="material-symbols-outlined text-rating text-[12px]" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                          <span className="font-label-sm text-[12px] font-bold text-on-surface">{salon.ratings.average.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-1 flex flex-col">
                      <h3 className="font-headline-sm text-[18px] font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{salon.name}</h3>
                      <p className="font-body-sm text-[14px] text-muted-text flex items-center gap-1 truncate">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                        {salon.address}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="space-y-4 w-full pt-2">
          <h2 className="font-headline-sm text-[20px] font-semibold text-on-surface">Search Results</h2>
          
          {loadingResults ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SalonCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-surface rounded-2xl border border-border">
               <div className="text-4xl mb-4 text-error">
                 <span className="material-symbols-outlined text-[40px]">error</span>
               </div>
               <h3 className="font-headline-sm text-[18px] mb-2">{error}</h3>
               <button onClick={() => handleSearch(q)} className="text-primary font-label-md hover:underline">Try Again</button>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16 bg-surface rounded-2xl border border-border shadow-sm">
              <div className="text-5xl mb-4 text-primary">
                <span className="material-symbols-outlined text-[48px]">storefront</span>
              </div>
              <h3 className="font-headline-sm text-[20px] text-on-surface mb-1">No salons found</h3>
              <p className="font-body-sm text-[14px] text-muted-text mb-4">Sorry, we couldn't find salons offering "{q}".</p>
              <div className="flex gap-3 justify-center">
                <button onClick={clearSearch} className="px-4 py-2 bg-surface border border-border text-on-surface rounded-xl font-label-md hover:bg-surface-variant transition-colors">Clear Search</button>
                <button onClick={() => navigate('/salons')} className="px-4 py-2 bg-primary text-white rounded-xl font-label-md hover:bg-primary-dark transition-colors">Explore Salons</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {results.map(salon => (
                <div 
                  key={salon._id} 
                  onClick={() => navigate(`/salon/${salon._id}`)}
                  className="bg-surface rounded-[18px] border border-border shadow-sm overflow-hidden flex flex-col cursor-pointer group hover:shadow-md transition-all duration-300 active:scale-[0.98]"
                >
                  <div className="h-40 w-full relative overflow-hidden bg-surface-variant">
                    <img 
                      src={salon.images?.[0] ? getImageUrl(salon.images[0]) : "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80"} 
                      alt={salon.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://images.unsplash.com/photo-1521590832167-7bfcfaa6362f?auto=format&fit=crop&w=600&q=80";
                      }}
                    />
                    {salon.ratings?.average > 0 && (
                      <div className="absolute top-3 right-3 bg-surface/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                        <span className="material-symbols-outlined text-rating text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                        <span className="font-label-sm text-[12px] font-bold text-on-surface">{salon.ratings.average.toFixed(1)}</span>
                      </div>
                    )}
                    {salon.gender && (
                      <div className="absolute top-3 left-3 bg-primary/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm">
                        <span className="font-label-sm text-[10px] uppercase font-bold text-white tracking-wider">{salon.gender}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-headline-sm text-[18px] text-on-surface group-hover:text-primary transition-colors line-clamp-1">{salon.name}</h3>
                    <p className="font-body-sm text-[14px] text-muted-text mt-1 flex items-center gap-1 line-clamp-1">
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      {salon.address}
                    </p>
                    
                    <div className="mt-auto pt-3 flex items-center justify-between border-t border-border mt-3">
                      <div className="flex items-center gap-1 text-muted-text">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        <span className="font-body-sm text-[12px]">{salon.openingTime} - {salon.closingTime}</span>
                      </div>
                      <span className="font-label-md text-[14px] text-primary bg-soft-primary px-2 py-1 rounded-lg">{salon.city}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Filter Bottom Sheet */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)}></div>
          <div className="bg-surface w-full sm:w-[400px] rounded-t-3xl sm:rounded-3xl p-6 relative z-10 animate-slide-up sm:animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline-sm text-[20px] font-semibold">Filter Results</h3>
              <button onClick={() => setIsFilterOpen(false)} className="w-8 h-8 flex items-center justify-center bg-surface-variant rounded-full text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-label-md text-on-surface mb-3">Gender</h4>
                <div className="flex gap-3">
                  {['unisex', 'female', 'male'].map(g => (
                    <button 
                      key={g}
                      onClick={() => setFilters({ ...filters, gender: filters.gender === g ? '' : g })}
                      className={`flex-1 py-2 rounded-xl font-label-md capitalize border transition-colors ${filters.gender === g ? 'bg-primary text-white border-primary' : 'bg-surface-variant text-on-surface border-border hover:border-primary/50'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-label-md text-on-surface mb-3">Minimum Rating</h4>
                <div className="flex gap-3">
                  {[4.5, 4.0, 3.0].map(r => (
                    <button 
                      key={r}
                      onClick={() => setFilters({ ...filters, rating: filters.rating === r ? '' : r })}
                      className={`flex-1 py-2 rounded-xl font-label-md border flex justify-center items-center gap-1 transition-colors ${filters.rating === r ? 'bg-primary text-white border-primary' : 'bg-surface-variant text-on-surface border-border hover:border-primary/50'}`}
                    >
                      {r}+ <span className="material-symbols-outlined text-[14px]">star</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => { setFilters({ gender: '', rating: '' }); setIsFilterOpen(false); }}
                className="flex-1 py-3.5 bg-surface-variant text-on-surface font-label-md rounded-xl hover:bg-border transition-colors"
              >
                Reset
              </button>
              <button 
                onClick={() => setIsFilterOpen(false)}
                className="flex-[2] py-3.5 bg-primary text-white font-label-md rounded-xl shadow-[0_4px_12px_rgba(84,35,143,0.3)] hover:bg-primary/90 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
