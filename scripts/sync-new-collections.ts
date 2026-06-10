import { createClient } from '@supabase/supabase-js';
import { COLLECTION_MIN_MATCHED_DESIGNS } from '../src/lib/collections/quality';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
 *
 * As the icing_colors column is backfilled for more designs, the
 * collection's item_count will grow automatically.
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

// Slugs of the new collections to sync. Kept as a hardcoded list so
// the targeted run stays fast — full update-collections-studio-images.ts
// iterates all 400+ collections and times out.
const targetSlugs = [
    'mothers-day-cakes',
    'fathers-day-cakes',
    'stray-kids',
    'yellow-cakes',
    'purple-cakes',
    'lavender-cakes',
];

async function processCollection(collection: any, isDryRun: boolean) {
    const orFilters = buildCollectionOrFilter(collection.name, collection.tags || []);

    const { count, error: countError } = await supabase
        .from('cakegenie_analysis_cache')
        .select('id', { count: 'exact', head: true })
        .not('original_image_url', 'is', null)
        .not('slug', 'is', null)
        .not('price', 'is', null)
        .or(orFilters);

    if (countError) {
        console.error(`Error counting for ${collection.name}:`, countError);
        return;
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
        console.error(`Error counting studio for ${collection.name}:`, studioCountError);
        return;
    }

    const { data: bestStudioDesign, error: studioError } = await supabase
        .from('cakegenie_analysis_cache')
        .select('studio_edited_image_url, usage_count, slug, keywords')
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
    let sourceSlug = null;
    let sourceKw = null;

    if (bestStudioDesign && bestStudioDesign.studio_edited_image_url) {
        sampleImage = bestStudioDesign.studio_edited_image_url;
        usedStudio = true;
        sourceSlug = bestStudioDesign.slug;
        sourceKw = bestStudioDesign.keywords;
    } else {
        const { data: bestOriginalDesign } = await supabase
            .from('cakegenie_analysis_cache')
            .select('original_image_url, usage_count, slug, keywords')
            .not('original_image_url', 'is', null)
            .not('slug', 'is', null)
            .not('price', 'is', null)
            .or(orFilters)
            .order('usage_count', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (bestOriginalDesign) {
            sampleImage = bestOriginalDesign.original_image_url;
            sourceSlug = bestOriginalDesign.slug;
            sourceKw = bestOriginalDesign.keywords;
        }
    }

    console.log(`\n📂 ${collection.name} (${collection.slug})`);
    console.log(`   Matched designs: ${count || 0}`);
    console.log(`   Studio-edited designs: ${studioImageCount || 0}`);
    console.log(`   Sample image: ${usedStudio ? '🎨 Studio' : '📷 Original fallback'}`);
    console.log(`   Source slug: ${sourceSlug}`);
    console.log(`   Source kw: ${typeof sourceKw === 'string' ? sourceKw.slice(0, 80) : JSON.stringify(sourceKw)}`);
    console.log(`   Threshold (8): ${(count || 0) >= COLLECTION_MIN_MATCHED_DESIGNS ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   URL: ${sampleImage?.slice(0, 80)}...`);

    if (sampleImage && !isDryRun) {
        const { error: updateError } = await supabase
            .from('cakegenie_collections')
            .update({
                item_count: count || 0,
                matched_design_count: count || 0,
                studio_image_count: studioImageCount || 0,
                sample_image: sampleImage,
            })
            .eq('id', collection.id);

        if (updateError) {
            console.error(`   ❌ Update error:`, updateError);
        } else {
            console.log(`   ✅ Updated collection record`);
        }
    } else if (!sampleImage) {
        console.log(`   ⚠️ No matching designs found. Collection will stay unpublished.`);
    }
}

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    console.log(`🚀 Processing ${targetSlugs.length} targeted collections ${isDryRun ? '(DRY RUN)' : ''}...`);

    const { data: collections, error } = await supabase
        .from('cakegenie_collections')
        .select('id, name, slug, tags, publication_status')
        .in('slug', targetSlugs);

    if (error) {
        console.error('Error fetching collections:', error);
        return;
    }

    if (!collections || collections.length === 0) {
        console.log('No targeted collections found.');
        return;
    }

    for (const collection of collections) {
        await processCollection(collection, isDryRun);
    }

    console.log(`\n🏁 Done ${isDryRun ? '(dry run)' : '(applied)'}.`);
}

main().catch(console.error);
