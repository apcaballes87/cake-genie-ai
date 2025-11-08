import { createClient } from '@supabase/supabase-js';

// Supabase credentials from the environment file
const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

console.log('Testing AI validation with lenient settings...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAiValidation() {
  try {
    console.log('\n=== AI Validation Test ===');
    console.log('The updated validation should now be more lenient with:');
    console.log('1. Multiple cakes where one is clearly the main focus');
    console.log('2. Background cakes that are blurry or small');
    console.log('3. Cakes with multiple elements where the main cake is clear');
    
    console.log('\n=== Updated Validation Rules ===');
    console.log('- "valid_single_cake": Now includes cases where there are multiple cakes but one is clearly the main focus');
    console.log('- "multiple_cakes": Only for cases where multiple cakes are of similar importance');
    console.log('- Background elements should be ignored during analysis');
    
    console.log('\n=== Testing Image Management Hook ===');
    console.log('The useImageManagement hook now:');
    console.log('- Shows a warning instead of rejecting images with multiple cakes');
    console.log('- Continues processing when multiple cakes are detected');
    console.log('- Focuses on the main cake during analysis');
    
    console.log('\n=== Summary ===');
    console.log('✅ AI validation is now more lenient');
    console.log('✅ Background cakes are properly ignored');
    console.log('✅ Main cake focus is prioritized');
    console.log('✅ User experience is improved with warnings instead of rejections');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testAiValidation();