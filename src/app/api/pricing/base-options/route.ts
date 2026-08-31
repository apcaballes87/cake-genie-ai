import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import type { BasePriceCatalog } from '@/lib/pricing/basePriceCatalog';

const CAKES_AND_MEMORIES_PRICING_ENABLED =
  process.env.CAKES_AND_MEMORIES_PRICING_ENABLED === 'true';

const CATALOG_TABLES: Record<BasePriceCatalog, string> = {
  genie: 'productsizes_cakegenie',
  cakes_and_memories: 'productsizes_cakesandmemories',
};

function resolveCatalog(requestedCatalog: string | null): BasePriceCatalog {
  if (requestedCatalog === 'cakes_and_memories' && CAKES_AND_MEMORIES_PRICING_ENABLED) {
    return 'cakes_and_memories';
  }

  return 'genie';
}

function isSafeLookupValue(value: string | null): value is string {
  return Boolean(value && value.length <= 100);
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type');
  const thickness = request.nextUrl.searchParams.get('thickness');

  if (!isSafeLookupValue(type) || !isSafeLookupValue(thickness)) {
    return NextResponse.json(
      { error: 'type and thickness are required.' },
      { status: 400 },
    );
  }

  const catalog = resolveCatalog(request.nextUrl.searchParams.get('catalog'));

  try {
    const { data, error } = await createAdminServerSupabaseClient()
      .from(CATALOG_TABLES[catalog])
      .select('cakesize, price, display_order')
      .eq('type', type)
      .eq('thickness', thickness)
      .order('display_order', { ascending: true })
      .order('cakesize', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      catalog,
      options: (data || []).map((item) => ({ size: item.cakesize, price: item.price })),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Failed to fetch base-price options:', error);
    return NextResponse.json(
      { error: 'Could not load base-price options.' },
      { status: 500 },
    );
  }
}
