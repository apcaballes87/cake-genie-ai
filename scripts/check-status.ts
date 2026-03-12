import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Checking remaining embeddings...');
    const { count, error } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*', { count: 'exact', head: true })
        .is('image_embedding', null)
        .not('original_image_url', 'is', null);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`Remaining records: ${count}`);
    }
}

check();
