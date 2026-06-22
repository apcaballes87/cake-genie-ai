-- Let the single-fingerprint backfill safely rewrite
-- cakegenie_analysis_cache.p_hash while preserving existing references.
--
-- Some downstream tables reference p_hash directly. PostgreSQL cannot alter a
-- foreign key action in place, so this migration recreates only the constraints
-- that reference public.cakegenie_analysis_cache(p_hash), preserving their
-- existing ON DELETE and deferrability behavior while changing ON UPDATE to
-- CASCADE.

DO $$
DECLARE
  constraint_record record;
  child_columns text;
  parent_columns text;
  parent_column_names text[];
  match_clause text;
  delete_clause text;
  deferrable_clause text;
  validation_clause text;
BEGIN
  FOR constraint_record IN
    SELECT
      c.oid,
      c.conname,
      c.conrelid,
      c.conkey,
      c.confkey,
      c.confdeltype,
      c.confmatchtype,
      c.condeferrable,
      c.condeferred,
      c.convalidated
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.cakegenie_analysis_cache'::regclass
  LOOP
    SELECT
      array_agg(parent_attr.attname ORDER BY child_key.ordinality),
      string_agg(format('%I', child_attr.attname), ', ' ORDER BY child_key.ordinality),
      string_agg(format('%I', parent_attr.attname), ', ' ORDER BY child_key.ordinality)
    INTO parent_column_names, child_columns, parent_columns
    FROM unnest(constraint_record.conkey) WITH ORDINALITY AS child_key(attnum, ordinality)
    JOIN pg_attribute child_attr
      ON child_attr.attrelid = constraint_record.conrelid
     AND child_attr.attnum = child_key.attnum
    JOIN unnest(constraint_record.confkey) WITH ORDINALITY AS parent_key(attnum, ordinality)
      ON parent_key.ordinality = child_key.ordinality
    JOIN pg_attribute parent_attr
      ON parent_attr.attrelid = 'public.cakegenie_analysis_cache'::regclass
     AND parent_attr.attnum = parent_key.attnum;

    IF parent_column_names IS DISTINCT FROM ARRAY['p_hash']::text[] THEN
      CONTINUE;
    END IF;

    match_clause := CASE constraint_record.confmatchtype
      WHEN 'f' THEN 'MATCH FULL'
      ELSE ''
    END;

    delete_clause := CASE constraint_record.confdeltype
      WHEN 'r' THEN 'ON DELETE RESTRICT'
      WHEN 'c' THEN 'ON DELETE CASCADE'
      WHEN 'n' THEN 'ON DELETE SET NULL'
      WHEN 'd' THEN 'ON DELETE SET DEFAULT'
      ELSE 'ON DELETE NO ACTION'
    END;

    deferrable_clause := CASE
      WHEN constraint_record.condeferrable AND constraint_record.condeferred THEN 'DEFERRABLE INITIALLY DEFERRED'
      WHEN constraint_record.condeferrable THEN 'DEFERRABLE INITIALLY IMMEDIATE'
      ELSE 'NOT DEFERRABLE'
    END;

    validation_clause := CASE
      WHEN constraint_record.convalidated THEN ''
      ELSE 'NOT VALID'
    END;

    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT %I',
      constraint_record.conrelid::regclass,
      constraint_record.conname
    );

    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.cakegenie_analysis_cache (%s) %s ON UPDATE CASCADE %s %s %s',
      constraint_record.conrelid::regclass,
      constraint_record.conname,
      child_columns,
      parent_columns,
      match_clause,
      delete_clause,
      deferrable_clause,
      validation_clause
    );
  END LOOP;
END $$;
