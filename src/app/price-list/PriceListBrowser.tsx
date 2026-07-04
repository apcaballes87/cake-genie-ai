'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, MapPin, Sparkles } from 'lucide-react';

import type {
  CakeTypePriceSummary,
  PriceListFilterKey,
} from '@/lib/pricing/priceList';
import type { DeliveryRateCard } from '@/lib/commerce/deliveryRates';

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

export default function PriceListBrowser({
  summaries,
  deliveryRates,
}: PriceListBrowserProps) {
  const [activeFilter, setActiveFilter] = useState<PriceListFilterKey>('all');
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});

  const filteredSummaries = useMemo(() => {
    if (activeFilter === 'all') return summaries;
    return summaries.filter((summary) => summary.filterKey === activeFilter);
  }, [activeFilter, summaries]);

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
            Larger sizes start higher even before advanced decorations are added.
          </p>
        </div>
        <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-5 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            <Sparkles className="h-3.5 w-3.5" />
            Starting prices only
          </div>
          <p className="mt-3 text-sm leading-6 text-amber-900">
            Final prices can increase depending on the difficulty, intricacy, toppers, and custom details of the design.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-purple-100 bg-white/80 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-purple-400">
              Browse price ranges
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              Explore every base price by cake type
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Pick a category, then expand any card to see every available base price by size.
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
            const visiblePrices = isExpanded ? summary.prices : summary.prices.slice(0, 3);

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
                        Available base prices by size
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Starting point only. Design complexity may increase the final quote.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleType(summary.cakeType)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-purple-300 hover:text-purple-700"
                    >
                      {isExpanded ? 'Show less' : `Show all ${summary.prices.length}`}
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {visiblePrices.map((pricePoint) => (
                      <div
                        key={`${summary.cakeType}-${pricePoint.size}`}
                        className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100"
                      >
                        <span className="text-sm font-medium text-slate-700">{pricePoint.size}</span>
                        <span className="text-base font-bold text-purple-700">
                          {formatPeso(pricePoint.price)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {!isExpanded && summary.prices.length > visiblePrices.length && (
                    <p className="mt-3 text-xs text-slate-500">
                      {summary.prices.length - visiblePrices.length} more size options hidden.
                    </p>
                  )}
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
          Use these ranges to set expectations, then head to the customizer for a more accurate quote based on your exact design, message, toppings, and colors.
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
