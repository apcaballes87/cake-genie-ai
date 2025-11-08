import { createClient } from '@supabase/supabase-js';

// Supabase credentials from the environment file
const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

console.log('Fixing base64 URLs in shared designs...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to convert base64 data URI to Blob (simplified version for Node.js)
function dataURItoBlob(dataURI) {
  if (!dataURI.startsWith('data:')) return null;
  
  try {
    const byteString = Buffer.from(dataURI.split(',')[1], 'base64');
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    return { buffer: byteString, type: mimeString };
  } catch (error) {
    console.error('Error converting data URI to blob:', error);
    return null;
  }
}

async function fixBase64Urls() {
  try {
    console.log('Fetching designs with base64 URLs...');
    
    // Get designs that have base64 data URIs
    const { data: designs, error } = await supabase
      .from('cakegenie_shared_designs')
      .select('design_id, customized_image_url')
      .like('customized_image_url', 'data:%')
      .limit(50); // Process in batches to avoid timeouts
    
    if (error) {
      console.log('Error fetching designs:', error.message);
      return;
    }
    
    console.log(`Found ${designs.length} designs with base64 URLs`);
    
    if (designs.length === 0) {
      console.log('No designs with base64 URLs found. Exiting.');
      return;
    }
    
    let fixedCount = 0;
    
    // Process each design
    for (const design of designs) {
      console.log(`Processing design ${design.design_id}...`);
      
      try {
        // Convert base64 to blob
        const blobData = dataURItoBlob(design.customized_image_url);
        if (!blobData) {
          console.log(`  Failed to convert base64 for design ${design.design_id}`);
          continue;
        }
        
        // Generate file name
        const fileExt = blobData.type.split('/')[1] || 'png';
        const fileName = `${design.design_id}-customized.${fileExt}`;
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('shared-cake-images')
          .upload(fileName, blobData.buffer, {
            contentType: blobData.type,
            upsert: true
          });
        
        if (uploadError) {
          console.log(`  Upload failed for design ${design.design_id}:`, uploadError.message);
          continue;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('shared-cake-images')
          .getPublicUrl(fileName);
        
        // Update the database record
        const { error: updateError } = await supabase
          .from('cakegenie_shared_designs')
          .update({ customized_image_url: publicUrl })
          .eq('design_id', design.design_id);
        
        if (updateError) {
          console.log(`  Database update failed for design ${design.design_id}:`, updateError.message);
          continue;
        }
        
        console.log(`  Successfully fixed design ${design.design_id}`);
        fixedCount++;
      } catch (designError) {
        console.log(`  Error processing design ${design.design_id}:`, designError.message);
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Fixed ${fixedCount} designs with base64 URLs`);
    console.log(`Remaining: ${designs.length - fixedCount} designs with issues`);
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

fixBase64Urls();