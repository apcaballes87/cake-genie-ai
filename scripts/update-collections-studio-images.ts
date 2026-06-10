import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { COLLECTION_MIN_MATCHED_DESIGNS } from '../src/lib/collections/quality';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials in .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Strips " Cakes", " Cake", " Themed", etc. from a collection name to get at the core keyword.
 */
const cleanCollectionName = (name: string): string => {
    return name
        .replace(/(?:\s+Cakes?|\s+Themed|\s+Design|\s+Collections?)$/i, '')
        .trim();
};

/**
 * Maps a collection's clean keyword to a canonical icing_colors bucket
 * (if the collection is a color collection). Sub-colors like "lavender" or
 * "sage green" map to their parent bucket. Returns null for non-color
 * collections so the existing tag/keyword matching path is used.
 *
 * icing_colors is the analyst's normalized "side color" of the cake — far
 * more accurate than the noisy `tags` array (which includes accent colors).
 * See cakegenie_analysis_cache.icing_colors and the
 * `get_closest_icing_color()` function for the canonical bucket list.
 */
const COLOR_CANONICAL: Record<string, string> = {
    white: 'white',
    black: 'black',
    blue: 'blue',
    pink: 'pink',
    yellow: 'yellow',
    purple: 'purple',
    lavender: 'purple',    // lavender is a sub-color of purple
    red: 'red',
    green: 'green',
    sage: 'green',        // sage green maps to green
    'sage green': 'green',
    emerald: 'green',     // emerald green maps to green
    'emerald green': 'green',
    orange: 'orange',
    brown: 'brown',
    gold: 'yellow',       // gold is rare; treat as a yellow variant
    silver: 'white',      // silver accents usually ride on white
    maroon: 'red',
    teal: 'blue',
    cream: 'white',
    ivory: 'white',
};

const canonicalColorFor = (cleanKeyword: string): string | null => {
    return COLOR_CANONICAL[cleanKeyword] || null;
};

/**
 * Builds a Supabase OR-filter string that matches products against
 * the core keyword derived from the collection name.
 *
 * For color collections (cleanKeyword matches COLOR_CANONICAL), only
 * `icing_colors.eq.<canonical>` is used. The tag/keyword/slug fallbacks
 * are skipped because they produce noisy results (e.g. a teal cake with
 * yellow stars gets tagged "yellow" but is not actually a yellow cake).
 */
