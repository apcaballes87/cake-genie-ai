'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ImagePlus, MapPin } from 'lucide-react';

import LazyImage from '@/components/LazyImage';
import MobileBottomNav from '@/components/MobileBottomNav';
import type { DeliveryRateCard } from '@/lib/commerce/deliveryRates';
import type {
  CakeTypePriceSummary,
  PriceListFilterKey,
} from '@/lib/pricing/priceList';
import { validateDiscountCode } from '@/services/discountService';
import type { CakeThickness, CakeType, DiscountValidationResult } from '@/types';
import {
  CAKE_SIZE_THUMBNAILS,
  CAKE_TYPE_THUMBNAILS,
  SQUARE_RECT_SIZE_PATTERN,
} from '@/constants';

type PriceListBrowserProps = {
  summaries: CakeTypePriceSummary[];
  deliveryRates: DeliveryRateCard[];
};

const FILTERS: { key: PriceListFilterKey; label: string }[] = [
  { key: 'all', label: 'All cake types' },
  { key: 'soft-icing', label: 'Soft icing' },
  { key: 'fondant', label: 'Fondant' },
  { key: 'party', label: 'Party sets' },
];

type PriceListCakeGroup = {
  key: string;
  title: string;
  summaries: CakeTypePriceSummary[];
};

type PricePointDiscountMap = Record<number, DiscountValidationResult>;

const COMBINED_CAKE_TYPE_GROUPS: { title: string; types: CakeType[] }[] = [
  { title: '1 Tier', types: ['1 Tier', '1 Tier Fondant'] },
  { title: '2 Tier', types: ['2 Tier', '2 Tier Fondant'] },
  { title: '3 Tier', types: ['3 Tier', '3 Tier Fondant'] },
  { title: 'Square', types: ['Square', 'Square Fondant'] },
  { title: 'Rectangle', types: ['Rectangle', 'Rectangle Fondant'] },
  { title: 'Bento', types: ['Bento'] },
  { title: 'Cupcake', types: ['Cupcake'] },
  { title: 'Bento Cupcake Set', types: ['Bento Cupcake Set'] },
];

function formatPeso(value: number): string {
  return `₱${value.toLocaleString()}`;
}

