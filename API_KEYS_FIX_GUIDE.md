# API Keys Fix Guide

## Issue
The application is showing API key errors:
1. "API key not valid. Please pass a valid API key." (Gemini)
2. Google Maps functionality may not be working (Google Maps)

## Root Cause
The `.env.local` file still contains placeholder values instead of actual API keys.

## Solution Steps

### Step 1: Get Your Actual API Keys from Vercel
1. Go to your Vercel dashboard (https://vercel.com/dashboard)
2. Select your Cake Genie project
3. Navigate to Settings > Environment Variables
4. Find the following variables and copy their actual values:
   - [VITE_GEMINI_API_KEY](file:///Users/apcaballes/genieph/vite-env.d.ts#L5-L5)
   - [VITE_GOOGLE_MAPS_API_KEY](file:///Users/apcaballes/genieph/vite-env.d.ts#L6-L6)

### Step 2: Update Your Local .env.local File
Open `/Users/apcaballes/genieph/.env.local` in a text editor and find these lines:
```
VITE_GEMINI_API_KEY=your_actual_gemini_api_key_here
VITE_GOOGLE_MAPS_API_KEY=your_actual_google_maps_api_key_here
```

Replace them with your actual API keys:
```
VITE_GEMINI_API_KEY=AIzaSyD_actual_gemini_key_here
VITE_GOOGLE_MAPS_API_KEY=AIzaSyG_actual_maps_key_here
```

### Step 3: Verify the Fix
Test if the API keys are now valid:
```bash
cd /Users/apcaballes/genieph
node tests/test-gemini-key.js
```

You should see:
```
Loaded environment variables from .env.local
=== Checking API Keys ===

1. Gemini API Key Check:
✅ Gemini API key found in environment variables
Testing Gemini API key validity...
✅ Gemini API key is valid!
Test response received successfully

2. Google Maps API Key Check:
✅ Google Maps API key found in environment variables
Note: Google Maps API key validation requires a browser environment
You can test it by opening the app and checking for map functionality

=== API Key Check Complete ===
```

### Step 4: Restart Development Server
Stop your current development server (Ctrl+C) and restart it:
```bash
npm run dev
```

### Step 5: Test Functionality
1. Open your browser and navigate to http://localhost:5175 (or your current dev server port)
2. Try uploading a cake image to test Gemini AI functionality
3. Try using the address selection feature to test Google Maps functionality
4. Check the browser console for any errors

## Common Issues and Troubleshooting

### Issue: API Keys Still Not Working
1. Double-check that you've replaced the placeholders with the actual keys from Vercel
2. Ensure there are no extra spaces or characters in the keys
3. Make sure you've restarted the development server after updating the keys

### Issue: Environment Variables Not Loading
1. Ensure the variable names are exactly [VITE_GEMINI_API_KEY](file:///Users/apcaballes/genieph/vite-env.d.ts#L5-L5) and [VITE_GOOGLE_MAPS_API_KEY](file:///Users/apcaballes/genieph/vite-env.d.ts#L6-L6) (with the VITE_ prefix)
2. Check that there are no syntax errors in your .env.local file
3. Verify that the file is named `.env.local` (not `.env` or any other variation)

### Issue: Vercel Environment Variables Not Synced
If you've updated the keys in Vercel but they're still not working locally:
1. Make sure you're using the same keys in both Vercel and your local .env.local file
2. Check that your Vercel environment variables are set for the correct environment (Production, Preview, Development)

## Verification Checklist
- [ ] Gemini API key retrieved from Vercel dashboard
- [ ] Google Maps API key retrieved from Vercel dashboard
- [ ] .env.local file updated with actual API keys
- [ ] API keys test script passes
- [ ] Development server restarted
- [ ] Image upload works with AI validation
- [ ] Address selection works with Google Maps
- [ ] No API key errors in browser console

## Need Help?
If you're still having issues after following these steps:

### For Gemini API Key Issues:
1. Double-check that your API key from Vercel is valid by testing it directly with the Google AI Studio
2. Ensure your API key has the necessary permissions for the Gemini API
3. Check if there are any network restrictions or firewall issues preventing API access

### For Google Maps API Key Issues:
1. Ensure your Google Maps API key has the required APIs enabled:
   - Maps JavaScript API
   - Places API
   - Geocoding API
2. Check that your API key has the proper restrictions (if any) for your domain
3. Verify that billing is enabled for your Google Cloud project

## Security Notes
- Never commit your `.env.local` file to version control
- The `.gitignore` file should already exclude `.env.local`
- Regularly rotate your API keys for security
- Monitor your API usage to detect any unauthorized use