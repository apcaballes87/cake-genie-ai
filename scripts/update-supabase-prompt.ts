import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updatePrompt() {
  // Read the improved prompt
  const improvedPrompt = fs.readFileSync('/tmp/improved_ai_prompt.txt', 'utf-8');

  console.log(`Updating ai_prompts with new version...`);
  console.log(`New prompt length: ${improvedPrompt.length} characters\n`);

  // Get the current active prompt ID
  const { data: currentPrompt, error: fetchError } = await supabase
    .from('ai_prompts')
    .select('prompt_id')
    .eq('is_active', true)
    .single();

  if (fetchError) {
    console.error('Error fetching current prompt:', fetchError);
    return;
  }

  console.log(`Updating prompt_id: ${currentPrompt.prompt_id}`);

  // Update using prompt_id
  const { data, error } = await supabase
    .from('ai_prompts')
    .update({
      version: 'v3.2',
      prompt_text: improvedPrompt,
      description: 'Enhanced printout detection - My Melody, Disney, Sanrio character fix',
      updated_at: new Date().toISOString()
    })
    .eq('prompt_id', currentPrompt.prompt_id)
    .select();

  if (error) {
    console.error('Error updating prompt:', error);
    return;
  }

  console.log('✓ Updated prompt successfully');
  console.log('\nUpdated prompt details:');
  console.log(`- Prompt ID: ${currentPrompt.prompt_id}`);
  console.log(`- Version: v3.2`);
  console.log(`- Length: ${improvedPrompt.length} chars`);
  console.log(`- Description: Enhanced printout detection - My Melody, Disney, Sanrio character fix`);
  console.log('\n✅ Database updated successfully!');
  console.log('\nKey improvements applied:');
  console.log('  ✅ Printout rules appear BEFORE cardstock in classification table');
  console.log('  ✅ My Melody, Disney, Sanrio explicitly mentioned 4+ times');
  console.log('  ✅ Cardstock labeled as "VERY RARE" throughout');
  console.log('  ✅ Clear exclusions: NO graphics, NO characters, NO multi-color');
  console.log('  ✅ Decision tree added with default to PRINTOUT');
}

updatePrompt();
