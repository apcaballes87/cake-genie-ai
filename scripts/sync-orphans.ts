import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncOrphans() {
    console.log('Finding 6 orphan products...');
    
    const { data: products, error } = await supabase
        .from('cakegenie_merchant_products')
        .select('product_id, image_url, title, short_description, tags, category')
        .not('image_url', 'is', null);

    if (error) return console.error(error);

    let syncedCount = 0;

    for (const prod of products || []) {
        // Check if exists in cache
        const { count } = await supabase
            .from('cakegenie_analysis_cache')
            .select('*', { count: 'exact', head: true })
            .eq('original_image_url', prod.image_url);

        if (count === 0) {
            console.log(`Syncing orphan product: ${prod.title} (${prod.image_url})`);
            
            // Create cache entry
            // We use the product details as fallback SEO/Tags
            const { error: insertError } = await supabase
                .from('cakegenie_analysis_cache')
                .insert({
                    original_image_url: prod.image_url,
                    seo_title: prod.title,
                    seo_description: prod.short_description || '',
                    tags: prod.tags || [],
                    keywords: prod.category || '',
                    p_hash: `prod_${prod.product_id.substring(0, 8)}`,
                    analysis_json: {
                        title: prod.title,
                        description: prod.short_description || '',
                        tags: prod.tags || [],
                        is_cake: true,
                        confidence: 1.0
                    }
                });

            if (insertError) {
                console.error(`Failed to sync ${prod.product_id}:`, insertError.message);
            } else {
                syncedCount++;
            }
        }
    }

    console.log(`Successfully synced ${syncedCount} orphans to cache.`);
}

syncOrphans();
