import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

interface CacheRow {
  id: string;
  slug: string | null;
  original_image_url: string | null;
  orb_index_status: string | null;
}

interface RowResult {
  indexed: number;
  alreadyIndexed: number;
  skipped: number;
  failed: number;
}

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

function getOrbIndexUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_ORB_BACKEND_URL?.trim();

  if (!baseUrl) {
    throw new Error('Missing NEXT_PUBLIC_ORB_BACKEND_URL.');
  }

  return `${baseUrl.replace(/\/$/, '')}/api/index`;
}

function inferFileName(row: CacheRow, url: string, contentType: string) {
  const extensionFromType = contentType.split('/')[1] || 'webp';
  const pathPart = url.split('?')[0] || '';
  const rawName = pathPart.split('/').pop();

  if (rawName && rawName.includes('.')) {
    return rawName;
  }

  if (row.slug) {
    return `${row.slug}.${extensionFromType}`;
  }

  return `orb-reindex-${row.id}.${extensionFromType}`;
}

async function updateOrbStatus(
  supabase: SupabaseClient,
  rowId: string,
  fields: Record<string, string | null>
) {
  const { error } = await supabase
    .from('cakegenie_analysis_cache')
    .update(fields)
    .eq('id', rowId);

  if (error) {
    console.warn(`Status update failed for ${rowId}: ${error.message}`);
  }
}

async function fetchImageFile(row: CacheRow) {
  if (!row.original_image_url) {
    throw new Error('No original_image_url available.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(row.original_image_url, {
      headers: { Accept: 'image/*' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'image/webp';
    if (!contentType.toLowerCase().startsWith('image/')) {
      throw new Error(`Not an image (${contentType || 'unknown content type'})`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const fileName = inferFileName(row, row.original_image_url, contentType);

    return new File([Uint8Array.from(buffer)], fileName, { type: contentType });
  } finally {
    clearTimeout(timeout);
  }
}

async function processRow(
  supabase: SupabaseClient,
  row: CacheRow,
  indexUrl: string,
  dryRun: boolean
): Promise<RowResult> {
  if (!row.original_image_url) {
    return { indexed: 0, alreadyIndexed: 0, skipped: 1, failed: 0 };
  }

  if (dryRun) {
    console.log(`[dry-run] ${row.id}: would re-index ${row.original_image_url}`);
    return { indexed: 1, alreadyIndexed: 0, skipped: 0, failed: 0 };
  }

  const attemptedAt = new Date().toISOString();

  try {
    await updateOrbStatus(supabase, row.id, {
      orb_index_status: 'indexing',
      orb_index_error: null,
      orb_index_attempted_at: attemptedAt,
    });

    const file = await fetchImageFile(row);
    const formData = new FormData();
    formData.append('cache_id', row.id);
    formData.append('skip_if_exists', 'true');
    formData.append('file', file, file.name);

    const response = await fetch(indexUrl, {
      method: 'POST',
      body: formData,
    });

    const payload = await response.json().catch(() => null) as
      | { already_indexed?: boolean; detail?: string; message?: string }
      | null;

    if (!response.ok) {
      const detail = payload?.detail || payload?.message || `ORB backend returned ${response.status}`;
      await updateOrbStatus(supabase, row.id, {
        orb_index_status: 'failed',
        orb_index_error: detail,
        orb_index_attempted_at: attemptedAt,
      });
      console.warn(`Failed ${row.id}: ${detail}`);
      return { indexed: 0, alreadyIndexed: 0, skipped: 0, failed: 1 };
    }

    await updateOrbStatus(supabase, row.id, {
      orb_index_status: 'ready',
      orb_index_error: null,
      orb_index_attempted_at: attemptedAt,
      orb_indexed_at: attemptedAt,
    });

    if (payload?.already_indexed) {
      console.log(`Already indexed ${row.id}`);
      return { indexed: 0, alreadyIndexed: 1, skipped: 0, failed: 0 };
    }

    console.log(`Indexed ${row.id}`);
    return { indexed: 1, alreadyIndexed: 0, skipped: 0, failed: 0 };
  } catch (error) {
    const message = formatErrorMessage(error);
    await updateOrbStatus(supabase, row.id, {
      orb_index_status: 'failed',
      orb_index_error: message,
      orb_index_attempted_at: attemptedAt,
    });
    console.warn(`Failed ${row.id}: ${message}`);
    return { indexed: 0, alreadyIndexed: 0, skipped: 0, failed: 1 };
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun = process.argv.includes('--dry-run');
  const limit = getLimit();
  const concurrency = getConcurrency();
  const indexUrl = getOrbIndexUrl();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('cakegenie_analysis_cache')
    .select('id, slug, original_image_url, orb_index_status')
    .in('orb_index_status', ['pending', 'failed', 'indexing'])
    .not('original_image_url', 'is', null)
    .neq('original_image_url', '')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = (data || []) as CacheRow[];
  console.log(
    `Re-indexing ${rows.length} rows against ${indexUrl}${dryRun ? ' (dry run)' : ''} using concurrency ${Math.min(
      concurrency,
      Math.max(rows.length, 1)
    )}.`
  );

  let indexed = 0;
  let alreadyIndexed = 0;
  let skipped = 0;
  let failed = 0;
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= rows.length) {
        return;
      }

      const result = await processRow(supabase, rows[currentIndex], indexUrl, dryRun);
      indexed += result.indexed;
      alreadyIndexed += result.alreadyIndexed;
      skipped += result.skipped;
      failed += result.failed;
    }
  }

  const workerCount = Math.min(concurrency, Math.max(rows.length, 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  console.log(
    `Done. Indexed: ${indexed}, already indexed: ${alreadyIndexed}, skipped: ${skipped}, failed: ${failed}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
