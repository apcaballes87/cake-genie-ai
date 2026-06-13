-- Migration: create eligible abandoned carts view
-- File: supabase/migrations/20260613093000_create_eligible_abandoned_carts_view.sql

CREATE OR REPLACE VIEW public.cakegenie_eligible_abandoned_carts AS
WITH user_cart_activity AS (
    SELECT 
        c.user_id,
        u.email,
        u.first_name,
        MAX(COALESCE(c.updated_at, c.created_at)) as last_activity
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
),
sent_emails AS (
    SELECT 
        user_id,
        MAX(CASE WHEN email_type = '100_min' THEN sent_at END) as last_100_min_sent,
        MAX(CASE WHEN email_type = '18_hour' THEN sent_at END) as last_18_hour_sent
    FROM public.cakegenie_abandoned_cart_emails
    GROUP BY user_id
)
SELECT 
    a.user_id,
    a.email as recipient_email,
    a.first_name,
    a.last_activity,
    CASE 
        -- 100-minute rule: activity older than 100 mins, and no 100-min email sent since that activity
        WHEN a.last_activity <= NOW() - INTERVAL '100 minutes' 
             AND a.last_activity > NOW() - INTERVAL '18 hours'
             AND (s.last_100_min_sent IS NULL OR s.last_100_min_sent < a.last_activity)
             THEN '100_min'::varchar
        
        -- 18-hour rule: activity older than 18 hours, and no 18-hour email sent since that activity
        WHEN a.last_activity <= NOW() - INTERVAL '18 hours'
             AND (s.last_18_hour_sent IS NULL OR s.last_18_hour_sent < a.last_activity)
             THEN '18_hour'::varchar
    END as email_to_send
FROM user_cart_activity a
LEFT JOIN sent_emails s ON a.user_id = s.user_id
WHERE 
    (
        a.last_activity <= NOW() - INTERVAL '100 minutes' 
        AND a.last_activity > NOW() - INTERVAL '18 hours'
        AND (s.last_100_min_sent IS NULL OR s.last_100_min_sent < a.last_activity)
    ) OR (
        a.last_activity <= NOW() - INTERVAL '18 hours'
        AND (s.last_18_hour_sent IS NULL OR s.last_18_hour_sent < a.last_activity)
    );
