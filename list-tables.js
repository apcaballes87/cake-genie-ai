import { createClient } from '@supabase/supabase-js';

// Supabase credentials from the environment file
const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

console.log('Connecting to Supabase project:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTables() {
  try {
    console.log('Testing the fixed query...');
    
    // Test the fixed query without the join
    const { data: testQuery, error: testQueryError } = await supabase
      .from('cakegenie_shared_designs')
      .select('*')
      .limit(1);
    
    if (testQueryError) {
      console.log('Fixed query error:', testQueryError.message);
    } else {
      console.log('Fixed query works! Sample design title:', testQuery[0].title);
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testTables();