function getSizeOverlayLabel(size: string): string[] {
  const sizePart = size.split(' ')[0] || '';
  const tiers = sizePart.match(/\d+"/g) || [];
  if (tiers.length > 0) {
    return tiers.map((tier) => tier);
  }

  const squareRect = sizePart.match(SQUARE_RECT_SIZE_PATTERN) || [];
  if (squareRect.length > 0) {
    return squareRect.map((dim) => dim.replace(/\s*[xX×]\s*/g, '×'));
  }

  return [size];
}

function getGroupedSummaries(summaries: CakeTypePriceSummary[]): PriceListCakeGroup[] {
  const byCakeType = new Map(summaries.map((summary) => [summary.cakeType, summary]));

  return COMBINED_CAKE_TYPE_GROUPS.flatMap((group) => {
    const groupSummaries = group.types
      .map((type) => byCakeType.get(type))
      .filter((summary): summary is CakeTypePriceSummary => Boolean(summary));

    if (groupSummaries.length === 0) return [];

    return [{
      key: group.title.toLowerCase().replace(/\s+/g, '-'),
      title: group.title,
      summaries: groupSummaries,
    }];
  });
}

function getDefaultSummaryForFilter(group: PriceListCakeGroup, activeFilter: PriceListFilterKey): CakeTypePriceSummary {
  if (activeFilter !== 'all') {
    const filteredSummary = group.summaries.find((summary) => summary.filterKey === activeFilter);
    if (filteredSummary) return filteredSummary;
  }

  return group.summaries.find((summary) => summary.filterKey === 'soft-icing') ?? group.summaries[0];
}

export default function PriceListBrowser({
  summaries,
  deliveryRates,
}: PriceListBrowserProps) {
  const [activeFilter, setActiveFilter] = useState<PriceListFilterKey>('all');
  const [selectedCakeTypeByGroup, setSelectedCakeTypeByGroup] = useState<Record<string, CakeType>>({});
  const [selectedThicknessByType, setSelectedThicknessByType] = useState<Record<string, CakeThickness>>({});
  const [activeDiscountCode, setActiveDiscountCode] = useState('');
  const [validatedDiscountsByPrice, setValidatedDiscountsByPrice] = useState<PricePointDiscountMap>({});

  const filteredGroups = useMemo(() => {
    const groups = getGroupedSummaries(summaries);
    if (activeFilter === 'all') return groups;
    return groups
      .map((group) => ({
        ...group,
        summaries: group.summaries.filter((summary) => summary.filterKey === activeFilter),
      }))
      .filter((group) => group.summaries.length > 0);
  }, [activeFilter, summaries]);

  const visibleBasePrices = useMemo(() => {
    const uniquePrices = new Set<number>();

    filteredGroups.forEach((group) => {
      const defaultSummary = getDefaultSummaryForFilter(group, activeFilter);
      const selectedCakeType = selectedCakeTypeByGroup[group.key];
      const summary =
        group.summaries.find((candidate) => candidate.cakeType === selectedCakeType) ??
        defaultSummary;

      const selectedThickness = selectedThicknessByType[summary.cakeType] ?? summary.defaultThickness;
      const selectedGroup =
        summary.priceGroups.find((priceGroup) => priceGroup.thickness === selectedThickness) ??
        summary.priceGroups[0];

      selectedGroup.prices.forEach((pricePoint) => {
        uniquePrices.add(pricePoint.price);
      });
    });

    return [...uniquePrices].sort((a, b) => a - b);
  }, [activeFilter, filteredGroups, selectedCakeTypeByGroup, selectedThicknessByType]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncDiscountCode = () => {
      const storedCode = window.localStorage.getItem('cart_discount_code')?.trim().toUpperCase() || '';
      setActiveDiscountCode(storedCode);
    };

    syncDiscountCode();
    window.addEventListener('focus', syncDiscountCode);
    window.addEventListener('storage', syncDiscountCode);

    return () => {
      window.removeEventListener('focus', syncDiscountCode);
      window.removeEventListener('storage', syncDiscountCode);
    };
  }, []);

  useEffect(() => {
    if (!activeDiscountCode || visibleBasePrices.length === 0) return;

    let isCancelled = false;

    const validateVisiblePrices = async () => {
      const results = await Promise.all(
        visibleBasePrices.map(async (price) => {
          const result = await validateDiscountCode(activeDiscountCode, price);
          return [price, result] as const;
        }),
      );

      if (isCancelled) return;

      setValidatedDiscountsByPrice(Object.fromEntries(results));
    };

    validateVisiblePrices().catch((error) => {
      console.error('Failed to validate discount code for price list:', error);
      if (!isCancelled) setValidatedDiscountsByPrice({});
    });

    return () => {
      isCancelled = true;
    };
  }, [activeDiscountCode, visibleBasePrices]);

  const discountsByPrice = activeDiscountCode ? validatedDiscountsByPrice : {};

  const handleThicknessSelect = (cakeType: string, thickness: CakeThickness) => {
    setSelectedThicknessByType((current) => ({
      ...current,
      [cakeType]: thickness,
    }));
  };

  const handleCakeTypeSelect = (groupKey: string, cakeType: CakeType) => {
    setSelectedCakeTypeByGroup((current) => ({
      ...current,
      [groupKey]: cakeType,
    }));
  };

  return (
    <>
      <section className="rounded-[2rem] border border-purple-100 bg-white/80 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-purple-400">
              All cake types
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              See every starting price
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Filter the catalog, then pick a cake height inside each type to see the matching size prices.
            </p>
            {activeDiscountCode && (
              <div className="mt-4 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
                <span className="uppercase tracking-[0.18em] text-emerald-600">Discount active</span>
                <span className="font-mono">{activeDiscountCode}</span>
                <span className="text-emerald-700/80">Discounted prices show when the code is valid for that base amount.</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {filteredGroups.length === 0 && (
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-600 lg:col-span-2">
              No cake types are available in this filter right now.
            </div>
          )}
          {filteredGroups.map((group) => {
            const defaultSummary = getDefaultSummaryForFilter(group, activeFilter);
            const selectedCakeType = selectedCakeTypeByGroup[group.key];
            const summary =
              group.summaries.find((candidate) => candidate.cakeType === selectedCakeType) ??
              defaultSummary;
            const selectedThickness = selectedThicknessByType[summary.cakeType] ?? summary.defaultThickness;
            const selectedGroup =
              summary.priceGroups.find((group) => group.thickness === selectedThickness) ??
              summary.priceGroups[0];

            return (
              <article
                key={group.key}
                className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md sm:p-5"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-purple-100 bg-purple-50 sm:h-16 sm:w-16">
                    <LazyImage
                      src={CAKE_TYPE_THUMBNAILS[summary.cakeType]}
                      alt=""
                      fill
                      sizes="64px"
                      imageClassName="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    {group.summaries.length > 1 ? (
                      <div className="inline-flex max-w-full flex-wrap rounded-full border border-purple-100 bg-purple-50 p-1">
                        {group.summaries.map((variant) => {
                          const isSelected = variant.cakeType === summary.cakeType;
                          return (
                            <button
                              key={variant.cakeType}
                              type="button"
                              onClick={() => handleCakeTypeSelect(group.key, variant.cakeType)}
                              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                isSelected
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : 'text-purple-700 hover:bg-white'
                              }`}
                            >
                              {variant.filterLabel}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">
                        {summary.filterLabel}
                      </div>
                    )}
                    <h3 className="mt-3 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                      {group.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {summary.note}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                  <div className="text-sm font-semibold text-slate-800">
                    Size prices for {selectedGroup.thickness} height
                  </div>

                  <div className="mt-4 grid grid-cols-2 justify-items-center gap-3 min-[430px]:grid-cols-3 sm:flex sm:flex-wrap sm:justify-start sm:gap-4">
                    {selectedGroup.prices.map((pricePoint) => {
                      const overlayLines = getSizeOverlayLabel(pricePoint.size);
                      const discountedPrice = discountsByPrice[pricePoint.price];
                      const hasDiscountedPrice =
                        Boolean(activeDiscountCode) &&
                        discountedPrice?.valid &&
                        discountedPrice.finalAmount < pricePoint.price;

                      return (
                        <div
                          key={`${summary.cakeType}-${selectedGroup.thickness}-${pricePoint.size}`}
                          className="flex w-full max-w-[118px] max-md:max-w-[100px] flex-col items-center gap-2 text-center"
                        >
                          <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-purple-300 bg-white shadow-sm shadow-purple-100/60 min-[390px]:h-28 min-[390px]:w-28">
                            <LazyImage
                              src={CAKE_SIZE_THUMBNAILS[pricePoint.size] || CAKE_TYPE_THUMBNAILS[summary.cakeType]}
                              alt=""
                              fill
                              sizes="(max-width: 389px) 96px, 112px"
                              imageClassName="object-cover opacity-[0.08]"
                            />
                            <div className="relative z-10 px-3 text-center">
                              <div className="text-[11px] max-md:text-[9px] font-bold leading-4 text-purple-600">
                                {overlayLines.map((line, index) => (
                                  <div key={`${pricePoint.size}-${line}-${index}`}>{line}</div>
                                ))}
                              </div>
                              {hasDiscountedPrice ? (
                                <div className="mt-1">
                                  <div className="text-[10px] max-md:text-[9px] font-bold leading-4 text-slate-400 line-through">
                                    {formatPeso(pricePoint.price)}
                                  </div>
                                  <div className="text-sm font-black leading-4 text-emerald-600">
                                    {formatPeso(discountedPrice.finalAmount)}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1 text-sm font-bold text-purple-700">
                                  {formatPeso(pricePoint.price)}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="min-h-8 text-xs font-semibold leading-4 text-slate-600">
                            {pricePoint.size}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6">
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                      Height
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
                      {summary.thicknesses.map((thickness) => {
                        const isSelected = selectedGroup.thickness === thickness;
                        return (
                          <button
                            key={`${summary.cakeType}-${thickness}`}
                            type="button"
                            onClick={() => handleThicknessSelect(summary.cakeType, thickness)}
                            className={`min-h-[60px] min-w-[80px] max-md:min-h-[52px] max-md:min-w-[68px] min-[390px]:min-w-[76px] md:min-w-[92px] rounded-[1.1rem] border px-3 py-3 text-center text-base font-black transition min-[390px]:text-lg ${
                              isSelected
                                ? 'border-purple-400 bg-purple-50 text-purple-700 shadow-[0_0_0_3px_rgba(168,85,247,0.12)]'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-purple-300 hover:bg-purple-50/50'
                            }`}
                          >
                            {thickness.replace(' in', '"')}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5">
                    <Link
                      href="/?upload=1"
                      className="genie-btn-primary flex w-full items-center justify-center gap-3 rounded-[1.35rem] px-6 max-md:py-3.5 py-[15px] text-[12px] max-md:text-[10px] font-bold shadow-lg shadow-purple-100/50 transition active:scale-[0.99] min-[360px]:text-[13px] min-[390px]:text-sm md:px-8 md:text-[17px] lg:text-lg"
                    >
                      <ImagePlus size={22} className="shrink-0" />
                      <span className="text-center sm:whitespace-nowrap">Upload Your Design - Get Instant Pricing</span>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-10 rounded-[2rem] border border-purple-100 bg-gradient-to-br from-purple-50/80 via-white to-pink-50/60 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-purple-400">
              Delivery fees in Cebu
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              Flat delivery fees per city
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              These are the same city-based delivery fees used at checkout.
            </p>
          </div>
          <Link
            href="/delivery-rates"
            className="inline-flex items-center gap-2 text-sm font-semibold text-purple-700 transition hover:text-purple-900"
          >
            <MapPin className="h-4 w-4" />
            See detailed serviceable areas
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {deliveryRates.map((rate) => (
            <div
              key={rate.city}
              className="rounded-2xl border border-white/80 bg-white/90 px-4 py-4 shadow-sm"
            >
              <div className="text-sm font-semibold text-slate-700">{rate.city}</div>
              <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                {rate.rate === 0 ? 'Free' : formatPeso(rate.rate)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <MobileBottomNav />
    </>
  );
}
