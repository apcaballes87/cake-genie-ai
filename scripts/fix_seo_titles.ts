
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Constants
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => {
        // Special handling for specific words or patterns if needed
        if (txt.toLowerCase() === 'genie.ph') return 'Genie.ph';
        if (txt.toLowerCase() === 'ph') return 'pH'; // Example, but unlikely for this dataset
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

// More robust title casing that handles delimiters like |
function formatSeoTitle(title: string): string {
    // Split by pipe to preserve " | Genie.ph" structure if we want to be safe, 
    // or just run title case on the whole thing but ensure Genie.ph is fixed.

    // Strategy: Title Case everything, then fix specific brand terms.
    let formatted = title.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });

    // Fix "Genie.ph" which might have become "Genie.ph" (already correct with logic above? No, P is lowercase)
    // "Genie.ph" -> Txt is "Genie.ph". charAt(0).toUpper is G. rest is enie.ph. -> Genie.ph. 
    // Wait, regex \w matches alphanumeric. "." is non-word char?
    // If regex is \w\S*, then "Genie.ph" matches "Genie" (word) then "." is non-word?
    // \S matches any non-whitespace. So "Genie.ph" is one token.
    // "Genie.ph" -> "Genie.ph" => G + enie.ph. Correct.

    // Fix common prepositions if we wanted "True Title Case" (of, the, and), 
    // but user asked for "all of the words capitalized". 
    // So "Black AND Gold" -> "Black And Gold".

    // Ensure "Genie.ph" is exactly "Genie.ph"
    formatted = formatted.replace(/Genie\.Ph/gi, 'Genie.ph'); // Just in case

    return formatted;
}

async function main() {
    console.log('🚀 Starting SEO Title Capitalization Fix...');

    // Fetch all rows where standard title casing might be off
    // We can just fetch all and process in memory since there are likely < 1000 rows, or use pagination.
    // Let's page it to be safe.

    const PAGE_SIZE = 100;
    let page = 0;
    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    while (true) {
        const { data: rows, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('p_hash, seo_title, slug')
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
            console.error('Error fetching rows:', error);
            break;
        }

        if (!rows || rows.length === 0) {
            break;
        }

        for (const row of rows) {
            const originalTitle = row.seo_title || '';
            if (!originalTitle) continue;

            const newTitle = formatSeoTitle(originalTitle);

            if (newTitle !== originalTitle) {
                console.log(`Updating: "${originalTitle}" -> "${newTitle}"`);

                const { error: updateError } = await supabase
                    .from('cakegenie_analysis_cache')
                    .update({ seo_title: newTitle })
                    .eq('p_hash', row.p_hash);

                if (updateError) {
                    console.error(`❌ Failed to update ${row.slug}:`, updateError.message);
                    errorCount++;
                } else {
                    updatedCount++;
                }
            }
            processedCount++;
        }

        page++;
    }

    console.log(`\n🎉 Finished!`);
    console.log(`Processed: ${processedCount}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);
}

main().catch(console.error);
