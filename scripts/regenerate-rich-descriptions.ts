import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAI } from '../src/lib/ai/client';

// Let environment variables determine the Vertex AI location (defaults to 'global' in .env.local)

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const googleApiKey = process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const WRITE = process.argv.includes('--write');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : undefined;
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
const CONCURRENCY = Math.max(1, Number(concurrencyArg?.split('=')[1] || 5));
const progressPath = resolve(process.cwd(), 'regenerate-descriptions-progress.json');

type CacheRow = {
  id: string;
  p_hash: string;
  slug: string | null;
  keywords: string | null;
  seo_title: string | null;
  seo_description: string | null;
  analysis_json: Record<string, any> | null;
  tags: string[] | null;
};

type GeneratedResponse = {
  description: string;
};

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Use API Key if available, otherwise fall back to Vertex AI client
const ai = googleApiKey ? new GoogleGenAI({ apiKey: googleApiKey }) : getAI();

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.STRING,
      description: 'Enticing, descriptive, and GMC-compliant product description. Length: 6 to 8 sentences. No pricing, no URLs, no transactional calls-to-action.',
    },
  },
  required: ['description'],
};

function loadProgress(): Set<string> {
  if (!existsSync(progressPath)) return new Set<string>();
  try {
    const parsed = JSON.parse(readFileSync(progressPath, 'utf8')) as string[];
    return new Set(parsed);
  } catch (error) {
    console.error('⚠️ Failed to parse progress file, starting fresh:', error);
    return new Set<string>();
  }
}

function saveProgress(done: Set<string>) {
  if (WRITE) {
    try {
      writeFileSync(progressPath, JSON.stringify([...done].sort(), null, 2));
    } catch (error) {
      console.error('⚠️ Failed to save progress:', error);
    }
  }
}

function isCompliant(text: string): boolean {
  const lower = text.toLowerCase();
  const forbidden = [
    'genie.ph',
    'genie',
    'starts at',
    '₱',
    'php',
    'order now',
    'get instant',
    'free delivery',
    'discount',
    'sale',
    'cheap',
    'yummy',
    'delicious',
    'tasty',
    'moist',
    'buy today',
    'order today',
    'buy yours',
    'get yours',
  ];
  return !forbidden.some((word) => lower.includes(word));
}

const DELAY_BETWEEN_BATCHES_MS = 300;
const RETRY_ATTEMPTS = 3;

const SYSTEM_PROMPT = `You are a professional copywriter and e-commerce specialist for a cake bakery.
Your task is to write a highly detailed, descriptive, and human-oriented description of a custom cake design.

Input:
A JSON object containing the cake's visual analysis (theme, cake type, colors, toppers, messages, icing style, support elements, etc.).

Target Structure & Guidelines:
1. Write 6 to 8 engaging and descriptive sentences (~150 to 250 words) describing the design clearly.
2. Cover the cake type/size, base colors, main toppers (specifically naming them and details/materials), support decorations, messages, and who the design fits.
3. Write for a human reader browsing cake designs for inspiration, not a search engine snippet. Keep it narrative, professional, and celebratory.
4. If a message text exists in the analysis, describe it generically as a piped inscription rather than quoting it exactly.
5. If the slug or keywords suggest a specific theme (e.g. Stray Kids, Minecraft, Floral), highlight that theme and its aesthetic.

CRITICAL COMPLIANCE RULES:
- Absolutely NO pricing references. Never mention "starts at", "price", "₱", "PHP", or cost of any kind.
- Absolutely NO URLs or website names. Never mention "genie.ph", "Genie.ph", "Genie", or any other site.
- Absolutely NO transaction-oriented calls-to-action (e.g. "order yours now", "get instant pricing", "visit our site", "buy today").
- Absolutely NO promotional words like "free delivery", "discount", "sale", "cheap", or taste/texture descriptors like "yummy", "delicious", "tasty", "moist".
`;

async function callAiWithRetry(promptInput: string, attempt = 1): Promise<GeneratedResponse> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [{ role: 'user', parts: [{ text: promptInput }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.7,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    const text = (response.text || '').trim();
    const parsed = JSON.parse(text) as GeneratedResponse;

    if (!parsed.description || parsed.description.trim().length === 0) {
      throw new Error('AI returned an empty description.');
    }

    return parsed;
  } catch (error: any) {
    if (attempt <= RETRY_ATTEMPTS) {
      const backoffTime = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 1000);
      console.warn(`⚠️ AI generation failed (Attempt ${attempt}/${RETRY_ATTEMPTS}). Retrying in ${backoffTime}ms... (Error: ${error.message})`);
      await new Promise((resolve) => setTimeout(resolve, backoffTime));
      return callAiWithRetry(promptInput, attempt + 1);
    }
    throw error;
  }
}

