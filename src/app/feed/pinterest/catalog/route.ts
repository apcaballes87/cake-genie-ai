import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildPinterestCatalogItems,
  generatePinterestCatalogXml,
  PINTEREST_CATALOG_PAGE_SIZE,
  type PinterestCatalogDesign,
} from '@/lib/pinterest/catalog';

export const revalidate = 21600;

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const designs = await fetchAllPinterestCatalogDesigns(supabase);

  if (!designs) {
    return new Response('Pinterest catalog generation failed', { status: 500 });
  }

  const baseUrl = 'https://genie.ph';
  const items = buildPinterestCatalogItems(designs, baseUrl);
  const xml = generatePinterestCatalogXml(baseUrl, items);

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=21600, s-maxage=21600',
    },
  });
}

async function fetchAllPinterestCatalogDesigns(
  supabase: SupabaseClient,
): Promise<PinterestCatalogDesign[] | null> {
  const designs: PinterestCatalogDesign[] = [];
  let pageStart = 0;

  while (true) {
    const pageEnd = pageStart + PINTEREST_CATALOG_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('slug, keywords, seo_title, seo_description, alt_text, studio_edited_image_url, price, tags')
      .not('studio_edited_image_url', 'is', null)
      .not('slug', 'is', null)
      .not('price', 'is', null)
      .order('created_at', { ascending: false })
      .range(pageStart, pageEnd);

    if (error) {
      console.error('Pinterest catalog feed error:', error.message);
      return null;
    }

    if (!data || data.length === 0) {
      break;
    }

    designs.push(...(data as PinterestCatalogDesign[]));

    if (data.length < PINTEREST_CATALOG_PAGE_SIZE) {
      break;
    }

    pageStart += PINTEREST_CATALOG_PAGE_SIZE;
  }

  return designs;
}
