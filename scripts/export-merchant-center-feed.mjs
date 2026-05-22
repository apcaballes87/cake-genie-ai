#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, '../.cache/merchant-center');
const outputPath = resolve(outputDir, 'genieph-merchant-center.csv');

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Source .env/.env.local or export NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const GOOGLE_PRODUCT_CATEGORY =
  'Food, Beverages & Tobacco > Food Items > Bakery > Cakes & Dessert Bars > Cakes';
const CAKE_TYPE_THICKNESS_MAP = {
  '1 Tier': '4 in',
  '2 Tier': '4 in',
  '3 Tier': '4 in',
  'Square': '3 in',
  'Rectangle': '3 in',
  '1 Tier Fondant': '5 in',
  '2 Tier Fondant': '5 in',
  '3 Tier Fondant': '5 in',
  'Square Fondant': '5 in',
  'Rectangle Fondant': '5 in',
  Bento: '2 in',
};
const FALLBACK_MIN_PRICE = 1099;
const GOOGLE_MERCHANT_ID_MAX_LENGTH = 50;
const GOOGLE_MERCHANT_ID_HASH_LENGTH = 8;

const header = [
  'id',
  'title',
  'description',
  'link',
  'image_link',
  'additional_image_link',
  'availability',
  'price',
  'brand',
  'condition',
  'google_product_category',
  'product_type',
  'shipping_label',
  'custom_label_0',
  'custom_label_1',
  'custom_label_2',
  'custom_label_3',
  'custom_label_4',
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const { data: products, error: productsError } = await supabase
    .from('cakegenie_merchant_products')
    .select(`
      product_id,
      merchant_id,
      p_hash,
      title,
      slug,
      short_description,
      long_description,
      image_url,
      alt_text,
      brand,
      category,
      cake_type,
      custom_price,
      availability,
      tags,
      is_active
    `)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  if (productsError) throw productsError;

  const merchantIds = [...new Set((products || []).map((product) => product.merchant_id).filter(Boolean))];
  const pHashes = [...new Set((products || []).map((product) => product.p_hash).filter(Boolean))];
  const cakeTypes = [...new Set((products || []).map((product) => product.cake_type).filter(Boolean))];

  const [{ data: merchants, error: merchantsError }, { data: cacheRows, error: cacheError }, { data: basePriceRows, error: basePriceError }] = await Promise.all([
    supabase
      .from('cakegenie_merchants')
      .select('merchant_id, business_name, slug, city')
      .in('merchant_id', merchantIds),
    pHashes.length > 0
      ? supabase
          .from('cakegenie_analysis_cache')
          .select('p_hash, slug, original_image_url, studio_edited_image_url, seo_description, alt_text')
          .in('p_hash', pHashes)
      : Promise.resolve({ data: [], error: null }),
    cakeTypes.length > 0
      ? supabase
          .from('productsizes_cakegenie')
          .select('type, thickness, price')
          .in('type', cakeTypes)
          .order('price', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (merchantsError) throw merchantsError;
  if (cacheError) throw cacheError;
  if (basePriceError) throw basePriceError;

  const merchantMap = new Map((merchants || []).map((merchant) => [merchant.merchant_id, merchant]));
  const cacheMap = new Map((cacheRows || []).map((row) => [row.p_hash, row]));
  const basePriceMap = buildBasePriceMap(basePriceRows || []);

  const rows = (products || [])
    .map((product) => {
      const merchant = merchantMap.get(product.merchant_id);
      if (!merchant) return null;

      const cache = product.p_hash ? cacheMap.get(product.p_hash) : null;
      const title = firstNonEmpty(product.title, cache?.slug, product.slug);
      const description = firstNonEmpty(
        product.long_description,
        product.short_description,
        cache?.seo_description,
        `Customize ${title} from ${merchant.business_name}. Delivery and pickup depend on lead time and service area.`,
      );
      const primaryImage = firstNonEmpty(product.image_url, cache?.studio_edited_image_url, cache?.original_image_url);
      if (!title || !primaryImage) return null;

      const additionalImage = firstNonEmpty(
        cache?.studio_edited_image_url && cache?.studio_edited_image_url !== primaryImage ? cache.studio_edited_image_url : null,
        cache?.original_image_url && cache?.original_image_url !== primaryImage ? cache.original_image_url : null,
      );

      const labels = buildCustomLabels({
        availability: product.availability,
        merchantCity: merchant.city,
        cakeType: product.cake_type,
        uploadAssisted: Boolean(product.p_hash),
      });
      const activePrice = resolveMerchantProductPrice(product, basePriceMap);
      if (!activePrice || activePrice <= 0) return null;

      return {
        id: toGoogleMerchantId(String(product.product_id)),
        title,
        description,
        link: `https://genie.ph/shop/${merchant.slug}/${product.slug}`,
        image_link: primaryImage,
        additional_image_link: additionalImage || '',
        availability: mapFeedAvailability(product.availability),
        price: `${toPrice(activePrice)} PHP`,
        brand: firstNonEmpty(product.brand, merchant.business_name, 'Genie.ph'),
        condition: 'new',
        google_product_category: GOOGLE_PRODUCT_CATEGORY,
        product_type: [product.category, product.cake_type].filter(Boolean).join(' > '),
        shipping_label: merchant.city || 'Philippines',
        custom_label_0: labels.customLabel0,
        custom_label_1: labels.customLabel1,
        custom_label_2: labels.customLabel2,
        custom_label_3: labels.customLabel3,
        custom_label_4: labels.customLabel4,
      };
    })
    .filter(Boolean);

  const csv = [
    header.join(','),
    ...rows.map((row) =>
      header.map((column) => escapeCsv(row[column] ?? '')).join(','),
    ),
  ].join('\n');

  writeFileSync(outputPath, csv);
  console.log(`Exported ${rows.length} merchant products to ${outputPath}`);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function mapFeedAvailability(availability) {
  switch (availability) {
    case 'in_stock':
      return 'in stock';
    case 'out_of_stock':
      return 'out of stock';
    case 'preorder':
      return 'preorder';
    case 'made_to_order':
      return 'preorder';
    default:
      return 'preorder';
  }
}

function buildBasePriceMap(rows) {
  const priceMap = {};

  for (const row of rows) {
    const expectedThickness = CAKE_TYPE_THICKNESS_MAP[row.type];
    if (!expectedThickness) continue;
    if (row.thickness !== expectedThickness) continue;
    if (priceMap[row.type] != null) continue;

    priceMap[row.type] = Number(row.price);
  }

  return priceMap;
}

function resolveMerchantProductPrice(product, basePriceMap) {
  const directPrice = Number(product.custom_price || 0);
  if (Number.isFinite(directPrice) && directPrice > 0) {
    return directPrice;
  }

  const basePrice = Number(basePriceMap[product.cake_type] || 0);
  if (Number.isFinite(basePrice) && basePrice > 0) {
    return basePrice;
  }

  return FALLBACK_MIN_PRICE;
}

function toPrice(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return '0.00';
  return numeric.toFixed(2);
}

function buildCustomLabels({ availability, merchantCity, cakeType, uploadAssisted }) {
  return {
    customLabel0: availability || 'unknown',
    customLabel1: merchantCity || 'unspecified-city',
    customLabel2: cakeType || 'unspecified-cake-type',
    customLabel3: uploadAssisted ? 'upload-assisted' : 'standard-customization',
    customLabel4: availability === 'made_to_order' || availability === 'preorder' ? 'made-to-order' : 'catalog-product',
  };
}

function toGoogleMerchantId(rawValue) {
  if (rawValue.length <= GOOGLE_MERCHANT_ID_MAX_LENGTH) {
    return rawValue;
  }

  const suffix = stableShortHash(rawValue);
  const prefixLength =
    GOOGLE_MERCHANT_ID_MAX_LENGTH - GOOGLE_MERCHANT_ID_HASH_LENGTH - 1;

  return `${rawValue.slice(0, prefixLength)}-${suffix}`;
}

function stableShortHash(value) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(GOOGLE_MERCHANT_ID_HASH_LENGTH, '0');
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
