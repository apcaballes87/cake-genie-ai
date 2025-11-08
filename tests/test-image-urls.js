import { createClient } from '@supabase/supabase-js';

// Supabase credentials from the environment file
const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

console.log('Testing image URLs in shared designs...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testImageUrls() {
  try {
    // Get a few shared designs to check their image URLs
    const { data: designs, error } = await supabase
      .from('cakegenie_shared_designs')
      .select('design_id, title, customized_image_url, url_slug')
      .limit(5);
    
    if (error) {
      console.log('Error fetching designs:', error.message);
      return;
    }
    
    console.log('\n=== Sample Shared Designs ===');
    designs.forEach((design, index) => {
      console.log(`\n${index + 1}. ${design.title}`);
      console.log(`   Slug: ${design.url_slug}`);
      console.log(`   Image URL: ${design.customized_image_url}`);
      console.log(`   Image URL type: ${typeof design.customized_image_url}`);
      
      // Check if it's a proper URL
      if (design.customized_image_url) {
        const isProperUrl = design.customized_image_url.startsWith('http');
        console.log(`   Is proper URL: ${isProperUrl}`);
        
        // If it's not a proper URL, show what it would look like
        if (!isProperUrl) {
          const fullUrl = `https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/${design.customized_image_url}`;
          console.log(`   Full URL would be: ${fullUrl}`);
        }
      }
    });
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testImageUrls();