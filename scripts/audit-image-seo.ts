#!/usr/bin/env npx tsx
// scripts/audit-image-seo.ts
// Audit image-SEO data quality in cakegenie_analysis_cache so we can see
// which rows have weak/missing alt_text, seo_title, seo_description, or
// image dimensions. Read-only; prints a report to stdout.
// Run with: npx tsx scripts/audit-image-seo.ts

import { createClient } from '@supabase/supabase-js';

// Mirrors scripts/audit-pricing-keys.ts — read-only anon key works for SELECT
const supabaseUrl = process.env.SUPABASE_URL || 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

interface Row {
    slug: string | null;
    alt_text: string | null;
    seo_title: string | null;
    seo_description: string | null;
    original_image_url: string | null;
    image_width: number | null;
    image_height: number | null;
    keywords: string | null;
}

const BATCH_SIZE = 1000;
const WEAK_ALT_LEN = 60;

function pct(n: number, total: number): string {
    if (total === 0) return '0.0%';
    return `${((n / total) * 100).toFixed(1)}%`;
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
}

async function fetchAll(): Promise<Row[]> {
    const all: Row[] = [];
    let offset = 0;
    while (true) {
        const { data, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('slug, alt_text, seo_title, seo_description, original_image_url, image_width, image_height, keywords')
            .not('slug', 'is', null)
            .range(offset, offset + BATCH_SIZE - 1);

        if (error) throw new Error(error.message);
        const batch = (data || []) as Row[];
        all.push(...batch);
        if (batch.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
    }
    return all;
}

function isGenericAltText(row: Row): boolean {
    const alt = (row.alt_text || '').trim().toLowerCase();
    if (!alt) return false;

    // Pattern 1: just "<words> cake" or "<words> cake design" with no detail
    if (/^[a-z0-9 '"\-]+cake( design)?\.?$/i.test(alt) && alt.length < 50) return true;

    // Pattern 2: literal "<keywords> cake design"
    const kw = (row.keywords || '').trim().toLowerCase();
    if (kw && (alt === `${kw} cake design` || alt === `${kw} cake`)) return true;

    // Pattern 3: "custom cake", "custom cake design" — default fallback leak
    if (alt === 'custom cake' || alt === 'custom cake design') return true;

    return false;
}

function pickSample<T>(arr: T[], n: number): T[] {
    const copy = [...arr];
    const out: T[] = [];
    while (out.length < n && copy.length > 0) {
        const idx = Math.floor(Math.random() * copy.length);
        out.push(copy.splice(idx, 1)[0]);
    }
    return out;
}

async function main() {
    console.log('Fetching rows from cakegenie_analysis_cache...');
    const rows = await fetchAll();
    const total = rows.length;
    console.log(`Scanned ${total} rows.\n`);

    // A. Aggregate metrics
    const altNull = rows.filter(r => !r.alt_text || r.alt_text.trim() === '').length;
    const altLens = rows.map(r => (r.alt_text || '').length).sort((a, b) => a - b);
    const weakAlt = rows.filter(r => (r.alt_text || '').length < WEAK_ALT_LEN).length;
    const noSeoTitle = rows.filter(r => !r.seo_title || r.seo_title.trim() === '').length;
    const noSeoDesc = rows.filter(r => !r.seo_description || r.seo_description.trim() === '').length;
    const noDims = rows.filter(r => !r.image_width || !r.image_height).length;
    const notWebp = rows.filter(r => {
        const url = (r.original_image_url || '').toLowerCase();
        if (!url) return false;
        const path = url.split('?')[0];
        return !path.endsWith('.webp');
    }).length;

    console.log('=== A. Aggregate Metrics ===');
    console.log(`alt_text NULL/empty        : ${altNull} (${pct(altNull, total)})`);
    console.log(`alt_text length p25        : ${percentile(altLens, 25)}`);
    console.log(`alt_text length p50        : ${percentile(altLens, 50)}`);
    console.log(`alt_text length p75        : ${percentile(altLens, 75)}`);
    console.log(`alt_text length p90        : ${percentile(altLens, 90)}`);
    console.log(`alt_text length max        : ${altLens[altLens.length - 1] ?? 0}`);
    console.log(`alt_text < ${WEAK_ALT_LEN} chars (weak) : ${weakAlt} (${pct(weakAlt, total)})`);
    console.log(`seo_title NULL/empty       : ${noSeoTitle} (${pct(noSeoTitle, total)})`);
    console.log(`seo_description NULL/empty : ${noSeoDesc} (${pct(noSeoDesc, total)})`);
    console.log(`image_width/height missing : ${noDims} (${pct(noDims, total)})`);
    console.log(`original_image_url not .webp: ${notWebp} (${pct(notWebp, total)})`);
    console.log('');

    // B. Generic alt text detector
    const generic = rows.filter(isGenericAltText);
    console.log('=== B. Generic / Boilerplate Alt Text ===');
    console.log(`Rows with generic alt_text : ${generic.length} (${pct(generic.length, total)})`);
    if (generic.length > 0) {
        console.log('Examples (up to 5):');
        for (const r of generic.slice(0, 5)) {
            console.log(`  - ${r.slug} :: "${r.alt_text}"`);
        }
    }
    console.log('');

    // C. Random sample of 20 rows
    console.log('=== C. Random Sample of 20 Rows ===');
    const sample = pickSample(rows, 20);
    for (const r of sample) {
        const altPreview = r.alt_text ? `"${r.alt_text.slice(0, 90)}${r.alt_text.length > 90 ? '…' : ''}"` : '<null>';
        const titleFlag = r.seo_title ? 'T' : '-';
        const descFlag = r.seo_description ? 'D' : '-';
        const dimsFlag = (r.image_width && r.image_height) ? 'S' : '-';
        console.log(`  [${titleFlag}${descFlag}${dimsFlag}] ${r.slug} (alt=${(r.alt_text || '').length}ch) ${altPreview}`);
    }
    console.log('');

    // D. Weakest 10 rows (null or shortest alt_text)
    console.log('=== D. 10 Weakest Rows (open these in browser) ===');
    const weakest = [...rows]
        .sort((a, b) => (a.alt_text || '').length - (b.alt_text || '').length)
        .slice(0, 10);
    for (const r of weakest) {
        console.log(`  https://genie.ph/customizing/${r.slug}`);
        console.log(`    alt_text (${(r.alt_text || '').length}ch): ${r.alt_text ?? '<null>'}`);
        console.log(`    seo_title: ${r.seo_title ?? '<null>'}`);
    }
    console.log('');

    console.log(`Audit complete. ${total} rows scanned.`);
}

main().catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
});
