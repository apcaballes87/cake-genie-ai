// config.ts

// Configuration variables are loaded from environment.
// These are public keys secured by Supabase RLS and Google Cloud API restrictions.

export const FEATURE_FLAGS = {
  USE_DATABASE_PRICING: true, // Set to true to use the new database-driven pricing
};

// Environment variable validation - fail fast if required vars are missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!supabaseUrl) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Please add it to your .env.local file.'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Please add it to your .env.local file.'
  );
}

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;
export const GOOGLE_MAPS_API_KEY = googleMapsApiKey || '';

// IMPORTANT: The Gemini API Key (process.env.API_KEY) is a special case.
// The execution environment (e.g., Google AI Studio) securely injects this
// one specific environment variable at runtime.