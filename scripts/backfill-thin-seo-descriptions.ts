import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { MIN_STORED_SEO_DESCRIPTION_WORDS, enrichStoredSeoDescription } from '../src/lib/seo/analysisCopy';
import type { HybridAnalysisResult } from '../src/types';
import { isGenericDesignDescription } from '../src/utils/designContentUtils';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY;
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : undefined;
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
const CONCURRENCY = Math.max(1, Number(concurrencyArg?.split('=')[1] || 12));
const progressPath = resolve(process.cwd(), 'thin-seo-description-backfill-progress.json');

type CacheRow = {
  id: string;
  slug: string | null;
  keywords: string | null;
  tags: string[] | null;
  availability: 'rush' | 'same-day' | 'normal' | null;
  seo_description: string | null;
  analysis_json: HybridAnalysisResult | null;
};

type CandidateRow = CacheRow & {
  currentDescription: string;
  enrichedDescription: string;
  currentWordCount: number;
  enrichedWordCount: number;
};

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function loadProgress() {
  if (DRY_RUN || !existsSync(progressPath)) return new Set<string>();
  return new Set(JSON.parse(readFileSync(progressPath, 'utf8')) as string[]);
}

function saveProgress(done: Set<string>) {
  if (DRY_RUN) return;
  writeFileSync(progressPath, JSON.stringify([...done].sort(), null, 2));
}

async function fetchRows() {
  const rows: CacheRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('id, slug, keywords, tags, availability, seo_description, analysis_json')
      .not('analysis_json', 'is', null)
      .not('seo_description', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`Fetch failed: ${error.message}`);

    rows.push(...((data || []) as CacheRow[]));
    if (!data || data.length < pageSize) break;
  }

  return typeof LIMIT === 'number' && Number.isFinite(LIMIT) ? rows.slice(0, LIMIT) : rows;
}

function buildCandidate(row: CacheRow): CandidateRow | null {
  if (!row.analysis_json || !row.availability || !row.seo_description) {
    return null;
  }

  const currentDescription = row.seo_description.trim();
  const currentWordCount = countWords(currentDescription);
  const isGeneric = isGenericDesignDescription(currentDescription);

  if (!isGeneric && currentWordCount >= MIN_STORED_SEO_DESCRIPTION_WORDS) {
    return null;
  }

  const enrichedDescription = enrichStoredSeoDescription({
    analysisResult: row.analysis_json,
    availability: row.availability,
    keywords: row.keywords,
    rawDescription: row.seo_description,
    tags: row.tags,
  }).trim();

  if (!enrichedDescription || enrichedDescription === currentDescription) {
    return null;
  }

  const enrichedWordCount = countWords(enrichedDescription);

  return {
    ...row,
    currentDescription,
    enrichedDescription,
    currentWordCount,
    enrichedWordCount,
  };
}

async function main() {
  const rows = await fetchRows();
  const candidates = rows.map(buildCandidate).filter((row): row is CandidateRow => Boolean(row));
  const done = loadProgress();

  console.log(`${DRY_RUN ? 'Dry run' : 'Live run'}: scanned=${rows.length}, candidates=${candidates.length}${LIMIT ? `, limit=${LIMIT}` : ''}.`);

  for (const sample of candidates.slice(0, 5)) {
    console.log(`\n[Sample] ${sample.slug || sample.id}`);
    console.log(`  before (${sample.currentWordCount} words): ${sample.currentDescription}`);
    console.log(`  after  (${sample.enrichedWordCount} words): ${sample.enrichedDescription}`);
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let cursor = 0;

  async function processRow(row: CandidateRow, index: number) {
    if (done.has(row.id)) {
      skipped += 1;
      return;
    }

    try {
      if (!DRY_RUN) {
        const nextAnalysisJson = {
          ...row.analysis_json,
          seo_description: row.enrichedDescription,
        };

        const { error } = await supabase
          .from('cakegenie_analysis_cache')
          .update({
            seo_description: row.enrichedDescription,
            analysis_json: nextAnalysisJson,
          })
          .eq('id', row.id);

        if (error) throw new Error(`Update failed: ${error.message}`);

        done.add(row.id);
        saveProgress(done);
      }

      updated += 1;
      if (index < 20 || (index + 1) % 250 === 0 || index + 1 === candidates.length) {
        console.log(
          `[${index + 1}/${candidates.length}] ${row.slug || row.id} ${row.currentWordCount}w -> ${row.enrichedWordCount}w`,
        );
      }
    } catch (error) {
      failed += 1;
      console.error(`[${index + 1}/${candidates.length}] Failed ${row.slug || row.id}:`, error);
    }
  }

  async function worker() {
    while (cursor < candidates.length) {
      const index = cursor;
      cursor += 1;
      await processRow(candidates[index], index);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`Finished. updated=${updated} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
