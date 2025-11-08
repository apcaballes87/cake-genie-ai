// config.ts

// Configuration variables from environment variables
// These are securely managed through Vercel environment variables
// and injected at build time using Vite's import.meta.env

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://cqmhanqnfybyxezhobkx.supabase.co";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks";
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyDThtN_G7khUxdZy6rVPgI0zpsyPS30ryE";

// Note: The || fallback values are the public keys that are already exposed in the codebase
// and are protected by Supabase RLS and Google Cloud API restrictions.
// For production, these should be set in Vercel environment variables.
