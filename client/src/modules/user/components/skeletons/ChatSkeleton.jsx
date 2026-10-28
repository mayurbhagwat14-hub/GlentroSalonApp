import React from 'react';
import { Skeleton, SkeletonText, SkeletonAvatar } from '../../../../components/common/Skeleton';

export const ChatSkeleton = () => {
  return (
    <div className="flex flex-col h-[calc(100dvh-72px-env(safe-area-inset-bottom))] md:h-[calc(100vh-120px)] animate-fade-in max-w-4xl mx-auto w-full bg-white sm:rounded-2xl shadow-sm sm:border border-slate-100 overflow-hidden">
      {/* Header Skeleton */}
      <div className="flex items-center gap-4 p-4 pt-[max(1.25rem,calc(env(safe-area-inset-top,0px)+0.75rem))] border-b border-slate-100 bg-white sticky top-0 z-10">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="flex flex-col gap-1">
          <SkeletonText lines={1} className="w-32" lineClassName="h-5" />
          <SkeletonText lines={1} className="w-24" lineClassName="h-3" />
        </div>
      </div>

      {/* Messages Skeleton */}
      <div className="flex-1 overflow-y-auto space-y-4 py-4 px-2">
        <div className="flex justify-start">
          <Skeleton className="w-2/3 h-16 rounded-2xl rounded-bl-md" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="w-1/2 h-12 rounded-2xl rounded-br-md" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="w-3/4 h-20 rounded-2xl rounded-bl-md" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="w-1/3 h-10 rounded-2xl rounded-br-md" />
        </div>
      </div>

      {/* Input Skeleton */}
      <div className="border-t border-gray-100 bg-white p-3 flex gap-2 rounded-t-2xl">
        <Skeleton className="flex-1 h-12 rounded-xl" />
        <Skeleton className="w-20 h-12 rounded-xl" />
      </div>
    </div>
  );
};

export const ChatListSkeleton = () => {
  return (
    <div className="animate-fade-in space-y-4 max-w-4xl mx-auto px-4 md:px-margin-desktop w-full pb-[100px] pt-4">
      <SkeletonText lines={1} className="w-32 mb-6 hidden md:block" lineClassName="h-8" />
      
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50 shadow-sm">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 flex gap-4 items-center">
            <SkeletonAvatar size="w-12 h-12" className="shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="flex justify-between items-start">
                <SkeletonText lines={1} className="w-32" lineClassName="h-5" />
                <SkeletonText lines={1} className="w-16" lineClassName="h-3" />
              </div>
              <SkeletonText lines={1} className="w-3/4" lineClassName="h-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
