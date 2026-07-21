/**
 * Makes the exact crawler-facing images for sitemap-eligible customizer pages
 * explicitly indexable by Bing and Google without changing their public URLs
 * or bytes.
 *
 * Usage:
 *   npm run backfill:bing-images -- --scope=canary
 *   npm run backfill:bing-images -- --scope=canary --apply
 *   npm run backfill:bing-images -- --scope=all --apply
 *
 * The script is dry-run by default. It has no arbitrary URL, bucket, prefix,
 * concurrency, or batch-size arguments: its only source of targets is the
 * shared sitemap indexability gate.
 */

import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SITE_ORIGIN = 'https://genie.ph';
const CANARY_FILE = path.resolve(process.cwd(), 'docs/seo/2026-07-21-bing-image-canary.txt');
const CHECKPOINT_FILE = path.resolve(process.cwd(), '.cache/bing-image-eligibility-checkpoint.json');
const FETCH_PAGE_SIZE = 1000;

type Scope = 'canary' | 'all';

type CustomizedCakeRow = {
  slug: string | null;
  created_at: string;
  seo_title: string | null;
  alt_text: string | null;
  keywords: string | null;
  original_image_url: string | null;
  studio_edited_image_url: string | null;
  image_variants?: unknown;
  image_width?: number | null;
  image_height?: number | null;
};

type SharedDesignRow = {
  url_slug: string | null;
  created_at: string;
  title: string | null;
  alt_text: string | null;
  description: string | null;
  original_image_url: string | null;
  customized_image_url: string | null;
  image_width?: number | null;
  image_height?: number | null;
};

type InventoryPage = {
  slug: string;
  pageUrl: string;
  imageUrls: string[];
};

type Checkpoint = {
  version: 1;
  updatedAt: string;
  completed: Record<string, {
    status: 'updated' | 'already-eligible';
    sha256: string | null;
  }>;
};

function parseArgs(argv: string[]): { scope: Scope; apply: boolean } {
  let scope: Scope = 'canary';
  let apply = false;

  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true;
      continue;
    }
    if (arg.startsWith('--scope=')) {
      const value = arg.slice('--scope='.length);
      if (value !== 'canary' && value !== 'all') {
        throw new Error(`Unsupported scope: ${value}`);
      }
      scope = value;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }

  return { scope, apply };
}

async function fetchAllPages<T>(
  fetchPage: (offset: number) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let offset = 0; ; offset += FETCH_PAGE_SIZE) {
    const page = await fetchPage(offset);
    rows.push(...page);
    if (page.length < FETCH_PAGE_SIZE) return rows;
  }
}

async function fetchCustomizedRows(
  supabase: SupabaseClient,
  cutoffDate: string,
): Promise<CustomizedCakeRow[]> {
  return fetchAllPages(async (offset) => {
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('slug, created_at, seo_title, alt_text, keywords, original_image_url, studio_edited_image_url, image_variants, image_width, image_height')
      .not('slug', 'is', null)
      .lte('created_at', cutoffDate)
      .order('created_at', { ascending: false })
      .range(offset, offset + FETCH_PAGE_SIZE - 1)
      .returns<CustomizedCakeRow[]>();

    if (error) throw new Error(`Failed to load customized cakes: ${error.message}`);
    return data ?? [];
  });
}

