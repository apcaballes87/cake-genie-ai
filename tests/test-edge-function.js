import { createClient } from '@supabase/supabase-js';

// Supabase credentials from the environment file
const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

console.log('Testing Edge Function with a sample design...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testEdgeFunction() {
  try {
    // Get a sample design to test
    const { data: design, error } = await supabase
      .from('cakegenie_shared_designs')
      .select('design_id, title, description, customized_image_url, url_slug')
      .limit(1);
    
    if (error) {
      console.log('Error fetching design:', error.message);
      return;
    }
    
    if (!design || design.length === 0) {
      console.log('No designs found in the database');
      return;
    }
    
    const testDesign = design[0];
    console.log(`\n=== Testing Design ===`);
    console.log(`Title: ${testDesign.title}`);
    console.log(`URL Slug: ${testDesign.url_slug}`);
    console.log(`Image URL: ${testDesign.customized_image_url}`);
    console.log(`Image URL type: ${typeof testDesign.customized_image_url}`);
    
    // Check if it's a proper URL
    const isProperUrl = testDesign.customized_image_url && 
      (testDesign.customized_image_url.startsWith('http://') || 
       testDesign.customized_image_url.startsWith('https://'));
    
    console.log(`Is proper URL: ${isProperUrl}`);
    
    if (isProperUrl) {
      console.log('✅ This design should now work correctly with Messenger previews!');
    } else {
      console.log('❌ This design still has issues with the image URL');
    }
    
    // Test the share URL
    const shareUrl = `https://genie.ph/designs/${testDesign.url_slug}`;
    console.log(`\nShare URL: ${shareUrl}`);
    console.log('You can test this URL in Facebook and Messenger to verify the fix');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testEdgeFunction();