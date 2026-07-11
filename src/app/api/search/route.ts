import { after, NextRequest, NextResponse } from 'next/server';
import { searchProductsFTS, searchProductsFTSCount } from '@/services/supabaseService';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import {
  isTypesenseConfigured,
  recordTypesenseShadowComparison,
  searchTypesense,
  shouldSampleTypesenseShadow,
} from '@/lib/search/typesense';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  const availability = searchParams.get('availability')?.split(',').filter(Boolean) || undefined;
  const icingColors = searchParams.get('icingColors') || undefined;
  const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined;
  const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined;
  const shouldRecordAnalytics = searchParams.get('analytics') === '1';
  const analyticsSource = searchParams.get('analyticsSource') === 'search_page'
    ? 'search_page'
    : 'unknown';

  if (!query.trim()) {
    return NextResponse.json({ data: [], total: 0, query: '', limit, offset });
  }

  const baselineStartedAt = performance.now();
  const [results, total] = await Promise.all([
    searchProductsFTS(query, limit, offset, { availability, minPrice, maxPrice, icingColors }),
    searchProductsFTSCount(query, { availability, minPrice, maxPrice, icingColors }),
  ]);
  const baselineLatencyMs = Math.round(performance.now() - baselineStartedAt);

  const shouldCompareTypesense = isTypesenseConfigured() && shouldSampleTypesenseShadow();

  if (shouldRecordAnalytics || shouldCompareTypesense) {
    after(async () => {
      let adminSupabase: ReturnType<typeof createAdminServerSupabaseClient>;
      try {
        adminSupabase = createAdminServerSupabaseClient();
      } catch (error) {
        console.warn('Search background analytics unavailable:', error);
        return;
      }

      if (shouldRecordAnalytics) {
        const { error } = await adminSupabase.rpc('record_search_result', {
          p_search_term: query,
          p_result_count: total,
          p_source: analyticsSource,
        });
        if (error) console.warn('Search result analytics failed:', error.message);
      }

      if (shouldCompareTypesense) {
        try {
          const typesenseStartedAt = performance.now();
          const typesenseResults = await searchTypesense(query, {
            limit,
            offset,
            maxPrice,
            icingColor: icingColors,
          });
          const typesenseLatencyMs = Math.round(performance.now() - typesenseStartedAt);

          await recordTypesenseShadowComparison({
            query,
            baselineSlugs: (results.data || []).map((item: { slug?: string }) => item.slug).filter(Boolean) as string[],
            typesenseSlugs: typesenseResults.hits.map((hit) => hit.document.slug),
            baselineCount: total,
            typesenseCount: typesenseResults.found,
            baselineLatencyMs,
            typesenseLatencyMs,
            requestPath: request.nextUrl.pathname,
            supabase: adminSupabase,
          });
        } catch (error) {
          console.warn('Typesense shadow comparison failed:', error);
        }
      }
    });
  }

  return NextResponse.json(
    {
      data: results.data || [],
      total,
      query,
      limit,
      offset,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    }
  );
}
