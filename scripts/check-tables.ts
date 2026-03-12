import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOtherTables() {
    console.log('Checking for other image-related tables...');
    
    // Check if 'products' table exists and has an image column
    const { data: tables, error: tableError } = await supabase
        .from('information_schema.columns')
        .select('table_name, column_name')
        .ilike('column_name', '%image%');

    if (tableError) {
        console.error('Error fetching columns:', tableError);
        return;
    }

    const uniqueTables = Array.from(new Set(tables.map(t => t.table_name)));
    console.log('Tables with image-related columns:', uniqueTables);

    for (const table of uniqueTables) {
        // Skip the cache table we already processed
        if (table === 'cakegenie_analysis_cache') continue;
        
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            
            console.log(`Table: ${table} | Count: ${count}`);
        } catch (e) {
            // Some tables might be view-only or protected
        }
    }
}

checkOtherTables();
