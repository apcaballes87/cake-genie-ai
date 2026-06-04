import { toGoogleMerchantId } from '@/lib/commerce/feedIds';
import { slugToTitle } from '@/lib/utils/pinterest';

export const PINTEREST_CATALOG_PAGE_SIZE = 1000;
export const PINTEREST_CATALOG_FALLBACK_MIN_PRICE = 1099;

export type PinterestCatalogDesign = {
  slug?: string | null;
  keywords?: string[] | string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  alt_text?: string | null;
  studio_edited_image_url?: string | null;
  price?: number | null;
  tags?: string[] | null;
};

export type PinterestCatalogItem = {
  id: string;
  title: string;
  description: string;
  altText: string;
  link: string;
  imageLink: string;
  price: number;
  availability: 'in stock';
};

export function sanitizePinterestCatalogXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function sanitizePinterestCatalogImageUrl(url: string | null | undefined): string {
  if (!url || url.startsWith('data:')) return '';

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';

    if (parsed.hostname.includes('supabase')) {
      return `${parsed.origin}${parsed.pathname}`;
    }

    return parsed.toString();
  } catch {
    return '';
  }
}

function normalizeKeywords(keywords: PinterestCatalogDesign['keywords']): string {
  if (Array.isArray(keywords)) return keywords.filter(Boolean).join(', ');
  if (typeof keywords === 'string') return keywords.trim();
  return '';
}

export function buildPinterestCatalogItem(
  design: PinterestCatalogDesign,
  baseUrl = 'https://genie.ph',
): PinterestCatalogItem | null {
  const slug = design.slug?.trim();
  if (!slug) return null;

  const imageLink = sanitizePinterestCatalogImageUrl(design.studio_edited_image_url);
  if (!imageLink) return null;

  const price = design.price && design.price > 0
    ? Math.round(design.price)
    : PINTEREST_CATALOG_FALLBACK_MIN_PRICE;

  const keywords = normalizeKeywords(design.keywords);
  const firstTag = design.tags?.find((tag) => tag.trim().length > 0);
  const fallbackTitle = firstTag
    ? `${firstTag.charAt(0).toUpperCase()}${firstTag.slice(1)} Cake`
    : slugToTitle(slug);

  const title = (design.seo_title || fallbackTitle).slice(0, 500);
  const description = (
    design.seo_description
    || design.alt_text
    || `Custom ${keywords || slugToTitle(slug)} cake design from Genie.ph`
  ).slice(0, 10000);
  const altText = (
    design.alt_text
    || description
    || title
  )
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);

  return {
    id: toGoogleMerchantId(slug),
    title: sanitizePinterestCatalogXml(title),
    description: sanitizePinterestCatalogXml(description),
    altText: sanitizePinterestCatalogXml(altText),
    link: `${baseUrl}/customizing/${slug}`,
    imageLink,
    price,
    availability: 'in stock',
  };
}

export function buildPinterestCatalogItems(
  designs: PinterestCatalogDesign[],
  baseUrl = 'https://genie.ph',
): PinterestCatalogItem[] {
  const seenIds = new Set<string>();
  const items: PinterestCatalogItem[] = [];

  for (const design of designs) {
    const item = buildPinterestCatalogItem(design, baseUrl);
    if (!item || seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    items.push(item);
  }

  return items;
}

export function generatePinterestCatalogXml(baseUrl: string, items: PinterestCatalogItem[]): string {
  const itemsXml = items
    .map(item => `    <item>
      <g:id>${sanitizePinterestCatalogXml(item.id)}</g:id>
      <g:title>${item.title}</g:title>
      <g:description>${item.description}</g:description>
      <g:link>${sanitizePinterestCatalogXml(item.link)}</g:link>
      <g:image_link>${sanitizePinterestCatalogXml(item.imageLink)}</g:image_link>
      <g:alt_text>${item.altText}</g:alt_text>
      <g:price>${item.price} PHP</g:price>
      <g:availability>${item.availability}</g:availability>
      <g:condition>new</g:condition>
      <g:brand>Genie.ph</g:brand>
      <g:product_type>Food, Beverages &amp; Tobacco &gt; Food Items &gt; Bakery &gt; Cakes</g:product_type>
      <g:adult>false</g:adult>
    </item>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Genie.ph - Custom Cake Catalog</title>
    <link>${sanitizePinterestCatalogXml(baseUrl)}</link>
    <description>Studio-edited custom cake designs available from Genie.ph</description>
${itemsXml}
  </channel>
</rss>`;
}
