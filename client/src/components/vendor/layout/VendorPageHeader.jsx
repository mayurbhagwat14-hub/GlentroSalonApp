import React from 'react';

const VendorPageHeader = ({ title, description, actions, className = '' }) => {
  return (
    <div className={`shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 mb-2.5 sm:mb-4 ${className}`}>
      <div>
        <h1 className="font-headline-md text-[20px] sm:text-[24px] lg:text-[28px] text-on-surface font-bold leading-tight">{title}</h1>
        {description && <p className="font-body-sm text-xs sm:text-sm text-muted-text mt-0.5 sm:mt-1">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};
export default VendorPageHeader;
