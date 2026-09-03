-- Storage bucket: party-budget-images (public)
-- Note: The bucket itself must be created via the Supabase dashboard or storage API.
-- Run the following in the Supabase SQL editor after this migration:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('party-budget-images', 'party-budget-images', true);

CREATE TABLE IF NOT EXISTS public.cakegenie_party_budget_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id     text NOT NULL,
  category_id text NOT NULL,
  image_url   text NOT NULL,
  file_path   text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_party_budget_images_user_item
  ON public.cakegenie_party_budget_images (user_id, item_id);

CREATE INDEX idx_party_budget_images_user
  ON public.cakegenie_party_budget_images (user_id);

ALTER TABLE public.cakegenie_party_budget_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their budget images" ON public.cakegenie_party_budget_images;
CREATE POLICY "Users can view their budget images"
  ON public.cakegenie_party_budget_images
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS "Users can insert their budget images" ON public.cakegenie_party_budget_images;
CREATE POLICY "Users can insert their budget images"
  ON public.cakegenie_party_budget_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS "Users can update their budget images" ON public.cakegenie_party_budget_images;
CREATE POLICY "Users can update their budget images"
  ON public.cakegenie_party_budget_images
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS "Users can delete their budget images" ON public.cakegenie_party_budget_images;
CREATE POLICY "Users can delete their budget images"
  ON public.cakegenie_party_budget_images
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cakegenie_party_budget_images TO authenticated;

-- Storage policies for party-budget-images bucket
DROP POLICY IF EXISTS "Users can upload budget images" ON storage.objects;
CREATE POLICY "Users can upload budget images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'party-budget-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS "Users can view budget images" ON storage.objects;
CREATE POLICY "Users can view budget images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'party-budget-images');

DROP POLICY IF EXISTS "Users can delete their budget images from storage" ON storage.objects;
CREATE POLICY "Users can delete their budget images from storage"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'party-budget-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );
