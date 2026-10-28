import React from 'react';
import { Skeleton, SkeletonImage, SkeletonText, SkeletonAvatar, SkeletonButton } from '../../../../components/common/Skeleton';

export const SalonCardSkeleton = () => {
  return (
    <div className="bg-surface rounded-2xl overflow-hidden border border-border shadow-sm flex flex-col h-[280px]">
      <SkeletonImage className="h-[160px] w-full" rounded="rounded-none" />
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1">
          <SkeletonText lines={1} className="w-3/4" lineClassName="h-5" />
          <Skeleton className="w-8 h-5 rounded-md" />
        </div>
        <SkeletonText lines={1} className="w-1/2 mb-2" lineClassName="h-3.5" />
        <div className="mt-auto flex items-center gap-2">
          <Skeleton className="w-16 h-5 rounded-md" />
          <Skeleton className="w-16 h-5 rounded-md" />
        </div>
      </div>
    </div>
  );
};

export const HomeSkeleton = () => {
  return (
    <div className="animate-fade-in space-y-6 w-full">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md pb-4 pt-[max(1.25rem,calc(env(safe-area-inset-top,0px)+0.75rem))] md:pt-4 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col gap-2">
            <SkeletonText lines={1} lineClassName="h-5 w-48" />
            <SkeletonText lines={1} lineClassName="h-4 w-32" />
          </div>
          <SkeletonAvatar size="w-10 h-10" />
        </div>

        {/* Search Bar Skeleton */}
        <Skeleton className="w-full h-12 rounded-2xl" />
      </header>

      {/* Banner Skeleton */}
      <SkeletonImage className="w-full h-[160px]" />

      {/* Categories Skeleton */}
      <section className="-mx-4 md:mx-0">
        <div className="flex overflow-x-auto gap-4 px-4 pb-2 hide-scrollbar">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <SkeletonAvatar size="w-[60px] h-[60px]" />
              <SkeletonText lines={1} className="w-12" lineClassName="h-3" />
            </div>
          ))}
        </div>
      </section>

      {/* Popular Salons Skeleton */}
      <section className="-mx-4 md:mx-0">
        <div className="px-4 flex justify-between items-end mb-4">
          <SkeletonText lines={1} className="w-32" lineClassName="h-6" />
        </div>
        <div className="flex overflow-x-auto gap-4 px-4 pb-4 hide-scrollbar">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-[280px] shrink-0">
              <SalonCardSkeleton />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
