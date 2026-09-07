BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions, pg_temp;

SELECT plan(6);

SELECT is(
  public.pdq_hamming_distance(repeat('0', 64), repeat('0', 64)),
  0,
  'identical PDQ hashes have zero distance'
);

SELECT is(
  public.pdq_hamming_distance(repeat('0', 63) || '1', repeat('0', 64)),
  1,
  'PDQ distance counts differing bits'
);

DO $$
DECLARE
  raised boolean := false;
BEGIN
  BEGIN
    PERFORM public.pdq_hamming_distance('not-a-pdq-hash', repeat('0', 64));
  EXCEPTION WHEN others THEN
    raised := true;
  END;
  PERFORM ok(raised, 'malformed PDQ hashes are rejected');
END;
$$;

INSERT INTO public.cakegenie_analysis_cache (
  p_hash,
  fingerprint_pipeline,
  analysis_json,
  pdq_hash,
  pdq_quality,
  pdq_pipeline,
  pdq_status,
  created_at
)
VALUES
  ('1000000000000001', 'pdq-test-legacy', '{}'::jsonb, repeat('0', 63) || '1', 90, 'pdq-test', 'ready', '2026-01-01T00:00:00Z'),
  ('1000000000000002', 'pdq-test-legacy', '{}'::jsonb, repeat('0', 62) || '03', 90, 'pdq-test', 'ready', '2026-01-02T00:00:00Z'),
  ('1000000000000004', 'pdq-test-legacy', '{}'::jsonb, repeat('0', 63) || '2', 49, 'pdq-test', 'ready', '2026-01-03T00:00:00Z'),
  ('1000000000000008', 'pdq-test-legacy', '{}'::jsonb, repeat('0', 63) || '4', 90, 'other-pdq-pipeline', 'ready', '2026-01-04T00:00:00Z'),
  ('1000000000000016', 'pdq-test-legacy', '{}'::jsonb, repeat('0', 63) || '8', 90, 'pdq-test', 'pending', '2026-01-05T00:00:00Z'),
  ('1000000000000032', 'pdq-test-legacy', '{}'::jsonb, repeat('0', 63) || '8', 90, 'pdq-test', 'ready', '2026-01-06T00:00:00Z');

SELECT is(
  (SELECT count(*)::integer
   FROM public.find_similar_analysis_by_pdq(repeat('0', 64), 90, 'pdq-test', 1, 50)),
  1,
  'PDQ lookup filters by ready status, quality, pipeline, and distance'
);

SELECT is(
  (SELECT p_hash
   FROM public.find_similar_analysis_by_pdq(repeat('0', 64), 90, 'pdq-test', 1, 50)),
  '1000000000000032',
  'PDQ lookup returns the newest eligible row for an equal-distance match'
);

SELECT is(
  (SELECT count(*)::integer
   FROM public.find_similar_analysis_by_pdq(repeat('0', 64), 90, 'pdq-test', 0, 50)),
  0,
  'PDQ lookup honors the configured maximum distance'
);

SELECT * FROM finish();
ROLLBACK;
