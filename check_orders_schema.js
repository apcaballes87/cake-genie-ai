import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('📋 Checking cakegenie_orders table schema...\n');

  // Get a sample order to see column names
  const { data: orders, error } = await supabase
    .from('cakegenie_orders')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching orders:', error.message);
    return;
  }

  if (orders && orders.length > 0) {
    console.log('✅ Column names in cakegenie_orders:');
    Object.keys(orders[0]).forEach(col => {
      console.log(`   - ${col}`);
    });

    // Check specifically for phone field
    const phoneFields = Object.keys(orders[0]).filter(k => k.includes('phone'));
    console.log('\n📞 Phone-related columns:', phoneFields.join(', ') || 'NONE');

    // Check for latitude/longitude
    const coordFields = Object.keys(orders[0]).filter(k =>
      k.includes('latitude') || k.includes('longitude')
    );
    console.log('🗺️  Coordinate columns:', coordFields.join(', ') || 'NONE');
  } else {
    console.log('⚠️  No orders found in database');
  }

  console.log('\n📦 Checking cakegenie_cart table schema...\n');

  const { data: cartItems, error: cartError } = await supabase
    .from('cakegenie_cart')
    .select('cart_item_id')
    .limit(1);

  if (cartError) {
    console.error('Error fetching cart:', cartError.message);
  } else if (cartItems && cartItems.length > 0) {
    console.log('✅ cart_item_id example:', cartItems[0].cart_item_id);
    console.log('   Type:', typeof cartItems[0].cart_item_id);
  } else {
    console.log('⚠️  No cart items found');
  }
}

checkSchema().catch(console.error);
