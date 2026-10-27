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
    <div className="flex items-center gap-2 pt-2 pb-1 md:hidden">
      <button 
        onClick={handleBack} 
        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors -ml-1 text-on-surface"
        aria-label="Go back"
      >
        <span className="material-symbols-outlined text-[22px]">arrow_back</span>
      </button>
      <h1 className="font-headline-sm text-[18px] md:text-[22px] text-on-surface font-semibold truncate flex-1">{title}</h1>
    </div>
  );
};

export default PageHeader;
