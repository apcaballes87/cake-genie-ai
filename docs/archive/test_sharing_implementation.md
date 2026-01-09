# Testing Facebook/Messenger Sharing Implementation

## Prerequisites
- Ensure all code changes have been pushed to GitHub
- Verify Supabase Edge Function is deployed
- Confirm Supabase Storage bucket and policies are set up

## Test Plan

### 1. Verify Database Schema
Check that the `cakegenie_shared_designs` table exists with proper columns:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cakegenie_shared_designs' 
ORDER BY ordinal_position;
```

### 2. Test Image Upload Functionality
Create a test design with a base64 image to verify upload functionality:
1. Create a new design in the app
2. Use an image that will be converted from base64 to a public URL
3. Check Supabase Storage to confirm image was uploaded to `shared-cake-images` bucket
4. Verify database entry has a public URL (not base64) in `customized_image_url` field

### 3. Test Edge Function Response
Verify the Edge Function returns proper HTML with Open Graph tags:
```bash
curl -H "User-Agent: facebookexternalhit/1.1" \
  https://cqmhanqnfybyxezhobkx.supabase.co/functions/v1/share-design/test-design-slug
```

Look for these meta tags in the response:
- `<meta property="og:title" content="...">`
- `<meta property="og:description" content="...">`
- `<meta property="og:image" content="...">`

### 4. Test User Redirect
Verify real users are redirected properly:
```bash
curl -H "User-Agent: Mozilla/5.0" \
  -I https://cqmhanqnfybyxezhobkx.supabase.co/functions/v1/share-design/test-design-slug
```

Should return a 302 redirect status with Location header.

### 5. Facebook Sharing Debugger Test
1. Go to https://developers.facebook.com/tools/debug/
2. Enter a share URL: `https://genie.ph/designs/YOUR-DESIGN-SLUG`
3. Click "Debug"
4. Verify:
   - Image preview is displayed
   - Title is correct
   - Description is correct
   - No warnings or errors

### 6. Messenger Sharing Test
1. Create a share link in the app
2. Copy the link
3. Paste it in Messenger
4. Verify that a proper preview with image, title, and description appears

## Expected Results

### Success Criteria
- [ ] Images are uploaded to Supabase Storage as public URLs
- [ ] Database stores public URLs (not base64 data URIs)
- [ ] Edge Function returns proper Open Graph meta tags for bots
- [ ] Edge Function redirects real users to the design page
- [ ] Facebook Sharing Debugger shows correct preview
- [ ] Messenger shows proper link preview

### Troubleshooting
If tests fail:

1. **Images not uploading:**
   - Check browser console for JavaScript errors
   - Verify Supabase Storage policies allow uploads
   - Confirm network requests to storage API are successful

2. **Base64 URLs in database:**
   - Check that `uploadImageToStorage` function is being called
   - Verify the condition `if (data.customizedImageUrl.startsWith('data:'))` is working
   - Check browser console for upload errors

3. **Edge Function not returning meta tags:**
   - Check Supabase function logs
   - Verify the user-agent detection is working
   - Confirm database query is returning data

4. **Facebook/Messenger not showing previews:**
   - Use Facebook Sharing Debugger to force a refresh
   - Check that image URLs are accessible (not localhost)
   - Verify image dimensions meet platform requirements

## Performance Verification
- [ ] Edge Function responses are cached appropriately
- [ ] Images are served with proper caching headers
- [ ] No excessive database queries
- [ ] Upload process completes in reasonable time

## Security Verification
- [ ] Only authorized users can upload images
- [ ] Public URLs are properly scoped to the bucket
- [ ] No sensitive information in meta tags
- [ ] Content Security Policy is properly set