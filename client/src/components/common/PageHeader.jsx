import { useLocation, useNavigate } from 'react-router-dom';
import { goBack } from '../../utils/navigation';

const PageHeader = ({ title, fallbackPath = '/', onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    
    // Explicit source-aware navigation for security and exact routing
    if (location.state?.from === '/login' || location.state?.from === '/register') {
      navigate(location.state.from);
      return;
    }
    
    goBack(navigate, fallbackPath);
  };

  return (
    <div className="flex items-center gap-3 pt-[max(0.875rem,env(safe-area-inset-top,14px))] pb-2.5 md:hidden">
      <button 
        onClick={handleBack} 
        className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors -ml-3 text-on-surface"
        aria-label="Go back"
      >
        <span className="material-symbols-outlined text-[24px]">arrow_back</span>
      </button>
      <h1 className="font-headline-sm text-[20px] md:text-[24px] text-on-surface font-semibold truncate flex-1">{title}</h1>
    </div>
  );
};

export default PageHeader;
