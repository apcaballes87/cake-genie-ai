import type { CakeType, BasePriceInfo } from '@/types';
import { buildLowestCakeBasePriceOptions, type CakeBasePriceRow } from '@/lib/commerce/cakeBasePriceOptions';
import { getDesignPageStartingPrice } from '@/lib/commerce/machineReadable';
import { normalizeCakeType } from '@/lib/utils/cakeType';
import { slugToTitle } from '@/lib/utils/pinterest';

export const OPENAI_ADS_CATALOG_COLUMNS = [
  'item_id',
  'title',
  'description',
  'url',
  'brand',
  'image_url',
  'price',
  'availability',
  'seller_name',
  'seller_url',
  'return_policy',
  'target_countries',
  'store_country',
  'is_eligible_search',
  'is_eligible_checkout',
  'is_ads_eligible',
] as const;

export type OpenAIAdsAvailability = 'in_stock' | 'out_of_stock' | 'pre_order' | 'backorder' | 'unknown';

export interface OpenAIAdsCatalogDesign {
  slug?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  alt_text?: string | null;
  keywords?: string | null;
  tags?: string[] | null;
  price?: number | string | null;
  availability?: string | null;
  studio_edited_image_url?: string | null;
  analysis_json?: { cakeType?: unknown } | null;
}

export interface OpenAIAdsCatalogProduct {
  item_id: string;
  title: string;
  description: string;
  url: string;
  brand: string;
  image_url: string;
  price: string;
  availability: OpenAIAdsAvailability;
  seller_name: string;
  seller_url: string;
  return_policy: string;
  target_countries: string;
  store_country: string;
  is_eligible_search: 'false';
  is_eligible_checkout: 'false';
  is_ads_eligible: 'true';
}

export function mapDesignAvailabilityToOpenAIAds(
  availability: string | null | undefined,
): OpenAIAdsAvailability {
  switch (availability?.trim().toLowerCase()) {
    case 'rush':
    case 'same-day':
    case 'in_stock':
      return 'in_stock';
    case 'normal':
    case 'preorder':
    case 'pre_order':
    case 'made_to_order':
      return 'pre_order';
    case 'out_of_stock':
      return 'out_of_stock';
    case 'backorder':
      return 'backorder';
    default:
      return 'unknown';
  }
}

export function isPublicEditedImageUrl(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;

  try {
    const image = new URL(value.trim());
    if (image.protocol !== 'https:' || image.username || image.password) return false;
    if (/\/object\/sign\//i.test(image.pathname) || image.searchParams.has('token')) return false;
    return true;
  } catch {
    return false;
  }
}

function cleanPlainText(value: string | null | undefined, maxLength: number): string {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function buildTitle(design: OpenAIAdsCatalogDesign, slug: string): string {
  const seoTitle = cleanPlainText(design.seo_title, 180)
    .replace(/\s*\|\s*Genie\.ph\s*$/i, '')
    .trim();
  return (seoTitle || slugToTitle(slug, 150)).slice(0, 150);
}

function buildDescription(design: OpenAIAdsCatalogDesign, title: string): string {
  return cleanPlainText(design.seo_description || design.alt_text, 5000)
    || `Custom cake design from Genie.ph. Customize “${title}” and view current pricing on Genie.ph.`;
}

function parseStartingPrice(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function buildLowestPriceOptionsByCakeType(
  rows: Array<CakeBasePriceRow & { type: string }>,
): Partial<Record<CakeType, BasePriceInfo[]>> {
  const grouped = new Map<string, CakeBasePriceRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.type) || [];
    current.push(row);
    grouped.set(row.type, current);
  }

  const result: Partial<Record<CakeType, BasePriceInfo[]>> = {};
  for (const [type, typeRows] of grouped) {
    result[type as CakeType] = buildLowestCakeBasePriceOptions(typeRows);
  }
  return result;
}

export function buildOpenAIAdsCatalogProducts(
  designs: OpenAIAdsCatalogDesign[],
  options: {
    pricesByCakeType: Partial<Record<CakeType, BasePriceInfo[]>>;
    sellerUrl?: string;
    returnPolicyUrl: string;
    baseUrl?: string;
  },
): OpenAIAdsCatalogProduct[] {
  const baseUrl = (options.baseUrl || 'https://genie.ph').replace(/\/$/, '');
  const seen = new Set<string>();
  const products: OpenAIAdsCatalogProduct[] = [];

  for (const design of designs) {
    const slug = design.slug?.trim();
    if (!slug || !/^[a-z0-9][a-z0-9_-]{0,199}$/i.test(slug) || seen.has(slug)) continue;
    if (!isPublicEditedImageUrl(design.studio_edited_image_url)) continue;

    const cakeType = normalizeCakeType(design.analysis_json?.cakeType);
    const pagePrice = getDesignPageStartingPrice(
      options.pricesByCakeType[cakeType],
      parseStartingPrice(design.price),
    );
    if (pagePrice === null) continue;

    const title = buildTitle(design, slug);
    const description = buildDescription(design, title);
    const image = new URL(design.studio_edited_image_url);
    const itemId = slug;
    seen.add(itemId);

    products.push({
      item_id: itemId,
      title,
      description,
      url: `${baseUrl}/customizing/${encodeURIComponent(slug)}`,
      brand: 'Genie.ph',
      image_url: image.toString(),
      price: `${Math.round(pagePrice).toFixed(2)} PHP`,
      availability: mapDesignAvailabilityToOpenAIAds(design.availability),
      seller_name: 'Genie.ph',
      seller_url: options.sellerUrl || baseUrl,
      return_policy: options.returnPolicyUrl,
      target_countries: 'PH',
      store_country: 'PH',
      is_eligible_search: 'false',
      is_eligible_checkout: 'false',
      is_ads_eligible: 'true',
    });
  }

  return products;
}

export function escapeOpenAIAdsCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildOpenAIAdsCatalogCsv(products: OpenAIAdsCatalogProduct[]): string {
  const header = OPENAI_ADS_CATALOG_COLUMNS.join(',');
  const rows = products.map((product) => OPENAI_ADS_CATALOG_COLUMNS
    .map((column) => escapeOpenAIAdsCsvCell(product[column]))
    .join(','));
  return [header, ...rows].join('\r\n');
}
