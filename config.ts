// config.ts
/// <reference types="vite/client" />

// IMPORTANT:
// This application uses Vite for environment variable handling.
// For local development, create a .env.local file (already in .gitignore)
// For production (Vercel), set environment variables in the Vercel dashboard:
//
// Required Environment Variables:
// - VITE_GEMINI_API_KEY (Google AI Studio API key)
// - VITE_GOOGLE_MAPS_API_KEY (Google Maps API key)
//
// The Supabase URL and anon key are public and safe to commit.

export const SUPABASE_URL = "https://cqmhanqnfybyxezhobkx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks";

// Google Maps API Key - loaded from environment variables
// In production (Vercel), set VITE_GOOGLE_MAPS_API_KEY
// In local development, add to .env.local
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

// Gemini API Key - loaded from environment variables
// In production (Vercel), set VITE_GEMINI_API_KEY
// In local development, add to .env.local
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

// Check if API key is set and provide helpful error message
if (!GEMINI_API_KEY) {
  console.warn("⚠️  WARNING: GEMINI_API_KEY is not set. Please add VITE_GEMINI_API_KEY to your .env.local file.");
} else if (GEMINI_API_KEY === "REPLACE_WITH_YOUR_NEW_GEMINI_API_KEY") {
  console.warn("⚠️  WARNING: You need to replace the placeholder API key in .env.local with your actual Gemini API key.");
}

// Google Custom Search Engine ID
export const GOOGLE_CSE_ID = "825ca1503c1bd4d00";