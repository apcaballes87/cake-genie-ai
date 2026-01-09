// Script to verify Supabase Storage setup for Facebook sharing
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
// Note: In a real scenario, you would use environment variables for these values
const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'YOUR_ANON_KEY_HERE'; // Replace with your anon key
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyStorageSetup() {
  console.log('🔍 Verifying Supabase Storage setup for Facebook sharing...\n');

  try {
    // 1. Check if the shared-cake-images bucket exists
    console.log('1. Checking for shared-cake-images bucket...');
    const { data: buckets, error: bucketError } = await supabase
      .storage
      .listBuckets();

    if (bucketError) {
      console.error('❌ Error fetching buckets:', bucketError.message);
      return;
    }

    const sharedCakeImagesBucket = buckets.find(bucket => bucket.id === 'shared-cake-images');
    
    if (sharedCakeImagesBucket) {
      console.log('✅ Bucket exists');
      console.log('   Name:', sharedCakeImagesBucket.name);
      console.log('   Public:', sharedCakeImagesBucket.public);
      console.log('   File size limit:', sharedCakeImagesBucket.file_size_limit);
      console.log('   Allowed MIME types:', sharedCakeImagesBucket.allowed_mime_types);
    } else {
      console.log('❌ Bucket does not exist');
      console.log('   You need to create the shared-cake-images bucket');
      return;
    }

    // 2. Test upload permissions (this would require authentication)
    console.log('\n2. Testing upload capability...');
    console.log('   Note: Full upload test requires authenticated user');
    console.log('   See shareService.ts for implementation details');

    // 3. Test public access
    console.log('\n3. Testing public access...');
    console.log('   Bucket is public:', sharedCakeImagesBucket.public);
    
    if (sharedCakeImagesBucket.public) {
      console.log('✅ Public access is enabled');
    } else {
      console.log('❌ Public access is not enabled');
    }

    console.log('\n✅ Storage setup verification complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test the sharing functionality in the app');
    console.log('   2. Verify images are uploaded to the shared-cake-images bucket');
    console.log('   3. Test with Facebook Sharing Debugger');
    console.log('   4. Verify Edge Function returns proper Open Graph meta tags');

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
  }
}

// Run the verification
verifyStorageSetup();