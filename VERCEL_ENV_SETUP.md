# Vercel Environment Variables Setup Guide

## Overview
Your updated app has been successfully deployed to GitHub with secure environment variable handling. Now you need to configure Vercel environment variables for production deployment.

## Required Environment Variables

The app requires the following environment variables (defined in [vite-env.d.ts](vite-env.d.ts)):

1. **VITE_SUPABASE_URL** - Your Supabase project URL
2. **VITE_SUPABASE_ANON_KEY** - Your Supabase anonymous key
3. **VITE_GEMINI_API_KEY** - Your Google Gemini API key (REQUIRED)
4. **VITE_GOOGLE_MAPS_API_KEY** - Your Google Maps API key

## Why Environment Variables?

The app has been updated from hardcoded values to environment variables for:
- Better security (API keys not exposed in code)
- Different values for development/production
- Easy key rotation without code changes
- Compliance with security best practices

## Setup Methods

### Method 1: Using Vercel Dashboard (Recommended)

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project: **genieph** (or cake-genie-ai)
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - Click **Add New**
   - Enter variable name (e.g., `VITE_GEMINI_API_KEY`)
   - Enter the value
   - Select environments: **Production**, **Preview**, **Development**
   - Click **Save**

### Method 2: Using Vercel CLI

Run these commands in your terminal (you'll be prompted for values):

```bash
# Navigate to your project directory
cd /Users/apcaballes/genieph

# Add Gemini API Key (REQUIRED - no fallback)
vercel env add VITE_GEMINI_API_KEY production
vercel env add VITE_GEMINI_API_KEY preview
vercel env add VITE_GEMINI_API_KEY development

# Add Supabase URL (optional - has fallback)
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_URL preview

# Add Supabase Anon Key (optional - has fallback)
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add VITE_SUPABASE_ANON_KEY preview

# Add Google Maps API Key (optional - has fallback)
vercel env add VITE_GOOGLE_MAPS_API_KEY production
vercel env add VITE_GOOGLE_MAPS_API_KEY preview
```

## Current Configuration Status

### ✅ Completed:
- Updated [config.ts](config.ts) to use `import.meta.env`
- Fixed [services/geminiService.ts](services/geminiService.ts) to use `VITE_GEMINI_API_KEY`
- Added TypeScript definitions in [vite-env.d.ts](vite-env.d.ts)
- Updated [.gitignore](.gitignore) to prevent env leaks
- Code pushed to GitHub: https://github.com/apcaballes87/cake-genie-ai
- Vercel project linked

### ⚠️ Action Required:
1. **Add VITE_GEMINI_API_KEY to Vercel** (CRITICAL - app won't work without this)
2. Optionally add other variables to override fallback values

## Fallback Values

The code includes fallback values for backwards compatibility:
- **VITE_SUPABASE_URL**: Falls back to `https://cqmhanqnfybyxezhobkx.supabase.co`
- **VITE_SUPABASE_ANON_KEY**: Falls back to existing public key
- **VITE_GOOGLE_MAPS_API_KEY**: Falls back to existing public key
- **VITE_GEMINI_API_KEY**: **NO FALLBACK** - must be set in Vercel

## Getting Your API Keys

### Gemini API Key
1. Go to: https://aistudio.google.com/apikey
2. Create or use existing API key
3. Copy the key value

### Supabase Keys
1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
2. Copy Project URL and anon/public key
3. (These have fallbacks, but you can override them)

### Google Maps API Key
1. Go to: https://console.cloud.google.com/apis/credentials
2. Create or use existing API key
3. (Has fallback, but you can override)

## Verification

After adding environment variables in Vercel:

1. **Redeploy your app** (Vercel should auto-deploy from main branch)
2. Check deployment logs for environment variable loading
3. Test the app - Gemini features should work
4. Check browser console for any "environment variable not set" errors

## Troubleshooting

### App shows "VITE_GEMINI_API_KEY environment variable not set" error
- Add the Gemini API key to Vercel environment variables
- Redeploy the application

### Changes not taking effect
- Vercel requires a redeploy after adding environment variables
- Go to Deployments → click "..." → Redeploy

### Local development
Create a `.env.local` file in your project root:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

This file is gitignored and won't be committed.

## Security Notes

✅ Environment variables are secure:
- `.env.local` is in `.gitignore`
- Vercel encrypts environment variables
- `VITE_` prefix makes them available in browser (safe for public keys)
- Private keys should NEVER use the `VITE_` prefix

⚠️ Important: The Supabase anon key and Google Maps API key are "public" keys that are meant to be used in the browser. They're protected by:
- Supabase Row Level Security (RLS)
- Google Cloud API restrictions
- Rate limiting

The Gemini API key should be restricted in Google Cloud Console to your domain.

## Next Steps

1. Add `VITE_GEMINI_API_KEY` to Vercel (use Method 1 or 2 above)
2. Trigger a new deployment or wait for auto-deploy
3. Test your production app
4. Monitor for any errors in Vercel deployment logs

## Resources

- Vercel Environment Variables: https://vercel.com/docs/projects/environment-variables
- Vite Environment Variables: https://vitejs.dev/guide/env-and-mode.html
- Your GitHub Repo: https://github.com/apcaballes87/cake-genie-ai
