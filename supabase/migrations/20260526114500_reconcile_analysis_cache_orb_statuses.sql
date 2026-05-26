UPDATE public.cakegenie_analysis_cache AS cache
SET
  orb_index_status = 'ready',
  orb_index_error = NULL,
  orb_indexed_at = COALESCE(cache.orb_indexed_at, features.created_at, cache.created_at, now())
FROM public.cakegenie_image_features AS features
WHERE features.id = cache.id;