const buildCollectionOrFilter = (collectionName: string, collectionTags: string[] = []): string => {
    const keyword = cleanCollectionName(collectionName);
    const cleanKeyword = keyword.toLowerCase();

    if (!cleanKeyword) return 'id.eq.-1';

    const filters: string[] = [];

    // 0. Color collection: strict match on icing_colors ONLY.
    // No keyword/slug/multi-word tag fallbacks — those are too noisy
    // for color matching and pull in accent-only designs.
    const canonical = canonicalColorFor(cleanKeyword);
    if (canonical) {
        filters.push(`icing_colors.eq.${canonical}`);
        return filters.join(',');
    }

    // 1. Exact match in tags array
    filters.push(`tags.cs.{"${cleanKeyword}"}`);

    // 2. Keyword match in keywords field (text search)
    filters.push(`keywords.ilike.%${cleanKeyword}%`);

    // 3. Slug match
    const slugKeyword = cleanKeyword.replace(/\s+/g, '-');
    filters.push(`slug.ilike.%${slugKeyword}%`);

    // 4. (Optional) Multi-word tags from the collection
    for (const tag of collectionTags) {
        const cleanTag = tag.trim().toLowerCase();
        if (cleanTag === cleanKeyword || cleanTag.split(/\s+/).length < 2) continue;
        filters.push(`tags.cs.{"${cleanTag}"}`);
    }

    return filters.join(',');
};

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    
    console.log(`🚀 Starting update of collection images ${isDryRun ? '(DRY RUN)' : ''}...`);

    // 1. Fetch all collections
    const { data: collections, error: fetchError } = await supabase
        .from('cakegenie_collections')
        .select('id, name, slug, tags, sample_image, publication_status, collection_type');

    if (fetchError) {
        console.error("❌ Error fetching collections:", fetchError);
        return;
    }

    if (!collections || collections.length === 0) {
        console.log("📭 No collections found in cakegenie_collections.");
        return;
    }

    console.log(`📂 Found ${collections.length} collections. Processing...`);

    let totalUpdated = 0;
    let studioCount = 0;
    let fallbackCount = 0;
    let skipCount = 0;

    for (const collection of collections) {
        const collectionTags = collection.tags || [];
        if (collectionTags.length === 0) {
            console.log(`⚠️ Collection "${collection.name}" has no tags. Skipping...`);
            skipCount++;
            continue;
        }

        const orFilters = buildCollectionOrFilter(collection.name, collectionTags);

        // 2. Count matching designs
        const { count, error: countError } = await supabase
            .from('cakegenie_analysis_cache')
            .select('id', { count: 'exact', head: true })
            .not('original_image_url', 'is', null)
            .not('slug', 'is', null)
            .not('price', 'is', null)
            .or(orFilters);

        if (countError) {
            console.error(`❌ Error counting designs for "${collection.name}":`, countError);
            continue;
        }

        const { count: studioImageCount, error: studioCountError } = await supabase
            .from('cakegenie_analysis_cache')
            .select('id', { count: 'exact', head: true })
            .not('studio_edited_image_url', 'is', null)
            .neq('studio_edited_image_url', '')
            .not('slug', 'is', null)
            .not('price', 'is', null)
            .or(orFilters);

        if (studioCountError) {
            console.error(`❌ Error counting studio designs for "${collection.name}":`, studioCountError);
            continue;
        }

        // 3. Prefer a design that has a studio_edited_image_url
        const { data: bestStudioDesign, error: studioError } = await supabase
            .from('cakegenie_analysis_cache')
            .select('studio_edited_image_url, usage_count')
            .not('studio_edited_image_url', 'is', null)
            .neq('studio_edited_image_url', '')
            .not('slug', 'is', null)
            .not('price', 'is', null)
            .or(orFilters)
            .order('usage_count', { ascending: false })
            .limit(1)
            .maybeSingle();

        let sampleImage = null;
        let usedStudio = false;

        if (studioError) {
            console.error(`❌ Error fetching studio thumbnail for "${collection.name}":`, studioError);
        } else if (bestStudioDesign && bestStudioDesign.studio_edited_image_url) {
            sampleImage = bestStudioDesign.studio_edited_image_url;
            usedStudio = true;
            studioCount++;
        } else {
            // 4. Fallback to original_image_url if no studio edited image is available
            const { data: bestOriginalDesign, error: originalError } = await supabase
                .from('cakegenie_analysis_cache')
                .select('original_image_url, usage_count')
                .not('original_image_url', 'is', null)
                .not('slug', 'is', null)
                .not('price', 'is', null)
                .or(orFilters)
                .order('usage_count', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (originalError) {
                console.error(`❌ Error fetching fallback thumbnail for "${collection.name}":`, originalError);
            } else if (bestOriginalDesign && bestOriginalDesign.original_image_url) {
                sampleImage = bestOriginalDesign.original_image_url;
                fallbackCount++;
            }
        }

        if (sampleImage) {
            console.log(`ℹ️ [Match] "${collection.name}": Type: ${usedStudio ? '🎨 Studio Edited' : '📷 Original Fallback'}, Image: ${sampleImage}`);
            
            if (!isDryRun) {
                const { error: updateError } = await supabase
                    .from('cakegenie_collections')
                    .update({
                        item_count: count || 0,
                        matched_design_count: count || 0,
                        studio_image_count: studioImageCount || 0,
                        sample_image: sampleImage,
                        ...(collection.publication_status === 'stocking' ? {
                            publication_status: (count || 0) >= COLLECTION_MIN_MATCHED_DESIGNS ? 'published' : 'stocking',
                            is_indexable: (count || 0) >= COLLECTION_MIN_MATCHED_DESIGNS,
                            published_at: (count || 0) >= COLLECTION_MIN_MATCHED_DESIGNS ? new Date().toISOString() : null,
                        } : {}),
                    })
                    .eq('id', collection.id);

                if (updateError) {
                    console.error(`❌ Error updating collection "${collection.name}":`, updateError);
                } else {
                    totalUpdated++;
                }
            } else {
                totalUpdated++; // Count as updated for dry-run
            }
        } else {
            console.log(`⚠️ Collection "${collection.name}" has no matching designs. Skipping...`);
            skipCount++;
        }
    }

    console.log(`\n🏁 ${isDryRun ? 'Dry-run' : 'Execution'} complete!`);
    console.log(`📊 Statistics:`);
    console.log(`   - Total Collections Processed: ${collections.length}`);
    console.log(`   - Updated/To Update: ${totalUpdated}`);
    console.log(`   - Used Studio Images: ${studioCount}`);
    console.log(`   - Used Fallback Original Images: ${fallbackCount}`);
    console.log(`   - Skipped/No match: ${skipCount}`);
}

main().catch(console.error);