async function fetchSharedRows(
  supabase: SupabaseClient,
  cutoffDate: string,
  imageSource: 'customized' | 'original',
): Promise<SharedDesignRow[]> {
  return fetchAllPages(async (offset) => {
    const select = imageSource === 'customized'
      ? 'url_slug, created_at, title, alt_text, description, original_image_url, customized_image_url'
      : 'url_slug, created_at, title, alt_text, description, original_image_url';

    let query = supabase
      .from('cakegenie_shared_designs')
      .select(select)
      .not('url_slug', 'is', null)
      .lte('created_at', cutoffDate)
      .order('created_at', { ascending: false })
      .range(offset, offset + FETCH_PAGE_SIZE - 1);

    query = imageSource === 'customized'
      ? query.like('customized_image_url', 'http%')
      : query.like('original_image_url', 'http%');

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load shared designs: ${error.message}`);

    return (data ?? []).map((row) => ({
      ...(row as unknown as SharedDesignRow),
      customized_image_url: imageSource === 'customized'
        ? ((row as unknown as SharedDesignRow).customized_image_url ?? null)
        : null,
    }));
  });
}

function loadCanaryUrls(): Set<string> {
  const values = fs.readFileSync(CANARY_FILE, 'utf8')
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => value && !value.startsWith('#'));

  if (values.length !== 20 || new Set(values).size !== 20) {
    throw new Error(`Canary file must contain exactly 20 unique page URLs; found ${values.length}.`);
  }

  return new Set(values);
}

function loadCheckpoint(): Checkpoint {
  if (!fs.existsSync(CHECKPOINT_FILE)) {
    return { version: 1, updatedAt: new Date(0).toISOString(), completed: {} };
  }

  const parsed = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')) as Checkpoint;
  if (parsed.version !== 1 || !parsed.completed || typeof parsed.completed !== 'object') {
    throw new Error(`Invalid checkpoint: ${CHECKPOINT_FILE}`);
  }
  return parsed;
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  fs.mkdirSync(path.dirname(CHECKPOINT_FILE), { recursive: true });
  checkpoint.updatedAt = new Date().toISOString();
  const temporaryFile = `${CHECKPOINT_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryFile, CHECKPOINT_FILE);
}

async function buildInventory(supabase: SupabaseClient): Promise<InventoryPage[]> {
  const {
    getSitemapCutoffDate,
    toIndexableCustomizedCakeRow,
    toIndexableSharedDesignRow,
  } = await import('../src/lib/sitemap/indexability');
  const { getPublicCrawlerImageManifest } = await import('../src/lib/seo/crawlerImage');

  const cutoffDate = getSitemapCutoffDate();
  const [customizedRows, customizedSharedRows, originalSharedRows] = await Promise.all([
    fetchCustomizedRows(supabase, cutoffDate),
    fetchSharedRows(supabase, cutoffDate, 'customized'),
    fetchSharedRows(supabase, cutoffDate, 'original'),
  ]);

  const pages: InventoryPage[] = [];
  const customizedSlugs = new Set<string>();

  for (const row of customizedRows) {
    const indexable = toIndexableCustomizedCakeRow(row);
    if (!indexable || customizedSlugs.has(indexable.slug)) continue;
    customizedSlugs.add(indexable.slug);

    const manifest = getPublicCrawlerImageManifest(row.image_variants);
    const imageUrls = manifest?.variants.map((variant) => variant.url) ?? [indexable.image_url];
    pages.push({
      slug: indexable.slug,
      pageUrl: `${SITE_ORIGIN}/customizing/${indexable.slug}`,
      imageUrls: [...new Set(imageUrls)],
    });
  }

  const sharedSlugs = new Set<string>();
  for (const row of [...customizedSharedRows, ...originalSharedRows]) {
    const indexable = toIndexableSharedDesignRow(row);
    if (!indexable || customizedSlugs.has(indexable.url_slug) || sharedSlugs.has(indexable.url_slug)) continue;
    sharedSlugs.add(indexable.url_slug);
    pages.push({
      slug: indexable.url_slug,
      pageUrl: `${SITE_ORIGIN}/customizing/${indexable.url_slug}`,
      imageUrls: [indexable.image_url],
    });
  }

  return pages;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(values.length);
  let cursor = 0;

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;

      try {
        results[index] = { status: 'fulfilled', value: await worker(values[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }));

  return results;
}

async function main(): Promise<void> {
  const { scope, apply } = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    BING_IMAGE_BACKFILL_CONCURRENCY,
    BING_IMAGE_BACKFILL_PAGE_BATCH_SIZE,
    ensurePublicImageEligibility,
  } = await import('../src/lib/seo/bingImageEligibilityBackfill');

  const allPages = await buildInventory(supabase);
  const canaryUrls = scope === 'canary' ? loadCanaryUrls() : null;
  const pages = canaryUrls
    ? allPages.filter((page) => canaryUrls.has(page.pageUrl))
    : allPages;

  if (canaryUrls && pages.length !== canaryUrls.size) {
    const inventoryUrls = new Set(pages.map((page) => page.pageUrl));
    const missing = [...canaryUrls].filter((url) => !inventoryUrls.has(url));
    throw new Error(`Canary pages are no longer in the sitemap inventory: ${missing.join(', ')}`);
  }

  const checkpoint = loadCheckpoint();
  const seenImages = new Set<string>();
  let updated = 0;
  let alreadyEligible = 0;
  let dryRun = 0;
  let externalSkipped = 0;
  let checkpointSkipped = 0;
  const failures: Array<{ url: string; error: string }> = [];

  console.log('Genie.ph Bing image eligibility backfill');
  console.log(`scope=${scope} apply=${apply} pages=${pages.length} batchSize=${BING_IMAGE_BACKFILL_PAGE_BATCH_SIZE} concurrency=${BING_IMAGE_BACKFILL_CONCURRENCY}`);

  for (let offset = 0; offset < pages.length; offset += BING_IMAGE_BACKFILL_PAGE_BATCH_SIZE) {
    const pageBatch = pages.slice(offset, offset + BING_IMAGE_BACKFILL_PAGE_BATCH_SIZE);
    const images = pageBatch
      .flatMap((page) => page.imageUrls)
      .filter((url) => {
        if (seenImages.has(url)) return false;
        seenImages.add(url);
        return true;
      });

    const pendingImages = images.filter((url) => {
      if (!apply || !checkpoint.completed[url]) return true;
      checkpointSkipped += 1;
      return false;
    });

    const results = await mapWithConcurrency(
      pendingImages,
      BING_IMAGE_BACKFILL_CONCURRENCY,
      (publicUrl) => ensurePublicImageEligibility({
        client: supabase,
        publicUrl,
        expectedSupabaseOrigin: supabaseUrl,
        apply,
      }),
    );

    results.forEach((result, index) => {
      const url = pendingImages[index];
      if (result.status === 'rejected') {
        failures.push({
          url,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
        return;
      }

      const value = result.value;
      if (value.status === 'updated') updated += 1;
      if (value.status === 'already-eligible') alreadyEligible += 1;
      if (value.status === 'dry-run') dryRun += 1;
      if (value.status === 'external-skipped') externalSkipped += 1;

      if (apply && (value.status === 'updated' || value.status === 'already-eligible')) {
        checkpoint.completed[value.url] = {
          status: value.status,
          sha256: value.sha256 ?? null,
        };
      }
    });

    if (apply) saveCheckpoint(checkpoint);
    console.log(`batch=${Math.floor(offset / BING_IMAGE_BACKFILL_PAGE_BATCH_SIZE) + 1} pages=${Math.min(offset + pageBatch.length, pages.length)}/${pages.length} updated=${updated} eligible=${alreadyEligible} dryRun=${dryRun} external=${externalSkipped} failures=${failures.length}`);
  }

  console.log(JSON.stringify({
    scope,
    apply,
    pages: pages.length,
    uniqueImages: seenImages.size,
    updated,
    alreadyEligible,
    dryRun,
    externalSkipped,
    checkpointSkipped,
    failures: failures.length,
  }, null, 2));

  if (failures.length > 0) {
    for (const failure of failures.slice(0, 50)) {
      console.error(`${failure.url}: ${failure.error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
