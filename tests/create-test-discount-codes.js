// Script to create test discount codes for development
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
  console.log('Please set VITE_SUPABASE_URL in your environment or .env.local file');
  console.log('You can copy .env.example to .env.local and fill in your values');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'your_supabase_service_role_key_here') {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set or is still the placeholder value');
  console.log('Please set SUPABASE_SERVICE_ROLE_KEY in your .env.local file');
  console.log('Get this from your Supabase project dashboard under Settings > API');
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

async function createTestCodes() {
  const testCodes = [
    {
      code: 'WELCOME50',
      discount_amount: 50,
      discount_percentage: 0,
      is_active: true,
      max_uses: 100,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      reason: 'Welcome discount',
    },
    {
      code: 'PERCENT20',
      discount_amount: 0,
      discount_percentage: 20,
      is_active: true,
      max_uses: 50,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      reason: '20% off promotion',
      min_order_amount: 500,
    },
    {
      code: 'TEST100',
      discount_amount: 100,
      discount_percentage: 0,
      is_active: true,
      max_uses: 10,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      reason: 'Test code for development',
    },
    {
      code: 'HOLIDAY25',
      discount_amount: 0,
      discount_percentage: 25,
      is_active: true,
      max_uses: 25,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      reason: 'Holiday promotion',
      min_order_amount: 1000,
    },
    {
      code: 'EXPIRED',
      discount_amount: 30,
      discount_percentage: 0,
      is_active: true,
      max_uses: 5,
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
      reason: 'Expired test code',
    },
    {
      code: 'INACTIVE',
      discount_amount: 40,
      discount_percentage: 0,
      is_active: false, // Inactive code
      max_uses: 5,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      reason: 'Inactive test code',
    }
  ];

  console.log('Creating test discount codes...');
  console.log(`Supabase URL: ${process.env.VITE_SUPABASE_URL}`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const code of testCodes) {
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .insert(code);
      
      if (error) {
        console.error(`❌ Error creating ${code.code}:`, error.message);
        errorCount++;
      } else {
        console.log(`✅ Created code: ${code.code}`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Exception creating ${code.code}:`, err.message);
      errorCount++;
    }
  }
  
  console.log(`\nFinished creating test discount codes.`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  
  if (errorCount > 0) {
    process.exit(1);
  }
  
  console.log('\n🎉 Test codes created successfully!');
  console.log('You can now test the discount functionality in the application.');
  console.log('Navigate to http://localhost:5174 to begin testing.');
}

createTestCodes().catch(err => {
  console.error('❌ Unexpected error:', err.message);
  process.exit(1);
});