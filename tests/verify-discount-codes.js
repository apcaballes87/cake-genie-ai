// Script to verify test discount codes were created
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Load environment variables from .env.local file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load .env.local file
const envLocalPath = join(__dirname, '..', '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
  console.log('Loaded environment variables from .env.local');
} else {
  console.log('No .env.local file found, using system environment variables');
}

// Check for required environment variables
if (!process.env.VITE_SUPABASE_URL) {
  console.error('❌ Error: VITE_SUPABASE_URL environment variable is not set');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'your_supabase_service_role_key_here') {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set or is still the placeholder value');
  console.log('Please set SUPABASE_SERVICE_ROLE_KEY in your .env.local file');
  console.log('Steps to get your key:');
  console.log('1. Go to your Supabase project dashboard');
  console.log('2. Navigate to Settings > API');
  console.log('3. Find the "service_role" key under "Project API keys"');
  console.log('4. Copy this key (it\'s different from the anon key)');
  console.log('5. Replace "your_supabase_service_role_key_here" with your actual key in .env.local');
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyTestCodes() {
  const testCodes = ['WELCOME50', 'PERCENT20', 'TEST100', 'HOLIDAY25', 'EXPIRED', 'INACTIVE'];
  
  console.log('Verifying test discount codes...\n');
  
  for (const code of testCodes) {
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', code)
        .single();
      
      if (error || !data) {
        console.log(`❌ Code ${code}: Not found`);
      } else {
        console.log(`✅ Code ${code}: Found`);
        console.log(`   Amount: ${data.discount_amount}`);
        console.log(`   Percentage: ${data.discount_percentage}`);
        console.log(`   Active: ${data.is_active}`);
        console.log(`   Expires: ${new Date(data.expires_at).toLocaleDateString()}`);
        console.log(`   Times Used: ${data.times_used}`);
        console.log(`   Max Uses: ${data.max_uses}`);
        console.log('');
      }
    } catch (err) {
      console.error(`❌ Exception checking ${code}:`, err.message);
    }
  }
  
  console.log('Verification complete.');
}

verifyTestCodes().catch(err => {
  console.error('❌ Unexpected error:', err.message);
  process.exit(1);
});