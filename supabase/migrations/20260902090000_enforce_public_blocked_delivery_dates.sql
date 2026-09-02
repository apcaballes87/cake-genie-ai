-- Make global blocked dates visible to the customer availability flow and
-- enforce them at the order boundary.
--
-- blocked_dates intentionally contains internal columns and merchant-scoped
-- rows, so customer clients must use this narrow RPC instead of receiving a
-- broad table SELECT policy.

CREATE OR REPLACE FUNCTION public.get_public_blocked_dates(
    start_date date,
    end_date date
)
RETURNS TABLE (
    blocked_date date,
    closure_reason text,
    is_all_day boolean,
    blocked_time_start time without time zone,
    blocked_time_end time without time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
    SELECT
        bd.blocked_date,
        bd.closure_reason,
        COALESCE(bd.is_all_day, TRUE),
        bd.blocked_time_start,
        bd.blocked_time_end
    FROM public.blocked_dates AS bd
    WHERE bd.is_active IS TRUE
      AND bd.merchant_id IS NULL
      AND bd.blocked_date >= start_date
      AND bd.blocked_date <= end_date
    ORDER BY bd.blocked_date, bd.blocked_time_start NULLS FIRST;
$function$;

REVOKE ALL ON FUNCTION public.get_public_blocked_dates(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_blocked_dates(date, date) TO anon, authenticated, service_role;

-- The customer-facing availability RPC must see the same global rows even
-- though it is called by anonymous visitors.
CREATE OR REPLACE FUNCTION public.get_available_delivery_dates(
    start_date date DEFAULT NULL::date,
    num_days integer DEFAULT 30
)
RETURNS TABLE (
    available_date date,
    day_of_week text,
    is_rush_available boolean,
    is_same_day_available boolean,
    is_standard_available boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    settings_record record;
    check_start_date date;
BEGIN
    SELECT * INTO settings_record
    FROM public.availability_settings
    WHERE setting_id = '00000000-0000-0000-0000-000000000001'
    LIMIT 1;

    IF start_date IS NULL THEN
        check_start_date := timezone('Asia/Manila', now())::date;
    ELSE
        check_start_date := start_date;
    END IF;

    RETURN QUERY
    SELECT
        d.date_val::date AS available_date,
        to_char(d.date_val, 'Day') AS day_of_week,
        (
            NOT EXISTS (
                SELECT 1
                FROM public.blocked_dates AS bd
                WHERE bd.blocked_date = d.date_val::date
                  AND bd.is_active IS TRUE
                  AND bd.merchant_id IS NULL
                  AND coalesce(bd.is_all_day, TRUE)
            )
            AND NOT settings_record.rush_to_same_day_enabled
            AND NOT settings_record.rush_same_to_standard_enabled
            AND (d.date_val::date - timezone('Asia/Manila', now())::date) >= settings_record.minimum_lead_time_days
        ) AS is_rush_available,
        (
            NOT EXISTS (
                SELECT 1
                FROM public.blocked_dates AS bd
                WHERE bd.blocked_date = d.date_val::date
                  AND bd.is_active IS TRUE
                  AND bd.merchant_id IS NULL
                  AND coalesce(bd.is_all_day, TRUE)
            )
            AND NOT settings_record.rush_same_to_standard_enabled
            AND (d.date_val::date - timezone('Asia/Manila', now())::date) >= settings_record.minimum_lead_time_days
        ) AS is_same_day_available,
        (
            NOT EXISTS (
                SELECT 1
                FROM public.blocked_dates AS bd
                WHERE bd.blocked_date = d.date_val::date
                  AND bd.is_active IS TRUE
                  AND bd.merchant_id IS NULL
                  AND coalesce(bd.is_all_day, TRUE)
            )
            AND (d.date_val::date - timezone('Asia/Manila', now())::date) >= greatest(settings_record.minimum_lead_time_days, 3)
        ) AS is_standard_available
    FROM generate_series(
        check_start_date::timestamp,
        (check_start_date + (num_days || ' days')::interval)::timestamp,
        '1 day'::interval
    ) AS d(date_val)
    WHERE d.date_val::date >= check_start_date
    ORDER BY d.date_val;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_available_delivery_dates(date, integer) TO anon, authenticated, service_role;

-- Keep the order boundary fail-closed for both regular and split/downpayment
-- order paths. The fixed customer time slots are mirrored here so partial
-- blocked-date records remain enforced even when a client is stale or bypassed.
CREATE OR REPLACE FUNCTION public.is_delivery_slot_blocked(
    p_delivery_date date,
    p_delivery_time_slot text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
    WITH slot_bounds AS (
        SELECT
            CASE p_delivery_time_slot
                WHEN '10AM - 12NN' THEN time '10:00'
                WHEN '12NN - 2PM' THEN time '12:00'
                WHEN '2PM - 4PM' THEN time '14:00'
                WHEN '4PM - 6PM' THEN time '16:00'
                WHEN '6PM - 8PM' THEN time '18:00'
            END AS slot_start,
            CASE p_delivery_time_slot
                WHEN '10AM - 12NN' THEN time '12:00'
                WHEN '12NN - 2PM' THEN time '14:00'
                WHEN '2PM - 4PM' THEN time '16:00'
                WHEN '4PM - 6PM' THEN time '18:00'
                WHEN '6PM - 8PM' THEN time '20:00'
            END AS slot_end
    )
    SELECT EXISTS (
        SELECT 1
        FROM public.blocked_dates AS bd
        CROSS JOIN slot_bounds AS slots
        WHERE bd.blocked_date = p_delivery_date
          AND bd.is_active IS TRUE
          AND bd.merchant_id IS NULL
          AND (
              coalesce(bd.is_all_day, TRUE)
              OR (
                  bd.blocked_time_start IS NOT NULL
                  AND bd.blocked_time_end IS NOT NULL
                  AND slots.slot_start IS NOT NULL
                  AND slots.slot_end IS NOT NULL
                  AND slots.slot_start < bd.blocked_time_end
                  AND slots.slot_end > bd.blocked_time_start
              )
          )
    );
$function$;

REVOKE ALL ON FUNCTION public.is_delivery_slot_blocked(date, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.reject_blocked_delivery_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    IF public.is_delivery_slot_blocked(NEW.delivery_date, NEW.delivery_time_slot) THEN
        RAISE EXCEPTION 'The selected delivery date or time is no longer available. Please choose another date or time.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.reject_blocked_delivery_order() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_blocked_delivery_order ON public.cakegenie_orders;
CREATE TRIGGER enforce_blocked_delivery_order
    BEFORE INSERT OR UPDATE OF delivery_date, delivery_time_slot
    ON public.cakegenie_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_blocked_delivery_order();
