import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { slugToTitle } from '@/lib/utils/pinterest';

// Cache for 6 hours - Pinterest checks feeds within 24 hours
export const revalidate = 21600;

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
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get('limit') || '200', 10),
    200
  );

  let designs: any[] = [];
  let feedTitle = 'Genie.ph - Custom Cake Designs';
  let feedDescription = 'Beautiful custom cake designs from Genie.ph. Order online in Cebu, Philippines.';

  if (board) {
    // Fetch collection info
    const { data: collection } = await supabase
      .from('cakegenie_collections')
      .select('name, slug, tags, description')
      .eq('slug', board)
      .single();

    if (collection) {
      feedTitle = `${collection.name} - Genie.ph`;
      feedDescription = collection.description || `${collection.name} cake designs from Genie.ph`;

      // Build search terms from collection name + tags
      const searchTerms = [collection.name, ...(collection.tags || [])];
      const orFilter = searchTerms
        .map(term => {
          const cleaned = term.trim().toLowerCase();
          return [
            `keywords.ilike.%${cleaned}%`,
            `alt_text.ilike.%${cleaned}%`,
            `slug.ilike.%${cleaned}%`,
          ].join(',');
        })
        .join(',');

      const { data } = await supabase
        .from('cakegenie_analysis_cache')
        .select('slug, keywords, original_image_url, alt_text, seo_description, price, created_at, image_width, image_height')
        .not('original_image_url', 'is', null)
        .not('slug', 'is', null)
        .or(orFilter)
        .order('created_at', { ascending: true }) // Oldest first per Pinterest docs
        .limit(limit);

      designs = data || [];
    }
  } else {
    // All latest designs
    const { data } = await supabase
      .from('cakegenie_analysis_cache')
      .select('slug, keywords, original_image_url, alt_text, seo_description, price, created_at, image_width, image_height')
      .not('original_image_url', 'is', null)
      .not('slug', 'is', null)
      .not('price', 'is', null)
      .order('created_at', { ascending: true }) // Oldest first
      .limit(limit);

    designs = data || [];
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
    items: designs.map(design => {
      const title = formatTitle(design.slug);
      
      let baseDesc = design.seo_description || design.alt_text || 'A beautiful custom cake design.';
      baseDesc = baseDesc.trim();
      if (baseDesc && !['.', '!', '?'].includes(baseDesc.slice(-1))) {
        baseDesc += '.';
      }

      let richDesc = `${title} 🎂\n\n${baseDesc}`;
      if (design.price) {
        richDesc += ` Starting at PHP ${design.price}.`;
      }
      richDesc += `\n\nPerfect for your next celebration in Cebu, Philippines! Order online at Genie.ph custom cake shop.`;

      // Extract hashtags from keywords
      let hashtagString = '#cebucakes #customcakes #genieph #cakedesign #birthdaycake';
      if (design.keywords && Array.isArray(design.keywords) && design.keywords.length > 0) {
        const keywordTags = design.keywords
            .filter((k: any) => typeof k === 'string' && k.length > 2)
            .slice(0, 5)
            .map((k: string) => `#${k.replace(/[\s-]/g, '').toLowerCase()}`)
            .join(' ');
        if (keywordTags) {
          hashtagString = `${keywordTags} #cebucakes #genieph`;
        }
      }
      richDesc += `\n\n${hashtagString}`;

      return {
        title,
        description: sanitizeXml(richDesc),
        link: `${baseUrl}/customizing/${design.slug}`,
        imageUrl: sanitizeImageUrl(design.original_image_url),
        imageWidth: design.image_width || undefined,
        imageHeight: design.image_height || undefined,
        pubDate: design.created_at ? new Date(design.created_at).toUTCString() : new Date().toUTCString(),
        // price is handled in richDesc now, but we'll keep it for the interface
        price: design.price,
      };
    }),
  });

  return new Response(rssXml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=21600, s-maxage=21600',
    },
  });
}

// ─── Helpers ──────────────────────────────────────────

function formatTitle(slug: string): string {
  return slugToTitle(slug);
}

function sanitizeXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeImageUrl(url: string | null): string {
  if (!url || url.startsWith('data:')) return '';
  try {
    const parsed = new URL(url);
    // Strip Supabase auth tokens from URLs
    if (parsed.hostname.includes('supabase')) {
      return `${parsed.origin}${parsed.pathname}`;
    }
    return url;
  } catch {
    return url || '';
  }
}

interface RSSFeedOptions {
  title: string;
  description: string;
  link: string;
  feedUrl: string;
  items: {
    title: string;
    description: string;
    link: string;
    imageUrl: string;
    imageWidth?: number;
    imageHeight?: number;
    pubDate: string;
    price?: number;
  }[];
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
