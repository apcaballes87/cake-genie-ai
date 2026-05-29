import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Pulls the currently ACTIVE prompt from ai_prompts and writes it to a repo file
// so the version-controlled prompt text stays in sync with what is live.
//
// Usage: npx tsx scripts/sync-active-prompt.ts [outputFile]
//   outputFile defaults to prompt_v<version>.txt in the project root.

const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncActivePrompt() {
    console.log('Fetching active prompt from ai_prompts...');

    const { data, error } = await supabase
        .from('ai_prompts')
        .select('prompt_id, version, prompt_text, description')
        .eq('is_active', true)
        .single();

    if (error || !data) {
        console.error('Error fetching active prompt:', error);
        process.exit(1);
    }

    const outputArg = process.argv[2];
    const outputFile = outputArg ?? `prompt_v${data.version}.txt`;
    const outputPath = path.join(process.cwd(), outputFile);

    fs.writeFileSync(outputPath, data.prompt_text, 'utf-8');

    console.log('\n✅ Synced active prompt to repo file.');
    console.log(`- Prompt ID: ${data.prompt_id}`);
    console.log(`- Version: ${data.version}`);
    console.log(`- Description: ${data.description ?? '(none)'}`);
    console.log(`- Wrote ${data.prompt_text.length} characters to: ${outputFile}`);
}

syncActivePrompt();
