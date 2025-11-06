const { createClient } = require('@supabase/supabase-js');

// Supabase credentials from the environment file
const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

console.log('Connecting to Supabase project:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listTables() {
  try {
    // Get list of tables from the database
    console.log('Fetching table list...');
    
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_schema')
      .eq('table_schema', 'public')
      .order('table_name');
    
    if (error) {
      console.error('Error fetching tables:', error);
      return;
    }
    
    console.log('\n=== Supabase Tables ===');
    if (data && data.length > 0) {
      data.forEach((table, index) => {
        console.log(`${index + 1}. ${table.table_name}`);
      });
      console.log(`\nTotal tables found: ${data.length}`);
    } else {
      console.log('No tables found in the public schema.');
    }
    
    // Let's also try to get tables from the Supabase meta tables
    console.log('\n=== Attempting to get table info from Supabase meta ===');
    const { data: metaTables, error: metaError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .order('tablename');
    
    if (metaError) {
      console.error('Error fetching meta tables:', metaError);
    } else if (metaTables && metaTables.length > 0) {
      console.log('\nTables from pg_tables:');
      metaTables.forEach((table, index) => {
        console.log(`${index + 1}. ${table.tablename}`);
      });
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

listTables();