import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const geminiApiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
    console.error('Missing environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and NEXT_PUBLIC_GOOGLE_AI_API_KEY are set in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

async function generateKeywords(analysisJson: any): Promise<string> {
    const prompt = `
    You are a keyword extraction expert for a cake design app.
    Analyze the following cake design JSON and extract 1-2 concise keywords that describe the theme, recipient, or color.
    Examples: "unicorn", "senior", "red minimalist", "wedding floral", "superhero".
    
    Input JSON:
    ${JSON.stringify(analysisJson, null, 2)}
    
    Output ONLY the keywords as a plain string. Do not include quotes or JSON formatting.
  `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts: [{ text: prompt }] }],
        });

        const text = (response.text || '').trim();
        return text;
    } catch (error) {
        console.error('Error generating keywords:', error);
        return "";
    }
}

async function backfillKeywords() {
    console.log('Starting keyword backfill...');

    // Fetch rows with missing keywords but having analysis_json
    // We check for null first.
    const { data: rows, error } = await supabase
        .from('cakegenie_analysis_cache')
        .select('p_hash, analysis_json, keywords')
        .not('analysis_json', 'is', null)
        .is('keywords', null);

    if (error) {
        console.error('Error fetching rows:', error);
        return;
    }

    // Also fetch empty strings
    const { data: emptyRows, error: emptyError } = await supabase
        .from('cakegenie_analysis_cache')
        .select('p_hash, analysis_json, keywords')
        .not('analysis_json', 'is', null)
        .eq('keywords', '');

    const allRows = [...(rows || []), ...(emptyRows || [])];

    // Deduplicate just in case
    const uniqueRows = Array.from(new Map(allRows.map(item => [item.p_hash, item])).values());

    console.log(`Found ${uniqueRows.length} rows to backfill.`);

    for (const row of uniqueRows) {
        console.log(`Processing row ${row.p_hash}...`);

        if (!row.analysis_json) continue;

        // Check if analysis_json already has a keyword field we can use
        let keywords = "";
        // Cast to any to safely check properties
        const json = row.analysis_json as any;

        if (typeof json === 'object' && json !== null && 'keyword' in json && json.keyword) {
            keywords = json.keyword;
            console.log(`  Found existing keyword in JSON: "${keywords}"`);
        } else {
            keywords = await generateKeywords(json);
            console.log(`  Generated keywords from AI: "${keywords}"`);
        }

        if (keywords) {
            const { error: updateError } = await supabase
                .from('cakegenie_analysis_cache')
                .update({ keywords: keywords })
                .eq('p_hash', row.p_hash);

            if (updateError) {
                console.error(`  Failed to update row ${row.p_hash}:`, updateError);
            } else {
                console.log(`  Updated row ${row.p_hash} successfully.`);
            }
        } else {
            console.log(`  Failed to generate keywords for row ${row.p_hash}.`);
        }

        // Add a small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Backfill complete.');
}

backfillKeywords();
