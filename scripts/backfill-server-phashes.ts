import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  computeImageFingerprint,
  FINGERPRINT_PIPELINE,
  MAX_FINGERPRINT_INPUT_BYTES,
} from '../src/lib/server/imageFingerprint';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

interface CacheRow {
  id: string;
  p_hash: string;
  original_image_url: string | null;
}

interface CacheReferenceTarget {
  id: string;
  p_hash: string;
}

const DUPLICATE_FINGERPRINT_PREFIX = `duplicate-of:${FINGERPRINT_PIPELINE}:`;

function getArg(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];

  return null;
}

function getLimit() {
  const raw = getArg('--limit');
  const parsed = raw ? Number.parseInt(raw, 10) : 50;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

function getConcurrency() {
  const raw = getArg('--concurrency');
  const parsed = raw ? Number.parseInt(raw, 10) : 4;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isDuplicatePHashError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

async function updateRelatedReferences(
  supabase: any,
  previousHash: string,
  nextHash: string
) {
  if (previousHash === nextHash) {
    return;
  }

  const db = supabase as any;

  const relatedUpdates = await Promise.all([
    db
      .from('cakegenie_saved_items')
      .update({ analysis_p_hash: nextHash })
      .eq('analysis_p_hash', previousHash),
    db
      .from('cakegenie_merchant_products')
      .update({ p_hash: nextHash })
      .eq('p_hash', previousHash),
    db
      .from('cakegenie_pinterest_pins')
      .update({ p_hash: nextHash })
      .eq('p_hash', previousHash),
  ]);

  for (const relatedUpdate of relatedUpdates) {
    if (relatedUpdate.error) {
      console.warn(`Related p_hash reference update failed for ${previousHash}: ${relatedUpdate.error.message}`);
    }
  }
}

async function findCanonicalRow(
  supabase: any,
  pHash: string
) {
  const db = supabase as any;

  const { data, error } = await db
    .from('cakegenie_analysis_cache')
    .select('id, p_hash')
    .eq('p_hash', pHash)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as CacheReferenceTarget | null;
}

interface RowResult {
  updated: number;
  aliased: number;
  skipped: number;
  failed: number;
}

async function processRow(
  supabase: any,
  row: CacheRow,
  dryRun: boolean
): Promise<RowResult> {
  if (!row.original_image_url) {
    return { updated: 0, aliased: 0, skipped: 1, failed: 0 };
  }

  try {
    const buffer = await fetchImageBuffer(row.original_image_url);
    const fingerprint = await computeImageFingerprint(buffer);

    if (dryRun) {
      console.log(`[dry-run] ${row.id}: p_hash ${row.p_hash} -> ${fingerprint.pHash}`);
      return { updated: 1, aliased: 0, skipped: 0, failed: 0 };
    }

    const db = supabase as any;

    const { error: updateError } = await db
      .from('cakegenie_analysis_cache')
      .update({
        p_hash: fingerprint.pHash,
        fingerprint_pipeline: fingerprint.pipeline,
      })
      .eq('id', row.id)
      .eq('p_hash', row.p_hash);

    if (updateError) {
      if (isDuplicatePHashError(updateError)) {
        const canonicalRow = await findCanonicalRow(supabase, fingerprint.pHash);

        if (!canonicalRow) {
          throw updateError;
        }

        await updateRelatedReferences(supabase, row.p_hash, canonicalRow.p_hash);

        const duplicateMarker = `${DUPLICATE_FINGERPRINT_PREFIX}${canonicalRow.p_hash}`;
        const { error: aliasError } = await db
          .from('cakegenie_analysis_cache')
          .update({
            fingerprint_pipeline: duplicateMarker,
          })
          .eq('id', row.id)
          .eq('p_hash', row.p_hash);

        if (aliasError) {
          throw aliasError;
        }

        console.log(
          `Aliased ${row.id}: kept legacy p_hash ${row.p_hash}, canonical ${canonicalRow.p_hash} already owned by ${canonicalRow.id}`
        );
        return { updated: 0, aliased: 1, skipped: 0, failed: 0 };
      }

      throw updateError;
    }

    await updateRelatedReferences(supabase, row.p_hash, fingerprint.pHash);

    console.log(`Updated ${row.id}: p_hash ${row.p_hash} -> ${fingerprint.pHash}`);
    return { updated: 1, aliased: 0, skipped: 0, failed: 0 };
  } catch (error) {
    const message = formatErrorMessage(error);
    console.warn(`Skipped ${row.id} (${row.original_image_url}): ${message}`);
    return { updated: 0, aliased: 0, skipped: 0, failed: 1 };
  }
}

async function fetchImageBuffer(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'image/*' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      throw new Error(`Not an image (${contentType || 'unknown content type'})`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_FINGERPRINT_INPUT_BYTES) {
      throw new Error(`Image too large (${buffer.length} bytes)`);
    }

    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun = process.argv.includes('--dry-run');
  const limit = getLimit();
  const concurrency = getConcurrency();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('cakegenie_analysis_cache')
    .select('id, p_hash, original_image_url')
    .is('fingerprint_pipeline', null)
    .not('original_image_url', 'is', null)
    .neq('original_image_url', '')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = (data || []) as CacheRow[];
  console.log(
    `Backfilling ${rows.length} rows with ${FINGERPRINT_PIPELINE}${dryRun ? ' (dry run)' : ''} using concurrency ${Math.min(
      concurrency,
      Math.max(rows.length, 1)
    )}.`
  );

  let updated = 0;
  let aliased = 0;
  let skipped = 0;
  let failed = 0;
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= rows.length) {
        return;
      }

      const result = await processRow(supabase, rows[currentIndex], dryRun);
      updated += result.updated;
      aliased += result.aliased;
      skipped += result.skipped;
      failed += result.failed;
    }
  }

  const workerCount = Math.min(concurrency, Math.max(rows.length, 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  console.log(`Done. Updated: ${updated}, aliased: ${aliased}, skipped: ${skipped}, failed: ${failed}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
