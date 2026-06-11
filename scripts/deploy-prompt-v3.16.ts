import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployPrompt() {
  const promptPath = path.join(process.cwd(), 'src/services/prompts/fallback-prompt.txt');
  const promptText = fs.readFileSync(promptPath, 'utf8');

  const { data: currentPrompt, error: fetchError } = await supabase
    .from('ai_prompts')
    .select('prompt_id, version')
    .eq('is_active', true)
    .single();

  if (fetchError) throw fetchError;
  console.log(`Replacing active prompt ${currentPrompt.version} (${currentPrompt.prompt_id}) with v3.16.`);

  const { data: insertedPrompt, error: insertError } = await supabase
    .from('ai_prompts')
    .insert({
      version: '3.16',
      prompt_text: promptText,
      is_active: false,
      description: 'v3.16 - Improved customer-facing cake descriptions and alt text',
      updated_at: new Date().toISOString(),
    })
    .select('prompt_id, version')
    .single();

  if (insertError) throw insertError;

  const { error: deactivateError } = await supabase
    .from('ai_prompts')
    .update({ is_active: false })
    .eq('is_active', true);
  if (deactivateError) throw deactivateError;

  const { data: activatedPrompt, error: activateError } = await supabase
    .from('ai_prompts')
    .update({ is_active: true })
    .eq('prompt_id', insertedPrompt.prompt_id)
    .select('prompt_id, version')
    .single();

  if (activateError) {
    await supabase
      .from('ai_prompts')
      .update({ is_active: true })
      .eq('prompt_id', currentPrompt.prompt_id);
    throw activateError;
  }

  console.log(`Activated prompt ${activatedPrompt.version} (${activatedPrompt.prompt_id}).`);
}

deployPrompt().catch((error) => {
  console.error(error);
  process.exit(1);
});
