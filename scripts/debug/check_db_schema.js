// Check actual database schema
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking database schema...\n');

  const tables = [
    'cakegenie_cart',
    'cakegenie_orders',
    'cakegenie_shared_designs',
    'cakegenie_analysis_cache',
    'xendit_payments',
    'discount_codes',
    'cakegenie_addresses'
  ];

  for (const table of tables) {
    console.log(`\n=== ${table} ===`);

    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '${table}'
        ORDER BY ordinal_position
      `
    });

    if (error) {
      // Try direct query instead
      const { data: sample, error: sampleError } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (sample && sample.length > 0) {
        console.log('Columns:', Object.keys(sample[0]).join(', '));
      } else {
        console.log('Could not fetch schema');
      }
    } else if (data) {
      data.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type})`);
      });
    }
  }
}

checkSchema().catch(console.error);
