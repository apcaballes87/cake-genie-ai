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

// Cake Toppers Skeleton for bottom sheet loading state
const TopperCardSkeleton: React.FC = () => (
  <div className="bg-white p-3 rounded-lg border border-slate-200 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 bg-slate-200 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
      </div>
      <div className="w-10 h-6 bg-slate-200 rounded-full" />
    </div>
  </div>
);

export const CakeToppersSkeleton: React.FC = React.memo(() => (
  <div className="space-y-3 animate-pulse">
    {/* Main Toppers Section */}
    <div>
      <div className="h-3 w-28 bg-slate-200 rounded mb-2" />
      <div className="space-y-2">
        <TopperCardSkeleton />
        <TopperCardSkeleton />
      </div>
    </div>
    {/* Support Elements Section */}
    <div className="mt-4">
      <div className="h-3 w-32 bg-slate-200 rounded mb-2" />
      <div className="space-y-2">
        <TopperCardSkeleton />
      </div>
    </div>
  </div>
));
CakeToppersSkeleton.displayName = 'CakeToppersSkeleton';

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
  <div className="mt-2 px-2 space-y-2 animate-pulse">
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
      <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200/50 animate-pulse">
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

// Footer: Sticky Add to Cart Bar Skeleton
export const StickyAddToCartBarSkeleton: React.FC = React.memo(() => (
  <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-lg p-3 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] border-t border-slate-200">
    <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
      <div className="min-w-[100px] flex flex-col gap-1">
        <Skeleton className="h-6 w-20" /> {/* Price */}
        <Skeleton className="h-3 w-12" /> {/* Label */}
      </div>
      <div className="flex flex-1 gap-3">
        <Skeleton className="flex-1 h-12 rounded-xl" /> {/* Share Button */}
        <Skeleton className="flex-1 h-12 rounded-xl" /> {/* Add to Cart Button */}
      </div>
    </div>
  </div>
));
StickyAddToCartBarSkeleton.displayName = 'StickyAddToCartBarSkeleton';

// Full Page Skeleton for Customizing Page
export const CustomizingPageSkeleton: React.FC = React.memo(() => (
  <div className="w-full min-h-screen bg-slate-50/30">
    {/* Header Section */}
    <div className="w-full max-w-7xl mx-auto px-4">
      <div className="w-full flex items-center gap-2 md:gap-4 mb-4 pt-6">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" /> {/* Back Button */}
        <div className="relative grow">
          <Skeleton className="w-full h-12 rounded-full" /> {/* Search Input */}
        </div>
        <Skeleton className="w-10 h-10 rounded-full shrink-0" /> {/* Cart Icon */}
      </div>
    </div>

    <div className="flex flex-col items-center gap-6 w-full max-w-7xl mx-auto px-4 pb-32">
      {/* Breadcrumbs */}
      <div className="w-full flex items-center gap-2">
        <Skeleton className="h-3 w-12" />
        <span className="text-slate-200">/</span>
        <Skeleton className="h-3 w-20" />
        <span className="text-slate-200">/</span>
        <Skeleton className="h-3 w-24" />
      </div>

      {/* Title & Tag */}
      <div className="w-full space-y-2">
        <Skeleton className="h-8 w-3/4 md:w-1/3 rounded-lg" /> {/* Title */}
        <Skeleton className="h-5 w-24 rounded-full" /> {/* Category Badge */}
      </div>

      {/* Main Two-Column Layout */}
      <div className="w-full flex flex-col md:flex-row gap-4 md:gap-8">

        {/* LEFT COLUMN: Image & Preview */}
        <div className="flex flex-col gap-4 w-full md:w-[calc(50%-6px)]">
          <div className="w-full bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col min-h-[450px]">
            {/* Tab Toggle */}
            <div className="p-2 shrink-0">
              <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
                <div className="w-1/2 h-9 bg-white rounded shadow-sm" />
                <div className="w-1/2 h-9" />
              </div>
            </div>

            {/* Image Area */}
            <div className="p-2 pt-0 grow">
              <div className="w-full aspect-square bg-slate-200/50 rounded-xl relative flex items-center justify-center overflow-hidden">
                <div className="w-10 h-10 rounded-full border-4 border-slate-300 border-t-slate-400 animate-spin" />

                {/* Save Button Overlay */}
                <div className="absolute top-3 left-3">
                  <Skeleton className="h-7 w-16 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Controls */}
        <div className="flex flex-col gap-4 w-full md:w-[calc(50%-6px)]">
          <div className="w-full bg-white/70 backdrop-blur-lg p-4 rounded-2xl shadow-lg border border-slate-200 space-y-8">
            {/* Customization Navigation (Tabs) */}
            <div className="space-y-4">
              <div className="flex justify-center">
                <Skeleton className="h-4 w-40" />
              </div>
              <CustomizationTabsSkeleton />
            </div>

            {/* Choice Preview (Chosen Options) */}
            <div className="space-y-3">
              <ChosenOptionsSkeleton />
            </div>

            {/* AI Control / Quick Actions */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-20 w-full rounded-xl" />
              <div className="flex justify-between items-center">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
            </div>

            {/* Bottom Actions for Desktop */}
            <div className="hidden md:flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
              <Skeleton className="h-10 w-28 rounded-xl" />
              <Skeleton className="h-10 w-28 rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Trending / Related Designs Grid */}
      <div className="w-full mt-8 space-y-6">
        <Skeleton className="h-6 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square rounded-2xl w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Sticky Bottom Bar */}
    <StickyAddToCartBarSkeleton />
  </div>
));
CustomizingPageSkeleton.displayName = 'CustomizingPageSkeleton';