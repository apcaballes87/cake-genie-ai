import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAI } from '../src/lib/ai/client';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleApiKey = process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : undefined;
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
const CONCURRENCY = Math.max(1, Number(concurrencyArg?.split('=')[1] || 6));
const progressPath = resolve(process.cwd(), 'generic-seo-copy-backfill-progress.json');

type CacheRow = {
  id: string;
  slug: string | null;
  keywords: string | null;
  alt_text: string | null;
  seo_description: string | null;
  analysis_json: Record<string, unknown> | null;
};

type GeneratedCopy = {
  alt_text: string;
  seo_description: string;
};

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ai = googleApiKey ? new GoogleGenAI({ apiKey: googleApiKey }) : getAI();

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    alt_text: {
      type: Type.STRING,
      description: 'Literal visual alt text under 140 characters. No promo words, no brand name, no punctuation at the end.',
    },
    seo_description: {
      type: Type.STRING,
      description: 'Four to five plain sentences describing the design from the analysis JSON. No pricing, no Starting at, no Get instant pricing, no Genie.ph.',
    },
  },
  required: ['alt_text', 'seo_description'],
};

function loadProgress() {
  if (DRY_RUN || !existsSync(progressPath)) return new Set<string>();
  const parsed = JSON.parse(readFileSync(progressPath, 'utf8')) as string[];
  return new Set(parsed);
}

function saveProgress(done: Set<string>) {
  if (DRY_RUN) return;
  writeFileSync(progressPath, JSON.stringify([...done].sort(), null, 2));
}

function isBadCopy(copy: GeneratedCopy) {
  const joined = `${copy.alt_text} ${copy.seo_description}`;
  return /get instant pricing|starting at|₱|php|genie\.ph|order now|buy yours|perfect|vibrant|beautiful|stunning|unique|elegant|gorgeous|whimsical/i.test(joined);
}

async function fetchRows() {
  const rows: CacheRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('id, slug, keywords, alt_text, seo_description, analysis_json')
      .ilike('seo_description', '%Get instant pricing%')
      .ilike('seo_description', '%Starting at%')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`Fetch failed: ${error.message}`);
    rows.push(...((data || []) as CacheRow[]));
    if (!data || data.length < pageSize) break;
  }
  return typeof LIMIT === 'number' && Number.isFinite(LIMIT) ? rows.slice(0, LIMIT) : rows;
}

async function generateCopy(row: CacheRow): Promise<GeneratedCopy> {
  let retryFeedback = '';

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const prompt = `
Generate improved SEO copy for a Genie.ph cake design using ONLY the analysis_json facts below.

Return JSON only with:
- alt_text: literal visual description, max 140 characters, no promotional words, no brand name, no final punctuation.
- seo_description: 4-5 plain sentences. Describe cake/cupcake type, colors, main toppers/theme, support decorations, and who the design fits.

Rules:
- Do not mention price, peso, PHP, "Starting at", "Get instant pricing", "Customize and order", Genie.ph, URLs, or transactional CTA.
- Do not invent names or messages beyond what appears in analysis_json.
- Do not quote or repeat cake_messages text anywhere. If a message is useful, describe it generically as a piped message.
- For cupcakes, call them cupcakes, never "cupcake cake" or "cake design".
- Use natural, specific language and avoid filler words like beautiful, stunning, unique, elegant, gorgeous, perfect, vibrant, whimsical.
${retryFeedback}

Row context:
slug: ${row.slug || ''}
keywords: ${row.keywords || ''}
current_alt_text: ${row.alt_text || ''}
analysis_json: ${JSON.stringify(row.analysis_json)}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: attempt === 1 ? 0.2 : 0,
      },
    });

    const parsed = JSON.parse((response.text || '').trim()) as GeneratedCopy;
    if (!parsed.alt_text?.trim() || !parsed.seo_description?.trim()) {
      retryFeedback = '\nPrevious attempt failed because it returned blank copy. Return complete nonblank fields.';
      continue;
    }
    if (isBadCopy(parsed)) {
      retryFeedback = `\nPrevious attempt failed because it used disallowed wording. Rewrite without these words or concepts: Get instant pricing, Starting at, price, Genie.ph, order now, buy, perfect, vibrant, beautiful, stunning, unique, elegant, gorgeous, whimsical. Previous JSON: ${JSON.stringify(parsed)}`;
      continue;
    }
    return {
      alt_text: parsed.alt_text.trim().replace(/[.!?]+$/, ''),
      seo_description: parsed.seo_description.trim(),
    };
  }

  throw new Error('Gemini could not produce compliant copy after 3 attempts.');
}

async function main() {
  const rows = await fetchRows();
  const done = loadProgress();
  console.log(`${DRY_RUN ? 'Dry run' : 'Live run'}: ${rows.length} affected rows${LIMIT ? `, limit ${LIMIT}` : ''}.`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let cursor = 0;

  async function processRow(row: CacheRow, index: number) {
    if (done.has(row.id)) {
      skipped += 1;
      return;
    }

    try {
      const generated = await generateCopy(row);
      console.log(`[${index + 1}/${rows.length}] ${row.slug || row.id}`);
      console.log(`  alt: ${generated.alt_text}`);
      console.log(`  desc: ${generated.seo_description}`);

      if (!DRY_RUN) {
        const { error } = await supabase
          .from('cakegenie_analysis_cache')
          .update({
            alt_text: generated.alt_text,
            seo_description: generated.seo_description,
          })
          .eq('id', row.id);

        if (error) throw new Error(`Update failed: ${error.message}`);
        done.add(row.id);
        saveProgress(done);
      }

      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`[${index + 1}/${rows.length}] Failed ${row.slug || row.id}:`, error);
    }

    await new Promise((resolveDone) => setTimeout(resolveDone, 150));
  }

  async function worker() {
    while (cursor < rows.length) {
      const index = cursor;
      cursor += 1;
      await processRow(rows[index], index);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`Finished. updated=${updated} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
