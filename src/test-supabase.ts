// Test Supabase connection
import { getSupabaseClient } from '../lib/supabase/client';

console.log('Testing Supabase connection...');

try {
  const supabase = getSupabaseClient();
  console.log('Supabase client created successfully');
  
  // Test a simple query to check connection
  supabase
    .from('cakegenie_shared_designs')
    .select('count')
    .limit(1)
    .then(({ data, error }) => {
      if (error) {
        console.error('Supabase connection error:', error);
      } else {
        console.log('Supabase connection successful');
        console.log('Test query result:', data);
      }
    });
} catch (error) {
  console.error('Failed to create Supabase client:', error);
}