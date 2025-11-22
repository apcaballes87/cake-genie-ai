// This script clears the prompt and enum cache in geminiService
// Run this after making changes to prompts or enum ordering

import { clearPromptCache } from '../src/services/geminiService';

console.log('Clearing geminiService prompt and enum cache...');
clearPromptCache();
console.log('✅ Cache cleared successfully!');
console.log('\nNext AI analysis will use:');
console.log('  - Fresh enum ordering from database (printout before cardstock)');
console.log('  - Latest FALLBACK_PROMPT with v3.2 improvements');
console.log('  - Latest ai_prompt from Supabase (if you updated it manually)');
