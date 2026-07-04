'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ImagePlus, MapPin, Sparkles } from 'lucide-react';

import LazyImage from '@/components/LazyImage';
import type { DeliveryRateCard } from '@/lib/commerce/deliveryRates';
import type {
  CakeTypePriceSummary,
  PriceListFilterKey,
} from '@/lib/pricing/priceList';
import type { CakeThickness, CakeType, IcingDesign } from '@/types';
import {
  CAKE_SIZE_THUMBNAILS,
  CAKE_THICKNESS_THUMBNAILS,
  CAKE_TYPE_THUMBNAILS,
  SQUARE_RECT_SIZE_PATTERN,
  getCakeTypesForIcingBase,
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

function isCircleStyle(size: string): boolean {
  return /round|cupcake|pieces/i.test(size) || /\d+"/.test(size);
}

function getExplorerTitle(cakeType: CakeType): string {
  if (cakeType === 'Cupcake') return 'Cupcake prices';
  if (cakeType === 'Bento Cupcake Set') return 'Bento + cupcake set prices';
  return `${cakeType} base prices`;
}

export default function PriceListBrowser({
  summaries,
  deliveryRates,
}: PriceListBrowserProps) {
  const [activeFilter, setActiveFilter] = useState<PriceListFilterKey>('all');
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [activeIcingBase, setActiveIcingBase] = useState<IcingDesign['base']>('soft_icing');
  const [selectedCakeType, setSelectedCakeType] = useState<CakeType | null>(null);
  const [selectedThickness, setSelectedThickness] = useState<CakeThickness | null>(null);

  const summariesByType = useMemo(
    () => new Map(summaries.map((summary) => [summary.cakeType, summary])),
    [summaries],
  );

  const filteredSummaries = useMemo(() => {
    if (activeFilter === 'all') return summaries;
    return summaries.filter((summary) => summary.filterKey === activeFilter);
  }, [activeFilter, summaries]);

  const icingBaseTypes = useMemo(
    () => getCakeTypesForIcingBase(activeIcingBase).filter((type) => summariesByType.has(type)),
    [activeIcingBase, summariesByType],
  );

  const activeCakeType = useMemo(
    () => (selectedCakeType && icingBaseTypes.includes(selectedCakeType) ? selectedCakeType : icingBaseTypes[0] ?? null),
    [icingBaseTypes, selectedCakeType],
  );

  const activeSummary = activeCakeType ? summariesByType.get(activeCakeType) ?? null : null;

  const activeThickness = useMemo(() => {
    if (!activeSummary) return null;
    if (selectedThickness && activeSummary.thicknesses.includes(selectedThickness)) {
      return selectedThickness;
    }
    return activeSummary.defaultThickness;
  }, [activeSummary, selectedThickness]);

  const activePriceGroup = useMemo(() => {
    if (!activeSummary || !activeThickness) return null;
    return (
      activeSummary.priceGroups.find((group) => group.thickness === activeThickness) ??
      activeSummary.priceGroups[0] ??
      null
    );
  }, [activeSummary, activeThickness]);

  const lowestStartingPrice =
    summaries.length > 0
      ? Math.min(...summaries.map((summary) => summary.startingPrice))
      : 0;
  const highestListedBase =
    summaries.length > 0 ? Math.max(...summaries.map((summary) => summary.maxPrice)) : 0;

  const areAllVisibleExpanded =
    filteredSummaries.length > 0 &&
    filteredSummaries.every((summary) => expandedTypes[summary.cakeType]);

  const handleToggleAll = () => {
    const nextExpanded = { ...expandedTypes };
    for (const summary of filteredSummaries) {
      nextExpanded[summary.cakeType] = !areAllVisibleExpanded;
    }
    setExpandedTypes(nextExpanded);
  };

  const handleToggleType = (cakeType: string) => {
    setExpandedTypes((current) => ({
      ...current,
      [cakeType]: !current[cakeType],
    }));
  };

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.75rem] border border-purple-100 bg-white/90 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-purple-500">
            Cake types
          </div>
          <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            {summaries.length}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Base-price categories pulled from the same pricing table used in the app.
          </p>
        </div>
        <div className="rounded-[1.75rem] border border-purple-100 bg-white/90 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-purple-500">
            Lowest starting price
          </div>
          <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            {formatPeso(lowestStartingPrice)}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Great for budgeting before you upload your exact peg or request.
          </p>
        </div>
        <div className="rounded-[1.75rem] border border-purple-100 bg-white/90 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-purple-500">
            Highest listed base
          </div>
          <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            {formatPeso(highestListedBase)}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Larger sizes and taller builds start higher even before added details.
          </p>
        </div>
        <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-5 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            <Sparkles className="h-3.5 w-3.5" />
            Starting prices only
          </div>
          <p className="mt-3 text-sm leading-6 text-amber-900">
            Final prices can increase depending on the difficulty, intricacy, toppers, colors, and custom details.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-purple-100 bg-white/80 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-purple-400">
              Price explorer
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              Browse by icing, shape, size, and height
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              This follows the same option flow as the customizer: choose an icing finish, pick a cake shape, then see the base prices for each size and height combination.
            </p>
          </div>
          {activeSummary && (
            <div className="rounded-[1.5rem] border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-pink-50 px-5 py-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-500">
                {getExplorerTitle(activeSummary.cakeType)}
              </div>
              <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                {activePriceGroup?.prices[0] ? formatPeso(activePriceGroup.prices[0].price) : formatPeso(activeSummary.startingPrice)}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {activeThickness ? `${activeThickness} height selected` : 'Choose a height'}.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-[2rem] border border-purple-100 bg-gradient-to-br from-white via-[#fcfbff] to-purple-50/70 p-4 shadow-inner sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-5">
              <div>
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                  Icing
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'soft_icing', label: 'Soft Icing' },
                    { id: 'fondant', label: 'Fondant' },
                  ] as const).map((option) => {
                    const isSelected = activeIcingBase === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setActiveIcingBase(option.id);
                          setSelectedCakeType(null);
                          setSelectedThickness(null);
                        }}
                        className={`flex items-center gap-3 rounded-[1.3rem] border px-4 py-3 text-left transition ${
                          isSelected
                            ? 'border-purple-400 bg-purple-50 text-purple-700 shadow-[0_0_0_3px_rgba(168,85,247,0.12)]'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-purple-300 hover:bg-purple-50/60'
                        }`}
                      >
                        <span className={`h-5 w-5 rounded-full border ${isSelected ? 'border-yellow-200 bg-yellow-100' : 'border-slate-200 bg-white'}`} />
                        <span className="text-sm font-semibold">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                  Shape
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {icingBaseTypes.map((cakeType) => {
                    const summary = summariesByType.get(cakeType);
                    if (!summary) return null;

                    const isSelected = activeCakeType === cakeType;
                    return (
                      <button
                        key={cakeType}
                        type="button"
                        onClick={() => {
                          setSelectedCakeType(cakeType);
                          setSelectedThickness(summary.defaultThickness);
                        }}
                        className={`group rounded-[1.4rem] border p-3 text-left transition ${
                          isSelected
                            ? 'border-purple-400 bg-white shadow-[0_0_0_3px_rgba(168,85,247,0.12)]'
                            : 'border-slate-200 bg-white/90 hover:border-purple-300 hover:bg-purple-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-slate-100 bg-white">
                            <LazyImage
                              src={CAKE_TYPE_THUMBNAILS[cakeType]}
                              alt=""
                              fill
                              sizes="56px"
                              imageClassName="object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className={`text-sm font-semibold ${isSelected ? 'text-purple-700' : 'text-slate-800'}`}>
                              {cakeType}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatPeso(summary.startingPrice)} to {formatPeso(summary.maxPrice)}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t border-purple-100 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              {activeSummary && activePriceGroup ? (
                <>
                  <div>
                    <div className="mb-5">
                      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                        Size
                      </div>
                      <div className="mt-4 flex flex-wrap gap-4">
                        {activePriceGroup.prices.map((pricePoint) => {
                          const isCircular = isCircleStyle(pricePoint.size);
                          const overlayLines = getSizeOverlayLabel(pricePoint.size);

                          return (
                            <div
                              key={`${activeSummary.cakeType}-${activePriceGroup.thickness}-${pricePoint.size}`}
                              className="flex flex-col items-center gap-2 text-center"
                            >
                              <div
                                className={`relative flex items-center justify-center overflow-hidden border bg-white shadow-sm ${
                                  isCircular
                                    ? 'h-28 w-28 rounded-full border-purple-400 shadow-[0_0_0_4px_rgba(168,85,247,0.10)]'
                                    : 'min-h-[112px] min-w-[112px] rounded-[1.75rem] border-slate-200 px-5 py-4'
                                }`}
                              >
                                <LazyImage
                                  src={CAKE_SIZE_THUMBNAILS[pricePoint.size] || CAKE_TYPE_THUMBNAILS[activeSummary.cakeType]}
                                  alt=""
                                  fill
                                  sizes="112px"
                                  imageClassName="object-cover opacity-[0.08]"
                                />
                                <div className="relative z-10 px-3 text-center">
                                  <div className={`font-bold ${isCircular ? 'text-[11px] text-purple-600' : 'text-[10px] text-slate-500'}`}>
                                    {overlayLines.map((line, index) => (
                                      <div key={`${pricePoint.size}-${line}-${index}`}>{line}</div>
                                    ))}
                                  </div>
                                  <div className={`mt-1 text-sm font-bold ${isCircular ? 'text-purple-700' : 'text-slate-800'}`}>
                                    {formatPeso(pricePoint.price)}
                                  </div>
                                </div>
                              </div>
                              <div className="max-w-[120px] text-xs font-semibold leading-4 text-slate-600">
                                {pricePoint.size}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-8">
                      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                        Height
                      </div>
                      <div className="mt-4 flex flex-wrap gap-4">
                        {activeSummary.thicknesses.map((thickness) => {
                          const isSelected = activeThickness === thickness;
                          return (
                            <button
                              key={`${activeSummary.cakeType}-${thickness}`}
                              type="button"
                              onClick={() => setSelectedThickness(thickness)}
                              className={`group relative min-h-[88px] min-w-[118px] overflow-hidden rounded-[1.2rem] border px-5 py-4 text-center transition ${
                                isSelected
                                  ? 'border-purple-400 bg-purple-50 shadow-[0_0_0_3px_rgba(168,85,247,0.12)]'
                                  : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/50'
                              }`}
                            >
                              <LazyImage
                                src={CAKE_THICKNESS_THUMBNAILS[thickness]}
                                alt=""
                                fill
                                sizes="118px"
                                imageClassName="object-cover opacity-[0.12]"
                              />
                              <span className={`relative z-10 text-2xl font-black tracking-tight ${isSelected ? 'text-purple-700' : 'text-slate-700'}`}>
                                {thickness.replace(' in', '"')}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        Height affects the cake build and can change which base prices apply for each size.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-600">
                  No price explorer data is available for this icing group right now.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-purple-100 bg-white/80 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-purple-400">
              All cake types
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              See every starting price
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Filter the catalog, then expand each cake type to reveal all size and height combinations.
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleAll}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-semibold text-purple-700 transition hover:border-purple-300 hover:bg-purple-100"
          >
            {areAllVisibleExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {areAllVisibleExpanded ? 'Collapse visible prices' : 'Show all visible prices'}
          </button>
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
          {filteredSummaries.length === 0 && (
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-600 lg:col-span-2">
              No cake types are available in this filter right now.
            </div>
          )}
          {filteredSummaries.map((summary) => {
            const isExpanded = Boolean(expandedTypes[summary.cakeType]);
            const visibleGroups = isExpanded ? summary.priceGroups : summary.priceGroups.slice(0, 1);

            return (
              <article
                key={summary.cakeType}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">
                      {summary.filterLabel}
                    </div>
                    <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-900">
                      {summary.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {summary.note}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-pink-50 px-4 py-3 text-left sm:min-w-[170px]">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-500">
                      Base price range
                    </div>
                    <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                      {formatPeso(summary.startingPrice)}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      up to {formatPeso(summary.maxPrice)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        Available base prices by height and size
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Prices shown here are starting points before intricate custom details are added.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleType(summary.cakeType)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-purple-300 hover:text-purple-700"
                    >
                      {isExpanded ? 'Show less' : `Show all ${summary.thicknesses.length} heights`}
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    {visibleGroups.map((group) => (
                      <div key={`${summary.cakeType}-${group.thickness}`} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                        <div className="mb-3 inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">
                          {group.thickness} height
                        </div>
                        <div className="space-y-2">
                          {group.prices.map((pricePoint) => (
                            <div
                              key={`${summary.cakeType}-${group.thickness}-${pricePoint.size}`}
                              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                            >
                              <span className="text-sm font-medium text-slate-700">{pricePoint.size}</span>
                              <span className="text-base font-bold text-purple-700">
                                {formatPeso(pricePoint.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {!isExpanded && summary.priceGroups.length > visibleGroups.length && (
                    <p className="mt-3 text-xs text-slate-500">
                      {summary.priceGroups.length - visibleGroups.length} more height groups hidden.
                    </p>
                  )}

                  <div className="mt-5">
                    <Link
                      href="/?upload=1"
                      className="genie-btn-primary flex w-full items-center justify-center gap-3 rounded-[1.35rem] px-6 py-[15px] text-[12px] font-bold shadow-lg shadow-purple-100/50 transition active:scale-[0.99] min-[360px]:text-[13px] min-[390px]:text-sm md:px-8 md:text-[17px] lg:text-lg"
                    >
                      <ImagePlus size={22} className="shrink-0" />
                      <span className="whitespace-nowrap">Upload Your Design - Get Instant Pricing</span>
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

      <section className="mt-10 rounded-[2rem] border border-slate-200 bg-white/90 p-6 text-center shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-purple-400">
          Ready for an exact quote?
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
          Upload your design to get the real final price
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Use these ranges to set expectations, then head to the customizer for a more accurate quote based on your exact design, message, toppings, colors, and finishing work.
        </p>
        <div className="mt-6">
          <Link
            href="/customizing#upload"
            className="genie-btn-primary inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-bold shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Start customizing
          </Link>
        </div>
      </section>
    </>
  );
}
