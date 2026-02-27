-- Migration to backfill item_count on cakegenie_collections
-- This avoids doing heavy dynamic ILIKE queries on the server.

CREATE OR REPLACE FUNCTION update_collection_item_counts_batch(p_limit INT, p_offset INT) RETURNS void AS $$
DECLARE
  coll RECORD;
  tag_text TEXT;
  current_count INT;
  query_str TEXT;
BEGIN
  FOR coll IN SELECT id, tags FROM public.cakegenie_collections ORDER BY id LIMIT p_limit OFFSET p_offset LOOP
    
    -- If no tags, count is 0
    IF coll.tags IS NULL OR array_length(coll.tags, 1) IS NULL THEN
      UPDATE public.cakegenie_collections SET item_count = 0 WHERE id = coll.id;
      CONTINUE;
    END IF;

    -- Build the dynamic SQL query
    query_str := 'SELECT count(*) FROM public.cakegenie_analysis_cache WHERE original_image_url IS NOT NULL AND original_image_url != '''' AND (';
    
    FOR i IN 1..array_length(coll.tags, 1) LOOP
      -- Strip wildcards from the tag text, consistent with TS logic
      tag_text := replace(replace(coll.tags[i], '%', ''), '_', '');
      
      -- Escape single quotes to prevent SQL syntax errors in the dynamic query
      tag_text := replace(tag_text, '''', '''''');
      
      IF tag_text = '' THEN
        CONTINUE;
      END IF;

      IF i > 1 THEN
        query_str := query_str || ' OR ';
      END IF;

      query_str := query_str || format(
        '(keywords ILIKE ''%%%s%%'' OR alt_text ILIKE ''%%%s%%'' OR slug ILIKE ''%%%s%%'' OR tags @> ARRAY[''%s'']::text[])',
        tag_text, tag_text, tag_text, tag_text
      );
    END LOOP;
    
    query_str := query_str || ')';

    -- Execute the dynamic SQL
    EXECUTE query_str INTO current_count;

    -- Update the collection
    UPDATE public.cakegenie_collections 
    SET item_count = current_count
    WHERE id = coll.id;

  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- We can leave the function in the database to be called periodically (e.g. by pg_cron or an edge function)
-- Or we can run it manually in chunks to avoid timeouts.
