import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

async function comprehensiveTest() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   COMPREHENSIVE CART PERFORMANCE TEST          ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // Test 1: Authentication Speed
  console.log('📝 Test 1: Anonymous Authentication Speed');
  console.log('─'.repeat(50));
  const authStart = Date.now();
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
  const authDuration = Date.now() - authStart;

  if (authError) {
    console.log('❌ Auth failed:', authError.message);
    return;
  }

  console.log(`✅ Anonymous sign-in: ${authDuration}ms`);
  console.log(`   User ID: ${authData.user.id}`);
  console.log(`   Target: < 1000ms ${authDuration < 1000 ? '✅ PASS' : '❌ FAIL'}\n`);

  const sessionId = authData.user.id;

  // Test 2: Empty Cart Query Performance
  console.log('📝 Test 2: Empty Cart Query Performance');
  console.log('─'.repeat(50));
  const emptyStart = Date.now();
  const { data: emptyCart, error: emptyError } = await supabase
    .from('cakegenie_cart')
    .select('*')
    .eq('session_id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  const emptyDuration = Date.now() - emptyStart;

  console.log(`✅ Empty cart query: ${emptyDuration}ms`);
  console.log(`   Rows returned: ${emptyCart?.length || 0}`);
  console.log(`   Target: < 500ms ${emptyDuration < 500 ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test 3: Add Test Item to Cart
  console.log('📝 Test 3: Add Item to Cart');
  console.log('─'.repeat(50));
  const addStart = Date.now();
  const testItem = {
    session_id: sessionId,
    user_id: null,
    quantity: 1,
    original_image_url: 'https://test.com/test.jpg',
    final_image_url: 'https://test.com/final.jpg',
    cake_info: { size: '8 inch', flavor: 'Chocolate' },
    main_toppers: [],
    support_elements: [],
    icing_design: 'Buttercream',
    base_price: 50.00,
    main_topper_price: 0,
    support_element_price: 0,
    final_price: 50.00,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };

  const { data: addedItem, error: addError } = await supabase
    .from('cakegenie_cart')
    .insert(testItem)
    .select()
    .single();
  const addDuration = Date.now() - addStart;

  if (addError) {
    console.log('❌ Add item failed:', addError.message);
  } else {
    console.log(`✅ Item added: ${addDuration}ms`);
    console.log(`   Cart item ID: ${addedItem.cart_item_id}`);
    console.log(`   Target: < 500ms ${addDuration < 500 ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  // Test 4: Query Cart with Item
  console.log('📝 Test 4: Query Cart with Item');
  console.log('─'.repeat(50));
  const queryStart = Date.now();
  const { data: cartWithItem, error: queryError } = await supabase
    .from('cakegenie_cart')
    .select('*')
    .eq('session_id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  const queryDuration = Date.now() - queryStart;

  console.log(`✅ Cart query with item: ${queryDuration}ms`);
  console.log(`   Items in cart: ${cartWithItem?.length || 0}`);
  console.log(`   Target: < 500ms ${queryDuration < 500 ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test 5: Multiple Sequential Queries (Simulating Page Refresh)
  console.log('📝 Test 5: Multiple Sequential Queries (3x)');
  console.log('─'.repeat(50));
  const results = [];
  for (let i = 1; i <= 3; i++) {
    const start = Date.now();
    await supabase
      .from('cakegenie_cart')
      .select('*')
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString());
    const duration = Date.now() - start;
    results.push(duration);
    console.log(`   Query ${i}: ${duration}ms`);
  }
  const avgDuration = Math.round(results.reduce((a, b) => a + b) / results.length);
  console.log(`✅ Average: ${avgDuration}ms`);
  console.log(`   Target: < 300ms ${avgDuration < 300 ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test 6: Cleanup - Delete Test Item
  console.log('📝 Test 6: Cleanup');
  console.log('─'.repeat(50));
  if (addedItem) {
    const { error: deleteError } = await supabase
      .from('cakegenie_cart')
      .delete()
      .eq('cart_item_id', addedItem.cart_item_id);

    if (deleteError) {
      console.log('⚠️  Warning: Could not delete test item');
    } else {
      console.log('✅ Test item deleted\n');
    }
  }

  // Final Summary
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║              PERFORMANCE SUMMARY               ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`Authentication:     ${authDuration}ms`);
  console.log(`Empty cart query:   ${emptyDuration}ms`);
  console.log(`Add item:           ${addDuration}ms`);
  console.log(`Query with item:    ${queryDuration}ms`);
  console.log(`Average repeat:     ${avgDuration}ms`);
  console.log('');

  const allPass = authDuration < 1000 &&
                  emptyDuration < 500 &&
                  addDuration < 500 &&
                  queryDuration < 500 &&
                  avgDuration < 300;

  if (allPass) {
    console.log('🎉 ALL TESTS PASSED! Cart performance is excellent!');
  } else {
    console.log('⚠️  Some tests did not meet target performance');
  }
}

comprehensiveTest().catch(console.error);
