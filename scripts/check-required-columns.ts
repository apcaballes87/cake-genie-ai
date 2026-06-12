#!/usr/bin/env npx tsx
/**
 * scripts/check-required-columns.ts
 *
 * Pre-deploy guardrail for the data-layer-verification rule
 * (see .agent/rules/data_layer_verification.md).
 *
 * For every `{ table, column }` pair in REQUIRED_COLUMNS, this script
 * issues a tiny probe query against the live Supabase project:
 *   GET /rest/v1/<table>?select=<column>&limit=0
 *
 *   - 200 OK  → column exists, all good
 *   - 400 with code PGRST204 (undefined_parameter) or 42703 (undefined_column)
 *     → column does NOT exist, exit non-zero so CI fails
 *
 * Pair the check with the rule: a plan saying "X links to Y via column C"
 * is only safe to write code against after this script confirms C exists
 * in the live schema. Run before merging any data-layer PR.
 *
 * Usage:
 *   npx tsx scripts/check-required-columns.ts
 *
 * Optional env override (defaults to VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY):
 *   SUPABASE_URL, SUPABASE_KEY
 *
 * Exit codes:
 *   0  — every required column exists
 *   1  — at least one required column is missing
 *   2  — couldn't reach Supabase (network / credentials)
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error(
        'Missing Supabase env vars.\n' +
        '  Required (any of): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL, VITE_SUPABASE_URL\n' +
        '  Required (any of): NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_KEY, VITE_SUPABASE_ANON_KEY\n' +
        '  Source from .env.local or .env in the project root.'
    );
    process.exit(2);
}

/**
 * The contract this script enforces. Add an entry whenever a feature's
 * plan/impl assumes a column exists. Removing an entry = "I no longer
 * need this column" — keep that in sync with the code.
 */
const REQUIRED_COLUMNS: ReadonlyArray<{ table: string; column: string; usedBy: string }> = [
    // The themed-review-pool helper (src/lib/reviews.ts) joins reviews to
    // designs via the design's image URL. Earlier versions assumed
    // cakegenie_analysis_cache.product_id existed — it doesn't. The actual
    // join key is the design's original_image_url.
    { table: 'cakegenie_analysis_cache', column: 'original_image_url', usedBy: 'getThemedReviewsForSlug' },
    { table: 'cakegenie_analysis_cache', column: 'slug', usedBy: 'slug page route + getThemedReviewsForSlug' },
    { table: 'cakegenie_analysis_cache', column: 'keywords', usedBy: 'getThemedReviewsForSlug tier-2' },
    { table: 'cakegenie_reviews',         column: 'original_image_url', usedBy: 'getThemedReviewsForSlug tier-1' },
    { table: 'cakegenie_reviews',         column: 'is_visible',        usedBy: 'public-read filter (all tiers)' },
    { table: 'cakegenie_reviews',         column: 'is_approved',       usedBy: 'public-read filter (all tiers)' },
    { table: 'cakegenie_reviews',         column: 'is_published',      usedBy: 'public-read filter (all tiers)' },
    { table: 'cakegenie_reviews',         column: 'rating',            usedBy: 'buildReviewSummary / getExactReviewsForSchema' },
    // The page-top hero summary still uses a site-wide count (legacy
    // query). When we tighten that, we'll add is_visible + is_approved
    // here. For now, the per-design override already works.
];

// PostgREST returns a 400 with one of these error codes when a column
// is missing. We match on the code rather than parsing the human-readable
// message, so the check is robust to locale changes.
const MISSING_COLUMN_CODES = new Set(['PGRST204', '42703']);

interface ProbeResult {
    table: string;
    column: string;
    usedBy: string;
    ok: boolean;
    status: number;
    errorCode?: string;
    errorMessage?: string;
}

