import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { pathToFileURL } from 'url';
import {
  MAX_FINGERPRINT_INPUT_BYTES,
  PDQ_MIN_QUALITY,
  computePDQFingerprint,
} from '../src/lib/server/imageFingerprint';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

interface CacheRow {
  id: string;
  original_image_url: string | null;
  pdq_status: string | null;
  created_at: string;
}

function getArg(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function positiveArg(name: string, fallback: number) {
  const value = Number.parseInt(getArg(name) || '', 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return String(error);

  const record = error as Record<string, unknown>;
  const fields = ['message', 'code', 'details', 'hint']
    .filter((field) => record[field] !== undefined && record[field] !== null)
    .map((field) => `${field}=${String(record[field])}`);
  if (fields.length > 0) return fields.join('; ');

  try {
    return JSON.stringify(error);
  } catch {
    return Object.prototype.toString.call(error);
  }
}

async function withRetries<T>(operation: () => Promise<T>, attempts: number): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(formatError(lastError));
}

async function fetchImageBuffer(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'image/*' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

async function updateRow(
  supabase: ReturnType<typeof createClient>,
  rowId: string,
  payload: Record<string, unknown>,
  attempts: number,
) {
  await withRetries(async () => {
    const { error } = await supabase
      .from('cakegenie_analysis_cache')
      .update(payload)
      .eq('id', rowId);
    if (error) throw error;
  }, attempts);
}

async function processRow(
  supabase: ReturnType<typeof createClient>,
  row: CacheRow,
  dryRun: boolean,
  attempts: number,
  blockedRowIds: Set<string>,
): Promise<'ready' | 'low_quality' | 'missing_source' | 'failed'> {
  const computedAt = new Date().toISOString();

  if (!row.original_image_url) {
    if (!dryRun) await updateRow(supabase, row.id, {
      pdq_status: 'missing_source',
      pdq_error: 'original_image_url is missing.',
      pdq_computed_at: null,
    }, attempts);
    return 'missing_source';
  }

  try {
    const result = await withRetries(async () => {
      const image = await fetchImageBuffer(row.original_image_url!);
      return computePDQFingerprint(image);
    }, attempts);
    const payload = {
      pdq_hash: result.pdqHash,
      pdq_quality: result.pdqQuality,
      pdq_pipeline: result.pdqPipeline,
      pdq_status: result.status,
      pdq_error: result.status === 'ready' ? null : 'PDQ quality is below the matching threshold.',
      pdq_computed_at: computedAt,
    };

    if (!dryRun) await updateRow(supabase, row.id, payload, attempts);
    if (dryRun || result.status !== 'ready') {
      console.log(`${dryRun ? '[dry-run] ' : ''}${row.id}: ${result.status}${result.pdqQuality === null ? '' : ` quality=${result.pdqQuality}`}`);
    }
    return result.status === 'ready' && result.pdqQuality !== null && result.pdqQuality >= PDQ_MIN_QUALITY
      ? 'ready'
      : 'low_quality';
  } catch (error) {
    const message = formatError(error);
    if (!dryRun) {
      try {
        await updateRow(supabase, row.id, {
          pdq_status: 'failed',
          pdq_error: message,
          pdq_computed_at: computedAt,
        }, attempts);
      } catch (persistError) {
        blockedRowIds.add(row.id);
        console.warn(`${row.id}: failed to persist failed status - ${formatError(persistError)}; skipping until the next invocation.`);
      }
    }
    console.warn(`${dryRun ? '[dry-run] ' : ''}${row.id}: failed - ${message}`);
    return 'failed';
  }
}

export async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun = process.argv.includes('--dry-run');
  const processAll = process.argv.includes('--all');
  const retryFailed = process.argv.includes('--retry-failed');
  const limit = positiveArg('--limit', 50);
  const concurrency = positiveArg('--concurrency', 4);
  const attempts = positiveArg('--retries', 3);

  if (dryRun && processAll) {
    throw new Error('Use --limit with --dry-run; --all is only available for resumable writes.');
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const runStartedAt = new Date().toISOString();
  const totals = { ready: 0, low_quality: 0, missing_source: 0, failed: 0 };
  const blockedRowIds = new Set<string>();
  let batchNumber = 0;

  while (true) {
    const { data: pendingData, error: pendingError } = await withRetries(
      async () => {
        const pendingQuery = supabase
          .from('cakegenie_analysis_cache')
          .select('id, original_image_url, pdq_status, created_at')
          .or('pdq_status.is.null,pdq_status.eq.pending')
          .order('created_at', { ascending: true })
          .limit(limit + blockedRowIds.size);
        return pendingQuery;
      },
      attempts,
    );
    if (pendingError) throw pendingError;

    let rows = ((pendingData || []) as CacheRow[])
      .filter((row) => !blockedRowIds.has(row.id))
      .slice(0, limit);

    // A failed row written during this invocation must not be selected again
    // by --all. Its persisted pdq_computed_at acts as the durable checkpoint;
    // a later invocation with --retry-failed can retry it.
    if (retryFailed && rows.length < limit) {
      const { data: failedData, error: failedError } = await withRetries(
        async () => {
          const failedQuery = supabase
            .from('cakegenie_analysis_cache')
            .select('id, original_image_url, pdq_status, created_at')
            .eq('pdq_status', 'failed')
            .or(`pdq_computed_at.is.null,pdq_computed_at.lt.${runStartedAt}`)
            .order('created_at', { ascending: true })
            .limit(limit - rows.length + blockedRowIds.size);
          return failedQuery;
        },
        attempts,
      );
      if (failedError) throw failedError;
      rows = rows.concat(
        ((failedData || []) as CacheRow[])
          .filter((row) => !blockedRowIds.has(row.id))
          .slice(0, limit - rows.length),
      );
    }

    if (rows.length === 0) break;
    batchNumber += 1;
    console.log(`Starting PDQ batch ${batchNumber} (${rows.length} rows, concurrency=${concurrency}).`);

    const counts = { ready: 0, low_quality: 0, missing_source: 0, failed: 0 };
    let nextIndex = 0;
    async function worker() {
      while (true) {
        const index = nextIndex++;
        if (index >= rows.length) return;
        counts[await processRow(supabase, rows[index], dryRun, attempts, blockedRowIds)] += 1;
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));
    totals.ready += counts.ready;
    totals.low_quality += counts.low_quality;
    totals.missing_source += counts.missing_source;
    totals.failed += counts.failed;
    console.log(`Completed PDQ batch ${batchNumber}. ready=${counts.ready}, low_quality=${counts.low_quality}, missing_source=${counts.missing_source}, failed=${counts.failed}.`);

    if (!processAll) break;
  }

  console.log(`Done. batches=${batchNumber}, ready=${totals.ready}, low_quality=${totals.low_quality}, missing_source=${totals.missing_source}, failed=${totals.failed}${dryRun ? ' (dry run)' : ''}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
