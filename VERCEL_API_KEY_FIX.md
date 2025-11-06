# Fixing API Key Issues in Vercel Deployment

## Problem Summary

You're experiencing "API key not valid" errors with your Genie application deployed on Vercel. This is likely because the `VITE_GEMINI_API_KEY` in your Vercel environment variables has been reported as leaked or is otherwise invalid.

## Root Cause

The Gemini API key in your Vercel configuration has been invalidated by Google, which causes all Gemini API calls to fail with the error:
```
"API key not valid. Please pass a valid API key."
```

## Solution Steps

### 1. Generate a New API Key
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API key"
3. Copy the new key to your clipboard

### 2. Update Vercel Environment Variables
1. Go to your Vercel dashboard (https://vercel.com/dashboard)
2. Select your "genie-ph" project
3. Click on "Settings" tab
4. Click on "Environment Variables" in the left sidebar
5. Find the `VITE_GEMINI_API_KEY` variable
6. Click the pencil icon to edit it
7. Replace the value with your new API key
8. Click "Save"

### 3. Redeploy Your Application
1. Go back to your project overview in Vercel
2. Click on "Deployments" tab
3. Click the "Redeploy" button for your latest deployment
4. Or make a small change to trigger a new deployment

### 4. Verify the Fix
1. Wait for the deployment to complete
2. Visit your application
3. Try uploading a cake image to test the Gemini API integration

## Why This Happens

Google periodically scans for API keys that may have been compromised and invalidates them to protect users. When this happens, you'll receive an error like:
```
{
  "error": {
    "code": 403,
    "message": "Your API key was reported as leaked. Please use another API key.",
    "status": "PERMISSION_DENIED"
  }
}
```

## Prevention

1. **Regular Key Rotation**: Rotate your API keys every 90 days
2. **Monitor Notifications**: Keep an eye on emails from Google about security issues
3. **Restrict Key Usage**: In Google AI Studio, you can restrict keys to specific IP addresses or referrers
4. **Use Separate Keys**: Use different keys for development and production environments

## Diagnostic Tools

We've created several tools to help you diagnose and fix this issue:

1. `check-env-configuration.mjs` - Checks your local environment configuration
2. `vercel-env-check.mjs` - Provides guidance for checking Vercel environment variables
3. `debug-vercel-env.mjs` - Helps debug Vercel environment variable issues

Run any of these scripts with:
```bash
node script-name.mjs
```

## If Issues Persist

1. Check Vercel deployment logs for specific error messages
2. Verify your new API key works with a direct curl request
3. Ensure you're using the correct model name (gemini-2.5-flash)
4. Contact Vercel support for deployment issues
5. Contact Google AI Studio support for API key issues

## Important Notes

- Changes to environment variables in Vercel require a new deployment to take effect
- Never commit API keys to version control
- The `VITE_` prefix is required for environment variables to be exposed to client-side code in Vercel
- Your local [.env.local](file:///Users/apcaballes/genieph/.env.local) file is separate from Vercel environment variables and only affects local development