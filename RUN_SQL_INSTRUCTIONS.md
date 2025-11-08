# How to Run the SQL Script in Supabase

Since we can't execute SQL directly via CLI/API, you need to use the Supabase Dashboard. It's very easy!

## Step-by-Step Instructions

### 1. Open Supabase SQL Editor

Click this link:
👉 **https://supabase.com/dashboard/project/cqmhanqnfybyxezhobkx/sql/new**

Or manually:
1. Go to https://supabase.com/dashboard
2. Select your project: `cqmhanqnfybyxezhobkx`
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"

### 2. Copy the SQL Script

The SQL script is in: `SUPABASE_STORAGE_SETUP.sql`

Here's the complete script to copy:

```sql
-- ============================================
-- Supabase Storage Setup for Shared Cake Images
-- ============================================

-- 1. Create the storage bucket for shared cake images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shared-cake-images',
  'shared-cake-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create policy to allow anyone to read images (public access)
CREATE POLICY "Public Access for Shared Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'shared-cake-images');

-- 3. Create policy to allow authenticated users to upload
CREATE POLICY "Authenticated users can upload shared images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'shared-cake-images'
  AND auth.role() = 'authenticated'
);

-- 4. Create policy to allow anonymous users to upload (for sharing)
CREATE POLICY "Anonymous users can upload shared images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'shared-cake-images'
  AND auth.role() = 'anon'
);

-- 5. Optional: Allow users to delete their own uploads
CREATE POLICY "Users can delete their own shared images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'shared-cake-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Verification: Check if bucket was created
SELECT * FROM storage.buckets WHERE id = 'shared-cake-images';
```

### 3. Paste and Run

1. Paste the entire script into the SQL Editor
2. Click the **"Run"** button (or press `Cmd+Enter` / `Ctrl+Enter`)
3. Wait for it to complete

### 4. Verify Success

You should see output like:

```
Success. No rows returned
Success. No rows returned
Success. No rows returned
Success. No rows returned
Success. No rows returned

id                  | name                | public | file_size_limit | ...
--------------------|---------------------|--------|-----------------|-----
shared-cake-images  | shared-cake-images  | true   | 10485760        | ...
```

The last query shows your newly created bucket!

### 5. Visual Verification

Go to Storage section to see the bucket:
👉 **https://supabase.com/dashboard/project/cqmhanqnfybyxezhobkx/storage/buckets**

You should see:
- **Bucket name**: `shared-cake-images`
- **Public**: Yes ✓
- **Size limit**: 10 MB

## What If There's an Error?

### Error: "relation already exists"
**Meaning**: The bucket or policies already exist
**Solution**: This is fine! It means the setup is already done

### Error: "permission denied"
**Meaning**: You don't have the right permissions
**Solution**: Make sure you're logged in as the project owner

### Error: "syntax error"
**Meaning**: Copy-paste issue
**Solution**:
1. Copy the ENTIRE script above (including comments)
2. Paste fresh into SQL Editor
3. Try again

## After Running the SQL

Once the bucket is created, your Facebook sharing fix is **COMPLETE**!

### What Happens Next:

1. ✅ **Vercel auto-deploys** (already pushed to GitHub)
2. ✅ **Storage bucket ready** (you just created it)
3. ✅ **New designs will upload images** to Supabase Storage
4. ✅ **Facebook sharing will work** with proper image URLs

### Test It:

1. Create a new shared design in your app
2. Check database - should see URL not base64:
   ```sql
   SELECT customized_image_url FROM cakegenie_shared_designs
   ORDER BY created_at DESC LIMIT 1;
   ```
3. Test with Facebook debugger: https://developers.facebook.com/tools/debug/
4. Share on actual Facebook/Messenger

## Quick Links

- **SQL Editor**: https://supabase.com/dashboard/project/cqmhanqnfybyxezhobkx/sql/new
- **Storage Buckets**: https://supabase.com/dashboard/project/cqmhanqnfybyxezhobkx/storage/buckets
- **Facebook Debugger**: https://developers.facebook.com/tools/debug/

---

**Need help?** Let me know if you see any errors!
