import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deepScan() {
    console.log('--- Deep Scan: cakegenie_analysis_cache ---');
    
    const { count: total, error: e1 } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*', { count: 'exact', head: true });
    
    const { count: withEmbedding, error: e2 } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*', { count: 'exact', head: true })
        .not('image_embedding', 'is', null);

    const { count: withUrlNoEmbedding, error: e3 } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*', { count: 'exact', head: true })
        .is('image_embedding', null)
        .not('original_image_url', 'is', null);

    const { count: noUrlNoEmbedding, error: e4 } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*', { count: 'exact', head: true })
        .is('image_embedding', null)
        .is('original_image_url', null);

    console.log(`Total Records: ${total}`);
    console.log(`With Embedding: ${withEmbedding}`);
    console.log(`Missing Embedding (but has URL): ${withUrlNoEmbedding}`);
    console.log(`Missing Both (No URL/No Embedding): ${noUrlNoEmbedding}`);

    console.log('\n--- Checking Merchant Products ---');
    const { data: missingInCache, error: e5 } = await supabase
        .from('cakegenie_merchant_products')
        .select('product_id, image_url, p_hash')
        .not('image_url', 'is', null);
    
    // Check if these products have a corresponding entry in the cache
    let productsMissingCacheEntry = 0;
    for (const prod of missingInCache || []) {
        const { count, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('*', { count: 'exact', head: true })
            .eq('original_image_url', prod.image_url);
        
        if (count === 0) productsMissingCacheEntry++;
    }
    console.log(`Products with Image URL but NO entry in Analysis Cache: ${productsMissingCacheEntry}`);
}

deepScan();
