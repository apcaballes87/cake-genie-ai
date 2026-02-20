-- Add click_count column if it doesn't exist
ALTER TABLE cakegenie_search_analytics ADD COLUMN IF NOT EXISTS click_count integer DEFAULT 0;

-- Create or replace the stored procedure for logging keywords
CREATE OR REPLACE FUNCTION log_search_keyword(p_search_term text, p_action_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Standardize the term (lowercase, remove extra spaces)
    p_search_term := trim(lower(p_search_term));

    -- If the string is empty or too short, do nothing
    IF length(p_search_term) < 3 THEN
        RETURN;
    END IF;

    -- Upsert logic: Insert if it doesn't exist, update if it does
    IF p_action_type = 'clicked' THEN
        INSERT INTO cakegenie_search_analytics (search_term, click_count, last_searched_at)
        VALUES (p_search_term, 1, now())
        ON CONFLICT (search_term)
        DO UPDATE SET 
            click_count = COALESCE(cakegenie_search_analytics.click_count, 0) + 1,
            last_searched_at = now();
    ELSE
        INSERT INTO cakegenie_search_analytics (search_term, search_count, last_searched_at)
        VALUES (p_search_term, 1, now())
        ON CONFLICT (search_term)
        DO UPDATE SET 
            search_count = COALESCE(cakegenie_search_analytics.search_count, 0) + 1,
            last_searched_at = now();
    END IF;
END;
$$;
