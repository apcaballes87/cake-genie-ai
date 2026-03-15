import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const revalidate = 86400;

/**
 * Lists all available Pinterest RSS feed URLs — one per collection/board.
 * Use this to quickly grab all feed URLs for Pinterest auto-publish setup.
 *
 * GET /feed/pinterest/feeds → JSON list of { board, name, feedUrl, count }
 */
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: collections } = await supabase
    .from('cakegenie_collections')
    .select('name, slug, item_count')
    .order('name', { ascending: true });

  const baseUrl = 'https://genie.ph';
  const feeds = [
    {
      board: 'all',
      name: 'All Designs (Latest 200)',
      feedUrl: `${baseUrl}/feed/pinterest`,
      count: 200,
    },
    ...(collections || []).map((c: any) => ({
      board: c.slug,
      name: c.name,
      feedUrl: `${baseUrl}/feed/pinterest?board=${c.slug}`,
      count: c.item_count || 0,
    })),
  ];

  return NextResponse.json({
    total: feeds.length,
    instructions: {
      step1: 'Go to https://ph.pinterest.com/settings/bulk-create-pins/',
      step2: 'Scroll down to "Auto-publish" section',
      step3: 'Paste any feed URL below and choose a board',
      step4: 'Pinterest will auto-publish pins within 24 hours (max 200/day)',
      note: 'Your domain genie.ph must be claimed on Pinterest first',
    },
    feeds,
  });
}
