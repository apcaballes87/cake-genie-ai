#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Configuration error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEFAULT_SINCE = '2026-06-01T00:00:00.000Z';
const PROGRESS_FILE = path.resolve(process.cwd(), 'scratch/square-studio-progress.json');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const resetProgress = args.includes('--reset-progress');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const sinceArg = args.find((arg) => arg.startsWith('--since='));
const untilArg = args.find((arg) => arg.startsWith('--until='));
const pHashArg = args.find((arg) => arg.startsWith('--p-hash='));
const concurrencyArg = args.find((arg) => arg.startsWith('--concurrency='));

const limit = limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : null;
const since = sinceArg ? sinceArg.split('=')[1] : DEFAULT_SINCE;
const until = untilArg ? untilArg.split('=')[1] : null;
const pHashFilter = pHashArg ? pHashArg.split('=')[1].trim() : null;
const concurrency = Math.min(
  Math.max(concurrencyArg ? Number.parseInt(concurrencyArg.split('=')[1], 10) : 4, 1),
  12
);

type StudioRow = {
  p_hash: string;
  slug: string | null;
  studio_edited_image_url: string | null;
  studio_edited_at: string | null;
  image_width: number | null;
  image_height: number | null;
};

type CornerColor = {
  r: number;
  g: number;
  b: number;
  alpha: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadProgress(): Set<string> {
  if (resetProgress) {
    return new Set();
  }

  if (!fs.existsSync(PROGRESS_FILE)) {
    return new Set();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) as { processedHashes?: string[] };
    return new Set(parsed.processedHashes ?? []);
  } catch (error) {
    console.warn('⚠️ Could not read progress file. Starting fresh.', (error as Error).message);
    return new Set();
  }
}

function saveProgress(processedHashes: Set<string>) {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({ processedHashes: Array.from(processedHashes) }, null, 2),
    'utf8'
  );
}

function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) {
    return null;
  }

  return {
    bucket: decodeURIComponent(match[1]),
    path: decodeURIComponent(match[2]),
  };
}

async function downloadImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function sampleTopLeftBackground(imageBuffer: Buffer, width: number, height: number): Promise<CornerColor> {
  const sampleWidth = Math.max(1, Math.min(24, width));
  const sampleHeight = Math.max(1, Math.min(24, height));
  const stats = await sharp(imageBuffer)
    .extract({ left: 0, top: 0, width: sampleWidth, height: sampleHeight })
    .stats();

  return {
    r: Math.round(stats.channels[0]?.mean ?? 245),
    g: Math.round(stats.channels[1]?.mean ?? 235),
    b: Math.round(stats.channels[2]?.mean ?? 245),
    alpha: 1,
  };
}

async function squarePadStudioImage(imageBuffer: Buffer) {
  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Failed to read Studio image dimensions.');
  }

  const width = metadata.width;
  const height = metadata.height;
  const isSquare = width === height;

  if (isSquare) {
    return {
      changed: false,
      width,
      height,
      outputBuffer: imageBuffer,
    };
  }

  const targetSize = Math.max(width, height);
  const background = await sampleTopLeftBackground(imageBuffer, width, height);

  const squaredBuffer = await sharp({
    create: {
      width: targetSize,
      height: targetSize,
      channels: 4,
      background,
    },
  })
    .composite([
      {
        input: imageBuffer,
        left: Math.floor((targetSize - width) / 2),
        top: Math.floor((targetSize - height) / 2),
      },
    ])
    .webp({ quality: 92, effort: 4 })
    .toBuffer();

  return {
    changed: true,
    width: targetSize,
    height: targetSize,
    outputBuffer: squaredBuffer,
  };
}

async function pMap<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });

  await Promise.all(runners);
}

async function fetchEligibleRows(): Promise<StudioRow[]> {
  let page = 0;
  const pageSize = 1000;
  const rows: StudioRow[] = [];

  while (true) {
    let query = supabase
      .from('cakegenie_analysis_cache')
      .select('p_hash, slug, studio_edited_image_url, studio_edited_at, image_width, image_height')
      .eq('studio_edit_status', 'completed')
      .not('studio_edited_image_url', 'is', null)
      .neq('studio_edited_image_url', '')
      .gte('studio_edited_at', since)
      .order('studio_edited_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (until) {
      query = query.lte('studio_edited_at', until);
    }

    if (pHashFilter) {
      query = query.eq('p_hash', pHashFilter);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Supabase fetch error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...(data as StudioRow[]));

    if (data.length < pageSize || pHashFilter) {
      break;
    }

    page += 1;
  }

  return rows;
}

