# Facebook & Messenger Sharing Fix Guide

## Problem
When sharing links like `https://genie.ph/designs/6-round-1-tier-cake-0e2317fe` on Facebook or Messenger, the cake image, title, and description don't appear.

## Solution Overview
We have a Supabase Edge Function that serves Open Graph meta tags for social media crawlers. The function needs to be deployed/updated to work properly.

## Current Status

✅ **Code Ready**: The share-design function is coded and ready in [supabase/functions/share-design/index.ts](supabase/functions/share-design/index.ts)
✅ **Vercel Routing**: [vercel.json](vercel.json) is configured to route `/designs/:slug*` to the Supabase function
⚠️ **Function Deployment**: Needs to be deployed to Supabase

## Step-by-Step Fix

### 1. Login to Supabase CLI

```bash
supabase login
```

This will open your browser to authenticate. Follow the prompts.

### 2. Link to Your Supabase Project

```bash
cd /Users/apcaballes/genieph
supabase link --project-ref cqmhanqnfybyxezhobkx
```

### 3. Deploy the share-design Function

```bash
supabase functions deploy share-design --no-verify-jwt
```

Or use the provided script:
```bash
./deploy-share-function.sh
```

### 4. Verify the Function Works

Test the direct Supabase URL in your browser:
```
https://cqmhanqnfybyxezhobkx.supabase.co/functions/v1/share-design/6-round-1-tier-cake-0e2317fe
```

**Expected behavior**:
- You should see HTML with Open Graph meta tags
- The page should redirect you to the React app
- View page source to see the meta tags

### 5. Test with Facebook Debugger

Once the function is deployed:

1. Go to: https://developers.facebook.com/tools/debug/
2. Paste your share URL: `https://genie.ph/designs/6-round-1-tier-cake-0e2317fe`
3. Click "Debug"
4. Check the scraped data - you should see:
   - **Title**: The cake design title
   - **Description**: The cake description
   - **Image**: The cake image URL

### 6. Clear Facebook Cache (if needed)

If you've shared the link before:
1. Click "Scrape Again" in the Facebook debugger
2. This forces Facebook to re-fetch the meta tags

## How It Works

1. **User shares**: `https://genie.ph/designs/6-round-1-tier-cake-0e2317fe`
2. **Vercel rewrites** the request to the Supabase function (via [vercel.json](vercel.json))
3. **Supabase function**:
   - Fetches design data from `cakegenie_shared_designs` table
   - Generates HTML with Open Graph meta tags
   - Returns HTML to Facebook's crawler
   - Redirects regular users to the React app
4. **Facebook crawler** sees the meta tags and displays the rich preview

## Architecture

```
genie.ph/designs/xyz
     ↓ (Vercel rewrite)
Supabase Edge Function
     ↓ (queries)
cakegenie_shared_designs table
     ↓ (returns)
HTML with OG tags → Facebook crawler ✓
JavaScript redirect → Real users ✓
```

## Troubleshooting

### Function returns 404
- Check if the design exists in `cakegenie_shared_designs` table
- Verify the URL slug matches the database

### Function returns 500
- Check Supabase function logs: `supabase functions logs share-design`
- Verify environment variables are set in Supabase dashboard

### Facebook still shows old preview
- Use Facebook debugger to scrape again
- Wait a few minutes for Facebook's cache to expire
- Check if the URL is exactly the same (trailing slash matters)

### Vercel deployment not picking up changes
- Ensure `vercel.json` is committed to git
- Redeploy: `vercel --prod`

## Testing Checklist

- [ ] Supabase CLI logged in
- [ ] Supabase function deployed
- [ ] Direct Supabase URL works and shows OG tags
- [ ] genie.ph/designs/:slug redirects correctly
- [ ] Facebook debugger shows correct title
- [ ] Facebook debugger shows correct description
- [ ] Facebook debugger shows correct image
- [ ] Actual Facebook share shows rich preview
- [ ] Messenger share shows rich preview

## Related Files

- [supabase/functions/share-design/index.ts](supabase/functions/share-design/index.ts) - The Edge Function code
- [vercel.json](vercel.json) - Routing configuration
- [deploy-share-function.sh](deploy-share-function.sh) - Deployment script
- [services/shareService.ts](services/shareService.ts) - Client-side sharing logic

## Environment Variables (Supabase)

The Edge Function needs these environment variables (auto-provided by Supabase):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

These are automatically available in Supabase Edge Functions.

## Domain Configuration

**Important**: The function uses `https://genie.ph` as the APP_DOMAIN on line 69 of the Edge Function.

If you're testing on `genieph.vercel.app`, you may want to temporarily change this for testing:

```typescript
const APP_DOMAIN = 'https://genieph.vercel.app'; // For testing
// const APP_DOMAIN = 'https://genie.ph'; // For production
```

Don't forget to change it back and redeploy before going live!

## Next Steps After Deployment

1. Create a test design and share it
2. Verify on Facebook/Messenger
3. If everything works, you're done!
4. If not, check the troubleshooting section above

## Support

- Supabase Functions Docs: https://supabase.com/docs/guides/functions
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Open Graph Protocol: https://ogp.me/
