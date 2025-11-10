# Facebook/Messenger Sharing Implementation

## Overview

This document describes the complete implementation of Facebook/Messenger sharing functionality in the Cake Genie application. The implementation ensures that when users share cake designs on social media platforms, proper previews with images, titles, and descriptions are displayed.

## Key Components

### 1. Frontend Service (shareService.ts)

The frontend service handles the image upload process:

- **dataURItoBlob()**: Converts base64 data URIs to Blob objects
- **uploadImageToStorage()**: Uploads images to Supabase Storage and returns public URLs
- **saveDesignToShare()**: Saves designs to the database with proper image URLs

### 2. Supabase Storage Setup

A dedicated storage bucket `shared-cake-images` is created with:

- Public read access for social media crawlers
- Authenticated user upload permissions
- Anonymous user upload permissions (for sharing)
- 10MB file size limit
- Support for JPEG, JPG, PNG, and WEBP image formats

### 3. Edge Function (share-design)

The Supabase Edge Function serves HTML with Open Graph meta tags:

- Detects social media crawlers (Facebook, Messenger, Twitter, etc.)
- Serves proper meta tags with image URLs for crawlers
- Redirects real users to the actual design page
- Handles base64 data URIs by falling back to default images

## Implementation Details

### Image Handling

1. When a user creates a shareable design, the frontend service checks if the image is a base64 data URI
2. If it is, the image is converted to a Blob and uploaded to Supabase Storage
3. The public URL of the uploaded image is stored in the database
4. When social media crawlers access the share URL, the Edge Function serves proper Open Graph meta tags with the public image URL

### Security

- Images are stored in a dedicated public bucket
- Upload permissions are restricted to authenticated and anonymous users
- Real users are redirected to the actual design page
- Social media crawlers receive only the necessary meta tags

## Testing

### Manual Testing

1. Create a new shared design in the application
2. Verify that the image is uploaded to Supabase Storage
3. Check the database to ensure the image URL is a public URL (not base64)
4. Test the share URL in the Facebook Sharing Debugger:
   - Go to https://developers.facebook.com/tools/debug/
   - Paste the share URL
   - Click "Debug"
   - Verify that the image, title, and description are displayed correctly

### Automated Testing

The implementation includes proper error handling and logging for debugging purposes.

## Deployment

1. Run the SQL setup script to create the storage bucket and policies
2. Deploy the Edge function using the deployment script
3. Test the implementation with new shared designs

## Troubleshooting

### Images not showing in social media previews

1. Check that the image URL in the database is a public URL (not base64)
2. Verify that the storage bucket and policies are properly configured
3. Test the share URL in the Facebook Sharing Debugger
4. Use the "Scrape Again" button to force Facebook to refresh the preview

### Edge Function errors

1. Check the Supabase function logs for error messages
2. Verify that the environment variables are properly set
3. Ensure that the database query is returning the expected data

## Performance

- Edge Function responses are cached for 1 hour in browsers and 24 hours on CDNs
- Images are cached indefinitely by Supabase Storage
- Facebook caches previews to reduce server load