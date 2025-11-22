import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPrompts() {
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data.length} prompts\n`);

  if (data.length > 0) {
    console.log('Table columns:', Object.keys(data[0]));
    console.log('');
  }

  data.forEach((prompt: any, idx: number) => {
    console.log(`[${idx}] Active: ${prompt.is_active}, Created: ${prompt.created_at}`);
    console.log(`Prompt length: ${prompt.prompt_text.length} chars`);
    const preview = prompt.prompt_text.substring(0, 200);
    console.log(`First 200 chars: ${preview}`);

    // Check if it has the old or new rules
    if (prompt.prompt_text.includes('My Melody')) {
      console.log('✓ Has My Melody examples');
    } else {
      console.log('✗ Missing My Melody examples');
    }

    if (prompt.prompt_text.includes('CHECK THIS FIRST')) {
      console.log('✓ Has reordered topper classifications');
    } else {
      console.log('✗ Needs reordered topper classifications');
    }
    console.log('');
  });
}

checkPrompts();
