require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpload() {
  console.log(`Testing upload using URL: ${supabaseUrl}`);
  
  // Create a 1x1 transparent PNG pixel buffer
  const pngHex = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789ccb6060600000000500010d0a2db40000000049454e44ae426082';
  const buffer = Buffer.from(pngHex, 'hex');
  const filePath = `customizations/test_connection_${Date.now()}.png`;
  
  const { data, error } = await supabase.storage
    .from('cakegenie')
    .upload(filePath, buffer, {
      contentType: 'image/png',
      upsert: true
    });
    
  if (error) {
    console.error('❌ Upload failed:', error);
  } else {
    console.log('✅ Upload succeeded! Path:', data.path);
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('cakegenie')
      .getPublicUrl(data.path);
    console.log('🔗 Public URL:', urlData.publicUrl);
    
    // Clean up
    console.log('Cleaning up test file...');
    const { error: deleteError } = await supabase.storage
      .from('cakegenie')
      .remove([filePath]);
    if (deleteError) {
      console.error('Failed to clean up:', deleteError);
    } else {
      console.log('✅ Clean up successful');
    }
  }
}

testUpload();