async function main() {
  console.log('🎂 Genie.ph — Studio Image Square Normalizer');
  console.log(
    `    DRY_RUN=${dryRun}  CONCURRENCY=${concurrency}  LIMIT=${limit ?? 'unlimited'}  SINCE=${since}  UNTIL=${until ?? 'now'}  P_HASH=${pHashFilter ?? 'all'}  RESET_PROGRESS=${resetProgress}`
  );
  console.log('─────────────────────────────────────────────────────────────────');

  const processedHashes = loadProgress();
  const rows = await fetchEligibleRows();
  const eligible = rows.filter(
    (row) =>
      row.studio_edited_image_url &&
      row.studio_edited_image_url.startsWith('http') &&
      !processedHashes.has(row.p_hash)
  );

  const rowsToProcess = limit ? eligible.slice(0, limit) : eligible;
  console.log(`📊 Found ${rows.length} completed Studio rows in range.`);
  console.log(`📊 Eligible to inspect this run: ${rowsToProcess.length}`);

  let inspected = 0;
  let squared = 0;
  let alreadySquare = 0;
  let failed = 0;

  await pMap(rowsToProcess, concurrency, async (row, index) => {
    const label = `[${index + 1}/${rowsToProcess.length}] ${row.p_hash}`;

    try {
      const storageInfo = parseStorageUrl(row.studio_edited_image_url!);
      if (!storageInfo) {
        throw new Error(`Invalid storage URL: ${row.studio_edited_image_url}`);
      }

      const imageBuffer = await downloadImage(row.studio_edited_image_url!);
      const normalized = await squarePadStudioImage(imageBuffer);
      const needsMetadataRepair =
        row.image_width !== normalized.width || row.image_height !== normalized.height;

      inspected += 1;

      if (!normalized.changed) {
        if (!dryRun && needsMetadataRepair) {
          const storageInfo = parseStorageUrl(row.studio_edited_image_url!);
          if (!storageInfo) {
            throw new Error(`Invalid storage URL: ${row.studio_edited_image_url}`);
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from(storageInfo.bucket).getPublicUrl(storageInfo.path);
          const cacheBustedPublicUrl = `${publicUrl}?t=${Date.now()}`;

          const { error: repairError } = await supabase
            .from('cakegenie_analysis_cache')
            .update({
              studio_edited_image_url: cacheBustedPublicUrl,
              image_width: normalized.width,
              image_height: normalized.height,
              image_variants: null,
              image_variants_indexed_source: null,
              image_variants_indexed_at: null,
              image_variants_status: 'pending',
              image_variants_error: null,
            })
            .eq('p_hash', row.p_hash);

          if (repairError) {
            throw new Error(`Metadata repair error: ${repairError.message}`);
          }
        }

        alreadySquare += 1;
        processedHashes.add(row.p_hash);
        saveProgress(processedHashes);
        const suffix = needsMetadataRepair ? ' • metadata repaired' : '';
        console.log(`${label} • already square (${normalized.width}x${normalized.height})${suffix}`);
        return;
      }

      if (dryRun) {
        squared += 1;
        processedHashes.add(row.p_hash);
        saveProgress(processedHashes);
        console.log(`${label} • [DRY] would square ${normalized.width}x${normalized.height}`);
        return;
      }

      const { error: uploadError } = await supabase.storage
        .from(storageInfo.bucket)
        .upload(storageInfo.path, normalized.outputBuffer, {
          contentType: 'image/webp',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Supabase upload error: ${uploadError.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(storageInfo.bucket).getPublicUrl(storageInfo.path);
      const cacheBustedPublicUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('cakegenie_analysis_cache')
        .update({
          studio_edited_image_url: cacheBustedPublicUrl,
          image_width: normalized.width,
          image_height: normalized.height,
          image_variants: null,
          image_variants_indexed_source: null,
          image_variants_indexed_at: null,
          image_variants_status: 'pending',
          image_variants_error: null,
        })
        .eq('p_hash', row.p_hash);

      if (updateError) {
        throw new Error(`Database update error: ${updateError.message}`);
      }

      squared += 1;
      processedHashes.add(row.p_hash);
      saveProgress(processedHashes);
      console.log(`${label} • squared to ${normalized.width}x${normalized.height}`);

      await sleep(150);
    } catch (error) {
      failed += 1;
      console.error(`${label} • ❌ ${(error as Error).message}`);
    }
  });

  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`✅ Done.`);
  console.log(`   inspected=${inspected}`);
  console.log(`   squared=${squared}`);
  console.log(`   alreadySquare=${alreadySquare}`);
  console.log(`   failed=${failed}`);
  console.log(`   progressSaved=${processedHashes.size}`);
}

main().catch((error) => {
  console.error('💥 Unhandled script error:', error);
  process.exit(1);
});
