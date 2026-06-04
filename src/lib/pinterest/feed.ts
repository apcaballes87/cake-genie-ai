import { isIndexableCollection } from '@/lib/collections/quality';
import { slugToTitle } from '@/lib/utils/pinterest';

export const PINTEREST_FEED_LIMIT = 200;

export type PinterestFeedCollection = {
  name?: string | null;
  slug?: string | null;
  tags?: string[] | null;
  description?: string | null;
  item_count?: number | null;
  publication_status?: string | null;
  is_indexable?: boolean | null;
};

export type PinterestFeedDesign = {
  slug?: string | null;
  keywords?: string[] | string | null;
  original_image_url?: string | null;
  studio_edited_image_url?: string | null;
  alt_text?: string | null;
  seo_description?: string | null;
  price?: number | null;
  created_at?: string | null;
  image_width?: number | null;
  image_height?: number | null;
};

export type PinterestFeedItem = {
  title: string;
  description: string;
  link: string;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  pubDate: string;
  price?: number | null;
};

export type ReadyPinterestFeedCollection = PinterestFeedCollection & {
  name: string;
  slug: string;
};

export function isPinterestCollectionFeedReady(
  collection: PinterestFeedCollection | null | undefined,
): collection is ReadyPinterestFeedCollection {
  if (!collection?.slug?.trim() || !collection.name?.trim()) return false;
  return isIndexableCollection(collection);
}

export function normalizePinterestFeedLimit(value: string | null): number {
  const parsed = Number.parseInt(value || `${PINTEREST_FEED_LIMIT}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return PINTEREST_FEED_LIMIT;
  return Math.min(parsed, PINTEREST_FEED_LIMIT);
}

export function buildPinterestCollectionSearchTerms(collection: PinterestFeedCollection): string[] {
  const rawTerms = [
    collection.name,
    collection.slug?.replace(/-/g, ' '),
    ...(collection.tags || []),
  ];

  const seen = new Set<string>();
  return rawTerms
    .map((term) => term?.trim().toLowerCase())
    .filter((term): term is string => Boolean(term && term.length >= 3))
    .filter((term) => {
      if (seen.has(term)) return false;
      seen.add(term);
      return true;
    });
}

export function sanitizeXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function sanitizePinterestImageUrl(url: string | null | undefined): string {
  if (!url || url.startsWith('data:')) return '';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';

    // Strip signed query params from Supabase Storage URLs so Pinterest sees a stable public asset URL.
    if (parsed.hostname.includes('supabase')) {
      return `${parsed.origin}${parsed.pathname}`;
    }

    return parsed.toString();
  } catch {
    return '';
  }
}

function normalizePinterestKeywords(keywords: PinterestFeedDesign['keywords']): string[] {
  if (Array.isArray(keywords)) return keywords;
  if (typeof keywords === 'string') {
    return keywords
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }
  return [];
}

export function buildPinterestFeedItems(
  designs: PinterestFeedDesign[],
  baseUrl = 'https://genie.ph',
): PinterestFeedItem[] {
  const seenLinks = new Set<string>();
  const items: PinterestFeedItem[] = [];

  for (const design of designs) {
    const slug = design.slug?.trim();
    if (!slug) continue;

    const imageUrl = sanitizePinterestImageUrl(
      design.studio_edited_image_url || design.original_image_url,
    );
    if (!imageUrl) continue;

    const link = `${baseUrl}/customizing/${slug}`;
    if (seenLinks.has(link)) continue;
    seenLinks.add(link);

    const title = slugToTitle(slug);
    let baseDescription = design.seo_description || design.alt_text || 'A beautiful custom cake design.';
    baseDescription = baseDescription.trim();
    if (baseDescription && !['.', '!', '?'].includes(baseDescription.slice(-1))) {
      baseDescription += '.';
    }

    let description = `${title}\n\n${baseDescription}`;
    if (design.price) {
      description += ` Starting at PHP ${design.price}.`;
    }
    description += '\n\nCustom cake design available from Genie.ph in Cebu, Philippines.';

    const keywordTags = normalizePinterestKeywords(design.keywords)
      .filter((keyword): keyword is string => typeof keyword === 'string' && keyword.trim().length > 2)
      .slice(0, 5)
      .map((keyword) => `#${keyword.replace(/[\s-]/g, '').toLowerCase()}`)
      .join(' ');

    description += `\n\n${keywordTags ? `${keywordTags} ` : ''}#cebucakes #genieph`;

    items.push({
      title,
      description: sanitizeXml(description),
      link,
      imageUrl,
      imageWidth: design.image_width || undefined,
      imageHeight: design.image_height || undefined,
      pubDate: design.created_at ? new Date(design.created_at).toUTCString() : new Date().toUTCString(),
      price: design.price,
    });
  }

  return items;
}
