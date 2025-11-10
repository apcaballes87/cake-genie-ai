-- Check if bucket was created
SELECT * FROM storage.buckets WHERE id = 'shared-cake-images';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%Shared%';