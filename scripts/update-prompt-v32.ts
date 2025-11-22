import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateToV32() {
  // Read the improved v3.2 prompt
  const improvedPrompt = fs.readFileSync('/tmp/improved_ai_prompt.txt', 'utf-8');

  console.log('Updating ai_prompts to v3.2...');
  console.log(`New prompt length: ${improvedPrompt.length} characters\n`);

  // Update the active prompt directly using prompt_id = 4
  const { data, error } = await supabase
    .from('ai_prompts')
    .update({
      version: 'v3.2',
      prompt_text: improvedPrompt,
      description: 'Enhanced printout detection - My Melody, Disney, Sanrio character fix',
      updated_at: new Date().toISOString()
    })
    .eq('prompt_id', 4)
    .select();

  if (error) {
    console.error('❌ Error updating prompt:', error);
    console.log('\nThis might be due to RLS policies.');
    console.log('You may need to update it manually in Supabase dashboard.');
    return false;
  }

  if (!data || data.length === 0) {
    console.error('❌ Update returned no data - may have been blocked by RLS');
    return false;
  }

  console.log('✅ Updated prompt successfully!');
  console.log('\nUpdated prompt details:');
  console.log(`- Prompt ID: 4`);
  console.log(`- Version: v3.2`);
  console.log(`- Length: ${improvedPrompt.length} chars`);
  console.log(`- Description: Enhanced printout detection`);

  console.log('\n🎯 Key improvements applied:');
  console.log('  ✅ Printout (T3) appears BEFORE cardstock (T4) in tier table');
  console.log('  ✅ "My Melody" mentioned 4+ times as printout example');
  console.log('  ✅ Cardstock labeled as "VERY RARE" throughout');
  console.log('  ✅ Printout labeled as "MOST COMMON"');
  console.log('  ✅ Decision tree added with default to PRINTOUT');
  console.log('  ✅ Gumpaste board detection with white/gold/silver exclusions');

  console.log('\n⚠️  IMPORTANT: Restart your dev server to clear the cache!');
  console.log('The prompt cache is 10 minutes, enum cache is 30 minutes.');

  return true;
}

updateToV32();
