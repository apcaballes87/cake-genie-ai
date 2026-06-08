import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployPrompt() {
    // Read prompt from fallback-prompt.txt
    const promptPath = path.join(process.cwd(), 'src/services/prompts/fallback-prompt.txt');
    console.log(`Reading prompt from: ${promptPath}`);

    if (!fs.existsSync(promptPath)) {
        console.error('Error: Prompt file not found!');
        process.exit(1);
    }

    const promptText = fs.readFileSync(promptPath, 'utf-8');
    const version = '3.15';
    const description = 'v3.15 - Side color mandatory with fallback chain (side -> top -> alt_text lead)';

    console.log(`\nPreparing to deploy Prompt v${version}...`);
    console.log(`Prompt Length: ${promptText.length} characters`);

    // 1. Get current active prompt
    console.log('\nFetching current active prompt...');
    const { data: currentPrompt, error: fetchError } = await supabase
        .from('ai_prompts')
        .select('prompt_id, version')
        .eq('is_active', true)
        .single();

    if (fetchError) {
        console.warn('Warning: No current active prompt found or error fetching:', fetchError.message);
    } else {
        console.log(`Found active prompt ID: ${currentPrompt.prompt_id}, version: ${currentPrompt.version}`);
    }

    // 2. Deactivate current active prompt(s)
    console.log('Deactivating existing active prompts...');
    const { error: deactivateError } = await supabase
        .from('ai_prompts')
        .update({ is_active: false })
        .eq('is_active', true);

    if (deactivateError) {
        console.error('Error deactivating prompts:', deactivateError);
        process.exit(1);
    }

    // 3. Insert new prompt
    console.log('Inserting new active prompt...');
    const { data, error: insertError } = await supabase
        .from('ai_prompts')
        .insert({
            version: version,
            prompt_text: promptText,
            is_active: true,
            description: description,
            updated_at: new Date().toISOString()
        })
        .select();

    if (insertError) {
        console.error('Error inserting prompt:', insertError);
        process.exit(1);
    }

    const newPrompt = data?.[0];
    if (newPrompt) {
        console.log('\n✅ SUCCESS! New active prompt inserted.');
        console.log(`- ID: ${newPrompt.prompt_id}`);
        console.log(`- Version: ${newPrompt.version}`);
        console.log(`- Description: ${newPrompt.description}`);
    } else {
        console.log('\n✅ Insertion command executed successfully.');
    }
}

deployPrompt();