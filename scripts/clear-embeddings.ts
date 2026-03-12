import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Clearing all image embeddings for re-processing...');
    
    let hasMore = true;
    let totalCleared = 0;
    const BATCH_SIZE = 1000;

    while (hasMore) {
        // Fetch p_hashes of records that still have embeddings
        const { data, error: fetchError } = await supabase
            .from('cakegenie_analysis_cache')
            .select('p_hash')
            .not('image_embedding', 'is', null)
            .limit(BATCH_SIZE);

        if (fetchError) {
            console.error('Error fetching p_hashes:', fetchError);
            break;
        }

        if (!data || data.length === 0) {
            hasMore = false;
            break;
        }

        const pHashes = data.map(r => r.p_hash);
        
        // Update those specific records
        const { error: updateError } = await supabase
            .from('cakegenie_analysis_cache')
            .update({ image_embedding: null })
            .in('p_hash', pHashes);

        if (updateError) {
            console.error('Error updating records:', updateError);
            break;
        }

        totalCleared += data.length;
        console.log(`Cleared ${totalCleared} records...`);
        
        // Small pause
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Clearing complete. Total records cleared: ${totalCleared}. Start the backfill-image-embeddings script now.`);
}

run();
