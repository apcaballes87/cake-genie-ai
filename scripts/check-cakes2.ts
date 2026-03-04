import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  const keywords = 'jollibee, mcdonalds, birthday';
  const keywordList = keywords
      ? keywords.toLowerCase().split(/[\s,]+/).filter(k => k.length > 1)
      : [];

  let query = client
      .from('cakegenie_analysis_cache')
      .select('slug, keywords, alt_text, usage_count')
      .not('original_image_url', 'is', null)
      .not('price', 'is', null)
      .neq('original_image_url', '');

  // If we have keywords, search across keywords, alt_text, and slug for better recall
  if (keywordList.length > 0) {
    const orFilters = keywordList.flatMap(k => [
      `keywords.ilike.%${k}%`,
      `alt_text.ilike.%${k}%`,
      `slug.ilike.%${k}%`,
    ]).join(',');
    console.log("OR Filters:", orFilters);
    query = query.or(orFilters);
  }

  const { data, error } = await query
      .order('usage_count', { ascending: false })
      .range(0, 3);
      
  console.log('Results:', data);
  if (error) console.error('Error:', error);
}

main();
