'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ImagePlus, MapPin } from 'lucide-react';

import LazyImage from '@/components/LazyImage';
import type { DeliveryRateCard } from '@/lib/commerce/deliveryRates';
import type {
  CakeTypePriceSummary,
  PriceListFilterKey,
} from '@/lib/pricing/priceList';
import type { CakeThickness } from '@/types';
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

export default function PriceListBrowser({
  summaries,
  deliveryRates,
}: PriceListBrowserProps) {
  const [activeFilter, setActiveFilter] = useState<PriceListFilterKey>('all');
  const [selectedThicknessByType, setSelectedThicknessByType] = useState<Record<string, CakeThickness>>({});

  const filteredSummaries = useMemo(() => {
    if (activeFilter === 'all') return summaries;
    return summaries.filter((summary) => summary.filterKey === activeFilter);
  }, [activeFilter, summaries]);

  const handleThicknessSelect = (cakeType: string, thickness: CakeThickness) => {
    setSelectedThicknessByType((current) => ({
      ...current,
      [cakeType]: thickness,
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
          {filteredSummaries.length === 0 && (
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-600 lg:col-span-2">
              No cake types are available in this filter right now.
            </div>
          )}
          {filteredSummaries.map((summary) => {
            const selectedThickness = selectedThicknessByType[summary.cakeType] ?? summary.defaultThickness;
            const selectedGroup =
              summary.priceGroups.find((group) => group.thickness === selectedThickness) ??
              summary.priceGroups[0];

            return (
              <article
                key={summary.cakeType}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-purple-100 bg-purple-50">
                    <LazyImage
                      src={CAKE_TYPE_THUMBNAILS[summary.cakeType]}
                      alt=""
                      fill
                      sizes="64px"
                      imageClassName="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
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
                </div>

                <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="text-sm font-semibold text-slate-800">
                    Size prices for {selectedGroup.thickness} height
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4">
                    {selectedGroup.prices.map((pricePoint) => {
                      const overlayLines = getSizeOverlayLabel(pricePoint.size);

                      return (
                        <div
                          key={`${summary.cakeType}-${selectedGroup.thickness}-${pricePoint.size}`}
                          className="flex w-[118px] flex-col items-center gap-2 text-center"
                        >
                          <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-purple-300 bg-white shadow-sm shadow-purple-100/60">
                            <LazyImage
                              src={CAKE_SIZE_THUMBNAILS[pricePoint.size] || CAKE_TYPE_THUMBNAILS[summary.cakeType]}
                              alt=""
                              fill
                              sizes="112px"
                              imageClassName="object-cover opacity-[0.08]"
                            />
                            <div className="relative z-10 px-3 text-center">
                              <div className="text-[11px] font-bold leading-4 text-purple-600">
                                {overlayLines.map((line, index) => (
                                  <div key={`${pricePoint.size}-${line}-${index}`}>{line}</div>
                                ))}
                              </div>
                              <div className="mt-1 text-sm font-bold text-purple-700">
                                {formatPeso(pricePoint.price)}
                              </div>
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
                    <div className="mt-3 flex flex-wrap gap-3">
                      {summary.thicknesses.map((thickness) => {
                        const isSelected = selectedGroup.thickness === thickness;
                        return (
                          <button
                            key={`${summary.cakeType}-${thickness}`}
                            type="button"
                            onClick={() => handleThicknessSelect(summary.cakeType, thickness)}
                            className={`min-h-[64px] min-w-[92px] rounded-[1.1rem] border px-4 py-3 text-center text-lg font-black transition ${
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
    </>
  );
}
