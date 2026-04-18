#!/usr/bin/env npx tsx
// scripts/backfill-alt-text.ts
// Upgrade weak/missing alt_text in cakegenie_analysis_cache by regenerating
// it from analysis_json using the same logic the live page uses
// (src/utils/designContentUtils.ts -> generateRichAltText).
//
// Defaults to DRY-RUN — prints previews and stats, no DB writes.
// Run with:  npx tsx scripts/backfill-alt-text.ts          (dry-run)
//            npx tsx scripts/backfill-alt-text.ts --write  (persist)
//
// Criteria for rewrite (configurable below): current alt_text is NULL, <60
// chars, looks like generic boilerplate ("<kw> cake design"), AND the
// regenerated alt_text is meaningfully longer/richer.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { generateRichAltText } from '../src/utils/designContentUtils';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const WRITE = process.argv.includes('--write');
const WEAK_ALT_LEN = 60;
const MIN_IMPROVEMENT_CHARS = 20; // only rewrite if new alt is >= this much longer
const BATCH_SIZE = 1000;

interface Row {
    p_hash: string;
    slug: string | null;
    alt_text: string | null;
    keywords: string | null;
    tags: string[] | null;
    analysis_json: any;
}

function isGeneric(alt: string, keywords: string | null): boolean {
    const a = alt.trim().toLowerCase();
    if (!a) return false;
    if (/^[a-z0-9 '"\-]+cake( design)?\.?$/i.test(a) && a.length < 50) return true;
    const kw = (keywords || '').trim().toLowerCase();
    if (kw && (a === `${kw} cake design` || a === `${kw} cake`)) return true;
    if (a === 'custom cake' || a === 'custom cake design') return true;
    return false;
}

function shouldConsider(row: Row): boolean {
    const alt = row.alt_text || '';
    if (!alt) return true;
    if (alt.length < WEAK_ALT_LEN) return true;
    if (isGeneric(alt, row.keywords)) return true;
    return false;
}

async function fetchCandidates(): Promise<Row[]> {
    const all: Row[] = [];
    let offset = 0;
    while (true) {
        const { data, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('p_hash, slug, alt_text, keywords, tags, analysis_json')
            .not('slug', 'is', null)
            .not('analysis_json', 'is', null)
            .range(offset, offset + BATCH_SIZE - 1);
        if (error) throw new Error(error.message);
        const batch = (data || []) as Row[];
        all.push(...batch);
        if (batch.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
    }
    return all;
}

async function main() {
    console.log(`Mode: ${WRITE ? 'WRITE (persisting changes)' : 'DRY-RUN (no DB writes)'}`);
    console.log('Fetching candidate rows...');
    const rows = await fetchCandidates();
    console.log(`Scanned ${rows.length} rows with analysis_json.\n`);

    let consideredCount = 0;
    let wouldUpdateCount = 0;
    let skippedNoImprovement = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const previews: Array<{ slug: string; before: string; after: string; delta: number }> = [];

    for (const row of rows) {
        if (!shouldConsider(row)) continue;
        consideredCount++;

        // Feed generateRichAltText the same shape it expects from the page loader.
        // It prioritizes design.alt_text (length > 15) so we pass alt_text=null
        // to force the auto-generation path for an apples-to-apples comparison.
        const generated = generateRichAltText({
            alt_text: null,
            keywords: row.keywords,
            tags: row.tags,
            analysis_json: row.analysis_json,
        });

        const current = (row.alt_text || '').trim();
        const delta = generated.length - current.length;

        if (delta < MIN_IMPROVEMENT_CHARS) {
            skippedNoImprovement++;
            continue;
        }
        if (generated === current) continue;

        wouldUpdateCount++;
        if (previews.length < 15) {
            previews.push({ slug: row.slug || row.p_hash, before: current || '<null>', after: generated, delta });
        }

        if (WRITE) {
            const { error } = await supabase
                .from('cakegenie_analysis_cache')
                .update({ alt_text: generated })
                .eq('p_hash', row.p_hash);
            if (error) {
                console.error(`  Update failed for ${row.slug}: ${error.message}`);
                failedCount++;
            } else {
                updatedCount++;
            }
            await new Promise((resolve) => setTimeout(resolve, 30));
        }
    }

    console.log('=== Summary ===');
    console.log(`Rows considered (weak alt_text)    : ${consideredCount}`);
    console.log(`Would update (meaningful improve)  : ${wouldUpdateCount}`);
    console.log(`Skipped (no meaningful improvement): ${skippedNoImprovement}`);
    if (WRITE) {
        console.log(`Updated in DB                      : ${updatedCount}`);
        console.log(`Failed updates                     : ${failedCount}`);
    }
    console.log('');

    if (previews.length > 0) {
        console.log('=== Preview (first 15) ===');
        for (const p of previews) {
            console.log(`- ${p.slug}  (+${p.delta} chars)`);
            console.log(`    before: ${p.before}`);
            console.log(`    after : ${p.after}`);
        }
    }

    console.log(`\nDone. ${WRITE ? 'Changes persisted.' : 'Re-run with --write to persist.'}`);
}

main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
