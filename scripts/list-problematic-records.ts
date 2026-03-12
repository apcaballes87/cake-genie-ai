import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listProblematic() {
    console.log('--- 13 Records with Broken/Empty Image URLs ---');
    const { data: broken, error: e1 } = await supabase
        .from('cakegenie_analysis_cache')
        .select('p_hash, original_image_url, created_at')
        .is('image_embedding', null)
        .not('original_image_url', 'is', null);

    if (e1) console.error(e1);
    else {
        broken.forEach((r, i) => {
            console.log(`${i + 1}. [${r.p_hash}] ${r.original_image_url} (Created: ${r.created_at})`);
        });
    }

    console.log('\n--- 48 Records with NO Original Image URL ---');
    const { data: missingUrl, error: e2 } = await supabase
        .from('cakegenie_analysis_cache')
        .select('p_hash, created_at, seo_title')
        .is('image_embedding', null)
        .is('original_image_url', null);

    if (e2) console.error(e2);
    else {
        missingUrl.forEach((r, i) => {
            console.log(`${i + 1}. [${r.p_hash}] Title: ${r.seo_title || 'N/A'} (Created: ${r.created_at})`);
        });
    }
}

listProblematic();
