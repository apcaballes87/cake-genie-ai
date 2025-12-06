// config.ts

// Configuration variables are hardcoded here for this specific "buildless"
// browser environment. These are public keys and are secured by
// Supabase RLS and Google Cloud API restrictions.

export const FEATURE_FLAGS = {
  USE_DATABASE_PRICING: true, // Set to true to use the new database-driven pricing
};

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cqmhanqnfybyxezhobkx.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks";
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyDThtN_G7khUxdZy6rVPgI0zpsyPS30ryE";

// IMPORTANT: The Gemini API Key (process.env.API_KEY) is a special case.
// The execution environment (e.g., Google AI Studio) securely injects this
// one specific environment variable at runtime.