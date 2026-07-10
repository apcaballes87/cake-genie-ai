/**
 * Re-run AI cake analysis for existing `cakegenie_analysis_cache` rows using
 * the current active prompt, then update only `analysis_json` and `price`.
 *
 * Usage:
 *   npx tsx scripts/rerun-analysis-cache.ts --dry-run --limit=3
 *   npx tsx scripts/rerun-analysis-cache.ts --limit=25 --concurrency=2
 *   npx tsx scripts/rerun-analysis-cache.ts --concurrency=2
 *   npx tsx scripts/rerun-analysis-cache.ts --p-hash=<hash>
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { parseArgs } from 'node:util';

import { normalizeCakeType } from '@/lib/utils/cakeType';

type JsonRecord = Record<string, unknown>;

type CacheRow = {
  id: string;
  p_hash: string;
  original_image_url: string | null;
  analysis_json: unknown;
  price: number | null;
};

type PricingState = {
  mainToppers: JsonRecord[];
  supportElements: JsonRecord[];
  cakeMessages: JsonRecord[];
  icingDesign: JsonRecord;
  cakeInfo: {
    type: string;
    thickness: string;
    size: string;
    flavors: string[];
  };
};

type RuntimeDeps = {
  SYSTEM_INSTRUCTION: string;
  buildSearchAnalysisGenerationConfig: (typeEnums: unknown) => Record<string, unknown>;
  calculatePriceFromDatabase: (
    uiState: PricingState,
    merchantId?: string,
  ) => Promise<{ addOnPricing: { addOnPrice: number } }>;
  convertToWebPBuffer: (imageBuffer: Buffer) => Promise<Buffer>;
  getAI: () => {
    models: {
      generateContent: (input: Record<string, unknown>) => Promise<{ text?: string | null }>;
    };
    caches: {
      list: () => AsyncIterable<Record<string, unknown>>;
      create: (input: Record<string, unknown>) => Promise<{ name?: string | null }>;
      delete: (input: Record<string, unknown>) => Promise<unknown>;
    };
  };
  getActivePromptDetails: (supabase: unknown) => Promise<{ promptText: string; version: string }>;
  getDynamicTypeEnums: (supabase: unknown) => Promise<unknown>;
  getOrCreatePromptCache: (
    aiClient: any,
    promptText: string,
    version: string,
    systemInstruction: string,
  ) => Promise<string | null>;
  postProcessSearchAnalysisResult: <T extends object>(result: T) => T;
  roundDownToNearest99: (price: number, minPrice?: number) => number;
};

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const { values } = parseArgs({
  options: {
    'batch-size': { type: 'string', default: '50' },
    concurrency: { type: 'string', default: '2' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
    limit: { type: 'string' },
    offset: { type: 'string', default: '0' },
    'p-hash': { type: 'string' },
  },
});

if (values.help) {
  console.log(`
Re-run AI cake analysis for cache rows and update only analysis_json + price.

Options:
  --dry-run           Analyze and price rows without writing database changes.
  --limit=<n>         Stop after processing n rows.
  --offset=<n>        Skip the first n ordered rows.
  --batch-size=<n>    Fetch this many rows per page. Default: 50.
  --concurrency=<n>   Parallel analyses to run at once. Default: 2.
  --p-hash=<hash>     Process one specific cache row by p_hash.
`);
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const dryRun = Boolean(values['dry-run']);
const limit = values.limit ? parseNonNegativeInt(values.limit, 'limit') : null;
const offset = parseNonNegativeInt(String(values.offset ?? '0'), 'offset');
const batchSize = parsePositiveInt(String(values['batch-size'] ?? '50'), 'batch-size');
const concurrency = parsePositiveInt(String(values.concurrency ?? '2'), 'concurrency');
const pHashFilter = typeof values['p-hash'] === 'string' ? values['p-hash'].trim() : null;
const aiTimeoutMs = 120_000;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function parsePositiveInt(rawValue: string, name: string) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.error(`--${name} must be a positive integer.`);
    process.exit(1);
  }
  return parsed;
}

function parseNonNegativeInt(rawValue: string, name: string) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.error(`--${name} must be a non-negative integer.`);
    process.exit(1);
  }
  return parsed;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function asRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function mapAnalysisToPricingState(rawAnalysis: unknown): PricingState {
  const analysis = asRecord(rawAnalysis);
  const icingDesign = asRecord(analysis.icing_design);

  const mainToppers = asRecordArray(analysis.main_toppers).map((topper, index) => ({
    ...topper,
    id: topper.id || `main-topper-${index}`,
    isEnabled: true,
    price: 0,
    original_type: topper.type,
  }));

  const supportElements = asRecordArray(analysis.support_elements).map((element, index) => ({
    ...element,
    id: element.id || `support-element-${index}`,
    isEnabled: true,
    price: 0,
    original_type: element.type,
  }));

  const cakeMessages = asRecordArray(analysis.cake_messages).map((message, index) => ({
    ...message,
    id: message.id || `cake-message-${index}`,
    isEnabled: true,
    price: 0,
  }));

  return {
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign: {
      ...icingDesign,
      drip: Boolean(icingDesign.drip),
      gumpasteBaseBoard: Boolean(icingDesign.gumpasteBaseBoard),
      dripPrice: 0,
      gumpasteBaseBoardPrice: 0,
    },
    cakeInfo: {
      type: normalizeCakeType(analysis.cakeType),
      thickness: asString(analysis.cakeThickness, '4"'),
      size: '6" Round',
      flavors: [],
    },
  };
}

async function getLowestBasePrice(type: string): Promise<number> {
  const normalizedType = normalizeCakeType(type);
  const { data, error } = await supabase
    .from('productsizes_cakegenie')
    .select('price')
    .eq('type', normalizedType)
    .order('price', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    const detail = error ? `: ${error.message}` : '';
    throw new Error(`Could not find base price for type "${normalizedType}"${detail}`);
  }

  return Number(data.price ?? 0);
}

async function calculateCachePrice(analysis: unknown) {
  const pricingState = mapAnalysisToPricingState(analysis);
  const { addOnPricing } = await runtimeDeps.calculatePriceFromDatabase(pricingState);
  const lowestBasePrice = await getLowestBasePrice(pricingState.cakeInfo.type);
  const total = runtimeDeps.roundDownToNearest99(lowestBasePrice + addOnPricing.addOnPrice, lowestBasePrice);
  return total;
}

function parseOutputText(text: string) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as JsonRecord;
  } catch {
    // Continue to recover the final JSON object if the model prepends prose.
  }

  const objectStarts = [...trimmed.matchAll(/{/g)]
    .map((match) => match.index)
    .filter((index): index is number => typeof index === 'number');

  for (const start of objectStarts) {
    const candidate = trimmed.slice(start).replace(/```(?:json)?\s*$/i, '').trim();
    try {
      return JSON.parse(candidate) as JsonRecord;
    } catch {
      // Try the next object start.
    }
  }

  throw new SyntaxError('AI response did not contain valid JSON.');
}

async function fetchBatch(startOffset: number) {
  let query = supabase
    .from('cakegenie_analysis_cache')
    .select('id, p_hash, original_image_url, analysis_json, price')
    .not('original_image_url', 'is', null)
    .order('id', { ascending: true })
    .range(startOffset, startOffset + batchSize - 1);

  if (pHashFilter) {
    query = query.eq('p_hash', pHashFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch cache rows: ${error.message}`);
  return (data || []) as CacheRow[];
}

async function analyzeImageUrl(
  imageUrl: string,
  promptText: string,
  cacheName: string | null,
  baseConfig: Record<string, unknown>,
  aiClient: any,
) {
  const imageResponse = await fetch(imageUrl, {
    headers: { Accept: 'image/*' },
  });

  if (!imageResponse.ok) {
    throw new Error(`Image fetch failed with status ${imageResponse.status}`);
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  if (imageBuffer.length > 10 * 1024 * 1024) {
    throw new Error('Image too large (max 10MB).');
  }

  const webpBuffer = await runtimeDeps.convertToWebPBuffer(imageBuffer);
  const base64Image = webpBuffer.toString('base64');

  let response;
  if (cacheName) {
    const cachedConfig = { ...baseConfig };
    delete (cachedConfig as { systemInstruction?: unknown }).systemInstruction;
    try {
      response = await aiClient.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [{
          role: 'user',
          parts: [{ inlineData: { mimeType: 'image/webp', data: base64Image } }],
        }],
        config: {
          ...cachedConfig,
          cachedContent: cacheName,
          abortSignal: AbortSignal.timeout(aiTimeoutMs),
        },
      });
    } catch (error) {
      console.warn(`Cached prompt generation failed for ${imageUrl}. Retrying without cache.`, error);
      response = await aiClient.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/webp', data: base64Image } },
            { text: promptText },
          ],
        }],
        config: {
          ...baseConfig,
          abortSignal: AbortSignal.timeout(aiTimeoutMs),
        },
      });
    }
  } else {
    response = await aiClient.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/webp', data: base64Image } },
          { text: promptText },
        ],
      }],
      config: {
        ...baseConfig,
        abortSignal: AbortSignal.timeout(aiTimeoutMs),
      },
    });
  }

  const rawText = (response.text || '').trim();
  const parsed = parseOutputText(rawText);
  const result = runtimeDeps.postProcessSearchAnalysisResult(parsed);
  const rejection = result.rejection as { isRejected?: boolean; reason?: string; message?: string } | undefined;
  if (rejection?.isRejected) {
    throw new Error(`Analysis rejected: ${rejection.reason || rejection.message || 'unknown reason'}`);
  }
  return result;
}

async function processRow(
  row: CacheRow,
  promptText: string,
  cacheName: string | null,
  baseConfig: Record<string, unknown>,
  aiClient: any,
) {
  if (!row.original_image_url) {
    throw new Error('Missing original_image_url.');
  }

  const analysis = await analyzeImageUrl(
    row.original_image_url,
    promptText,
    cacheName,
    baseConfig,
    aiClient,
  );
  const price = await calculateCachePrice(analysis);

  if (!dryRun) {
    const { error } = await supabase
      .from('cakegenie_analysis_cache')
      .update({
        analysis_json: analysis,
        price,
      })
      .eq('id', row.id);

    if (error) {
      throw new Error(`Failed to update cache row ${row.id}: ${error.message}`);
    }
  }

  return { analysis, price };
}

let runtimeDeps: RuntimeDeps;

async function loadRuntimeDeps(): Promise<RuntimeDeps> {
  const [
    aiClientModule,
    aiPromptsModule,
    aiUtilsModule,
    contractModule,
    promptLoaderModule,
    pricingModule,
    pricingUtilsModule,
    imageHashModule,
  ] = await Promise.all([
    import('@/lib/ai/client'),
    import('@/lib/ai/prompts'),
    import('@/lib/ai/utils'),
    import('@/lib/admin/searchAnalysisContract'),
    import('@/services/prompts/promptLoader'),
    import('@/services/pricingService.database'),
    import('@/lib/utils/pricing'),
    import('@/lib/utils/imageHash'),
  ]);

  return {
    SYSTEM_INSTRUCTION: aiPromptsModule.SYSTEM_INSTRUCTION,
    buildSearchAnalysisGenerationConfig: contractModule.buildSearchAnalysisGenerationConfig,
    calculatePriceFromDatabase: pricingModule.calculatePriceFromDatabase,
    convertToWebPBuffer: imageHashModule.convertToWebPBuffer,
    getAI: aiClientModule.getAI,
    getActivePromptDetails: promptLoaderModule.getActivePromptDetails,
    getDynamicTypeEnums: aiUtilsModule.getDynamicTypeEnums,
    getOrCreatePromptCache: aiClientModule.getOrCreatePromptCache,
    postProcessSearchAnalysisResult: contractModule.postProcessSearchAnalysisResult,
    roundDownToNearest99: pricingUtilsModule.roundDownToNearest99,
  };
}

async function main() {
  runtimeDeps = await loadRuntimeDeps();
  const startedAt = Date.now();
  const aiClient = runtimeDeps.getAI();
  const [promptDetails, typeEnums] = await Promise.all([
    runtimeDeps.getActivePromptDetails(supabase),
    runtimeDeps.getDynamicTypeEnums(supabase),
  ]);
  const baseConfig = runtimeDeps.buildSearchAnalysisGenerationConfig(typeEnums);
  const cacheName = await runtimeDeps.getOrCreatePromptCache(
    aiClient,
    promptDetails.promptText,
    promptDetails.version,
    runtimeDeps.SYSTEM_INSTRUCTION,
  );

  console.log(`Starting cache re-analysis${dryRun ? ' (dry run)' : ''} with prompt version ${promptDetails.version}.`);
  console.log(`Options: batchSize=${batchSize}, concurrency=${concurrency}, offset=${offset}, limit=${limit ?? 'none'}, pHash=${pHashFilter ?? 'all'}`);

  let fetched = 0;
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let currentOffset = offset;
  let stop = false;

  while (!stop) {
    const rows = await fetchBatch(currentOffset);
    if (rows.length === 0) break;

    fetched += rows.length;
    currentOffset += rows.length;

    const queue = [...rows];
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0 && !stop) {
        const row = queue.shift();
        if (!row) return;

        if (limit !== null && processed >= limit) {
          stop = true;
          return;
        }

        processed += 1;
        const label = `[${processed}${limit ? `/${limit}` : ''}] ${row.p_hash}`;

        try {
          const result = await processRow(
            row,
            promptDetails.promptText,
            cacheName,
            baseConfig,
            aiClient,
          );
          updated += 1;
          console.log(`${label} ${dryRun ? 'analyzed' : 'updated'} price=${result.price}`);
        } catch (error) {
          errors += 1;
          console.error(`${label} failed:`, error instanceof Error ? error.message : error);
        }
      }
    });

    await Promise.all(workers);

    if (pHashFilter) {
      break;
    }
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('Done.');
  console.log(`Summary: fetched=${fetched}, processed=${processed}, updated=${updated}, skipped=${skipped}, errors=${errors}, elapsed=${elapsedSeconds}s`);
}

main().catch((error) => {
  console.error('Fatal rerun-analysis-cache failure:', error);
  process.exit(1);
});