async function fetchRecords(doneIds: Set<string>): Promise<CacheRow[]> {
  const records: CacheRow[] = [];
  let offset = 0;
  const PAGE_SIZE = 1000;

  console.log('🔍 Fetching cake records from cakegenie_analysis_cache in pages...');

  while (true) {
    const { data: pageData, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('id, p_hash, slug, keywords, seo_title, seo_description, analysis_json, tags')
      .not('analysis_json', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('❌ Error fetching records:', error.message);
      process.exit(1);
    }

    if (!pageData || pageData.length === 0) break;

    // Filter pageData to include only those not in doneIds
    for (const record of pageData) {
      if (!doneIds.has(record.id)) {
        records.push(record as CacheRow);
      }
    }

    process.stdout.write(`Fetched page starting at ${offset} (Total eligible records: ${records.length})\r`);

    if (LIMIT !== undefined && records.length >= LIMIT) {
      console.log(`\nReached limit of ${LIMIT} records during fetch.`);
      return records.slice(0, LIMIT);
    }

    if (pageData.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`\n✅ Loaded ${records.length} unprocessed records successfully.`);
  return LIMIT !== undefined ? records.slice(0, LIMIT) : records;
}

async function main() {
  console.log('🚀 Starting Rich SEO Description Generation...');
  console.log(`Mode: ${WRITE ? '💾 WRITE (Updates will be committed)' : '🔍 DRY RUN (Previews only)'}`);
  if (LIMIT !== undefined) console.log(`Limit: ${LIMIT} records`);
  console.log(`Concurrency: ${CONCURRENCY} parallel workers`);

  const doneIds = loadProgress();
  if (doneIds.size > 0) {
    console.log(`Loaded progress: ${doneIds.size} already processed.`);
  }

  const records = await fetchRecords(doneIds);
  if (records.length === 0) {
    console.log('✅ No new records to process.');
    return;
  }

  let processedCount = 0;
  let successCount = 0;
  let failedCount = 0;
  let cursor = 0;

  async function processRecord(record: CacheRow, index: number) {
    const logPrefix = `[${index + 1}/${records.length}] [Slug: ${record.slug || 'no-slug'}]`;

    try {
      const promptInput = JSON.stringify({
        keywords: record.keywords || record.seo_title || 'custom themed',
        cakeType: record.analysis_json?.cakeType || 'custom cake',
        tags: record.tags || [],
        analysis: record.analysis_json,
      });

      const result = await callAiWithRetry(promptInput);
      let desc = result.description.trim();

      // Enforce post-generation safeguards if compliance is breached
      if (!isCompliant(desc)) {
        console.warn(`   ⚠️ Description violated compliance rules, cleaning up...`);
        desc = desc
          .replace(/genie\.ph|genie/gi, '')
          .replace(/starts at \b\d+/gi, '')
          .replace(/order now|buy yours|get yours|order today|buy today|get instant/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      if (WRITE) {
        const { error } = await supabase
          .from('cakegenie_analysis_cache')
          .update({ seo_description: desc })
          .eq('id', record.id);

        if (error) {
          throw new Error(`Supabase update failed: ${error.message}`);
        }

        doneIds.add(record.id);
        saveProgress(doneIds);
        console.log(`✅ ${logPrefix} Updated successfully.`);
      } else {
        console.log(`\n------------------------------------------------`);
        console.log(`${logPrefix}`);
        console.log(`OLD Description: "${record.seo_description || 'None'}"`);
        console.log(`NEW Description: "${desc}"`);
        console.log(`------------------------------------------------\n`);
      }

      successCount++;
    } catch (error: any) {
      console.error(`❌ ${logPrefix} Failed to process: ${error.message}`);
      failedCount++;
    }

    processedCount++;
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
  }

  async function worker(workerId: number) {
    while (cursor < records.length) {
      const index = cursor;
      cursor += 1;
      if (index < records.length) {
        await processRecord(records[index], index);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i));
  await Promise.all(workers);

  console.log(`\n🎉 Execution Finished!`);
  console.log(`Total Eligible    : ${records.length}`);
  console.log(`Successfully Processed: ${successCount}`);
  console.log(`Failed / Skipped      : ${failedCount}`);
  if (!WRITE) {
    console.log(`\nℹ️ This was a DRY RUN. Run with --write to persist changes in Supabase.`);
  }
}

main().catch((error) => {
  console.error('Fatal error in main:', error);
  process.exit(1);
});
