-- Add publication and trend-discovery metadata for programmatic cake collections.
ALTER TABLE public.cakegenie_collections
  ADD COLUMN IF NOT EXISTS collection_type TEXT NOT NULL DEFAULT 'evergreen',
  ADD COLUMN IF NOT EXISTS trend_source TEXT,
  ADD COLUMN IF NOT EXISTS trend_score NUMERIC,
  ADD COLUMN IF NOT EXISTS trend_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_indexable BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS matched_design_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS studio_image_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_slug TEXT;

ALTER TABLE public.cakegenie_collections
  DROP CONSTRAINT IF EXISTS cakegenie_collections_publication_status_check;

ALTER TABLE public.cakegenie_collections
  ADD CONSTRAINT cakegenie_collections_publication_status_check
  CHECK (publication_status IN ('candidate', 'stocking', 'published', 'retired'));

UPDATE public.cakegenie_collections
SET
  publication_status = 'published',
  is_indexable = TRUE,
  matched_design_count = GREATEST(COALESCE(matched_design_count, 0), COALESCE(item_count, 0)),
  published_at = COALESCE(published_at, created_at, NOW())
WHERE publication_status = 'published';

UPDATE public.cakegenie_collections
SET
  collection_type = CASE
    WHEN slug IN (
      'black-minimalist-cakes',
      'pink-vintage-cakes',
      'red-candy-cakes',
      'sage-green-minimalist-cakes',
      'black-and-gold-cakes'
    ) THEN 'visual_combo'
    ELSE 'evergreen'
  END,
  publication_status = 'stocking',
  is_indexable = FALSE,
  published_at = NULL
WHERE slug IN (
  'pink-cakes',
  'black-cakes',
  'emerald-green-cakes',
  'sage-green-cakes',
  'coquette-cakes',
  'korean-minimalist-cakes',
  'chrome-metallic-cakes',
  'heart-cakes',
  'first-birthday-cakes',
  'cakes-for-boyfriend-or-husband',
  'black-minimalist-cakes',
  'pink-vintage-cakes',
  'red-candy-cakes',
  'sage-green-minimalist-cakes',
  'black-and-gold-cakes'
);

CREATE INDEX IF NOT EXISTS idx_collections_publication
  ON public.cakegenie_collections (publication_status, is_indexable, item_count);

CREATE INDEX IF NOT EXISTS idx_collections_trend_checked_at
  ON public.cakegenie_collections (trend_checked_at DESC NULLS LAST);
