'use client';
import React from 'react';

// Generic skeleton component
export const Skeleton: React.FC<{ className?: string }> = React.memo(({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
));
Skeleton.displayName = 'Skeleton';

const SkeletonPill: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Skeleton className={`h-9 rounded-full ${className}`} />
);

const SearchHeaderSkeleton: React.FC<{ showFilters?: boolean }> = ({ showFilters = false }) => (
  <>
    <div className="fixed top-0 left-0 right-0 z-80 border-b border-purple-100 bg-white/90 shadow-sm backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="w-full flex items-center gap-2 md:gap-4 py-2.5 md:py-[14px]">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <Skeleton className="h-12 grow rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        </div>
      </div>
    </div>
    <div className="h-[56px] md:h-[74px]" />
    <div className="flex flex-col items-center mb-6">
      <Skeleton className="h-5 w-64 mb-4" />
      {showFilters && (
        <div className="w-full overflow-x-hidden pb-2">
          <div className="flex items-center justify-center gap-2 min-w-max px-2">
            <SkeletonPill className="w-28" />
            <SkeletonPill className="w-28" />
            <SkeletonPill className="w-28" />
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <SkeletonPill className="w-24" />
            <SkeletonPill className="w-24" />
          </div>
        </div>
      )}
    </div>
  </>
);

const ProductCardSkeleton: React.FC = () => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_-24px_rgba(15,23,42,0.45)]">
    <Skeleton className="aspect-4/5 w-full rounded-none" />
    <div className="space-y-3 p-3">
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </div>
  </div>
);

const CollectionCategoryCardSkeleton: React.FC = () => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <Skeleton className="aspect-4/3 w-full rounded-none" />
    <div className="space-y-2 p-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  </div>
);


// Cart item skeleton
export const CartItemSkeleton: React.FC = React.memo(() => (
  <div className="flex gap-4 p-4 genie-card rounded-lg">
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
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CartItemSkeleton key={i} />
      ))}
    </div>
    <div className="mt-6 pt-6 border-t border-purple-100 space-y-4">
      <Skeleton className="h-6 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="w-16 h-16 rounded-lg shrink-0" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-28 rounded-lg shrink-0" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
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
  <div className="fixed bottom-0 left-0 right-0 z-90 pointer-events-none">
    <div className="pointer-events-auto">
      <div className="h-4 bg-green-100 rounded-t-2xl">
        <div className="max-w-4xl mx-auto h-full flex items-center justify-center">
          <Skeleton className="h-3 w-48 bg-green-200/70" />
        </div>
      </div>
      <div className="relative bg-white/80 backdrop-blur-lg px-3 pt-3 pb-[20px] rounded-t-2xl shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] border-t border-transparent">
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
          <div className="min-w-[100px] min-h-[44px] flex items-center">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-6 w-20" /> {/* Price */}
              <Skeleton className="h-3 w-24" /> {/* Label */}
            </div>
          </div>
          <div className="flex flex-1 gap-3">
            <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
            <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
            <Skeleton className="flex-1 h-12 rounded-xl" /> {/* Add to Cart Button */}
          </div>
        </div>
      </div>
    </div>
  </div>
));
StickyAddToCartBarSkeleton.displayName = 'StickyAddToCartBarSkeleton';

// Full Page Skeleton for Customizing Page
export const CustomizingPageSkeleton: React.FC = React.memo(() => (
  <div className="w-full min-h-screen bg-slate-50/30">
    <div className="w-full bg-purple-200/70 py-[4.5px]">
      <div className="max-w-7xl mx-auto px-4">
        <Skeleton className="h-4 w-56 mx-auto bg-white/60" />
      </div>
    </div>

    <div className="sticky top-0 z-80 w-full border-b border-purple-100 bg-white/80 backdrop-blur-lg">
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="w-full flex items-center gap-2 md:gap-4 py-2.5 md:py-[14px]">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="relative grow">
            <Skeleton className="w-full h-12 rounded-full" />
          </div>
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        </div>
      </div>
    </div>

    <div className="flex flex-col items-center gap-2 w-full max-w-7xl mx-auto px-4 pb-24">
      <div className="w-full space-y-2 pt-2">
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-10" />
          <span className="text-slate-200">/</span>
          <Skeleton className="h-3 w-20" />
          <span className="text-slate-200">/</span>
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-7 w-64 max-w-[85%] rounded-lg" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>

      <div className="w-full flex flex-col md:flex-row gap-2">
        <div className="flex flex-col gap-4 w-full md:w-[calc(50%-6px)]">
          <div className="w-full flex flex-col gap-1">
            <div className="flex w-full gap-2">
              <Skeleton className="flex-1 h-9 rounded-full" />
              <Skeleton className="flex-1 h-9 rounded-full" />
            </div>

            <div className="w-full flex flex-col overflow-hidden rounded-3xl">
              <div className="p-3 w-full text-center mb-1">
                <div className="w-full bg-slate-200 rounded-full h-1.5 relative overflow-hidden">
                  <div className="h-full w-2/3 bg-linear-to-r from-pink-400 via-purple-400 to-indigo-400 rounded-full animate-pulse" />
                </div>
                <div className="flex justify-center mt-2">
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>

              <div className="relative w-full aspect-[5/4] md:aspect-square rounded-3xl overflow-hidden bg-white">
                <Skeleton className="absolute inset-0 rounded-3xl" />
                <div className="absolute top-3 left-3">
                  <Skeleton className="h-7 w-28 rounded-full bg-green-200/70" />
                </div>
                <div className="absolute top-3 right-3 flex gap-2">
                  <Skeleton className="h-7 w-16 rounded-full" />
                  <Skeleton className="h-7 w-16 rounded-full" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border-4 border-slate-300 border-t-slate-400 animate-spin" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-x-1.5 whitespace-nowrap overflow-hidden px-2">
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-16" />
            </div>

            <div className="flex justify-center">
              <Skeleton className="h-4 w-44 bg-green-200/70" />
            </div>

            <div className="hidden md:block">
              <div className="flex items-center justify-center gap-2">
                <Skeleton className="h-9 w-28 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-36 rounded-full" />
              </div>
            </div>
          </div>

          <div className="md:hidden">
            <div className="genie-card p-2 rounded-2xl">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-purple-100">
                <div className="p-2 genie-icon-soft rounded-lg">
                  <div className="w-5 h-5 bg-purple-200 rounded animate-pulse" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
              <div className="mt-6">
                <ChosenOptionsSkeleton />
              </div>
              <div className="mt-4 px-2">
                <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200/50">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-col gap-2 w-full md:w-[calc(50%-6px)]">
          <div className="genie-card p-2 rounded-2xl">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-purple-100">
                  <div className="p-2 genie-icon-soft rounded-lg">
                    <div className="w-5 h-5 bg-purple-200 rounded animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-44" />
                  </div>
              </div>
              <div className="mt-6">
                <ChosenOptionsSkeleton />
              </div>
              <div className="mt-4 px-2">
                <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200/50">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>

    <StickyAddToCartBarSkeleton />
  </div>
));
CustomizingPageSkeleton.displayName = 'CustomizingPageSkeleton';

