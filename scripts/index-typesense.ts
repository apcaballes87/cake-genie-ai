#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import {
  ensureTypesenseCollection,
  importTypesenseDocuments,
  mapCacheRowToTypesenseDocument,
} from '../src/lib/search/typesense';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase URL or service role key.');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE_SIZE = 500;
const IMPORT_BATCH_SIZE = 100;

async function main() {
  await ensureTypesenseCollection();
  let offset = 0;
  let indexed = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('p_hash,slug,keywords,alt_text,seo_description,original_image_url,studio_edited_image_url,price,usage_count,availability,icing_colors,tags,analysis_json,created_at')
      .not('slug', 'is', null)
      .not('original_image_url', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;

    const documents = (data || [])
      .map((row) => mapCacheRowToTypesenseDocument(row))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    for (let index = 0; index < documents.length; index += IMPORT_BATCH_SIZE) {
      await importTypesenseDocuments(documents.slice(index, index + IMPORT_BATCH_SIZE));
      indexed += Math.min(IMPORT_BATCH_SIZE, documents.length - index);
      console.log(`Indexed ${indexed} documents`);
    }

    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Typesense backfill complete: ${indexed} documents.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
