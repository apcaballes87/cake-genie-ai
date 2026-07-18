BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET LOCAL search_path = public, extensions, pg_temp;

SELECT plan(19);

CREATE TEMP TABLE claim_variant_test_context AS
SELECT substr(md5(gen_random_uuid()::text), 1, 16) AS p_hash;

INSERT INTO public.cakegenie_analysis_cache (p_hash, analysis_json)
SELECT p_hash, '{}'::jsonb
FROM claim_variant_test_context;

CREATE TEMP TABLE claim_variant_test_cases (
    sequence integer PRIMARY KEY,
    status text,
    indexed_source text,
    effective_source text,
    attempted_case text,
    expected integer,
    label text
);

INSERT INTO claim_variant_test_cases VALUES
    (1, NULL, 'https://example.com/a.jpg', 'https://example.com/a.jpg', 'none', 1, 'NULL / same'),
    (2, NULL, 'https://example.com/a.jpg', 'https://example.com/b.jpg', 'none', 1, 'NULL / changed'),
    (3, 'pending', 'https://example.com/a.jpg', 'https://example.com/a.jpg', 'none', 1, 'pending / same'),
    (4, 'pending', 'https://example.com/a.jpg', 'https://example.com/b.jpg', 'none', 1, 'pending / changed'),
    (5, 'ready', 'https://example.com/a.jpg', 'https://example.com/a.jpg', 'none', 0, 'ready / same'),
    (6, 'ready', 'https://example.com/a.jpg', 'https://example.com/b.jpg', 'none', 1, 'ready / changed'),
    (7, 'failed', 'https://example.com/a.jpg', 'https://example.com/a.jpg', 'none', 0, 'failed / same'),
    (8, 'failed', 'https://example.com/a.jpg', 'https://example.com/b.jpg', 'none', 1, 'failed / changed'),
    (9, 'partial', 'https://example.com/a.jpg', 'https://example.com/a.jpg', 'none', 0, 'partial / same'),
    (10, 'partial', 'https://example.com/a.jpg', 'https://example.com/b.jpg', 'none', 1, 'partial / changed'),
    (11, 'skipped', 'https://example.com/a.jpg', 'https://example.com/a.jpg', 'none', 0, 'skipped / same'),
    (12, 'skipped', 'https://example.com/a.jpg', 'https://example.com/b.jpg', 'none', 1, 'skipped / changed'),
    (13, 'skipped', NULL, NULL, 'none', 0, 'skipped / NULL source'),
    (14, 'running', 'https://example.com/a.jpg', 'https://example.com/a.jpg', 'fresh', 0, 'running fresh / same'),
    (15, 'running', 'https://example.com/a.jpg', 'https://example.com/b.jpg', 'fresh', 0, 'running fresh / changed'),
    (16, 'running', 'https://example.com/a.jpg', 'https://example.com/a.jpg', 'stale', 1, 'running stale / same'),
    (17, 'running', 'https://example.com/a.jpg', 'https://example.com/b.jpg', 'stale', 1, 'running stale / changed'),
    (18, 'running', 'https://example.com/a.jpg', 'https://example.com/a.jpg', 'none', 0, 'running no timestamp / same'),
    (19, 'running', 'https://example.com/a.jpg', 'https://example.com/b.jpg', 'none', 0, 'running no timestamp / changed');

CREATE TEMP TABLE claim_variant_test_results (
    sequence integer PRIMARY KEY,
    result text NOT NULL
);

DO $$
DECLARE
    test_hash text := (SELECT p_hash FROM claim_variant_test_context);
    test_case record;
    actual integer;
BEGIN
    FOR test_case IN
        SELECT * FROM claim_variant_test_cases ORDER BY sequence
    LOOP
        UPDATE public.cakegenie_analysis_cache
        SET image_variants_status = test_case.status,
            image_variants_indexed_source = test_case.indexed_source,
            image_variants_attempted_at = CASE test_case.attempted_case
                WHEN 'fresh' THEN now()
                WHEN 'stale' THEN now() - interval '6 minutes'
                ELSE NULL
            END
        WHERE p_hash = test_hash;

        actual := public.cakegenie_claim_variant_row(
            test_hash,
            test_case.effective_source
        );

        INSERT INTO claim_variant_test_results (sequence, result)
        VALUES (
            test_case.sequence,
            is(actual, test_case.expected, test_case.label)
        );

        IF actual IS DISTINCT FROM test_case.expected THEN
            RAISE EXCEPTION 'claim policy failed for %: expected %, got %',
                test_case.label,
                test_case.expected,
                actual;
        END IF;
    END LOOP;
END;
$$;

SELECT result
FROM claim_variant_test_results
ORDER BY sequence;

SELECT * FROM finish();
SELECT 'ok - all 19 claim policy cases passed' AS result;

ROLLBACK;
