// config.ts

// Configuration variables loaded from environment variables.
// These are public keys and are secured by Supabase RLS and Google Cloud API restrictions.
// See .env.example for the template.

export const FEATURE_FLAGS = {
  USE_DATABASE_PRICING: import.meta.env.VITE_USE_DATABASE_PRICING === 'true',
};

// Supabase Configuration
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Google Maps API Key
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required Supabase environment variables. Please check your .env file.');
}

if (!GOOGLE_MAPS_API_KEY) {
  console.warn('Google Maps API key is missing. Map features may not work correctly.');
}

// IMPORTANT: The Gemini API Key (process.env.API_KEY) is a special case.
// The execution environment (e.g., Google AI Studio) securely injects this
// one specific environment variable at runtime.