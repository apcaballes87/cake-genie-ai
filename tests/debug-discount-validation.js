import { createClient } from '@supabase/supabase-js';

// Supabase credentials
const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTYyMTAxOCwiZXhwIjoyMDc1MTk3MDE4fQ.A7X292I6E0tYXuJf6lK0OiC2q6nSHQ8yJJ9L3b9dX0s';

console.log('Debugging Discount Code Validation...');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugDiscountValidation() {
  try {
    console.log('\n=== Debugging Discount Code Validation ===');
    console.log('Testing code: TEST100');
    console.log('Order amount: 500');
    
    // Directly query the discount code using service role key
    const { data: discountCode, error: dbError } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', 'TEST100')
      .single();

    if (dbError || !discountCode) {
      console.log('Error fetching discount code:', dbError?.message || 'Not found');
      return;
    }

    console.log('\n=== Discount Code Details ===');
    console.log('Code:', discountCode.code);
    console.log('Discount Amount:', discountCode.discount_amount);
    console.log('Is Active:', discountCode.is_active);
    console.log('Expires At:', discountCode.expires_at);
    console.log('Times Used:', discountCode.times_used);
    console.log('Max Uses:', discountCode.max_uses);
    console.log('User ID:', discountCode.user_id);
    
    // Perform the same validation checks as the function
    console.log('\n=== Validation Checks ===');
    
    if (!discountCode.is_active) {
      console.log('❌ Code is not active');
      return;
    }
    console.log('✅ Code is active');
    
    const now = new Date();
    const expiresAt = new Date(discountCode.expires_at);
    if (expiresAt < now) {
      console.log('❌ Code has expired');
      return;
    }
    console.log('✅ Code has not expired');
    
    if (discountCode.times_used >= discountCode.max_uses) {
      console.log('❌ Code has reached usage limit');
      return;
    }
    console.log('✅ Code has not reached usage limit');
    
    // Calculate discount
    let discountAmount = 0;
    if (discountCode.discount_amount) {
      discountAmount = parseFloat(discountCode.discount_amount);
    }
    
    console.log('\n=== Calculations ===');
    console.log('Discount Amount:', discountAmount);
    const finalAmount = 500 - discountAmount;
    console.log('Final Amount:', finalAmount);
    
    console.log('\n=== Expected Results ===');
    console.log('Is valid: true');
    console.log('Discount Amount: 100');
    console.log('Final Amount: 400');
    
    console.log('\n=== Test Completed ===');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

debugDiscountValidation();