import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isPinterestCollectionFeedReady, type PinterestFeedCollection } from '@/lib/pinterest/feed';

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
    .select('name, slug, item_count, publication_status, is_indexable')
    .order('name', { ascending: true });

  const baseUrl = 'https://genie.ph';
  const allCollections: PinterestFeedCollection[] = collections || [];
  const readyCollections = allCollections.filter(isPinterestCollectionFeedReady);
  const skippedCollections = allCollections.filter((collection) => !isPinterestCollectionFeedReady(collection));

  const feeds = [
    {
      board: 'all',
      name: 'All Designs (Latest 200)',
      feedUrl: `${baseUrl}/feed/pinterest`,
      count: 200,
      ready: true,
    },
    ...readyCollections.map((c) => ({
      board: c.slug,
      name: c.name,
      feedUrl: `${baseUrl}/feed/pinterest?board=${c.slug}`,
      count: c.item_count || 0,
      ready: true,
    })),
  ];

  return NextResponse.json({
    total: feeds.length,
    eligibleCollectionFeeds: readyCollections.length,
    skippedCollectionFeeds: skippedCollections.length,
    instructions: {
      step1: 'Go to https://ph.pinterest.com/settings/bulk-create-pins/',
      step2: 'Scroll down to "Auto-publish" section',
      step3: 'Paste one ready feed URL below and choose the matching board',
      step4: 'Pinterest will auto-publish pins within 24 hours (max 200/day)',
      note: 'Your domain genie.ph must be claimed on Pinterest first. Skipped collections are not published/indexable or have fewer than the catalog quality threshold.',
    },
    feeds,
    skipped: skippedCollections.map((c) => ({
      board: c.slug,
      name: c.name,
      count: c.item_count || 0,
      publication_status: c.publication_status || null,
      is_indexable: c.is_indexable === true,
      reason: 'Collection is not ready for Pinterest RSS auto-publish',
    })),
  });
}
