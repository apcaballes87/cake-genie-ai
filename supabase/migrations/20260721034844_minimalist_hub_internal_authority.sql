-- Strengthen the existing minimalist collection without changing its tags,
-- inventory, sample image, publication timestamps, or matching behavior.
UPDATE public.cakegenie_collections
SET description = 'Compare Korean-style, pastel, vintage-piped, and simple birthday cakes in Cebu. Open a design to customize its message, colors, and size and see starting prices.'
WHERE slug = 'minimalist-cake';

-- The approved featured-hub list includes this already-built 66-design hub.
-- Publish only this exact row, and only while it still satisfies the existing
-- collection quality gate and has a public crawler image.
UPDATE public.cakegenie_collections
SET
  published_at = COALESCE(published_at, NOW()),
  is_indexable = TRUE,
  publication_status = 'published'
WHERE slug = '30th-birthday-cake'
  AND item_count >= 8
  AND matched_design_count >= 8
  AND sample_image ~ '^https?://';

-- Add one contextual, canonical minimalist-hub link to the existing bento
-- guide paragraph. The predicate makes the content update idempotent.
UPDATE public.blogs
SET
  content = REPLACE(
    content,
    'Beyond minimalist lettering and character cakes',
    'Beyond [minimalist cake designs in Cebu](/collections/minimalist-cake) and character cakes'
  ),
  updated_at = NOW()
WHERE slug = 'bento-cake-guide-2026'
  AND POSITION('/collections/minimalist-cake' IN content) = 0
  AND POSITION('Beyond minimalist lettering and character cakes' IN content) > 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.cakegenie_collections
    WHERE slug = 'minimalist-cake'
      AND description = 'Compare Korean-style, pastel, vintage-piped, and simple birthday cakes in Cebu. Open a design to customize its message, colors, and size and see starting prices.'
      AND publication_status = 'published'
      AND is_indexable = TRUE
      AND item_count >= 8
  ) THEN
    RAISE EXCEPTION 'Minimalist hub description rollout failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.cakegenie_collections
    WHERE slug = '30th-birthday-cake'
      AND publication_status = 'published'
      AND is_indexable = TRUE
      AND item_count >= 8
  ) THEN
    RAISE EXCEPTION '30th birthday featured hub is not publishable';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.blogs
    WHERE slug = 'bento-cake-guide-2026'
      AND POSITION('/collections/minimalist-cake' IN content) > 0
  ) THEN
    RAISE EXCEPTION 'Bento guide minimalist hub link rollout failed';
  END IF;
END $$;
