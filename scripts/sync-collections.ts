import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)");
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
 * Builds a Supabase OR-filter string that matches products against
 * the core keyword derived from the collection name.
 */
const buildCollectionOrFilter = (collectionName: string, collectionTags: string[] = []): string => {
    const keyword = cleanCollectionName(collectionName);
    const cleanKeyword = keyword.toLowerCase();

    if (!cleanKeyword) return 'id.eq.-1';

    const filters: string[] = [];

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
    console.log("🚀 Starting synchronization of cake collections...");

    // 1. Fetch all collections
    const { data: collections, error: fetchError } = await supabase
        .from('cakegenie_collections')
        .select('id, name, slug, tags');

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

    for (const collection of collections) {
        const collectionTags = collection.tags || [];
        if (collectionTags.length === 0) {
            console.log(`⚠️ Collection "${collection.name}" has no tags. Skipping...`);
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

        // 3. Get best thumbnail (highest usage_count)
        // We want a real design with a valid image
        const { data: bestDesign, error: designError } = await supabase
            .from('cakegenie_analysis_cache')
            .select('original_image_url, usage_count')
            .not('original_image_url', 'is', null)
            .not('slug', 'is', null)
            .not('price', 'is', null)
            .or(orFilters)
            .order('usage_count', { ascending: false })
            .limit(1)
            .maybeSingle();

        let sampleImage = null;
        if (designError) {
            console.error(`❌ Error fetching thumbnail for "${collection.name}":`, designError);
        } else if (bestDesign) {
            sampleImage = bestDesign.original_image_url;
        }

        // 4. Update collection record
        const { error: updateError } = await supabase
            .from('cakegenie_collections')
            .update({
                item_count: count || 0,
                sample_image: sampleImage
            })
            .eq('id', collection.id);

        if (updateError) {
            console.error(`❌ Error updating collection "${collection.name}":`, updateError);
        } else {
            console.log(`✅ Updated "${collection.name}": ${count} designs, Thumbnail: ${sampleImage ? 'Yes' : 'No'}`);
            totalUpdated++;
        }
    }

    console.log(`\n🏁 Synchronization complete! Updated ${totalUpdated} collections.`);
}

main().catch(console.error);
