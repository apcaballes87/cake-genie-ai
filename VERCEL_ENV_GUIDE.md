# Vercel Environment Variables Guide

## Understanding Your Setup

Your Genie application uses Vercel for production deployment where environment variables are managed through the Vercel dashboard. This is the correct and secure approach for managing API keys and other sensitive configuration values.

## Required Environment Variables

For your application to work correctly, you need these environment variables set in your Vercel project:

1. `VITE_GEMINI_API_KEY` - Google AI Studio API key for Gemini integration
2. `VITE_GOOGLE_MAPS_API_KEY` - Google Maps API key for map functionality

## How to Check and Update Vercel Environment Variables

### 1. Access Your Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Log in to your account
3. Select your "genie-ph" project

### 2. Navigate to Environment Variables
1. Click on the "Settings" tab
2. Click on "Environment Variables" in the left sidebar

### 3. Check Current Variables
Look for these variables in your list:
- `VITE_GEMINI_API_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`

### 4. If Variables Are Missing or Invalid
1. Generate a new Gemini API key:
   - Go to https://aistudio.google.com/app/apikey
   - Click "Create API key"
   - Copy the new key

2. Add or update the variable in Vercel:
   - Click "Add" to create a new variable
   - Set Name to `VITE_GEMINI_API_KEY`
   - Set Value to your new API key
   - Set Environment to "Production" (and "Preview" if needed)
   - Click "Add"

## Common Issues and Solutions

### Issue: "API key not valid" Error
**Cause**: The API key has been reported as leaked or has expired
**Solution**: 
1. Generate a new API key from Google AI Studio
2. Update the `VITE_GEMINI_API_KEY` variable in Vercel
3. Redeploy your application

### Issue: Environment Variables Not Taking Effect
**Cause**: Changes to environment variables require a new deployment
**Solution**:
1. Make a small change to trigger a new deployment (e.g., update a comment in your code)
2. Or manually redeploy from the Vercel dashboard

## Testing Your Configuration

### 1. Verify API Key Directly
You can test your API key using curl:

```bash
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=YOUR_API_KEY_HERE" \
     -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"test"}]}]}'
```

A successful response indicates the key is valid.

### 2. Check Vercel Deployment Logs
1. Go to your Vercel dashboard
2. Select your project
3. Click on the "Deployments" tab
4. Select the latest deployment
5. Check the logs for any environment variable related errors

## Local Development vs Production

### Local Development
For local development, you can use a [.env.local](file:///Users/apcaballes/genieph/.env.local) file with your own API keys:
1. Create a [.env.local](file:///Users/apcaballes/genieph/.env.local) file in your project root
2. Add your API keys:
   ```
   VITE_GEMINI_API_KEY=your_local_api_key_here
   VITE_GOOGLE_MAPS_API_KEY=your_local_maps_key_here
   ```
3. Never commit this file to version control (it's in [.gitignore](file:///Users/apcaballes/genieph/.gitignore))

### Production (Vercel)
For production, all environment variables must be set in the Vercel dashboard as described above.

## Best Practices

1. **Regular Key Rotation**: Periodically rotate your API keys for security
2. **Monitor Notifications**: Keep an eye on emails from Google about key compromises
3. **Environment Separation**: Use different keys for development and production if possible
4. **Documentation**: Keep documentation of which services require which keys
5. **Testing**: Always test new keys before updating production

## Troubleshooting Checklist

- [ ] Verify `VITE_GEMINI_API_KEY` is set in Vercel
- [ ] Check if the API key has been reported as leaked
- [ ] Generate a new API key if needed
- [ ] Update the key in Vercel environment variables
- [ ] Redeploy the application
- [ ] Check deployment logs for errors
- [ ] Test the API key directly with curl

## Need Help?

If you continue to experience issues:
1. Check the Vercel deployment logs for specific error messages
2. Verify your API key has the correct permissions in Google AI Studio
3. Contact Vercel support for deployment-related issues
4. Contact Google AI Studio support for API key issues