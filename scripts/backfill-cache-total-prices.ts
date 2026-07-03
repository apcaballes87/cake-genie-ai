/**
 * Recalculate `cakegenie_analysis_cache.price` from `analysis_json` using:
 *   lowest base price for the same cake tier/type + current add-on pricing
 *
 * Usage:
 *   npx tsx scripts/backfill-cache-total-prices.ts --dry-run --limit=25
 *   npx tsx scripts/backfill-cache-total-prices.ts
 *   npx tsx scripts/backfill-cache-total-prices.ts --p-hash=<hash>
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { parseArgs } from 'node:util';

import { normalizeCakeType } from '@/lib/utils/cakeType';

type JsonRecord = Record<string, unknown>;

type AnalysisCacheRow = {
  id: string | number;
  p_hash: string | null;
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
  calculatePriceFromDatabase: (
    uiState: PricingState,
    merchantId?: string,
  ) => Promise<{ addOnPricing: { addOnPrice: number } }>;
  roundDownToNearest99: (price: number, minPrice?: number) => number;
};

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const { values } = parseArgs({
  options: {
    'batch-size': { type: 'string', default: '100' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
    limit: { type: 'string' },
    'merchant-id': { type: 'string' },
    'p-hash': { type: 'string' },
    'show-pricing-warnings': { type: 'boolean', default: false },
  },
});

if (values.help) {
  console.log(`
Backfill cakegenie_analysis_cache.price from analysis_json.

Options:
  --dry-run              Calculate and log changes without updating rows.
  --limit=<n>            Stop after processing n candidate rows.
  --batch-size=<n>       Number of rows to fetch per page. Default: 100.
  --merchant-id=<uuid>   Use merchant-specific pricing rules when calculating.
  --p-hash=<hash>        Recalculate one cache row.
  --show-pricing-warnings
                         Show one warning per missing pricing rule encountered.
`);
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const batchSize = parsePositiveInt(String(values['batch-size'] ?? '100'), 'batch-size');
const limit = values.limit ? parsePositiveInt(values.limit, 'limit') : null;
const dryRun = Boolean(values['dry-run']);
const merchantId = typeof values['merchant-id'] === 'string' ? values['merchant-id'] : undefined;
const pHash = typeof values['p-hash'] === 'string' ? values['p-hash'] : undefined;
const showPricingWarnings = Boolean(values['show-pricing-warnings']);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

let runtimeDeps: RuntimeDeps;

if (!showPricingWarnings) {
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('No pricing rule found for:')) {
      return;
    }
    originalWarn(...args);
  };
}

function parsePositiveInt(rawValue: string, name: string) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.error(`--${name} must be a positive integer.`);
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
      thickness: asString(analysis.cakeThickness, '4 in'),
      size: asString(analysis.cakeSize, '6" Round'),
      flavors: [],
    },
  };
}

async function getLowestBasePriceForType(type: string): Promise<number> {
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

async function fetchBatch(offset: number) {
  let query = supabase
    .from('cakegenie_analysis_cache')
    .select('id, p_hash, analysis_json, price')
    .not('analysis_json', 'is', null)
    .order('id', { ascending: true })
    .range(offset, offset + batchSize - 1);

  if (pHash) {
    query = query.eq('p_hash', pHash);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch cache rows: ${error.message}`);
  }

  return (data || []) as unknown as AnalysisCacheRow[];
}

async function main() {
  runtimeDeps = await loadRuntimeDeps();
  console.log(`Starting total price backfill${dryRun ? ' (dry run)' : ''}...`);

  let fetched = 0;
  let processed = 0;
  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  for (let offset = 0; ; offset += batchSize) {
    const rows = await fetchBatch(offset);
    if (rows.length === 0) break;

    fetched += rows.length;

    for (const row of rows) {
      if (limit !== null && processed >= limit) {
        console.log('Reached --limit, stopping.');
        printSummary({ fetched, processed, updated, unchanged, errors });
        return;
      }

      processed++;
      if (processed % 100 === 0) {
        console.log(`Processed ${processed} rows... updated=${updated}, unchanged=${unchanged}, errors=${errors}`);
      }

      try {
        const pricingState = mapAnalysisToPricingState(row.analysis_json);
        const { addOnPricing } = await runtimeDeps.calculatePriceFromDatabase(pricingState, merchantId);
        const lowestBasePrice = await getLowestBasePriceForType(pricingState.cakeInfo.type);
        const nextPrice = runtimeDeps.roundDownToNearest99(lowestBasePrice + addOnPricing.addOnPrice, lowestBasePrice);

        if (row.price === nextPrice) {
          unchanged++;
          continue;
        }

        const label = row.p_hash || row.id;

        if (dryRun) {
          console.log(`[dry-run] ${label}: ${row.price} -> ${nextPrice}`);
          updated++;
          continue;
        }

        const { error: updateError } = await supabase
          .from('cakegenie_analysis_cache')
          .update({ price: nextPrice })
          .eq('id', row.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        updated++;
        if (updated % 25 === 0) {
          console.log(`Updated ${updated} rows...`);
        }
      } catch (error) {
        errors++;
        console.error(`Failed row ${row.p_hash || row.id}:`, error instanceof Error ? error.message : error);
      }
    }

    if (rows.length < batchSize || pHash) break;
  }

  printSummary({ fetched, processed, updated, unchanged, errors });

  if (errors > 0) {
    process.exitCode = 1;
  }
}

async function loadRuntimeDeps(): Promise<RuntimeDeps> {
  const [pricingModule, pricingUtilsModule] = await Promise.all([
    import('@/services/pricingService.database'),
    import('@/lib/utils/pricing'),
  ]);

  return {
    calculatePriceFromDatabase: pricingModule.calculatePriceFromDatabase,
    roundDownToNearest99: pricingUtilsModule.roundDownToNearest99,
  };
}

function printSummary(summary: {
  fetched: number;
  processed: number;
  updated: number;
  unchanged: number;
  errors: number;
}) {
  console.log('\nBackfill summary');
  console.log(`  fetched:   ${summary.fetched}`);
  console.log(`  processed: ${summary.processed}`);
  console.log(`  updated:   ${summary.updated}`);
  console.log(`  unchanged: ${summary.unchanged}`);
  console.log(`  errors:    ${summary.errors}`);
}

main().catch((error) => {
  console.error('Unexpected total price backfill failure:', error instanceof Error ? error.message : error);
  process.exit(1);
});
