// config.ts
// Configuration using Vite environment variables

// Vite environment variables must be prefixed with VITE_ to be exposed to the client
// These are loaded from .env.local (gitignored) in development
// and set in Vercel dashboard for production

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

// Validate that required environment variables are set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing required environment variables. Please check your .env.local file.\n' +
    'Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY\n' +
    'See .env.example for the template.'
  );
}

// Google Maps API key is optional - only needed for address features
if (!GOOGLE_MAPS_API_KEY) {
  console.warn('VITE_GOOGLE_MAPS_API_KEY is not set. Address features may not work.');
}