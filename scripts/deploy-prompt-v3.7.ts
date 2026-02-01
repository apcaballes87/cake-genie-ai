import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Supabase configuration
const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployPrompt() {
    // Read prompt from root directory (prompt_v3.7.txt)
    const promptPath = path.join(process.cwd(), 'prompt_v3.7.txt');
    console.log(`Reading prompt from: ${promptPath}`);

    if (!fs.existsSync(promptPath)) {
        console.error('Error: Prompt file not found!');
        process.exit(1);
    }

    const promptText = fs.readFileSync(promptPath, 'utf-8');
    const version = '3.7';
    const description = 'v3.7 - Enhanced 3D Figure & Crown Classification (Crowns=Toy, Gold Spheres pricing)';

    console.log(`\nPreparing to deploy Prompt v${version}...`);
    console.log(`Prompt Length: ${promptText.length} characters`);

    // 1. Get current active prompt
    console.log('\nFetching current active prompt...');
    const { data: currentPrompt, error: fetchError } = await supabase
        .from('ai_prompts')
        .select('prompt_id')
        .eq('is_active', true)
        .single();

    if (fetchError) {
        console.error('Error fetching current prompt:', fetchError);
        process.exit(1);
    }

    console.log(`Found active prompt ID: ${currentPrompt.prompt_id}`);

    // 2. Update existing prompt
    console.log('Updating prompt...');
    const { data, error: updateError } = await supabase
        .from('ai_prompts')
        .update({
            version: version,
            prompt_text: promptText,
            description: description,
            updated_at: new Date().toISOString()
        })
        .eq('prompt_id', currentPrompt.prompt_id)
        .select();

    if (updateError) {
        console.error('Error updating prompt:', updateError);
        process.exit(1);
    }

    const newPrompt = data?.[0];
    if (newPrompt) {
        console.log('\n✅ SUCCESS! Prompt updated.');
        console.log(`- ID: ${newPrompt.prompt_id}`);
        console.log(`- Version: ${newPrompt.version}`);
        console.log(`- Description: ${newPrompt.description}`);
    } else {
        console.log('\n✅ Update command executed. (Return data hidden by RLS)');
    }
}

deployPrompt();
