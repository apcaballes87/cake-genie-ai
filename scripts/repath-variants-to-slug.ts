/**
 * Re-path existing image variants from p_hash-based storage keys to
 * descriptive slug-based keys, so the rendered hero image URL carries
 * keyword signal for Google Images.
 *
 *   variants/{p_hash}/{w}.webp  →  variants/{slug}/{w}.webp
 *
 * For each row whose manifest still points at a p_hash path:
 *   1. COPY each variant object to the new slug path (storage copy — no
 *      re-encode, cheap and bandwidth-light).
 *   2. Rewrite the `image_variants` manifest URLs to the slug paths.
 *   3. Leave the old p_hash objects in place (orphans; cleaned up separately).
 *
 * Modes:
 *   preview (default): report how many rows/objects WOULD change. No writes.
 *   --confirm:         perform the copy + manifest rewrite.
 *   --limit=<n>:       cap rows processed (for a pilot run).
 *
 * Resilience (weak internet): paginated reads, per-object retry+backoff,
 * a local checkpoint file so --confirm resumes from the last committed row.
 * Idempotent: rows already on slug paths are skipped; storage copy uses
 * upsert semantics so a re-run is safe.
 *
 * Spec: .kiro/specs/cake-image-variant-pipeline (slug-key revision).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const BUCKET = 'cakegenie';
const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/seo-ecommerce');
const CHECKPOINT = path.join(ARTIFACT_DIR, '.variant-repath-checkpoint.json');

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

const args = process.argv.slice(2);
const CONFIRM = args.includes('--confirm');
const RESET = args.includes('--reset-checkpoint');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const PAGE = 500;

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
});

async function withRetry<T>(label: string, fn: () => Promise<T>, maxAttempts = 6): Promise<T> {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (err) {
            attempt += 1;
            if (attempt >= maxAttempts) throw err;
            const wait = Math.min(1500 * 2 ** (attempt - 1), 24000) + Math.floor(Math.random() * 750);
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`… ${label} attempt ${attempt} failed (${msg}); retry in ${(wait / 1000).toFixed(1)}s`);
            await new Promise((r) => setTimeout(r, wait));
        }
    }
}

interface VariantEntry { width: number; url: string; bytes: number }
interface Manifest { format: string; source?: string; variants: VariantEntry[] }
interface Row { slug: string; p_hash: string; image_variants: Manifest | null }

const STORAGE_OBJECT_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

/** Extract the in-bucket object path from a public storage URL, or null. */
function objectPathFromUrl(url: string): string | null {
    const i = url.indexOf(STORAGE_OBJECT_PREFIX);
    if (i < 0) return null;
    return url.slice(i + STORAGE_OBJECT_PREFIX.length);
}

function readCheckpoint(): { offset: number; changed: number; copied: number } | null {
    try {
        if (fs.existsSync(CHECKPOINT)) return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
    } catch { /* ignore */ }
    return null;
}
function writeCheckpoint(cp: { offset: number; changed: number; copied: number }): void {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2));
}

async function fetchPage(offset: number): Promise<Row[]> {
    return withRetry(`fetch rows ${offset}`, async () => {
        const { data, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('slug, p_hash, image_variants')
            .not('image_variants', 'is', null)
            .not('slug', 'is', null)
            .order('slug', { ascending: true })
            .range(offset, offset + PAGE - 1);
        if (error) throw new Error(error.message);
        return (data ?? []) as Row[];
    });
}

/** Copy one storage object old→new (upsert). Treats "already exists" as success. */
async function copyObject(from: string, to: string): Promise<void> {
    await withRetry(`copy ${from}→${to}`, async () => {
        const { error } = await supabase.storage.from(BUCKET).copy(from, to);
        if (error) {
            const m = error.message.toLowerCase();
            // Idempotent: destination already present from a prior run.
            if (m.includes('exists') || m.includes('duplicate')) return;
            throw new Error(error.message);
        }
    });
}

/** Returns the new manifest if the row needs re-pathing, else null. */
function planRow(row: Row): { newManifest: Manifest; copies: Array<{ from: string; to: string }> } | null {
    const m = row.image_variants;
    if (!m || !Array.isArray(m.variants) || m.variants.length === 0) return null;

    const slugSeg = `/variants/${row.slug}/`;
    // Already on slug paths → nothing to do (idempotent).
    if (m.variants.every((v) => v.url.includes(slugSeg))) return null;

    const copies: Array<{ from: string; to: string }> = [];
    const newVariants = m.variants.map((v) => {
        const oldPath = objectPathFromUrl(v.url);
        const newUrl = `${SUPABASE_URL}${STORAGE_OBJECT_PREFIX}variants/${row.slug}/${Math.trunc(v.width)}.webp`;
        const newPath = `variants/${row.slug}/${Math.trunc(v.width)}.webp`;
        if (oldPath && oldPath !== newPath) copies.push({ from: oldPath, to: newPath });
        return { ...v, url: newUrl };
    });
    return { newManifest: { ...m, variants: newVariants }, copies };
}

async function run(): Promise<void> {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    if (RESET && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT);

    const cp = (CONFIRM && readCheckpoint()) || { offset: 0, changed: 0, copied: 0 };
    let offset = cp.offset;
    let changed = cp.changed;
    let copied = cp.copied;
    let scanned = offset;

    /* eslint-disable no-await-in-loop */
    while (scanned - cp.offset < LIMIT) {
        const rows = await fetchPage(offset);
        if (rows.length === 0) break;

        for (const row of rows) {
            if (scanned - cp.offset >= LIMIT) break;
            scanned += 1;
            const plan = planRow(row);
            if (!plan) continue;

            if (!CONFIRM) {
                changed += 1;
                copied += plan.copies.length;
                continue;
            }

            // Copy objects first, then rewrite the manifest. If a copy fails
            // after retries it throws → script aborts → safe to resume (the
            // manifest is only rewritten once all copies for the row succeed).
            for (const c of plan.copies) {
                await copyObject(c.from, c.to);
                copied += 1;
            }
            await withRetry(`update manifest ${row.slug}`, async () => {
                const { error } = await supabase
                    .from('cakegenie_analysis_cache')
                    .update({ image_variants: plan.newManifest })
                    .eq('slug', row.slug);
                if (error) throw new Error(error.message);
            });
            changed += 1;
            writeCheckpoint({ offset: scanned, changed, copied });
        }

        offset += PAGE;
        if (rows.length < PAGE) break;
    }
    /* eslint-enable no-await-in-loop */

    console.log('\n--- Re-path Summary ---');
    console.log(`Rows scanned:        ${scanned}`);
    console.log(`Rows ${CONFIRM ? 'updated' : 'to update'}:    ${changed}`);
    console.log(`Objects ${CONFIRM ? 'copied' : 'to copy'}:   ${copied}`);
    console.log(`Mode:                ${CONFIRM ? 'APPLIED' : 'PREVIEW (no writes)'}`);
    if (CONFIRM && fs.existsSync(CHECKPOINT)) {
        fs.unlinkSync(CHECKPOINT);
        console.log('Checkpoint cleared (run complete).');
    }
    if (!CONFIRM) console.log('Re-run with --confirm to apply. Use --limit=<n> for a pilot.');
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\nRe-path aborted:', err instanceof Error ? err.message : err);
        console.error('Safe to re-run with --confirm: resumes from checkpoint; copies are idempotent.');
        process.exit(1);
    });
