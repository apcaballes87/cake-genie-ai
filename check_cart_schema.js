// Check cart table schema by attempting an insert
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCartSchema() {
  // Try to select from cart with a filter that returns no results
  const { data, error } = await supabase
    .from('cakegenie_cart')
    .select('*')
    .limit(1);

  if (data && data.length > 0) {
    console.log('=== cakegenie_cart columns ===');
    console.log(Object.keys(data[0]).sort().join('\n'));
  } else if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Cart table is empty, checking error from RLS...');

    // Check if RLS is blocking
    const { error: insertError } = await supabase
      .from('cakegenie_cart')
      .insert({})
      .select();

    if (insertError) {
      console.log('\nError message (helps identify required columns):');
      console.log(insertError.message);
    }
  }
}

checkCartSchema().catch(console.error);
