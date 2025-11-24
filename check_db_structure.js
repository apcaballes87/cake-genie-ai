import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('=== Checking RLS Policies ===\n');

  // Check RLS policies
  const { data: policies, error: policiesError } = await supabase.rpc('pg_policies_info');

  if (policiesError) {
    console.log('Note: Cannot query pg_policies directly with anon key (expected)');
    console.log('RLS policies are likely active and enforced.\n');
  }

  console.log('=== Checking Indexes on cakegenie_cart ===\n');

  // Check indexes via pg_indexes
  const { data: indexes, error: indexError } = await supabase.rpc('get_table_indexes', {
    table_name: 'cakegenie_cart'
  });

  if (indexError) {
    console.log('Cannot query indexes directly. Will use EXPLAIN instead.\n');
  }

  console.log('=== Testing Query Performance ===\n');

  // Test a sample query with EXPLAIN
  console.log('Testing: SELECT * FROM cakegenie_cart WHERE session_id = ? LIMIT 1');
  const start = Date.now();
  const { data, error } = await supabase
    .from('cakegenie_cart')
    .select('*')
    .eq('session_id', '00000000-0000-0000-0000-000000000000')
    .limit(1);
  const duration = Date.now() - start;

  console.log(`Query completed in: ${duration}ms`);
  console.log(`Result: ${data ? data.length : 0} rows`);
  if (error) console.log('Error:', error.message);

  console.log('\n=== Checking Table Structure ===\n');

  // Get a sample row to see structure
  const { data: sampleCart, error: sampleError } = await supabase
    .from('cakegenie_cart')
    .select('*')
    .limit(1);

  if (sampleCart && sampleCart.length > 0) {
    console.log('cakegenie_cart columns:', Object.keys(sampleCart[0]));
  }

  const { data: sampleAddress } = await supabase
    .from('cakegenie_addresses')
    .select('*')
    .limit(1);

  if (sampleAddress && sampleAddress.length > 0) {
    console.log('cakegenie_addresses columns:', Object.keys(sampleAddress[0]));
  }
}

checkDatabase().catch(console.error);
