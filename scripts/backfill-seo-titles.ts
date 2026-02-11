import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) are set in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function toTitleCase(str: string): string {
    if (!str) return '';
    return str.replace(
        /\w\S*/g,
        (txt) => {
            // Check for brand name "Genie.ph" case-insensitively
            if (txt.toLowerCase() === 'genie.ph') {
                return 'Genie.ph';
            }
            // Standard title case: First letter upper, rest lower
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
}

async function backfillSeoTitles() {
    console.log('Starting SEO Title backfill...');

    // Fetch all rows with analysis_json
    const { data: rows, error } = await supabase
        .from('cakegenie_analysis_cache')
        .select('p_hash, seo_title');

    if (error) {
        console.error('Error fetching rows:', error);
        return;
    }

    if (!rows || rows.length === 0) {
        console.log('No rows found.');
        return;
    }

    console.log(`Found ${rows.length} rows to process.`);

    let updatedCount = 0;

    for (const row of rows) {
        const originalTitle = row.seo_title || '';
        if (!originalTitle) continue;

        const newTitle = toTitleCase(originalTitle);

        if (newTitle !== originalTitle) {
            console.log(`Updating "${originalTitle}" -> "${newTitle}"`);

            const { error: updateError } = await supabase
                .from('cakegenie_analysis_cache')
                .update({ seo_title: newTitle })
                .eq('p_hash', row.p_hash);

            if (updateError) {
                console.error(`  Failed to update row ${row.p_hash}:`, updateError);
            } else {
                updatedCount++;
            }

            // Small delay to be gentle on DB
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    console.log(`Backfill complete. Updated ${updatedCount} rows.`);
}

backfillSeoTitles();
