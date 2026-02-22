import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL as string, SUPABASE_SERVICE_KEY as string);

function truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;

    const sliced = text.slice(0, maxLength);
    const lastSpace = sliced.lastIndexOf(' ');

    if (lastSpace > 0) {
        return sliced.slice(0, lastSpace).trim() + "...";
    }
    return sliced.trim() + "...";
}

function truncateDescription(desc: string): string {
    if (!desc) return '';
    let result = desc;

    result = result.replace(/Order your custom .*? cake today from Genie\.ph for delivery in Cebu City(.*?)\./gi, '').trim();
    result = result.replace(/Get the price of any cake instantly at genie\.ph\./gi, '').trim();
    result = result.replace(/Get instant pricing for this/gi, 'This').trim();

    if (result.length <= 160) return result;

    const sentences = result.match(/[^.!?]+[.!?]+/g) || [result];
    let candidate = '';

    for (const sentence of sentences) {
        if ((candidate + sentence).length <= 155) {
            candidate += sentence;
        } else {
            break;
        }
    }

    candidate = candidate.trim();
    if (candidate.length > 0 && candidate.length <= 160) return candidate;

    return truncateText(result, 157); // 157 + '...' = 160
}

function truncateTitle(title: string): string {
    if (!title) return '';
    let result = title;

    result = result.replace(/\s*\|\s*Genie\.ph\s*$/i, '').trim();

    if (result.length <= 60) return result;

    return truncateText(result, 57);
}

async function main() {
    console.log('Fetching ALL rows with pagination...');

    let allRows: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('p_hash, seo_title, seo_description')
            .range(from, from + limit - 1);

        if (error) {
            console.error('Fetch error:', error);
            return;
        }

        if (data && data.length > 0) {
            allRows = allRows.concat(data);
            from += limit;
            hasMore = data.length === limit;
        } else {
            hasMore = false;
        }
    }

    console.log(`Fetched ${allRows.length} rows total.`);

    let updatedCount = 0;
    let titleFixed = 0;
    let descFixed = 0;

    const updates = [];

    for (const row of allRows) {
        const originalTitle = row.seo_title || '';
        const originalDesc = row.seo_description || '';

        let newTitle = truncateTitle(originalTitle);
        if (newTitle !== originalTitle) titleFixed++;

        let newDesc = truncateDescription(originalDesc);
        if (newDesc !== originalDesc) descFixed++;

        if (newTitle !== originalTitle || newDesc !== originalDesc) {
            updates.push({
                p_hash: row.p_hash,
                seo_title: newTitle,
                seo_description: newDesc
            });
        }
    }

    console.log(`Need to update ${updates.length} rows...`);

    // Process in batches of 50 concurrently
    const chunkSize = 50;
    for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);

        await Promise.all(chunk.map(updateData =>
            supabase
                .from('cakegenie_analysis_cache')
                .update({ seo_title: updateData.seo_title, seo_description: updateData.seo_description })
                .eq('p_hash', updateData.p_hash)
        ));

        updatedCount += chunk.length;
        console.log(`Updated ${updatedCount} / ${updates.length} rows`);
    }

    console.log(`\n🎉 Finished fixing meta tags!`);
    console.log(`Titles truncated/fixed: ${titleFixed}`);
    console.log(`Descriptions truncated/fixed: ${descFixed}`);
}

main().catch(console.error);
