import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config';

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('YOUR_SUPABASE_URL')) {
  throw new Error("Supabase credentials are not configured. Please update your details in the `config.ts` file.");
}

let client: SupabaseClient | null = null;

/**
 * Gets the singleton Supabase client instance.
 * Creates the client if it doesn't exist yet.
 * Safe for concurrent calls - always returns the same instance.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}
