// Quick script to create NEW100 discount code
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
  console.log('✅ Loaded environment variables from .env.local');
} else {
  console.log('⚠️ No .env.local file found, using system environment variables');
}

// Check for required environment variables
if (!process.env.VITE_SUPABASE_URL) {
  console.error('❌ Error: VITE_SUPABASE_URL environment variable is not set');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'your_supabase_service_role_key_here') {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set or is still the placeholder value');
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createNEW100Code() {
  console.log('\n🎫 Creating NEW100 discount code...');
  console.log(`📍 Supabase URL: ${process.env.VITE_SUPABASE_URL}\n`);

  // First check if it already exists
  const { data: existing } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('code', 'NEW100')
    .single();

  if (existing) {
    console.log('ℹ️ NEW100 already exists. Current details:');
    console.log(JSON.stringify(existing, null, 2));
    console.log('\n🔄 Updating to ensure it\'s valid...');

    // Update it to be definitely valid
    const { data, error } = await supabase
      .from('discount_codes')
      .update({
        is_active: true,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        times_used: 0,
        max_uses: 1000,
      })
      .eq('code', 'NEW100')
      .select();

    if (error) {
      console.error('❌ Error updating NEW100:', error.message);
      process.exit(1);
    }

    console.log('✅ NEW100 updated successfully!');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    // Create new code
    const newCode = {
      code: 'NEW100',
      discount_amount: 100,
      discount_percentage: 0,
      is_active: true,
      max_uses: 1000,
      times_used: 0,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
      min_order_amount: 0,
      reason: 'New customer discount - ₱100 off',
    };

    const { data, error } = await supabase
      .from('discount_codes')
      .insert(newCode)
      .select();

    if (error) {
      console.error('❌ Error creating NEW100:', error.message);
      console.error('Details:', error);
      process.exit(1);
    }

    console.log('✅ NEW100 created successfully!');
    console.log(JSON.stringify(data[0], null, 2));
  }

  console.log('\n🎉 Done! You can now use NEW100 in your cart.');
}

createNEW100Code().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
