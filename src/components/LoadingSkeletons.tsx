'use client';
import React from 'react';

// Generic skeleton component
export const Skeleton: React.FC<{ className?: string }> = React.memo(({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
));
Skeleton.displayName = 'Skeleton';


// Cart item skeleton
export const CartItemSkeleton: React.FC = React.memo(() => (
  <div className="flex gap-4 p-4 bg-white rounded-lg border border-slate-200">
    <Skeleton className="w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-md" />
    <div className="grow space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-6 w-1/4" />
      <div className="pt-4">
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  </div>
));
CartItemSkeleton.displayName = 'CartItemSkeleton';

// Cart loading skeleton (multiple items)
export const CartSkeleton: React.FC<{ count?: number }> = React.memo(({ count = 2 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <CartItemSkeleton key={i} />
    ))}
    <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
      <Skeleton className="h-8 w-1/2" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-16 w-full" />
    </div>
  </div>
));
CartSkeleton.displayName = 'CartSkeleton';

// Order card skeleton
export const OrderCardSkeleton: React.FC = React.memo(() => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="text-right space-y-2">
        <Skeleton className="h-6 w-20 ml-auto" />
        <Skeleton className="h-4 w-12 ml-auto" />
      </div>
    </div>
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-4">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="w-5 h-5" />
    </div>
  </div>
));
OrderCardSkeleton.displayName = 'OrderCardSkeleton';


// Orders list skeleton
export const OrdersSkeleton: React.FC<{ count?: number }> = React.memo(({ count = 3 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <OrderCardSkeleton key={i} />
    ))}
  </div>
));
OrdersSkeleton.displayName = 'OrdersSkeleton';

// Address card skeleton
export const AddressCardSkeleton: React.FC = React.memo(() => (
  <div className="relative p-5 bg-white rounded-xl border-2 border-slate-200">
    <div className="flex items-start gap-4">
      <Skeleton className="w-6 h-6 rounded-full" />
      <div className="grow space-y-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
    <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-7 w-20" />
    </div>
  </div>
));
AddressCardSkeleton.displayName = 'AddressCardSkeleton';

export const AddressesSkeleton: React.FC<{ count?: number }> = React.memo(({ count = 2 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <AddressCardSkeleton key={i} />
    ))}
  </div>
));
AddressesSkeleton.displayName = 'AddressesSkeleton';


// New skeleton for FeatureList Toggle items
export const ToggleSkeleton: React.FC = React.memo(() => (
  <div className="bg-white p-3 rounded-md border border-slate-200">
    <div className="flex justify-between items-center animate-pulse">
      <div className="flex items-center gap-3 w-3/4">
        <div className="h-4 bg-slate-200 rounded w-full"></div>
      </div>
      <div className="w-11 h-6 bg-slate-200 rounded-full"></div>
    </div>
  </div>
));
ToggleSkeleton.displayName = 'ToggleSkeleton';

// New skeleton for thumbnail lists
const ThumbnailSkeleton: React.FC = () => (
  <div className="shrink-0 w-24 flex flex-col items-center text-center gap-2">
    <Skeleton className="w-full aspect-5/4 rounded-lg" />
    <Skeleton className="h-3 w-16" />
  </div>
);

export const ThumbnailListSkeleton: React.FC<{ count?: number }> = React.memo(({ count = 3 }) => (
  <div className="flex gap-4 overflow-x-hidden px-1">
    {Array.from({ length: count }).map((_, i) => (
      <ThumbnailSkeleton key={i} />
    ))}
  </div>
));
ThumbnailListSkeleton.displayName = 'ThumbnailListSkeleton';

const FlavorTierSkeleton: React.FC = () => (
  <div className="bg-white p-3 rounded-md border border-slate-200 space-y-3">
    <div className="flex items-center gap-3">
      <Skeleton className="w-12 h-12 rounded-md" />
      <Skeleton className="h-5 w-2/4" />
    </div>
    <div className="mt-3 pt-3 border-t border-slate-200">
      <ThumbnailListSkeleton />
    </div>
  </div>
);


export const CakeBaseSkeleton: React.FC = React.memo(() => (
  <div className="bg-white p-3 rounded-md border border-slate-200 space-y-4 animate-pulse">
    <div>
      <Skeleton className="h-4 w-1/4 mb-2" />
      <ThumbnailListSkeleton />
    </div>
  </div>
));
CakeBaseSkeleton.displayName = 'CakeBaseSkeleton';

// Customization Tabs Skeleton (Circles)
export const CustomizationTabsSkeleton: React.FC = React.memo(() => (
  <div className="w-full px-4 mb-4">
    <div className="flex gap-4 overflow-x-auto pb-2 justify-between md:justify-center">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col items-center gap-2 min-w-[60px]">
          <div className="w-12 h-12 rounded-full bg-slate-200/80" />
          <div className="h-2.5 w-10 bg-slate-200/80 rounded" />
        </div>
      ))}
    </div>
  </div>
));
CustomizationTabsSkeleton.displayName = 'CustomizationTabsSkeleton';

// Chosen Options Skeleton (Squares)
export const ChosenOptionsSkeleton: React.FC = React.memo(() => (
  <div className="mt-2 px-2 space-y-2">
    <div className="h-3 w-24 bg-slate-200 rounded ml-1" /> {/* "Chosen Options" label */}
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col items-center gap-1 min-w-[60px]">
          <div className="w-14 h-14 rounded-lg bg-slate-200 border border-slate-100" />
          <div className="h-2.5 w-12 bg-slate-200 rounded mt-1" />
        </div>
      ))}
    </div>
  </div>
));
ChosenOptionsSkeleton.displayName = 'ChosenOptionsSkeleton';

export const CustomizationSkeleton: React.FC = React.memo(() => (
  <div className="space-y-6 animate-pulse">
    {/* Tabs */}
    <CustomizationTabsSkeleton />

    {/* Chosen Options */}
    <ChosenOptionsSkeleton />

    {/* Additional Instructions Placeholder */}
    <div className="px-2">
      <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200/50">
        <div className="h-4 w-32 bg-slate-200 rounded" />
        <div className="h-16 w-full bg-slate-200 rounded" />
      </div>
    </div>

    {/* Actions */}
    <div className="flex justify-end px-2 pt-2 gap-2">
      <div className="h-9 w-24 bg-slate-200 rounded-lg" />
      <div className="h-9 w-20 bg-slate-200 rounded-lg" />
    </div>
  </div>
));
CustomizationSkeleton.displayName = 'CustomizationSkeleton';