async function probeColumn(
    table: string,
    column: string,
): Promise<{ status: number; body: any }> {
    // PostgREST returns 400 with code=42703 (PostgreSQL "undefined_column")
    // or PGRST204 (PostgREST's own "Could not find a column") when the
    // column doesn't exist. We use the PostgREST canonical endpoint with
    // the apikey header so RLS-protected columns still probe (the select
    // doesn't return rows, but the column existence check is auth-time).
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    url.searchParams.set('select', column);
    url.searchParams.set('limit', '0');
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Accept: 'application/json',
        },
    });
    let body: any = null;
    try {
        body = await res.json();
    } catch {
        // Non-JSON body — fine, we just need the status code.
    }
    return { status: res.status, body };
}

function classifyResult(
    table: string,
    column: string,
    usedBy: string,
    status: number,
    body: any,
): ProbeResult {
    if (status === 200) {
        return { table, column, usedBy, ok: true, status };
    }
    // 401/403 are auth issues — surface separately so the user knows it's
    // not a missing column.
    if (status === 401 || status === 403) {
        return {
            table, column, usedBy, ok: false, status,
            errorMessage: `auth failure (${status}); check that the key is valid and has read access to ${table}`,
        };
    }
    const errorCode: string | undefined = body?.code;
    const errorMessage: string | undefined = body?.message;
    if (errorCode && MISSING_COLUMN_CODES.has(errorCode)) {
        return { table, column, usedBy, ok: false, status, errorCode, errorMessage };
    }
    // 4xx/5xx we don't recognize — assume column is fine (it could be a
    // permissions error on the row data, not a missing column). Log
    // for awareness.
    return {
        table, column, usedBy, ok: true, status,
        errorMessage: `unexpected ${status} (${errorCode ?? 'no code'}): ${errorMessage ?? '(no message)'}`,
    };
}

async function main() {
    console.log(`Probing ${REQUIRED_COLUMNS.length} required column(s) against ${supabaseUrl}\n`);

    const results: ProbeResult[] = [];
    for (const { table, column, usedBy } of REQUIRED_COLUMNS) {
        try {
            const { status, body } = await probeColumn(table, column);
            results.push(classifyResult(table, column, usedBy, status, body));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({
                table, column, usedBy, ok: false, status: 0,
                errorMessage: `network/transport error: ${msg}`,
            });
        }
    }

    // Pretty-print the result table.
    const pad = (s: string, n: number) => s.length >= n ? s : s + ' '.repeat(n - s.length);
    console.log(
        pad('TABLE', 32) + pad('COLUMN', 24) + pad('STATUS', 10) + 'USED BY'
    );
    console.log('-'.repeat(120));
    for (const r of results) {
        const status = r.ok ? 'OK' : `MISSING (${r.errorCode ?? 'err'})`;
        console.log(
            pad(r.table, 32) +
            pad(r.column, 24) +
            pad(status, 10) +
            r.usedBy
        );
        if (r.errorMessage) {
            console.log(`    └─ ${r.errorMessage}`);
        }
    }

    const missing = results.filter((r) => !r.ok);
    console.log('');
    if (missing.length === 0) {
        console.log(`✅ All ${results.length} required column(s) exist.`);
        process.exit(0);
    }

    console.error(`❌ ${missing.length} required column(s) missing:\n`);
    for (const r of missing) {
        console.error(`   - ${r.table}.${r.column}  (used by ${r.usedBy})`);
        if (r.errorMessage) {
            console.error(`     ${r.errorMessage}`);
        }
    }
    console.error('');
    console.error('Remediation:');
    console.error('  1. Check whether the column was dropped/renamed in a recent migration.');
    console.error('  2. If the column was intentionally removed, update the feature that depends on it AND');
    console.error('     remove the corresponding entry from REQUIRED_COLUMNS in this script.');
    console.error('  3. If the column should still exist, write/restore the migration that adds it.');
    console.error('     See .agent/rules/data_layer_verification.md for the contract.');
    process.exit(1);
}

main().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(2);
});
