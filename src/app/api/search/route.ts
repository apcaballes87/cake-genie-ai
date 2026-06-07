import { NextRequest, NextResponse } from 'next/server';
import { searchProductsFTS, searchProductsFTSCount } from '@/services/supabaseService';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  const availability = searchParams.get('availability')?.split(',').filter(Boolean) || undefined;
  const icingColors = searchParams.get('icingColors')?.split(',').filter(Boolean) || undefined;
  const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined;
  const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined;

  if (!query.trim()) {
    return NextResponse.json({ data: [], total: 0, query: '', limit, offset });
  }

  const [results, total] = await Promise.all([
    searchProductsFTS(query, limit, offset, { availability, minPrice, maxPrice, icingColors }),
    searchProductsFTSCount(query, { availability, minPrice, maxPrice, icingColors }),
  ]);

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
