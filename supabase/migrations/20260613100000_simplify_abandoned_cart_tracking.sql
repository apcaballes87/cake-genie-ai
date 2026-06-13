-- Migration: simplify abandoned cart tracking
-- File: supabase/migrations/20260613100000_simplify_abandoned_cart_tracking.sql

-- 1. Drop old view and table
DROP VIEW IF EXISTS public.cakegenie_eligible_abandoned_carts;
DROP TABLE IF EXISTS public.cakegenie_abandoned_cart_emails;

-- 2. Add columns to cakegenie_cart
ALTER TABLE public.cakegenie_cart 
ADD COLUMN IF NOT EXISTS email_100_min_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS email_18_hour_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_cakegenie_cart_abandoned_100min 
ON public.cakegenie_cart(user_id) 
WHERE email_100_min_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cakegenie_cart_abandoned_18hour 
ON public.cakegenie_cart(user_id) 
WHERE email_18_hour_sent_at IS NULL;

-- 4. Create trigger function to reset sent status on cart modification
CREATE OR REPLACE FUNCTION public.trg_reset_cart_email_tracking()
RETURNS TRIGGER AS $$
BEGIN
    -- If the email sent columns are not being updated, it means this is a user-initiated cart change.
    -- We reset the sent timestamps to allow recovery emails to trigger again.
    IF (OLD.email_100_min_sent_at IS NOT DISTINCT FROM NEW.email_100_min_sent_at AND 
        OLD.email_18_hour_sent_at IS NOT DISTINCT FROM NEW.email_18_hour_sent_at) THEN
        NEW.email_100_min_sent_at = NULL;
        NEW.email_18_hour_sent_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger
DROP TRIGGER IF EXISTS reset_cart_email_tracking ON public.cakegenie_cart;
CREATE TRIGGER reset_cart_email_tracking
BEFORE UPDATE ON public.cakegenie_cart
FOR EACH ROW
EXECUTE FUNCTION public.trg_reset_cart_email_tracking();

-- 6. Recreate the view to isolate ONLY the test user for testing phase
CREATE OR REPLACE VIEW public.cakegenie_eligible_abandoned_carts AS
WITH user_cart_summary AS (
    SELECT 
        c.user_id,
        u.email as recipient_email,
        u.first_name,
        MAX(COALESCE(c.updated_at, c.created_at)) as last_activity,
        MIN(c.email_100_min_sent_at) as last_100_min_sent,
        MIN(c.email_18_hour_sent_at) as last_18_hour_sent
    FROM public.cakegenie_cart c
    JOIN public.cakegenie_users u ON c.user_id = u.user_id
    WHERE c.expires_at > NOW()
      AND c.user_id = '86318c91-8951-4f6f-a396-327e089e87df' -- TEST USER LIMITATION
      AND NOT EXISTS (
          SELECT 1 
          FROM public.cakegenie_orders o 
          WHERE o.user_id = c.user_id 
            AND o.payment_status = 'paid'
            AND o.created_at >= COALESCE(c.updated_at, c.created_at)
      )
    GROUP BY c.user_id, u.email, u.first_name
)
SELECT 
    user_id,
    recipient_email,
    first_name,
    last_activity,
    CASE 
        -- For testing, we remove time restrictions so it qualifies immediately
        WHEN (last_100_min_sent IS NULL OR last_100_min_sent < last_activity)
             THEN '100_min'::varchar
        WHEN (last_18_hour_sent IS NULL OR last_18_hour_sent < last_activity)
             THEN '18_hour'::varchar
    END as email_to_send
FROM user_cart_summary
WHERE 
    (last_100_min_sent IS NULL OR last_100_min_sent < last_activity)
    OR (last_18_hour_sent IS NULL OR last_18_hour_sent < last_activity);
