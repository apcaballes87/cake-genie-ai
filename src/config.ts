// config.ts

// Using Vite environment variables for Supabase credentials
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// IMPORTANT:
// This application runs directly in the browser without a build step to handle
// environment variables (like process.env). Therefore, you must manually enter
// your Supabase credentials below.
//
// 1. Go to your Supabase project dashboard.
// 2. Go to Settings > API.
// 3. Copy the "Project URL" and the "anon" "public" key.
// 4. Paste them here to replace the placeholder values.
