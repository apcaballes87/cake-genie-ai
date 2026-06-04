import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import {
  buildPinterestCollectionSearchTerms,
  buildPinterestFeedItems,
  isPinterestCollectionFeedReady,
  normalizePinterestFeedLimit,
  sanitizeXml,
  type PinterestFeedItem,
  type PinterestFeedDesign,
} from '@/lib/pinterest/feed';

// Cache for 6 hours - Pinterest checks feeds within 24 hours
export const revalidate = 21600;

const PINTEREST_FEED_QUERY_TIMEOUT_MS = 8000;

type FeedQueryError = {
  message?: string;
};

type SupabaseFeedQuery<T> = {
  abortSignal: (signal: AbortSignal) => PromiseLike<{ data: T[] | null; error: FeedQueryError | null }>;
};

async function runFeedQuery<T>(query: SupabaseFeedQuery<T>, label: string): Promise<T[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PINTEREST_FEED_QUERY_TIMEOUT_MS);

  try {
    const { data, error } = await query.abortSignal(controller.signal);
    if (error) {
      console.error(`Pinterest RSS query failed (${label}):`, error.message || error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error(`Pinterest RSS query aborted or failed (${label}):`, error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Pinterest RSS Feed - Auto-publish pins from your domain.
 *
 * Usage:
 *   /feed/pinterest              → All latest designs (up to 200)
 *   /feed/pinterest?board=birthday-cakes  → Designs from a specific collection
 *
 * Pinterest requirements:
 *   - RSS 2.0 XML format (NOT Atom)
 *   - Each <item> needs: <title>, <description>, <link> (to claimed domain), image tag
 *   - Max 200 items per feed
 *   - Oldest content published first
 */
export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const board = request.nextUrl.searchParams.get('board');
  const limit = normalizePinterestFeedLimit(request.nextUrl.searchParams.get('limit'));

  let designs: PinterestFeedDesign[] = [];
  let feedTitle = 'Genie.ph - Custom Cake Designs';
  let feedDescription = 'Beautiful custom cake designs from Genie.ph. Order online in Cebu, Philippines.';

  if (board) {
    // Fetch collection info
    const { data: collection } = await supabase
      .from('cakegenie_collections')
      .select('name, slug, tags, description, item_count, publication_status, is_indexable')
      .eq('slug', board)
      .single();

    if (isPinterestCollectionFeedReady(collection)) {
      feedTitle = `${collection.name} - Genie.ph`;
      feedDescription = collection.description || `${collection.name} cake designs from Genie.ph`;

      // Build search terms from collection name + tags
      const searchTerms = buildPinterestCollectionSearchTerms(collection);
      const orFilter = searchTerms
        .map(term => {
          return [
            `keywords.ilike.%${term}%`,
            `alt_text.ilike.%${term}%`,
            `slug.ilike.%${term.replace(/\s+/g, '-')}%`,
          ].join(',');
        })
        .join(',');

      const data = await runFeedQuery<PinterestFeedDesign>(supabase
        .from('cakegenie_analysis_cache')
        .select('slug, keywords, original_image_url, studio_edited_image_url, alt_text, seo_description, price, created_at, image_width, image_height')
        .not('studio_edited_image_url', 'is', null)
        .not('slug', 'is', null)
        .not('price', 'is', null)
        .or(orFilter)
        .order('created_at', { ascending: false })
        .limit(limit), `board:${board}`);

      designs = [...(data || [])].reverse(); // Pinterest wants oldest first within the selected feed window.
    }
  } else {
    // All latest designs
    const data = await runFeedQuery<PinterestFeedDesign>(supabase
      .from('cakegenie_analysis_cache')
      .select('slug, keywords, original_image_url, studio_edited_image_url, alt_text, seo_description, price, created_at, image_width, image_height')
      .not('studio_edited_image_url', 'is', null)
      .not('slug', 'is', null)
      .not('price', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit), 'all-designs');

    designs = [...(data || [])].reverse(); // Pinterest wants oldest first within the selected feed window.
  }

  const baseUrl = 'https://genie.ph';
  const feedUrl = board
    ? `${baseUrl}/feed/pinterest?board=${board}`
    : `${baseUrl}/feed/pinterest`;

  const rssXml = generateRSS({
    title: feedTitle,
    description: feedDescription,
    link: baseUrl,
    feedUrl,
    items: buildPinterestFeedItems(designs, baseUrl),
  });

  return new Response(rssXml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=21600, s-maxage=21600',
    },
  });
}

interface RSSFeedOptions {
  title: string;
  description: string;
  link: string;
  feedUrl: string;
  items: PinterestFeedItem[];
}

function generateRSS(options: RSSFeedOptions): string {
  const { title, description, link, feedUrl, items } = options;

  const itemsXml = items
    .filter(item => item.imageUrl) // Pinterest requires an image
    .map(item => {
      return `    <item>
      <title>${sanitizeXml(item.title)}</title>
      <description>${item.description}</description>
      <link>${sanitizeXml(item.link)}</link>
      <guid isPermaLink="true">${sanitizeXml(item.link)}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <enclosure url="${sanitizeXml(item.imageUrl)}" type="image/jpeg" />
      <media:content url="${sanitizeXml(item.imageUrl)}" medium="image"${item.imageWidth ? ` width="${item.imageWidth}"` : ''}${item.imageHeight ? ` height="${item.imageHeight}"` : ''} />
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${sanitizeXml(title)}</title>
    <description>${sanitizeXml(description)}</description>
    <link>${sanitizeXml(link)}</link>
    <atom:link href="${sanitizeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <language>en-ph</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Genie.ph Pinterest Feed</generator>
${itemsXml}
  </channel>
</rss>`;
}
