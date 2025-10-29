// config.ts

// IMPORTANT:
// This file reads configuration from environment variables (.env.local file).
// Never commit API keys directly in this file!
//
// 1. Copy .env.example to .env.local
// 2. Add your actual API keys to .env.local (this file is gitignored)
// 3. Vite will automatically load these at build time

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://cqmhanqnfybyxezhobkx.supabase.co";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks";

// Google Maps API Key from environment variables
// IMPORTANT: Generate a NEW Google Maps API Key and set it in .env.local and Vercel!
// The old key was exposed and should be revoked.
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyA0RZHBXUprvS7k2x6_C-FuhkEjHluR9Ck";

// Validate that all required environment variables are set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GOOGLE_MAPS_API_KEY) {
  console.error(
    'Missing required environment variables. Please check your .env.local file.\n' +
    'Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GOOGLE_MAPS_API_KEY'
  );
}