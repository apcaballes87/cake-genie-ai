// Test script to verify shared-cake-images bucket functionality
import { createClient } from '@supabase/supabase-js';

// Use the same configuration as in config.ts
const SUPABASE_URL = "https://cqmhanqnfybyxezhobkx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSharedCakeImagesBucket() {
  console.log('🔍 Testing shared-cake-images bucket...');
  
  try {
    // List all buckets to see if we can access them
    const { data: allBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError.message);
      return;
    }
    
    console.log('✅ Successfully listed buckets');
    console.log('Total buckets:', allBuckets.length);
    
    // Find the shared-cake-images bucket
    const sharedCakeImagesBucket = allBuckets.find(bucket => bucket.id === 'shared-cake-images');
    
    if (sharedCakeImagesBucket) {
      console.log('✅ shared-cake-images bucket found');
      console.log('Bucket details:');
      console.log('  ID:', sharedCakeImagesBucket.id);
      console.log('  Name:', sharedCakeImagesBucket.name);
      console.log('  Public:', sharedCakeImagesBucket.public);
      console.log('  File size limit:', sharedCakeImagesBucket.file_size_limit);
      console.log('  Allowed MIME types:', sharedCakeImagesBucket.allowed_mime_types);
      
      // Test uploading a small test file
      console.log('\n📤 Testing upload capability...');
      
      // Create a simple test image (1x1 pixel PNG in base64)
      const testImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const binaryData = atob(testImageData);
      const arrayBuffer = new ArrayBuffer(binaryData.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i);
      }
      
      const testFile = new Blob([uint8Array], { type: 'image/png' });
      const fileName = `test-${Date.now()}.png`;
      const filePath = `test/${fileName}`;
      
      // Upload test file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('shared-cake-images')
        .upload(filePath, testFile, {
          contentType: 'image/png',
          upsert: true
        });
      
      if (uploadError) {
        console.error('❌ Upload test failed:', uploadError.message);
        // This might fail due to permissions, which is expected for anon users in some cases
      } else {
        console.log('✅ Upload test successful');
        console.log('Uploaded file path:', uploadData.path);
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('shared-cake-images')
          .getPublicUrl(filePath);
        
        console.log('Public URL:', publicUrl);
        
        // Clean up - delete the test file
        const { error: deleteError } = await supabase.storage
          .from('shared-cake-images')
          .remove([filePath]);
        
        if (deleteError) {
          console.warn('⚠️  Could not delete test file:', deleteError.message);
        } else {
          console.log('✅ Test file cleaned up');
        }
      }
    } else {
      console.log('❌ shared-cake-images bucket not found');
      console.log('Available buckets:', allBuckets.map(b => b.id));
    }
    
  } catch (error) {
    console.error('❌ Error testing shared-cake-images bucket:', error.message);
  }
}

// Run the test
testSharedCakeImagesBucket();