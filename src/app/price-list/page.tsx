import type { SupabaseClient } from '@supabase/supabase-js';
import Link from 'next/link';

import AnimatedBlobs from '@/components/UI/AnimatedBlobs';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { getDeliveryRateCards } from '@/lib/commerce/deliveryRates';
import {
  buildCakeTypePriceSummaries,
  type CakeTypePriceRow,
} from '@/lib/pricing/priceList';
import { buildReviewSummary } from '@/lib/reviews';
import { createClient } from '@/lib/supabase/server';
import { buildMarketingPageMetadata } from '@/lib/utils/metadata';

import PriceListBrowser from './PriceListBrowser';
import PriceListHeader from './PriceListHeader';

export const metadata = buildMarketingPageMetadata({
  title: 'Custom Cake Price List in Cebu',
  description:
    'Browse Genie.ph base price ranges by cake type and size, then review flat delivery fees per Cebu city before customizing your order.',
  canonicalPath: 'https://genie.ph/price-list',
});

async function getReviewSummary() {
  const supabase: SupabaseClient = await createClient();
  const { data: ratingRows, error } = await supabase
    .from('cakegenie_reviews')
    .select('rating')
    .eq('is_visible', true)
    .eq('is_approved', true);

  if (error) {
    console.error('Error fetching review summary for price list page:', error);
    return { total: 0, averageRating: 0 };
  }

  return buildReviewSummary(ratingRows);
}

async function getPriceRows(): Promise<CakeTypePriceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('productsizes_cakegenie')
    .select('type, thickness, cakesize, price, display_order')
    .order('type', { ascending: true })
    .order('thickness', { ascending: true })
    .order('display_order', { ascending: true })
    .order('cakesize', { ascending: true });

  if (error) {
    console.error('Error fetching price list rows:', error);
    return [];
  }

  return (data ?? []).flatMap((row) => {
    if (
      typeof row.type !== 'string' ||
      typeof row.thickness !== 'string' ||
      typeof row.cakesize !== 'string' ||
      typeof row.price !== 'number'
    ) {
      return [];
    }

    return [{
      type: row.type as CakeTypePriceRow['type'],
      thickness: row.thickness as CakeTypePriceRow['thickness'],
      cakesize: row.cakesize,
      price: row.price,
      display_order: typeof row.display_order === 'number' ? row.display_order : null,
    }];
  });
}

export default async function PriceListPage() {
  const [reviewSummary, priceRows] = await Promise.all([
    getReviewSummary(),
    getPriceRows(),
  ]);

  const summaries = buildCakeTypePriceSummaries(priceRows);
  const deliveryRates = getDeliveryRateCards();

  return (
    <>
      <main className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(245,208,254,0.42),_transparent_30%),linear-gradient(180deg,_#fcfbff_0%,_#f8fafc_44%,_#ffffff_100%)] pb-24 md:pb-0">
        <AnimatedBlobs />
        <PriceListHeader />

        <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 lg:px-8 lg:pt-16">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white/80 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-purple-600 shadow-sm backdrop-blur">
              Cake pricing guide
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl">
              Price List for Custom Cake Base Prices in Cebu
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
              Browse the starting base prices for each cake type, compare sizes, and use the ranges below as your planning guide before you customize your final design.
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Need a practical visual starting point?{' '}
              <Link href="/collections/minimalist-cake" className="font-semibold text-purple-700 hover:text-purple-900 hover:underline">
                Browse minimalist cake designs in Cebu
              </Link>{' '}
              before comparing sizes and finishes.
            </p>
            <div className="mt-6 rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-5 shadow-sm">
              <p className="text-sm leading-7 text-amber-950">
                Prices shown here are starting points only. Final pricing can increase depending on the difficulty and intricacy of the design, plus added toppers, messages, florals, or special finishing work.
              </p>
            </div>
          </div>

          <div className="mt-10">
            <PriceListBrowser summaries={summaries} deliveryRates={deliveryRates} />
          </div>
        </section>
      </main>

      <LandingFooter reviewSummary={reviewSummary} />
    </>
  );
}
