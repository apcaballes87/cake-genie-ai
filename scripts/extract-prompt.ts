import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

async function extractPrompt() {
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('prompt_text')
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Save to file
  fs.writeFileSync('/tmp/current_ai_prompt.txt', data.prompt_text);
  console.log('✓ Saved current ai_prompt to /tmp/current_ai_prompt.txt');
  console.log(`Prompt length: ${data.prompt_text.length} characters`);

  // Show first few lines
  const lines = data.prompt_text.split('\n').slice(0, 10);
  console.log('\nFirst 10 lines:');
  lines.forEach((line, idx) => console.log(`${idx + 1}: ${line}`));
}

extractPrompt();
