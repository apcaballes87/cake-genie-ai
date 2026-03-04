import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('cakegenie_analysis_cache')
    .select('slug, keywords, alt_text')
    .or('slug.ilike.%jollibee%,keywords.ilike.%jollibee%,alt_text.ilike.%jollibee%,slug.ilike.%mcdonalds%,keywords.ilike.%mcdonalds%,alt_text.ilike.%mcdonalds%')
    .limit(10);
    
  console.log('Results:', data);
  if (error) console.error('Error:', error);
}

main();
