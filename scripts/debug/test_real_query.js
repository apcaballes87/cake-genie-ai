import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRealQuery() {
  console.log('=== Testing Real Cart Query Performance ===\n');

  // First, create an anonymous session
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

  if (authError) {
    console.log('Auth error:', authError.message);
    return;
  }

  const sessionId = authData.user.id;
  console.log('Created anonymous user:', sessionId);

  // Test 1: Query with real session_id (empty cart)
  console.log('\n--- Test 1: Query empty cart ---');
  const start1 = Date.now();
  const { data: cart1, error: error1 } = await supabase
    .from('cakegenie_cart')
    .select('*')
    .eq('session_id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  const duration1 = Date.now() - start1;

  console.log(`Query completed in: ${duration1}ms`);
  console.log(`Result: ${cart1 ? cart1.length : 0} rows`);
  if (error1) console.log('Error:', error1.message);

  // Test 2: Query addresses
  console.log('\n--- Test 2: Query addresses ---');
  const start2 = Date.now();
  const { data: addresses, error: error2 } = await supabase
    .from('cakegenie_addresses')
    .select('*')
    .is('user_id', null)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  const duration2 = Date.now() - start2;

  console.log(`Query completed in: ${duration2}ms`);
  console.log(`Result: ${addresses ? addresses.length : 0} rows`);
  if (error2) console.log('Error:', error2.message);

  // Test 3: Parallel queries (simulating real app behavior)
  console.log('\n--- Test 3: Parallel queries (like real app) ---');
  const start3 = Date.now();
  const [cartResult, addressResult] = await Promise.all([
    supabase
      .from('cakegenie_cart')
      .select('*')
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('cakegenie_addresses')
      .select('*')
      .is('user_id', null)
      .order('is_default', { ascending: false })
  ]);
  const duration3 = Date.now() - start3;

  console.log(`Both queries completed in: ${duration3}ms`);
  console.log(`Cart: ${cartResult.data ? cartResult.data.length : 0} rows`);
  console.log(`Addresses: ${addressResult.data ? addressResult.data.length : 0} rows`);

  // Test 4: Cold start simulation (clear and retry)
  console.log('\n--- Test 4: Second request (should be faster) ---');
  const start4 = Date.now();
  const { data: cart4 } = await supabase
    .from('cakegenie_cart')
    .select('*')
    .eq('session_id', sessionId)
    .gt('expires_at', new Date().toISOString());
  const duration4 = Date.now() - start4;

  console.log(`Query completed in: ${duration4}ms`);
  console.log(`Result: ${cart4 ? cart4.length : 0} rows`);

  console.log('\n=== Performance Summary ===');
  console.log(`Average query time: ${Math.round((duration1 + duration2 + duration4) / 3)}ms`);
  console.log(`Parallel queries: ${duration3}ms`);
  console.log(`Target: < 500ms ✅ ${duration3 < 500 ? 'PASS' : 'FAIL'}`);
}

testRealQuery().catch(console.error);
