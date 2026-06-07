import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Configuration error: NEXT_PUBLIC_SUPABASE_URL and a Supabase key must be set.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('🔍 Querying database to count studio edited images...');
    const { count, error } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*', { count: 'exact', head: true })
        .eq('studio_edit_status', 'completed')
        .not('studio_edited_image_url', 'is', null)
        .neq('studio_edited_image_url', '');

    if (error) {
        console.error('❌ Error counting rows:', error.message);
        process.exit(1);
    }

    console.log(`✅ Total completed studio edited images found: ${count}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
