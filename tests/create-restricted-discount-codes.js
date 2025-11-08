// Script to create discount codes with user restrictions for testing
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envLocalPath = join(__dirname, '..', '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
}

if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createRestrictedCodes() {
  console.log('\n🎫 Creating discount codes with user restrictions...\n');

  const testCodes = [
    {
      code: 'ONETIME50',
      discount_amount: 50,
      discount_percentage: 0,
      is_active: true,
      max_uses: 1000,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'One-time use per user',
      one_per_user: true,        // ✨ NEW: Each user can only use once
      new_users_only: false,
    },
    {
      code: 'WELCOME100',
      discount_amount: 100,
      discount_percentage: 0,
      is_active: true,
      max_uses: 1000,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'New customers only',
      one_per_user: false,
      new_users_only: true,      // ✨ NEW: Only for users with no previous orders
    },
    {
      code: 'FIRSTORDER75',
      discount_amount: 75,
      discount_percentage: 0,
      is_active: true,
      max_uses: 500,
      expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'First order only',
      one_per_user: true,        // ✨ NEW: One time per user
      new_users_only: true,      // ✨ NEW: AND only for new users
    },
    {
      code: 'UNLIMITED25',
      discount_amount: 0,
      discount_percentage: 25,
      is_active: true,
      max_uses: 10000,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'No user restrictions - reusable',
      one_per_user: false,       // No restriction - users can use multiple times
      new_users_only: false,
      min_order_amount: 500,
    },
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const code of testCodes) {
    try {
      // Try to insert, or update if exists
      const { data, error } = await supabase
        .from('discount_codes')
        .upsert(code, { onConflict: 'code' })
        .select();

      if (error) {
        console.error(`❌ Error creating ${code.code}:`, error.message);
        errorCount++;
      } else {
        console.log(`✅ Created/Updated: ${code.code}`);
        console.log(`   └─ ${code.reason}`);
        if (code.one_per_user) console.log(`   └─ ⚠️  One use per user`);
        if (code.new_users_only) console.log(`   └─ 🆕 New users only`);
        console.log();
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Exception creating ${code.code}:`, err.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  console.log(`\n📝 How to test:`);
  console.log(`\n1. ONETIME50 - Can only be used once per user`);
  console.log(`   - Try using it, complete an order`);
  console.log(`   - Try using it again → should fail with "already used"`);

  console.log(`\n2. WELCOME100 - Only for users who never ordered before`);
  console.log(`   - Use it as a new user → should work`);
  console.log(`   - After completing an order, try on new cart → should fail with "only for new customers"`);

  console.log(`\n3. FIRSTORDER75 - Combines both restrictions`);
  console.log(`   - Only works for new users, and only once`);
  console.log(`   - Perfect for true "first order" discounts`);

  console.log(`\n4. UNLIMITED25 - No restrictions`);
  console.log(`   - Can be used multiple times by same user`);
  console.log(`   - Min order ₱500`);

  console.log(`\n🎉 Test codes ready! Apply migration first if you haven't:\n`);
  console.log(`   Run the migrations to add new columns to discount_codes table`);
}

createRestrictedCodes().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
