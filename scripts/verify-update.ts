import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('prompt_id, version, is_active, description, prompt_text')
    .eq('prompt_id', 4)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Prompt ID:', data.prompt_id);
  console.log('Version:', data.version);
  console.log('Active:', data.is_active);
  console.log('Description:', data.description);
  console.log('Prompt length:', data.prompt_text.length);
  console.log('\nFirst 300 chars:');
  console.log(data.prompt_text.substring(0, 300));
  console.log('\nChecking for improvements:');
  console.log('Has "My Melody":', data.prompt_text.includes('My Melody') ? '✓ YES' : '✗ NO');
  console.log('Has "VERY RARE":', data.prompt_text.includes('VERY RARE') ? '✓ YES' : '✗ NO');
  console.log('Has "MOST COMMON":', data.prompt_text.includes('MOST COMMON') ? '✓ YES' : '✗ NO');
  console.log('Has "DECISION TREE":', data.prompt_text.includes('DECISION TREE') ? '✓ YES' : '✗ NO');
}

verify();
