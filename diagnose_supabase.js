// Diagnostic script to check Supabase connection
import { createClient } from '@supabase/supabase-js';

// Use the same configuration as in config.ts
const SUPABASE_URL = "https://cqmhanqnfybyxezhobkx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnoseSupabase() {
  console.log('🔍 Diagnosing Supabase connection...');
  console.log('Supabase URL:', SUPABASE_URL);
  
  try {
    // Test a simple query to check if we can connect
    const { data, error } = await supabase
      .from('cakegenie_shared_designs')
      .select('count', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase query error:', error.message);
      return;
    }
    
    console.log('✅ Supabase connection successful');
    console.log('Table exists and is accessible');
    
    // Check if we can access the storage bucket
    const { data: buckets, error: bucketError } = await supabase
      .storage
      .listBuckets();
    
    if (bucketError) {
      console.error('❌ Supabase storage error:', bucketError.message);
    } else {
      console.log('✅ Supabase storage accessible');
      console.log('Available buckets:', buckets.map(b => b.id));
      const sharedCakeImagesBucket = buckets.find(bucket => bucket.id === 'shared-cake-images');
      if (sharedCakeImagesBucket) {
        console.log('✅ shared-cake-images bucket found');
        console.log('Bucket details:', sharedCakeImagesBucket);
      } else {
        console.log('❌ shared-cake-images bucket not found');
        console.log('All buckets:', buckets);
      }
    }
  } catch (error) {
    console.error('❌ Supabase connection error:', error.message);
  }
}

// Run the diagnosis
diagnoseSupabase();