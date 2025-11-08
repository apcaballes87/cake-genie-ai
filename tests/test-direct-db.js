// Direct database test using service role key
import { createClient } from '@supabase/supabase-js';

// Configuration - using the values from .env.local
const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
// This is the service role key from the .env.local file
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTYyMTAxOCwiZXhwIjoyMDc1MTk3MDE4fQ.XXXXXX'; // This is a placeholder

console.log('Testing direct database connection with service role key to:', supabaseUrl);

// Create client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testDirectDB() {
  console.log('\n--- Testing direct database access ---');
  
  // Try to query the discount codes
  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .limit(10);
  
  if (error) {
    console.error('❌ DIRECT DB ERROR:', error.message);
    console.error('Error code:', error.code);
    console.error('Error details:', error.details);
  } else {
    console.log('✅ DIRECT DB SUCCESS! Found', data.length, 'codes');
    console.log('Codes:', data);
  }
  
  // Try to find NEW100 specifically
  console.log('\n--- Searching for NEW100 directly ---');
  const { data: newCode, error: newError } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('code', 'NEW100')
    .single();
  
  if (newError) {
    console.error('❌ NEW100 not found directly:', newError.message);
    console.error('Error code:', newError.code);
  } else {
    console.log('✅ Found NEW100 directly:', newCode);
  }
}

testDirectDB();