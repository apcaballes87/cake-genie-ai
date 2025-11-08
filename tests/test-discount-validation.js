import { createClient } from '@supabase/supabase-js';

// Supabase credentials
const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

console.log('Testing Discount Code Validation...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDiscountValidation() {
  try {
    console.log('\n=== Testing Discount Code Validation ===');
    console.log('Testing code: TEST100');
    console.log('Order amount: 500');
    
    // First, let's sign in as an anonymous user to get a session
    const { data: { session }, error: signInError } = await supabase.auth.signInAnonymously();
    
    if (signInError) {
      console.log('Error signing in anonymously:', signInError.message);
      return;
    }
    
    console.log('Signed in anonymously, now testing discount code validation...');
    
    // Now test the discount code validation function with proper authentication
    const { data: validationData, error: validationError } = await supabase.functions.invoke('validate-discount-code', {
      body: { 
        code: 'TEST100',
        orderAmount: 500
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (validationError) {
      console.log('Error validating discount code:', validationError.message);
      console.log('Full error:', validationError);
      return;
    }

    console.log('\n=== Validation Results ===');
    console.log('Response:', JSON.stringify(validationData, null, 2));
    
    // Check the expected results
    if (validationData.valid === true) {
      console.log('✅ Is valid: true ✓');
    } else {
      console.log('❌ Is valid: false ✗');
    }
    
    if (validationData.discountAmount === 100) {
      console.log('✅ Is discountAmount: 100 ✓');
    } else {
      console.log(`❌ Is discountAmount: ${validationData.discountAmount} ✗`);
    }
    
    if (validationData.finalAmount === 400) {
      console.log('✅ Is finalAmount: 400 ✓');
    } else {
      console.log(`❌ Is finalAmount: ${validationData.finalAmount} ✗`);
    }
    
    console.log('\n=== Test Completed ===');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testDiscountValidation();