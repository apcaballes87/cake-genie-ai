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
 * Builds a Supabase OR-filter string that matches products across
 * the tags array for each collection tag.
 */
const buildCollectionOrFilter = (collectionTags: string[]): string => {
    const filters: string[] = [];
    for (const tag of collectionTags) {
        const cleanTag = tag.trim().toLowerCase();
        if (!cleanTag) continue;

        // 1. Match the exact tag (handles multi-word keywords)
        // tags.cs.{"clean tag"} matches if "clean tag" is in the tags array
        filters.push(`tags.cs.{"${cleanTag}"}`);

        // 2. If it's a phrase, also match if ALL individual words are present.
        const words = cleanTag.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 1) {
            filters.push(`tags.cs.{${words.map(w => `"${w}"`).join(',')}}`);
        }
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

        const orFilters = buildCollectionOrFilter(collectionTags);

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
