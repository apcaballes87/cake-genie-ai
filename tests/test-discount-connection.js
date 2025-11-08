import { createClient } from '@supabase/supabase-js';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Use the actual service role key from the .env.local file
// Note: In the .env.local file, it says "your_actual_supabase_service_role_key_here"
// We need to get the actual service role key from the Supabase dashboard
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing connection with anon key to:', supabaseUrl);

// Test with anon key (RLS enforced)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// For now, let's just test with the anon key and see what we get
async function testDiscountTable() {
  console.log('\n--- Testing with Anon Key (RLS enforced) ---');
  
  // First, let's check if we can authenticate
  const { data: authData, error: authError } = await supabaseAnon.auth.getSession();
  if (authError) {
    console.log('Auth error:', authError.message);
  } else {
    console.log('Auth status: Authenticated' + (authData.session ? '' : ' (no session)'));
  }
  
  // Now let's try to query the discount codes
  const { data: anonData, error: anonError } = await supabaseAnon
    .from('discount_codes')
    .select('*')
    .limit(10);
  
  if (anonError) {
    console.error('❌ ANON ERROR:', anonError.message);
    console.error('Error code:', anonError.code);
    console.error('Error details:', anonError.details);
  } else {
    console.log('✅ ANON SUCCESS! Found', anonData.length, 'codes');
    console.log('Codes:', anonData);
  }
  
  // Try to find NEW100 specifically
  console.log('\n--- Searching for NEW100 with Anon Key ---');
  const { data: newCodeAnon, error: newErrorAnon } = await supabaseAnon
    .from('discount_codes')
    .select('*')
    .eq('code', 'NEW100')
    .single();
  
  if (newErrorAnon) {
    console.error('❌ NEW100 not found with anon key:', newErrorAnon.message);
    console.error('Error code:', newErrorAnon.code);
  } else {
    console.log('✅ Found NEW100 with anon key:', newCodeAnon);
  }
  
  // Let's also try a more permissive query
  console.log('\n--- Trying permissive query ---');
  const { data: allCodes, error: allError } = await supabaseAnon
    .from('discount_codes')
    .select('code, is_active, expires_at');
  
  if (allError) {
    console.error('❌ All codes query failed:', allError.message);
  } else {
    console.log('✅ All codes query success! Found', allCodes.length, 'codes');
    console.log('All codes:', allCodes);
  }
}

testDiscountTable();