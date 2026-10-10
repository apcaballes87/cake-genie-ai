/**
 * Repair a small, explicit set of public Storage image URLs in place.
 * Dry run: npx tsx scripts/repair-seo-image-headers.ts --url=https://...
 * Apply:   npx tsx scripts/repair-seo-image-headers.ts --url=https://... --apply
 * For a bounded batch, use --published-canonical-file=<path> or
 * --published-shared-file=<path> (one URL per line). The script rejects URLs
 * that are no longer the image selected by the live sitemap rules.
 */
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  ensurePublicImageEligibility,
  parseGenieStorageObjectUrl,
  purgeSupabaseCdnObject,
  waitForPublicImageEligibility,
} from '../src/lib/seo/bingImageEligibilityBackfill';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const canonicalFile = args.find((arg) => arg.startsWith('--published-canonical-file='))?.slice('--published-canonical-file='.length);
const sharedFile = args.find((arg) => arg.startsWith('--published-shared-file='))?.slice('--published-shared-file='.length);
if (Number(Boolean(canonicalFile)) + Number(Boolean(sharedFile)) + Number(args.some((arg) => arg.startsWith('--url='))) !== 1) {
  throw new Error('Use either exact --url values or a published canonical image file.');
}
if (args.some((arg) => arg !== '--apply' && !arg.startsWith('--url=') && !arg.startsWith('--published-canonical-file=') && !arg.startsWith('--published-shared-file='))) {
  throw new Error('Unsupported argument.');
}
const inventoryFile = canonicalFile || sharedFile;
const rawUrls = inventoryFile
  ? fs.readFileSync(inventoryFile, 'utf8').split(/\r?\n/).map((url) => url.trim()).filter(Boolean)
  : args.filter((arg) => arg.startsWith('--url=')).map((arg) => arg.slice(6));
const urls = [...new Set(rawUrls)];
if (urls.length < 1 || urls.length > (inventoryFile ? 100 : 10)) {
  throw new Error('Provide 1 to 10 exact URLs, or 1 to 100 published sitemap URLs in a file.');
}

const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!origin || !secretKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}
for (const url of urls) {
  if (!parseGenieStorageObjectUrl(url, origin)) {
    throw new Error(`URL is outside the approved public Storage paths: ${url}`);
  }
}

