-- Rows that existed before the enqueue trigger need one idempotent queue pass.
-- Their eligibility remains anchored to the original successful analysis time.
INSERT INTO public.cakegenie_seo_batch_jobs (
  cache_id,
  analysis_revision,
  analysis_json,
  availability,
  keywords,
  tags,
  slug,
  eligible_at
)
SELECT
  c.id,
  c.seo_analysis_revision,
  c.analysis_json,
  c.availability,
  c.keywords,
  to_jsonb(c.tags),
  c.slug,
  c.analysis_ready_at + interval '48 hours'
FROM public.cakegenie_analysis_cache AS c
WHERE c.seo_status = 'pending'
  AND c.analysis_ready_at IS NOT NULL
  AND c.seo_analysis_revision IS NOT NULL
  AND nullif(btrim(c.slug), '') IS NOT NULL
  AND nullif(btrim(c.original_image_url), '') IS NOT NULL
ON CONFLICT (cache_id, analysis_revision) DO NOTHING;
