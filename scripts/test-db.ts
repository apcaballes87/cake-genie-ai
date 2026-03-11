import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Testing DB connection...');
    const { data, error } = await supabase.from('cakegenie_analysis_cache').select('p_hash').limit(1);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success! Found record:', data[0]?.p_hash);
    }
}

test();
