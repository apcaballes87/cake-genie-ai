-- ============================================
-- Supabase Storage Setup for Shared Cake Images
-- ============================================
-- Run this in your Supabase SQL Editor

-- 1. Create the storage bucket for shared cake images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shared-cake-images',
  'shared-cake-images',
  true, -- Public bucket so images are accessible via URL
  10485760, -- 10MB limit
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

-- ============================================
-- Verification Queries
-- ============================================

-- Check if bucket was created
SELECT * FROM storage.buckets WHERE id = 'shared-cake-images';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%shared%';
