BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions, pg_temp;

SELECT plan(4);

-- 000...01 is one bit away from the query; 000...03 is two bits away.
-- The restored pre-recent-upload RPCs must return only the former.
INSERT INTO public.cakegenie_analysis_cache (p_hash, fingerprint_pipeline, analysis_json)
VALUES
  ('0000000000000001', 'phash-threshold-test', '{}'::jsonb),
  ('0000000000000003', 'phash-threshold-test', '{}'::jsonb);

SELECT is(
  (SELECT count(*)::integer
   FROM public.find_similar_analysis_by_fingerprint('0000000000000000', 'phash-threshold-test')),
  1,
  'pipeline fingerprint lookup returns only the distance-one row'
);

SELECT is(
  (SELECT p_hash
   FROM public.find_similar_analysis_by_fingerprint('0000000000000000', 'phash-threshold-test')),
  '0000000000000001',
  'pipeline fingerprint lookup chooses the closest allowed match'
);

SELECT is(
  (SELECT count(*)::integer
   FROM public.find_similar_analysis('0000000000000000')
   WHERE fingerprint_pipeline = 'phash-threshold-test'),
  1,
  'legacy fingerprint lookup excludes distance-two rows'
);

SELECT is(
  (SELECT p_hash
   FROM public.find_similar_analysis('0000000000000000')
   WHERE fingerprint_pipeline = 'phash-threshold-test'),
  '0000000000000001',
  'legacy fingerprint lookup returns the distance-one row'
);

SELECT * FROM finish();
ROLLBACK;
