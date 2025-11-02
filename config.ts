// config.ts

// IMPORTANT:
// This application runs directly in the browser without a build step to handle
// environment variables (like process.env). Therefore, you must manually enter
// your Supabase credentials below.
//
// 1. Go to your Supabase project dashboard.
// 2. Go to Settings > API.
// 3. Copy the "Project URL" and the "anon" "public" key.
// 4. Paste them here to replace the placeholder values.

export const SUPABASE_URL = "https://cqmhanqnfybyxezhobkx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks";

// Add your Google Maps API Key here.
// You can get one from the Google Cloud Console: https://console.cloud.google.com/google/maps-apis/
// Also, remember to add it to index.html where prompted.
export const GOOGLE_MAPS_API_KEY = "AIzaSyA0RZHBXUprvS7k2x6_C-FuhkEjHluR9Ck";

// Gemini API Key (get from Google AI Studio)
export const GEMINI_API_KEY = "***REMOVED_GEMINI_KEY***";

// Google Custom Search Engine ID
export const GOOGLE_CSE_ID = "825ca1503c1bd4d00";