-- Migration: Hourly cleanup of abandoned pending orders
-- Date: 2026-06-12
--
-- BACKGROUND
-- With cart-persistence fixed, abandoned `payment_status='pending'` orders
-- pile up cleanly in `cakegenie_orders` until the user pays OR the Xendit
-- invoice expires (default 24h). Stale pending orders:
--   * Skew admin dashboards.
--   * Hold the `discount_codes.times_used` counter — `create_order_from_cart`
--     already incremented it when the abandoned order was created (see
--     20260109_secure_create_order.sql line 211-213), and a re-pay uses a
--     new invoice but the discount slot has already been burned.
--   * Confuse the user when they re-visit My Orders and see multiple
--     pending entries from abandoned attempts.
--
-- This migration installs pg_cron (if not already present) and schedules a
-- single SQL job that runs at the top of every hour. The job:
--   1. Cancels `cakegenie_orders` rows where `payment_status='pending'`
--      (or the defensive `'awaiting_payment'`) and `updated_at < now() -
--      interval '24 hours'`. Sets `order_status='cancelled'`,
--      `payment_status='expired'`, `cancelled_at=now()`. The row is NOT
--      deleted — the audit trail is preserved.
--   2. Decrements `discount_codes.times_used` for any cancelled order
--      that had a `discount_code_id` — mirroring the increment path
--      inside `create_order_from_cart`.
--
-- Idempotency: both UPDATEs are gated on the current `payment_status`
-- value, so re-running the cleanup is a no-op on already-cancelled rows.

-- ---------------------------------------------------------------------------
-- 1. Make sure pg_cron is available
-- ---------------------------------------------------------------------------
-- Supabase exposes pg_cron on the project's `postgres` database but does
-- not preinstall it. `CREATE EXTENSION IF NOT EXISTS` is a no-op when
-- the extension is already registered.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- ---------------------------------------------------------------------------
-- 1b. Extend the payment_status CHECK constraint to allow 'expired'
-- ---------------------------------------------------------------------------
-- The legacy constraint only allows (pending, verifying, partial, paid,
-- refunded, failed). Adding 'expired' lets us mark abandoned orders as
-- such without overloading 'failed' (which means "payment attempt
-- rejected" — a different lifecycle event).
DO $$
BEGIN
    ALTER TABLE public.cakegenie_orders
        DROP CONSTRAINT IF EXISTS cakegenie_orders_payment_status_check;

    ALTER TABLE public.cakegenie_orders
        ADD CONSTRAINT cakegenie_orders_payment_status_check
        CHECK (
            payment_status IS NULL
            OR payment_status = ANY (ARRAY[
                'pending',
                'verifying',
                'partial',
                'paid',
                'refunded',
                'failed',
                'expired'
            ])
        );
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Helper function: do the actual cancel + discount refund
-- ---------------------------------------------------------------------------
-- Split out from the cron job so it can be invoked manually for
-- back-fills / incident response without touching cron.schedule.
CREATE OR REPLACE FUNCTION public.cleanup_abandoned_pending_orders(
    p_age interval DEFAULT interval '24 hours'
)
RETURNS TABLE(
    cancelled_count  integer,
    refunded_count   integer,
    refunded_codes   jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_cancelled_count  integer := 0;
    v_refunded_count   integer := 0;
    v_refunded_codes   jsonb   := '[]'::jsonb;
BEGIN
    -- 2a. Capture the discount codes that need to be refunded BEFORE we
    --     mutate the order rows. We need a stable list of distinct
    --     discount_code_ids that we're about to expire.
    --
    --     Using a TEMP TABLE keeps things simple and avoids correlated
    --     subquery pitfalls. The aggregate of `count(*)` per code is the
    --     amount to refund: one decrement per abandoned order.
    CREATE TEMP TABLE _cleanup_refund_codes (
        discount_code_id  uuid PRIMARY KEY,
        refund_amount     integer NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO _cleanup_refund_codes (discount_code_id, refund_amount)
    SELECT
        o.discount_code_id,
        COUNT(*)::integer
    FROM public.cakegenie_orders o
    WHERE o.payment_status IN ('pending', 'awaiting_payment')
      AND o.updated_at < NOW() - p_age
      AND o.discount_code_id IS NOT NULL
    GROUP BY o.discount_code_id;

    GET DIAGNOSTICS v_refunded_count = ROW_COUNT;

    -- 2b. Cancel the matching orders. The WHERE clause mirrors the
    --     cron guard so the function is safe to re-run.
    UPDATE public.cakegenie_orders
    SET
        order_status   = 'cancelled',
        payment_status = 'expired',
        cancelled_at   = NOW(),
        updated_at     = NOW()
    WHERE payment_status IN ('pending', 'awaiting_payment')
      AND updated_at < NOW() - p_age;

    GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;

    -- 2c. Refund the discount counters, floored at zero to be defensive
    --     (in case the increment path was ever skipped, we never go
    --     negative — a code is never "more free" than its max).
    WITH refunded AS (
        UPDATE public.discount_codes dc
        SET times_used = GREATEST(0, dc.times_used - rc.refund_amount)
        FROM _cleanup_refund_codes rc
        WHERE dc.code_id = rc.discount_code_id
        RETURNING dc.code_id
    )
    SELECT COALESCE(jsonb_agg(code_id), '[]'::jsonb)
      INTO v_refunded_codes
      FROM refunded;

    -- 2d. Operator-visible summary
    RAISE NOTICE 'cleanup_abandoned_pending_orders: cancelled % order(s), refunded % discount code slot(s) (codes: %)',
        v_cancelled_count, v_refunded_count, v_refunded_codes;

    cancelled_count := v_cancelled_count;
    refunded_count  := v_refunded_count;
    refunded_codes  := v_refunded_codes;

    RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.cleanup_abandoned_pending_orders(interval) IS
    'Cancels cakegenie_orders rows whose payment_status has been pending/awaiting_payment for longer than the given age, and decrements discount_codes.times_used for each abandoned order that had a discount applied. Idempotent: re-running on the same set is a no-op.';

-- ---------------------------------------------------------------------------
-- 3. Schedule the hourly cron job
-- ---------------------------------------------------------------------------
-- Cron expression: `0 * * * *` = at minute 0 of every hour.
-- We use a dollar-quoted body so we don't have to escape single quotes.
SELECT cron.schedule(
    'cleanup-abandoned-orders',
    '0 * * * *',
    $cron$
        SELECT cancelled_count
        FROM public.cleanup_abandoned_pending_orders(interval '24 hours');
    $cron$
);

-- ---------------------------------------------------------------------------
-- DOWN / OPS NOTES (Supabase migration history is one-way; the schedule
-- can be removed manually if needed)
-- ---------------------------------------------------------------------------
--   -- List current jobs (verify the schedule was created):
--   SELECT * FROM cron.job WHERE jobname = 'cleanup-abandoned-orders';
--
--   -- Inspect last 20 runs:
--   SELECT runid, start_time, end_time, status, return_message
--     FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-abandoned-orders')
--    ORDER BY start_time DESC
--    LIMIT 20;
--
--   -- Manual back-fill (e.g. clear out a backlog of 48h-old pending orders):
--   SELECT * FROM public.cleanup_abandoned_pending_orders(interval '48 hours');
--
--   -- UNDO the schedule (Supabase does not run down-migrations):
--   SELECT cron.unschedule('cleanup-abandoned-orders');
--   -- Optionally drop the helper:
--   -- DROP FUNCTION IF EXISTS public.cleanup_abandoned_pending_orders(interval);
