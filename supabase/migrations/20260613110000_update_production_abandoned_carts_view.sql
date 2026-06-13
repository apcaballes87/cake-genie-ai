-- Migration: Update eligible abandoned carts view for production
-- File: supabase/migrations/20260613110000_update_production_abandoned_carts_view.sql

-- Drop the test-user limited view
DROP VIEW IF EXISTS public.cakegenie_eligible_abandoned_carts;

-- Recreate the view with real time intervals and no test-user filter
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
        WHEN (last_100_min_sent IS NULL OR last_100_min_sent < last_activity)
             AND (last_activity <= NOW() - INTERVAL '100 minutes')
             THEN '100_min'::varchar
        WHEN (last_100_min_sent IS NOT NULL AND last_100_min_sent >= last_activity)
             AND (last_18_hour_sent IS NULL OR last_18_hour_sent < last_activity)
             AND (last_activity <= NOW() - INTERVAL '18 hours')
             THEN '18_hour'::varchar
    END as email_to_send
FROM user_cart_summary
WHERE 
    ((last_100_min_sent IS NULL OR last_100_min_sent < last_activity)
     AND (last_activity <= NOW() - INTERVAL '100 minutes'))
    OR 
    ((last_100_min_sent IS NOT NULL AND last_100_min_sent >= last_activity)
     AND (last_18_hour_sent IS NULL OR last_18_hour_sent < last_activity)
     AND (last_activity <= NOW() - INTERVAL '18 hours'));
