// Debug script to test adding items to cart
console.log('=== Debug Add to Cart ===\n');

// This script simulates what happens when adding an item to cart
// It's meant to be run in the browser console

async function debugAddToCart() {
  console.log('🔍 Starting cart debug...');
  
  // First, check auth state
  const { data: { session } } = await supabase.auth.getSession();
  console.log('🔑 Session:', session);
  
  if (!session) {
    console.log('🔵 Creating anonymous session...');
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('❌ Auth error:', error);
      return;
    }
    console.log('✅ Anonymous session created:', data.user);
  }
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  console.log('👤 Current user:', user);
  
  // Simulate adding an item to cart
  const testItem = {
    cake_type: 'Round',
    cake_thickness: 'Single',
    cake_size: '6"',
    base_price: 500,
    addon_price: 0,
    final_price: 500,
    original_image_url: 'https://example.com/test.jpg',
    customized_image_url: 'https://example.com/test-customized.jpg',
    customization_details: {
      flavors: ['Chocolate'],
      mainToppers: [],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {
        drip: false,
        gumpasteBaseBoard: false,
        colors: {
          side: '#FFFFFF',
          top: '#FFFFFF'
        }
      },
      additionalInstructions: ''
    },
    quantity: 1
  };
  
  console.log('🛒 Adding test item:', testItem);
  
  // Try to add to cart
  try {
    const response = await fetch('/rest/v1/cakegenie_cart', {
      method: 'POST',
      headers: {
        'apikey': supabaseKey, // You'll need to get this from your config
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        ...testItem,
        user_id: user?.is_anonymous ? null : user?.id,
        session_id: user?.is_anonymous ? user?.id : null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
      })
    });
    
    console.log('📡 Add to cart response:', response.status, response.statusText);
    const data = await response.json();
    console.log('📦 Add to cart result:', data);
  } catch (error) {
    console.error('💥 Error adding to cart:', error);
  }
  
  // Try to fetch cart items
  try {
    console.log('📥 Fetching cart items...');
    const response = await fetch('/rest/v1/cakegenie_cart?select=*', {
      method: 'GET',
      headers: {
        'apikey': supabaseKey, // You'll need to get this from your config
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Get cart response:', response.status, response.statusText);
    const data = await response.json();
    console.log('📋 Cart items:', data);
  } catch (error) {
    console.error('💥 Error fetching cart:', error);
  }
}

// Run the debug function
debugAddToCart();