
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY!;

if (!supabaseUrl || !supabaseKey || !googleApiKey) {
  console.error('Missing environment variables');
  console.log('supabaseUrl:', supabaseUrl);
  console.log('supabaseKey:', supabaseKey ? 'PRESENT' : 'MISSING');
  console.log('googleApiKey:', googleApiKey ? 'PRESENT' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const aiClient = new GoogleGenAI({ apiKey: googleApiKey });

const REPORT_PATH = path.join(process.cwd(), 'bento-verification-report.json');
const PROGRESS_FILE = path.join(process.cwd(), 'metadata-correction-progress.json');
const DRY_RUN = process.argv.includes('--dry-run');
const REWRITE_LIMIT = DRY_RUN ? 5 : 1000;

const metadataSchema = {
  type: Type.OBJECT,
  properties: {
    keyword: { type: Type.STRING, description: "New keyword/title for the cake product, removing 'Bento' references." },
    alt_text: { type: Type.STRING, description: "Updated alt text for accessibility, accurately describing it as a 1 tier cake." },
    seo_title: { type: Type.STRING, description: "SEO optimized title, removing 'Bento Cake' references." },
    seo_description: { type: Type.STRING, description: "Updated meta description, removing 'Bento' references and reflecting it is a 1 tier cake." },
  },
  required: ['keyword', 'alt_text', 'seo_title', 'seo_description'],
};

async function rewriteMetadata(currentMetadata: any): Promise<any | null> {
  const prompt = `
    You are an expert cake SEO and copywriter. I will give you the current metadata for a cake that was incorrectly identified as a 'Bento' cake. 
    It is actually a '1 Tier' cake (standard single tier cake). 
    Rewrite the fields to be accurate, removing any mentions of 'Bento'.
    
    Current Metadata:
    - Keyword/Title: ${currentMetadata.keyword}
    - Alt Text: ${currentMetadata.alt_text}
    - SEO Title: ${currentMetadata.seo_title}
    - SEO Description: ${currentMetadata.seo_description}
    
    Instructions:
    1. Maintain the descriptive details about the design (e.g., characters, colors, toppers).
    2. Replace "Bento", "Bento Cake", "Minimalist Bento" with appropriate terms like "1 Tier Cake", "Single Tier Cake", "Round Cake", or just remove the bento reference.
    3. Ensure the SEO description remains around 5-6 sentences as per standard requirements.
    4. Keep the tone professional, appetizing, and premium.
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: metadataSchema,
        temperature: 0,
      },
    });

    const jsonText = (response.text || '').trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Error calling Gemini:', error);
    return null;
  }
}

async function run() {
  console.log(`Starting metadata correction... ${DRY_RUN ? '(DRY RUN MODE)' : ''}`);

  if (!fs.existsSync(REPORT_PATH)) {
    console.error('Verification report not found.');
    return;
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
  const flaggedItems = report.filter((item: any) => item.isBento === false);
  
  console.log(`Found ${flaggedItems.length} items flagged for correction.`);

  let progress: Record<string, boolean> = {};
  if (fs.existsSync(PROGRESS_FILE) && !DRY_RUN) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  }

  let count = 0;
  for (const item of flaggedItems) {
    if (progress[item.p_hash]) continue;
    if (count >= REWRITE_LIMIT) break;

    console.log(`\n[${count + 1}/${flaggedItems.length}] Processing p_hash: ${item.p_hash}`);
    
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('analysis_json')
      .eq('p_hash', item.p_hash)
      .single();

    if (error || !data) {
      console.error(`Error fetching record ${item.p_hash}:`, error?.message);
      continue;
    }

    const currentAnalysis = data.analysis_json;
    
    const containsBento = JSON.stringify(currentAnalysis).toLowerCase().includes('bento');
    if (!containsBento) {
      console.log('Skipping - no bento term found in metadata.');
      if (!DRY_RUN) {
        progress[item.p_hash] = true;
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
      }
      continue;
    }

    const newMetadata = await rewriteMetadata(currentAnalysis);
    if (!newMetadata) {
      console.error('Failed to generate new metadata.');
      continue;
    }

    if (DRY_RUN) {
      console.log('--- Proposed Changes ---');
      console.log('KEYWORD:', currentAnalysis.keyword, '->', newMetadata.keyword);
      console.log('SEO TITLE:', currentAnalysis.seo_title, '->', newMetadata.seo_title);
      console.log('ALT TEXT:', currentAnalysis.alt_text, '->', newMetadata.alt_text);
      console.log('SEO DESC BEGIN:', currentAnalysis.seo_description.substring(0, 50), '...');
      console.log('NEW SEO DESC BEGIN:', newMetadata.seo_description.substring(0, 50), '...');
    } else {
      const updatedAnalysis = {
        ...currentAnalysis,
        ...newMetadata,
        cakeType: '1 Tier'
      };

      const { error: updateError } = await supabase
        .from('cakegenie_analysis_cache')
        .update({ analysis_json: updatedAnalysis })
        .eq('p_hash', item.p_hash);

      if (updateError) {
        console.error(`Error updating record ${item.p_hash}:`, updateError.message);
      } else {
        console.log('Successfully updated.');
        progress[item.p_hash] = true;
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
      }
    }

    count++;
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\nProcess finished.');
}

run().catch(console.error);