const client = createClient(origin, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function validatePublishedCanonicalUrls() {
  if (!canonicalFile) return;
  const { toIndexableCustomizedCakeRow } = await import('../src/lib/sitemap/indexability');
  const slugs = urls.map((url) => {
    const objectPath = parseGenieStorageObjectUrl(url, origin)!.objectPath;
    const match = objectPath.match(/^variants\/([^/]+)\/\d+\.webp$/);
    if (!match) throw new Error(`Published canonical repair accepts only exact variant URLs: ${url}`);
    return match[1];
  });
  const { data, error } = await client
    .from('cakegenie_analysis_cache')
    .select('slug, created_at, seo_title, alt_text, keywords, original_image_url, studio_edited_image_url, image_variants, image_variants_indexed_source, image_width, image_height, seo_status')
    .eq('seo_status', 'published')
    .in('slug', slugs)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Published image inventory read failed: ${error.message}`);

  const preferredBySlug = new Map<string, string>();
  for (const row of data || []) {
    if (preferredBySlug.has(row.slug)) continue;
    const indexable = toIndexableCustomizedCakeRow(row);
    if (indexable) preferredBySlug.set(row.slug, indexable.image_url);
  }
  const invalid = urls.filter((url, index) => preferredBySlug.get(slugs[index]) !== url);
  if (invalid.length > 0) {
    if (!apply) {
      const eligiblePath = `${canonicalFile}.eligible`;
      fs.writeFileSync(
        eligiblePath,
        `${urls.filter((url, index) => preferredBySlug.get(slugs[index]) === url).join('\n')}\n`,
      );
      console.log(`Wrote currently selected image URLs to ${eligiblePath}.`);
    }
    throw new Error(`Refusing ${invalid.length} URLs that are not the currently selected sitemap image. First: ${invalid[0]}`);
  }
  console.log(`Verified ${urls.length} current published canonical image URLs.`);
}

async function validatePublishedSharedUrls() {
  if (!sharedFile) return;
  const { getSitemapCutoffDate, toIndexableCustomizedCakeRow, toIndexableSharedDesignRow } =
    await import('../src/lib/sitemap/indexability');
  const cutoffDate = getSitemapCutoffDate();
  const sharedSelect = 'url_slug, created_at, title, alt_text, description, original_image_url, customized_image_url';
  const [customizedResult, originalResult] = await Promise.all([
    client.from('cakegenie_shared_designs').select(sharedSelect)
      .not('url_slug', 'is', null).lte('created_at', cutoffDate)
      .like('customized_image_url', 'http%').order('created_at', { ascending: false }),
    client.from('cakegenie_shared_designs').select(
      'url_slug, created_at, title, alt_text, description, original_image_url',
    ).not('url_slug', 'is', null).lte('created_at', cutoffDate)
      .like('original_image_url', 'http%').order('created_at', { ascending: false }),
  ]);
  if (customizedResult.error || originalResult.error) {
    throw new Error(`Shared design read failed: ${customizedResult.error?.message || originalResult.error?.message}`);
  }
  const seen = new Set<string>();
  const designs = [...(customizedResult.data || []), ...(originalResult.data || [])]
    .map((row) => toIndexableSharedDesignRow(row))
    .filter((row) => {
      if (!row || seen.has(row.url_slug)) return false;
      seen.add(row.url_slug);
      return true;
    });
  const { data: collisions, error: collisionError } = await client
    .from('cakegenie_analysis_cache')
    .select('slug, created_at, seo_title, alt_text, keywords, original_image_url, studio_edited_image_url, image_variants, image_variants_indexed_source, image_width, image_height')
    .eq('seo_status', 'published')
    .in('slug', designs.map((design) => design!.url_slug))
    .order('created_at', { ascending: false });
  if (collisionError) throw new Error(`Shared design collision read failed: ${collisionError.message}`);
  const customizedSlugs = new Set((collisions || [])
    .map((row) => toIndexableCustomizedCakeRow(row)?.slug)
    .filter((slug): slug is string => Boolean(slug)));
  const selectedUrls = new Set(designs
    .filter((design) => !customizedSlugs.has(design!.url_slug))
    .map((design) => design!.image_url));
  console.log(`Published shared rows: ${designs.length}; selected image URLs: ${selectedUrls.size}.`);
  if (!apply) {
    const selectedPath = `${sharedFile}.selected`;
    const selectedStorageUrls = [...selectedUrls].filter((url) => parseGenieStorageObjectUrl(url, origin));
    fs.writeFileSync(selectedPath, `${selectedStorageUrls.join('\n')}\n`);
    console.log(`Wrote ${selectedStorageUrls.length} selected public Storage URLs to ${selectedPath}.`);
  }
  const invalid = urls.filter((url) => !selectedUrls.has(url));
  if (invalid.length > 0) {
    if (!apply) {
      const eligiblePath = `${sharedFile}.eligible`;
      fs.writeFileSync(eligiblePath, `${urls.filter((url) => selectedUrls.has(url)).join('\n')}\n`);
      console.log(`Wrote currently selected shared image URLs to ${eligiblePath}.`);
    }
    throw new Error(`Refusing ${invalid.length} URLs outside the published shared-image sitemap inventory. First: ${invalid[0]}`);
  }
  console.log(`Verified ${urls.length} current published shared image URLs.`);
}

async function normalGet(url: string) {
  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  await response.arrayBuffer();
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    xRobotsTag: response.headers.get('x-robots-tag'),
    cfCacheStatus: response.headers.get('cf-cache-status'),
  };
}

async function main() {
  await validatePublishedCanonicalUrls();
  await validatePublishedSharedUrls();
  for (const url of urls) {
    const before = await normalGet(url);
    if (before.status !== 200 || !before.contentType?.startsWith('image/')) {
      throw new Error(`Refusing to update a URL that does not return a public image: ${url}`);
    }

    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: url,
      expectedSupabaseOrigin: origin,
      apply,
    });
    console.log(JSON.stringify({ url, before, status: result.status, sha256: result.sha256 }));

    if (!apply) continue;
    if (result.status === 'updated-pending-public' || result.status === 'metadata-ready-public-blocked') {
      await purgeSupabaseCdnObject({ publicUrl: url, expectedSupabaseOrigin: origin, secretKey });
    }

    const verified = await waitForPublicImageEligibility({ urls: [url] });
    const after = await normalGet(url);
    console.log(JSON.stringify({ url, after, verified: verified.blocked.length === 0 }));
    if (verified.blocked.length > 0 || after.status !== 200 || after.xRobotsTag?.toLowerCase() !== 'all') {
      throw new Error(`Normal public GET still blocks image indexing: ${url}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
