-- Keep customer-facing collection labels distinct from their exact, indexed
-- membership query. This avoids broad tag matching while allowing valid
-- singular/plural and noun-form collection names to remain useful galleries.
ALTER TABLE public.cakegenie_collections
  ADD COLUMN IF NOT EXISTS search_query text;

INSERT INTO public.cakegenie_collections (
  name,
  slug,
  search_query,
  tags,
  description
)
VALUES
  (
    'Dancer Cake',
    'dancer-cake',
    'dance',
    ARRAY['dancer cake', 'dance cake', 'dancing cake', 'ballerina cake', 'dance birthday cake'],
    'Browse dancer cake designs for recitals, competitions, and birthdays. Start with a dance-inspired cake, then customize the size, colors, message, and details for delivery or pickup in Metro Cebu.'
  ),
  (
    'Debut Cake',
    'debut-cake',
    'debut',
    ARRAY['debut cake', '18th birthday cake', 'debut cake cebu', 'eighteenth birthday cake', 'debut birthday cake'],
    'Browse debut cake designs for an 18th birthday celebration in Cebu. Choose an elegant starting point, then customize the size, colors, message, flowers, bows, and details before arranging delivery or pickup.'
  ),
  (
    'Drinks Cake',
    'drinks-cake',
    'beer',
    ARRAY['drinks cake', 'beer cake', 'beer mug cake', 'adult birthday cake', 'beer birthday cake'],
    'Browse drinks cake designs inspired by beer bottles, mugs, and brewery themes for adult birthdays and celebrations. Customize the size, message, and details before arranging delivery or pickup in Metro Cebu.'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  search_query = EXCLUDED.search_query,
  tags = EXCLUDED.tags,
  description = EXCLUDED.description;

WITH refreshed AS (
  SELECT
    collection.id,
    collection.search_query,
    public.search_collection_products_count(collection.search_query, NULL) AS matched_design_count
  FROM public.cakegenie_collections collection
  WHERE collection.slug IN ('dancer-cake', 'debut-cake', 'drinks-cake')
), samples AS (
  SELECT DISTINCT ON (refreshed.id)
    refreshed.id,
    COALESCE(image.studio_edited_image_url, design.original_image_url) AS sample_image
  FROM refreshed
  JOIN LATERAL public.search_collection_products(refreshed.search_query, 100, 0, NULL) design ON true
  LEFT JOIN public.cakegenie_analysis_cache image ON image.p_hash = design.p_hash
  ORDER BY refreshed.id, (image.studio_edited_image_url IS NOT NULL) DESC, design.rank_score DESC, design.slug ASC
), studio_counts AS (
  SELECT
    refreshed.id,
    count(*) FILTER (WHERE image.studio_edited_image_url IS NOT NULL)::integer AS studio_image_count
  FROM refreshed
  JOIN LATERAL public.search_collection_products(refreshed.search_query, 100, 0, NULL) design ON true
  LEFT JOIN public.cakegenie_analysis_cache image ON image.p_hash = design.p_hash
  GROUP BY refreshed.id
)
UPDATE public.cakegenie_collections collection
SET
  item_count = refreshed.matched_design_count,
  matched_design_count = refreshed.matched_design_count,
  sample_image = samples.sample_image,
  studio_image_count = COALESCE(studio_counts.studio_image_count, 0),
  publication_status = CASE WHEN refreshed.matched_design_count >= 8 AND samples.sample_image IS NOT NULL THEN 'published' ELSE 'stocking' END,
  is_indexable = refreshed.matched_design_count >= 8 AND samples.sample_image IS NOT NULL,
  published_at = CASE WHEN refreshed.matched_design_count >= 8 AND samples.sample_image IS NOT NULL THEN COALESCE(collection.published_at, now()) ELSE NULL END
FROM refreshed
LEFT JOIN samples ON samples.id = refreshed.id
LEFT JOIN studio_counts ON studio_counts.id = refreshed.id
WHERE collection.id = refreshed.id;
