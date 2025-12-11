import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

async function extractPrompt() {
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No active prompts found.');
    return;
  }

  console.log(`Found ${data.length} active prompts.`);

  data.forEach((p: any, index: number) => {
    // Use index as ID if id is missing
    const id = p.id || index;
    console.log(`\n--- Prompt #${index + 1} (ID: ${id}) ---`);
    console.log(`Length: ${p.prompt_text ? p.prompt_text.length : 0} characters`);

    if (p.prompt_text) {
      const lines = p.prompt_text.split('\n').slice(0, 5);
      lines.forEach((line: string, idx: number) => console.log(`${idx + 1}: ${line}`));

      // Save each to a separate file
      fs.writeFileSync(`/tmp/active_prompt_${id}.txt`, p.prompt_text);
      console.log(`Saved to /tmp/active_prompt_${id}.txt`);
    }
  });
}

extractPrompt();
