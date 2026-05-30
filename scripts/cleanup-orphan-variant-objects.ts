/**
 * Delete orphaned image-variant storage objects left behind by the
 * slug-key re-path (`scripts/repath-variants-to-slug.ts`).
 *
 * After the re-path, each design's variants live at `variants/{slug}/...`,
 * but the OLD `variants/{p_hash}/...` objects remain in the bucket as
 * orphans. This script removes any `variants/{key}/` folder whose key is no
 * longer referenced by ANY row's `image_variants` manifest.
 *
 * SAFETY:
 *   - Preview by default (lists orphan folders + object counts, no deletes).
 *   - `--confirm` required to delete.
 *   - Builds the "referenced keys" set from the live DB first. If that set
 *     is implausibly small (< MIN_REFERENCED_KEYS) the script ABORTS rather
 *     than risk mass-deleting live objects after a bad DB read.
 *   - Only deletes folders NOT in the referenced set — never touches a key
 *     any manifest still points at (works for both slug and the 3 slug-less
 *     p_hash rows that were intentionally left on hash paths).
 *   - Resilient: paginated listing, retry + backoff, resumable via the
 *     ordered folder walk (re-running after an interrupt simply re-skips
 *     already-deleted folders).
 *
 * Usage:
 *   npx tsx scripts/cleanup-orphan-variant-objects.ts                 # preview
 *   npx tsx scripts/cleanup-orphan-variant-objects.ts --confirm       # delete
 *   npx tsx scripts/cleanup-orphan-variant-objects.ts --confirm --limit=500
 *
 * Recommended: run only AFTER the slug-key deploy is live and stable, so
 * nothing references the old hash paths anymore.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const BUCKET = 'cakegenie';
const PREFIX = 'variants';

/** Abort guard: if fewer referenced keys than this are found, something is
 * wrong with the DB read — refuse to delete anything. */
const MIN_REFERENCED_KEYS = 5000;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

const args = process.argv.slice(2);
const CONFIRM = args.includes('--confirm');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

const DB_PAGE = 1000;
const LIST_PAGE = 1000;

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

const STORAGE_OBJECT_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

/** Extract the variant KEY (folder name) from a manifest URL, or null. */
function keyFromVariantUrl(url: string): string | null {
    const i = url.indexOf(`${STORAGE_OBJECT_PREFIX}${PREFIX}/`);
    if (i < 0) return null;
    const rest = url.slice(i + STORAGE_OBJECT_PREFIX.length + PREFIX.length + 1); // after "variants/"
    const slash = rest.indexOf('/');
    return slash > 0 ? rest.slice(0, slash) : null;
}

interface ManifestRow { image_variants: { variants?: Array<{ url?: string }> } | null }

/** Build the set of storage keys still referenced by any row's manifest. */
async function buildReferencedKeySet(): Promise<Set<string>> {
    const referenced = new Set<string>();
    let offset = 0;
    /* eslint-disable no-await-in-loop */
    while (true) {
        const rows = await withRetry(`db page ${offset}`, async () => {
            const { data, error } = await supabase
                .from('cakegenie_analysis_cache')
                .select('image_variants')
                .not('image_variants', 'is', null)
                .order('slug', { ascending: true })
                .range(offset, offset + DB_PAGE - 1);
            if (error) throw new Error(error.message);
            return (data ?? []) as ManifestRow[];
        });
        if (rows.length === 0) break;
        for (const r of rows) {
            const vs = r.image_variants?.variants ?? [];
            for (const v of vs) {
                if (typeof v.url === 'string') {
                    const key = keyFromVariantUrl(v.url);
                    if (key) referenced.add(key);
                }
            }
        }
        offset += DB_PAGE;
        if (rows.length < DB_PAGE) break;
    }
    /* eslint-enable no-await-in-loop */
    return referenced;
}

