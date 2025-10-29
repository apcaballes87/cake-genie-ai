// config.ts

// IMPORTANT:
// This file reads configuration from environment variables (.env.local file).
// Never commit API keys directly in this file!
//
// 1. Copy .env.example to .env.local
// 2. Add your actual API keys to .env.local (this file is gitignored)
// 3. Vite will automatically load these at build time

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Google Maps API Key from environment variables
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Validate that all required environment variables are set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GOOGLE_MAPS_API_KEY) {
  throw new Error(
    'Missing required environment variables. Please check your .env.local file.\n' +
    'Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GOOGLE_MAPS_API_KEY'
  );
}