export const SearchPageSkeleton: React.FC<{ showFilters?: boolean; count?: number }> = React.memo(({
  showFilters = true,
  count = 12,
}) => (
  <div className="min-h-screen">
    <div className="w-full max-w-7xl mx-auto h-full flex flex-col px-4 pb-24 md:pb-0 overflow-hidden">
      <SearchHeaderSkeleton showFilters={showFilters} />

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: count }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </div>

      <div className="mt-8 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px grow bg-slate-200" />
          <Skeleton className="h-4 w-44" />
          <div className="h-px grow bg-slate-200" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    </div>
  </div>
));
SearchPageSkeleton.displayName = 'SearchPageSkeleton';

export const CollectionsPageSkeleton: React.FC = React.memo(() => (
  <div className="min-h-screen pb-24 md:pb-0">
    <div className="w-full max-w-7xl mx-auto px-4">
      <SearchHeaderSkeleton />

      <div className="flex items-center gap-4 mb-8">
        <div className="grow space-y-3">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-full max-w-3xl" />
          <Skeleton className="h-4 w-5/6 max-w-2xl" />
        </div>
      </div>

      <section className="mb-10">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <CollectionCategoryCardSkeleton key={index} />
          ))}
        </div>
      </section>

      <section className="pt-6 border-t border-slate-200">
        <div className="mb-4 space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </section>
    </div>
  </div>
));
CollectionsPageSkeleton.displayName = 'CollectionsPageSkeleton';

export const LandingPageSkeleton: React.FC = React.memo(() => (
  <div className="space-y-10 pb-16">
    <section className="px-4 pt-6">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-5 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.35)] backdrop-blur-sm md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-4">
              <div className="flex gap-2">
                <SkeletonPill className="w-28" />
                <SkeletonPill className="w-32" />
              </div>
              <Skeleton className="h-12 w-full max-w-xl" />
              <Skeleton className="h-12 w-11/12 max-w-lg" />
              <Skeleton className="h-5 w-full max-w-2xl" />
              <Skeleton className="h-5 w-4/5 max-w-xl" />
              <Skeleton className="h-14 w-full rounded-full" />
              <div className="flex gap-3">
                <Skeleton className="h-12 w-40 rounded-2xl" />
                <Skeleton className="h-12 w-32 rounded-2xl" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 min-[450px]:gap-4">
              <div className="flex flex-col gap-3 min-[450px]:gap-4">
                <Skeleton className="aspect-[5/6] rounded-2xl" />
                <Skeleton className="aspect-[5/6] rounded-2xl" />
              </div>
              <div className="flex flex-col gap-3 pt-8 min-[450px]:gap-4 min-[450px]:pt-12">
                <Skeleton className="aspect-[5/6] rounded-2xl" />
                <Skeleton className="aspect-[5/6] rounded-2xl" />
              </div>
              <div className="flex flex-col gap-3 pt-4 min-[450px]:gap-4 min-[450px]:pt-8">
                <Skeleton className="aspect-[5/6] rounded-2xl" />
                <Skeleton className="aspect-[5/6] rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-5 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </section>

    <section className="px-4">
      <div className="max-w-7xl mx-auto rounded-[2rem] border border-slate-200/70 bg-white/70 p-6 shadow-[0_28px_70px_-55px_rgba(15,23,42,0.4)]">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <SkeletonPill className="w-32" />
            <Skeleton className="h-9 w-full max-w-md" />
            <Skeleton className="h-9 w-4/5 max-w-sm" />
            <Skeleton className="h-4 w-full max-w-lg" />
            <Skeleton className="h-4 w-5/6 max-w-md" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
          </div>
        </div>
      </div>
    </section>
  </div>
));
LandingPageSkeleton.displayName = 'LandingPageSkeleton';
