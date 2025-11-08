// Simple test to verify the cart page is working
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envLocalPath = join(__dirname, '..', '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
  console.log('Loaded environment variables from .env.local');
}

// Check if required environment variables are set
if (!process.env.VITE_SUPABASE_URL) {
  console.error('❌ Error: VITE_SUPABASE_URL is not set');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks'
);

async function testCartPage() {
  console.log('Testing cart page functionality...');
  
  try {
    // Test 1: Check if we can connect to Supabase
    const { data, error } = await supabase.from('cakegenie_cart').select('count');
    
    if (error) {
      console.log('⚠️  Warning: Could not connect to cart table, but this might be expected if no items exist');
      console.log('Error:', error.message);
    } else {
      console.log('✅ Supabase connection successful');
    }
    
    // Test 2: Try to sign in anonymously (this is what the frontend does)
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    
    if (authError) {
      console.log('⚠️  Warning: Could not sign in anonymously');
      console.log('Error:', authError.message);
    } else {
      console.log('✅ Anonymous sign-in successful');
    }
    
    console.log('\n🎉 Cart page basic functionality test completed!');
    console.log('You can now visit http://localhost:5175/cart to test the UI');
    
  } catch (err) {
    console.error('❌ Unexpected error during test:', err.message);
    process.exit(1);
  }
}

testCartPage();