import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function correctBentoClassifications() {
    console.log("🛠️ Starting Bento Cake Correction...");

    const reportPath = path.join(process.cwd(), 'bento-verification-report.json');
    if (!fs.existsSync(reportPath)) {
        console.error("❌ Report file not found. Run verification script first.");
        return;
    }

    const results = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const toCorrect = results.filter((r: any) => r.isBento === false);

    if (toCorrect.length === 0) {
        console.log("✅ No items need correction.");
        return;
    }

    console.log(`📡 Found ${toCorrect.length} items to correct to '1 Tier'.`);

    // Perform updates in batches to avoid Supabase/Rate limit issues
    const batchSize = 50;
    for (let i = 0; i < toCorrect.length; i += batchSize) {
        const batch = toCorrect.slice(i, i + batchSize);
        console.log(`\n📦 Correcting batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)...`);

        const promises = batch.map(async (item: any) => {
            try {
                // First, fetch the current analysis_json to merge the change
                const { data: current, error: fetchError } = await supabase
                    .from('cakegenie_analysis_cache')
                    .select('analysis_json')
                    .eq('p_hash', item.p_hash)
                    .single();

                if (fetchError || !current) {
                    console.error(`   ❌ Failed to fetch [${item.p_hash}]:`, fetchError?.message);
                    return null;
                }

                const updatedJson = {
                    ...(current.analysis_json as object),
                    cakeType: '1 Tier'
                };

                const { error: updateError } = await supabase
                    .from('cakegenie_analysis_cache')
                    .update({ analysis_json: updatedJson })
                    .eq('p_hash', item.p_hash);

                if (updateError) {
                    console.error(`   ❌ Failed to update [${item.p_hash}]:`, updateError.message);
                    return null;
                }

                console.log(`   ✅ Adjusted [${item.p_hash}] to '1 Tier'`);
                return item.p_hash;
            } catch (err: any) {
                console.error(`   ❌ Unexpected error for [${item.p_hash}]:`, err.message);
                return null;
            }
        });

        await Promise.all(promises);
    }

    console.log("\n✨ Correction Complete!");
}

correctBentoClassifications();