/** List immediate folder names under `variants/` (paginated). */
async function listVariantFolders(): Promise<string[]> {
    const folders: string[] = [];
    let offset = 0;
    /* eslint-disable no-await-in-loop */
    while (true) {
        const batch = await withRetry(`list folders ${offset}`, async () => {
            const { data, error } = await supabase.storage
                .from(BUCKET)
                .list(PREFIX, { limit: LIST_PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
            if (error) throw new Error(error.message);
            return data ?? [];
        });
        if (batch.length === 0) break;
        // Folders are entries without an `id` (Supabase represents nested
        // prefixes as name-only entries). Files would have an id/metadata.
        for (const entry of batch) {
            if (entry && typeof entry.name === 'string' && entry.name.length > 0) {
                folders.push(entry.name);
            }
        }
        offset += LIST_PAGE;
        if (batch.length < LIST_PAGE) break;
    }
    /* eslint-enable no-await-in-loop */
    return folders;
}

/** List object paths inside one variant folder. */
async function listObjectsInFolder(folder: string): Promise<string[]> {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(`${PREFIX}/${folder}`, { limit: LIST_PAGE });
    if (error) throw new Error(error.message);
    return (data ?? [])
        .filter((e) => e && typeof e.name === 'string' && e.name.length > 0)
        .map((e) => `${PREFIX}/${folder}/${e.name}`);
}

async function run(): Promise<void> {
    console.log('Building referenced-key set from live manifests…');
    const referenced = await buildReferencedKeySet();
    console.log(`Referenced keys: ${referenced.size}`);

    if (referenced.size < MIN_REFERENCED_KEYS) {
        console.error(
            `ABORT: only ${referenced.size} referenced keys (< ${MIN_REFERENCED_KEYS}). ` +
            `Refusing to delete — the DB read looks incomplete.`,
        );
        process.exit(1);
    }

    console.log('Listing variant folders in storage…');
    const folders = await listVariantFolders();
    console.log(`Total variant folders in bucket: ${folders.length}`);

    const orphanFolders = folders.filter((f) => !referenced.has(f));
    console.log(`Orphan folders (not referenced by any manifest): ${orphanFolders.length}`);

    let foldersProcessed = 0;
    let objectsDeleted = 0;
    const sample: string[] = [];

    /* eslint-disable no-await-in-loop */
    for (const folder of orphanFolders) {
        if (foldersProcessed >= LIMIT) break;
        const objects = await withRetry(`list ${folder}`, () => listObjectsInFolder(folder));
        if (sample.length < 10) sample.push(`${PREFIX}/${folder}/ (${objects.length} objects)`);

        if (CONFIRM && objects.length > 0) {
            await withRetry(`delete ${folder}`, async () => {
                const { error } = await supabase.storage.from(BUCKET).remove(objects);
                if (error) throw new Error(error.message);
            });
            objectsDeleted += objects.length;
        } else {
            objectsDeleted += objects.length; // counted as "would delete" in preview
        }
        foldersProcessed += 1;
        if (foldersProcessed % 200 === 0) {
            console.log(`  …${foldersProcessed}/${orphanFolders.length} orphan folders processed`);
        }
    }
    /* eslint-enable no-await-in-loop */

    console.log('\n--- Orphan Cleanup Summary ---');
    console.log(`Referenced keys:          ${referenced.size}`);
    console.log(`Variant folders in bucket: ${folders.length}`);
    console.log(`Orphan folders:           ${orphanFolders.length}`);
    console.log(`Folders processed:        ${foldersProcessed}`);
    console.log(`Objects ${CONFIRM ? 'deleted' : 'to delete'}:       ${objectsDeleted}`);
    console.log(`Mode:                     ${CONFIRM ? 'APPLIED (deleted)' : 'PREVIEW (no deletes)'}`);
    if (sample.length > 0) {
        console.log('Sample orphan folders:');
        sample.forEach((s) => console.log(`  ${s}`));
    }
    if (!CONFIRM) console.log('\nRe-run with --confirm to delete. Use --limit=<n> for a pilot.');
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\nCleanup aborted:', err instanceof Error ? err.message : err);
        console.error('Safe to re-run: re-running re-skips already-deleted folders.');
        process.exit(1);
    });
