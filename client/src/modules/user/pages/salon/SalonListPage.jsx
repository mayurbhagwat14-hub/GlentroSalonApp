import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSalons, getNearbySalons, getCategories } from '../../services/userApi';
import { useLocationContext } from '../../../../context/LocationContext';
import { goBack } from '../../../../utils/navigation';
import Loader from '../../../../components/common/Loader';
import { getImageUrl } from '../../../../utils/imageUtils';
import SalonMapView from '../../../../components/common/SalonMapView';
import { SalonCardSkeleton } from '../../components/skeletons/HomeSkeleton';

const SalonListPage = () => {
  const [salons, setSalons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || '';
  const searchParam = searchParams.get('search') || '';
  
  const [filters, setFilters] = useState({ search: searchParam, gender: '', category: categoryParam });
  const { selectedLocation } = useLocationContext();
  const navigate = useNavigate();

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadSalons(); }, [filters, searchParams, selectedLocation]);

  const loadCategories = async () => {
    try { const res = await getCategories(); setCategories(res.data.data); } catch (e) {}
  };

  const loadSalons = async (customLocation = null) => {
    setLoading(true);
    try {
      const activeFilters = { ...filters, search: searchParams.get('search') || filters.search, category: searchParams.get('category') || filters.category };
      
      let params = { limit: 50, ...Object.fromEntries(Object.entries(activeFilters).filter(([_, v]) => v)) };
      let res;
      
      const loc = customLocation || selectedLocation;

      if (loc?.lat && loc?.lng) {
        params = { ...params, lat: loc.lat, lng: loc.lng };
        res = await getNearbySalons(params);
        
        // Smart Fallback
        if (res.data.data.salons.length === 0 && !customLocation) {
          const fallbackParams = { limit: 50, category: params.category, search: params.search };
          res = await getSalons(fallbackParams);
        }
      } else {
        if (loc?.city) params.city = loc.city;
        res = await getSalons(params);
      }
      
      setSalons(res.data.data.salons || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleMapMove = (lat, lng) => {
    // When map moves, fetch salons around the new center
    loadSalons({ lat, lng });
  };

  const currentCategoryName = categories.find(c => c._id === filters.category)?.name || (searchParams.get('search') ? `Search: ${searchParams.get('search')}` : 'All Salons');

  return (
    <div className="animate-fade-in min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md shadow-sm pt-[max(1.25rem,calc(env(safe-area-inset-top,0px)+0.75rem))] md:pt-2">
        <div className="flex justify-between items-center px-4 md:px-0 h-16 md:h-12 w-full">
          <button onClick={() => goBack(navigate, '/')} className="md:hidden p-2 text-on-surface-variant hover:bg-soft-primary transition-colors rounded-full active:scale-95 duration-150 -ml-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline-md text-[24px] text-primary flex-1 text-center md:text-left truncate px-2 md:px-0">{currentCategoryName}</h1>
          <button onClick={() => navigate('/search')} className="p-2 text-on-surface-variant hover:bg-soft-primary transition-colors rounded-full active:scale-95 duration-150">
            <span className="material-symbols-outlined">search</span>
          </button>
        </div>
        
        {/* Category/Filter Pills and View Toggle */}
        <div className="flex justify-between items-center px-4 md:px-0 py-3 md:py-2 border-t border-border md:border-transparent">
          <div className="flex gap-3 overflow-x-auto whitespace-nowrap hide-scrollbar flex-1 pr-4">
            <button 
              onClick={() => { navigate('/salons'); setFilters({...filters, category: ''}) }}
              className={`px-4 py-2 rounded-full font-label-md text-[14px] transition-colors shrink-0 ${!filters.category && !searchParams.get('search') ? 'bg-primary text-white shadow-sm' : 'bg-soft-primary text-primary hover:bg-primary-container hover:text-white'}`}
            >
              All
            </button>
            {categories.map(cat => (
              <button 
                key={cat._id}
                onClick={() => { navigate(`/salons?category=${cat._id}`); setFilters({...filters, category: cat._id, search: ''}) }}
                className={`px-4 py-2 rounded-full font-label-md text-[14px] transition-colors shrink-0 ${filters.category === cat._id ? 'bg-primary text-white shadow-sm' : 'bg-soft-primary text-primary hover:bg-primary-container hover:text-white'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          
          <div className="flex bg-surface-variant rounded-lg p-1 shrink-0 ml-2">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-[20px] mr-1">list</span>
              <span className="text-[12px] hidden sm:block">List</span>
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-md flex items-center justify-center transition-colors ${viewMode === 'map' ? 'bg-white shadow-sm text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-[20px] mr-1">map</span>
              <span className="text-[12px] hidden sm:block">Map</span>
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-0 py-6 md:py-4 space-y-6 md:space-y-4">
        {viewMode === 'map' ? (
          <div className="w-full h-[60vh] sm:h-[70vh] rounded-2xl overflow-hidden shadow-sm">
            <SalonMapView 
              salons={salons} 
              centerLocation={selectedLocation} 
              onMapMove={handleMapMove}
            />
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SalonCardSkeleton key={i} />
            ))}
          </div>
        ) : salons.length === 0 ? (
          <div className="text-center py-16 bg-surface rounded-2xl border border-border shadow-sm">
            <div className="text-5xl mb-4 text-primary">
              <span className="material-symbols-outlined text-[48px]">storefront</span>
            </div>
            <h3 className="font-headline-sm text-[20px] text-on-surface mb-1">No salons found</h3>
            <p className="font-body-sm text-[14px] text-muted-text">Try a different category or search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {salons.map(salon => (
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
                  {/* Rating Badge */}
                  {salon.ratings?.average > 0 && (
                    <div className="absolute top-3 right-3 bg-surface/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                      <span className="material-symbols-outlined text-rating text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                      <span className="font-label-sm text-[12px] font-bold text-on-surface">{salon.ratings.average.toFixed(1)}</span>
                    </div>
                  )}
                  {/* Gender Tag */}
                  <div className="absolute top-3 left-3 bg-primary/90 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <span className="font-label-sm text-[10px] uppercase font-bold text-white tracking-wider">{salon.gender}</span>
                  </div>
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
      </main>
    </div>
  );
};

export default SalonListPage;
