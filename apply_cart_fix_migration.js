/**
 * Apply the cart item fix migration to Supabase
 * This script reads the migration SQL file and executes it
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    console.log('🔧 Applying cart item fix migration...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20251204000001_fix_cart_items_in_orders.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log('🗄️  Connecting to Supabase...\n');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // If exec_sql doesn't exist, try direct SQL execution
      console.log('⚠️  exec_sql RPC not available, trying direct execution...\n');

      // Split the migration into individual statements
      const statements = migrationSQL
        .split('$function$')
        .map((part, i, arr) => {
          if (i < arr.length - 1) {
            return part + '$function$';
          }
          return part;
        })
        .filter(s => s.trim().length > 0);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (!stmt || stmt.startsWith('--')) continue;

        console.log(`Executing statement ${i + 1}/${statements.length}...`);

        try {
          // We'll need to use the Supabase SQL editor or pgAdmin for complex migrations
          console.log('⚠️  This migration contains complex function definitions.');
          console.log('Please apply it manually through the Supabase SQL Editor.\n');
          console.log('Steps:');
          console.log('1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new');
          console.log('2. Copy the contents of: supabase/migrations/20251204000001_fix_cart_items_in_orders.sql');
          console.log('3. Paste and run the migration\n');
          process.exit(0);
        } catch (execError) {
          console.error('❌ Error executing statement:', execError.message);
          throw execError;
        }
      }
    }

    console.log('✅ Migration applied successfully!\n');
    console.log('🎉 The cart item fix is now active.');
    console.log('   - Removed items will no longer appear in orders');
    console.log('   - Only visible cart items will be included\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
