# Gemini API Key Fix Guide

## Issue
The application is showing: "API key not valid. Please pass a valid API key."

## Root Cause
The `.env.local` file still contains the placeholder value instead of the actual Gemini API key.

## Solution Steps

### Step 1: Get Your Actual API Key from Vercel
1. Go to your Vercel dashboard (https://vercel.com/dashboard)
2. Select your Cake Genie project
3. Navigate to Settings > Environment Variables
4. Find the [VITE_GEMINI_API_KEY](file:///Users/apcaballes/genieph/vite-env.d.ts#L5-L5) variable
5. Copy the actual API key value (it should start with "AIza")

### Step 2: Update Your Local .env.local File
Open `/Users/apcaballes/genieph/.env.local` in a text editor and find this line:
```
VITE_GEMINI_API_KEY=your_actual_gemini_api_key_here
```

Replace it with your actual API key:
```
VITE_GEMINI_API_KEY=AIzaSyD_actual_key_here
```

### Step 3: Verify the Fix
Test if the API key is now valid:
```bash
cd /Users/apcaballes/genieph
node tests/test-gemini-key.js
```

You should see:
```
Loaded environment variables from .env.local
✅ API key found in environment variables
Testing API key validity...
✅ API key is valid!
Test response received successfully
```

### Step 4: Restart Development Server
Stop your current development server (Ctrl+C) and restart it:
```bash
npm run dev
```

### Step 5: Test Image Upload
1. Open your browser and navigate to http://localhost:5175 (or your current dev server port)
2. Try uploading a cake image
3. Check the browser console for any errors
4. The AI validation should now work correctly

## Common Issues and Troubleshooting

### Issue: API Key Still Not Working
1. Double-check that you've replaced the placeholder with the actual key from Vercel
2. Ensure there are no extra spaces or characters in the key
3. Make sure you've restarted the development server after updating the key

### Issue: Environment Variable Not Loading
1. Ensure the variable name is exactly [VITE_GEMINI_API_KEY](file:///Users/apcaballes/genieph/vite-env.d.ts#L5-L5) (with the VITE_ prefix)
2. Check that there are no syntax errors in your .env.local file
3. Verify that the file is named `.env.local` (not `.env` or any other variation)

### Issue: Vercel Environment Variables Not Synced
If you've updated the key in Vercel but it's still not working locally:
1. Make sure you're using the same key in both Vercel and your local .env.local file
2. Check that your Vercel environment variables are set for the correct environment (Production, Preview, Development)

## Verification Checklist
- [ ] API key retrieved from Vercel dashboard
- [ ] .env.local file updated with actual API key
- [ ] API key test script passes
- [ ] Development server restarted
- [ ] Image upload works with AI validation
- [ ] No "API key not valid" errors in browser console

## Need Help?
If you're still having issues after following these steps:
1. Double-check that your API key from Vercel is valid by testing it directly with the Google AI Studio
2. Ensure your API key has the necessary permissions for the Gemini API
3. Check if there are any network restrictions or firewall issues preventing API access