import { createClient } from '@supabase/supabase-js';

// Supabase credentials - will use service role key from environment if available
const supabaseUrl = process.env.SUPABASE_URL || 'https://congofivupobtfudnhni.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvbmdvZml2dXBvYnRmdWRuaG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODc1NjkyMTQsImV4cCI6MjAwMzE0NTIxNH0.y2jsrPWt7Q_016e1o8PkM-Ayyti9yzxj3jH9hvH4DiM';

// Note: For production use, this should use SUPABASE_SERVICE_ROLE_KEY for full access

console.log('Fixing base64 URLs in shared designs...');
console.log('Using Supabase URL:', supabaseUrl);
console.log('Using service role key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

// Use service role key if available in environment, otherwise use anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    
    // First, let's check how many total records we have
    const { count: totalCount, error: countError } = await supabase
      .from('cakegenie_shared_designs')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log('Error counting total designs:', countError.message);
    } else {
      console.log(`Total designs in table: ${totalCount}`);
    }
    
    // Get designs that have base64 data URIs
    const { data: designs, error } = await supabase
      .from('cakegenie_shared_designs') // Corrected table name
      .select('design_id, customized_image_url')
      .like('customized_image_url', 'data:%')
      .limit(50); // Process in batches to avoid timeouts
    
    if (error) {
      console.log('Error fetching designs:', error.message);
      console.log('Error details:', error);
      return;
    }
    
    console.log(`Found ${designs.length} designs with base64 URLs`);
    
    // Let's also check a few sample records to see what URLs we have
    const { data: sampleData, error: sampleError } = await supabase
      .from('cakegenie_shared_designs')
      .select('design_id, customized_image_url')
      .limit(5);
    
    if (!sampleError && sampleData && sampleData.length > 0) {
      console.log('Sample records:');
      sampleData.forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.design_id}: ${record.customized_image_url.substring(0, 100)}${record.customized_image_url.length > 100 ? '...' : ''}`);
      });
    }
    
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
          .from('cakegenie_shared_designs') // Corrected table name
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
    console.log(`Found ${designs.length} designs with base64 URLs`);
    console.log(`Successfully fixed ${fixedCount} designs`);
    console.log(`${designs.length - fixedCount} designs had issues`);
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

fixBase64Urls();