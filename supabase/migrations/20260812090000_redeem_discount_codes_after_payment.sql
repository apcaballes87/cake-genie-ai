-- Redeem discount codes only after a payment confirms the order.
-- Pending checkouts retain their discount on the order but do not consume it.

CREATE OR REPLACE FUNCTION public.create_order_from_cart(
    p_user_id uuid,
    p_delivery_address_id uuid,
    p_delivery_date date,
    p_delivery_time_slot text,
    p_subtotal numeric,
    p_delivery_fee numeric,
    p_delivery_instructions text DEFAULT NULL::text,
    p_discount_amount numeric DEFAULT 0,
    p_discount_code_id uuid DEFAULT NULL::uuid,
    p_recipient_name text DEFAULT NULL::text,
    p_recipient_phone text DEFAULT NULL::text,
    p_delivery_address text DEFAULT NULL::text,
    p_delivery_city text DEFAULT NULL::text,
    p_delivery_latitude numeric DEFAULT NULL::numeric,
    p_delivery_longitude numeric DEFAULT NULL::numeric,
    p_cart_item_ids text[] DEFAULT NULL::text[],
    p_clear_cart boolean DEFAULT FALSE,
    p_buyer_attribution jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_order_id uuid;
    v_order_number text;
    v_total_amount numeric;
    v_calculated_discount numeric := 0;
    v_discount_record record;
    v_base_amount numeric;
    v_buyer_attribution jsonb := COALESCE(p_buyer_attribution, '{}'::jsonb);
BEGIN
    v_base_amount := p_subtotal;

    IF p_discount_code_id IS NOT NULL THEN
        SELECT *
          INTO v_discount_record
          FROM public.discount_codes
         WHERE code_id = p_discount_code_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid discount code ID provided';
        END IF;

        IF v_discount_record.is_active IS FALSE THEN
            RAISE EXCEPTION 'Discount code is not active';
        END IF;

        IF v_discount_record.expires_at IS NOT NULL
           AND v_discount_record.expires_at < NOW() THEN
            RAISE EXCEPTION 'Discount code has expired';
        END IF;

        IF v_discount_record.max_uses IS NOT NULL
           AND v_discount_record.times_used >= v_discount_record.max_uses THEN
            RAISE EXCEPTION 'Discount code usage limit reached';
        END IF;

        IF v_discount_record.minimum_order_amount IS NOT NULL
           AND p_subtotal < v_discount_record.minimum_order_amount THEN
            RAISE EXCEPTION 'Minimum order amount of % required', v_discount_record.minimum_order_amount;
        END IF;

        IF v_discount_record.user_id IS NOT NULL
           AND v_discount_record.user_id != p_user_id THEN
            RAISE EXCEPTION 'This discount code is not valid for this user';
        END IF;

        IF v_discount_record.discount_amount IS NOT NULL THEN
            v_calculated_discount := v_discount_record.discount_amount;
        ELSIF v_discount_record.discount_percentage IS NOT NULL THEN
            v_calculated_discount := (v_base_amount * v_discount_record.discount_percentage) / 100;
        END IF;

        v_calculated_discount := LEAST(v_calculated_discount, p_subtotal + p_delivery_fee);
    END IF;

    v_total_amount := GREATEST(0, p_subtotal + p_delivery_fee - v_calculated_discount);
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');

    INSERT INTO public.cakegenie_orders (
        user_id, order_number, delivery_address_id, delivery_date,
        delivery_time_slot, delivery_instructions, subtotal, delivery_fee,
        discount_amount, discount_code_id, total_amount, order_status,
        payment_status, recipient_name, delivery_phone, delivery_address,
        delivery_city, delivery_latitude, delivery_longitude, buyer_attribution,
        buyer_first_touch_source, buyer_first_touch_medium, buyer_first_touch_campaign,
        buyer_purchase_session_source, buyer_purchase_session_medium,
        buyer_purchase_session_campaign
    )
    VALUES (
        p_user_id, v_order_number, p_delivery_address_id, p_delivery_date,
        p_delivery_time_slot, p_delivery_instructions, p_subtotal, p_delivery_fee,
        v_calculated_discount, p_discount_code_id, v_total_amount, 'pending',
        'pending', p_recipient_name, p_recipient_phone, p_delivery_address,
        p_delivery_city, p_delivery_latitude, p_delivery_longitude, v_buyer_attribution,
        NULLIF(BTRIM(v_buyer_attribution #>> '{firstTouch,source}'), ''),
        NULLIF(BTRIM(v_buyer_attribution #>> '{firstTouch,medium}'), ''),
        NULLIF(BTRIM(v_buyer_attribution #>> '{firstTouch,campaign}'), ''),
        NULLIF(BTRIM(v_buyer_attribution #>> '{purchaseSession,source}'), ''),
        NULLIF(BTRIM(v_buyer_attribution #>> '{purchaseSession,medium}'), ''),
        NULLIF(BTRIM(v_buyer_attribution #>> '{purchaseSession,campaign}'), '')
    )
    RETURNING cakegenie_orders.order_id INTO v_order_id;

    INSERT INTO public.cakegenie_order_items (
        order_id, source_cart_item_id, cake_type, cake_thickness, cake_size,
        base_price, addon_price, final_price, quantity, original_image_url,
        customized_image_url, customization_details
    )
    SELECT
        v_order_id, cart.cart_item_id, cart.cake_type, cart.cake_thickness,
        cart.cake_size, cart.base_price, cart.addon_price, cart.final_price,
        cart.quantity, cart.original_image_url, cart.customized_image_url,
        cart.customization_details
    FROM public.cakegenie_cart cart
    WHERE (cart.user_id = p_user_id OR cart.session_id = p_user_id::text)
      AND cart.expires_at > NOW()
      AND (p_cart_item_ids IS NULL OR cart.cart_item_id::text = ANY(p_cart_item_ids));

    RETURN QUERY SELECT v_order_id, v_order_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_split_order_from_cart(
    p_user_id uuid,
    p_delivery_address_id uuid,
    p_delivery_date date,
    p_delivery_time_slot text,
    p_subtotal numeric,
    p_delivery_fee numeric,
    p_delivery_instructions text DEFAULT NULL::text,
    p_discount_amount numeric DEFAULT 0,
    p_discount_code_id uuid DEFAULT NULL::uuid,
    p_recipient_name text DEFAULT NULL::text,
    p_recipient_phone text DEFAULT NULL::text,
    p_delivery_address text DEFAULT NULL::text,
    p_delivery_city text DEFAULT NULL::text,
    p_delivery_latitude numeric DEFAULT NULL::numeric,
    p_delivery_longitude numeric DEFAULT NULL::numeric,
    p_is_split_order boolean DEFAULT false,
    p_split_message text DEFAULT NULL::text,
    p_split_count integer DEFAULT NULL::integer,
    p_cart_item_ids text[] DEFAULT NULL::text[],
    p_buyer_attribution jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_order_id uuid;
    v_order_number text;
    v_total_amount numeric;
    v_now_manila_date date := timezone('Asia/Manila', now())::date;
    v_buyer_attribution jsonb := COALESCE(p_buyer_attribution, '{}'::jsonb);
BEGIN
    IF p_split_message = 'downpayment_50'
       AND p_delivery_date < (v_now_manila_date + 3) THEN
        RAISE EXCEPTION 'A minimum of 3 days lead time is required for 50%% downpayments.';
    END IF;

    v_total_amount := p_subtotal + p_delivery_fee - p_discount_amount;
    v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 99999)::text, 5, '0');

    INSERT INTO public.cakegenie_orders (
        user_id, order_number, delivery_address_id, delivery_date,
        delivery_time_slot, delivery_instructions, subtotal, delivery_fee,
        discount_amount, discount_code_id, total_amount, order_status,
        payment_status, recipient_name, delivery_phone, delivery_address,
        delivery_city, delivery_latitude, delivery_longitude, is_split_order,
        split_message, split_count, organizer_user_id, amount_collected,
        buyer_attribution, buyer_first_touch_source, buyer_first_touch_medium,
        buyer_first_touch_campaign, buyer_purchase_session_source,
        buyer_purchase_session_medium, buyer_purchase_session_campaign
    )
    VALUES (
        p_user_id, v_order_number, p_delivery_address_id, p_delivery_date,
        p_delivery_time_slot, p_delivery_instructions, p_subtotal, p_delivery_fee,
        p_discount_amount, p_discount_code_id, v_total_amount, 'pending',
        'pending', p_recipient_name, p_recipient_phone, p_delivery_address,
        p_delivery_city, p_delivery_latitude, p_delivery_longitude,
        p_is_split_order, p_split_message, p_split_count,
        CASE WHEN p_is_split_order THEN p_user_id ELSE NULL END, 0,
        v_buyer_attribution,
        NULLIF(BTRIM(v_buyer_attribution #>> '{firstTouch,source}'), ''),
        NULLIF(BTRIM(v_buyer_attribution #>> '{firstTouch,medium}'), ''),
        NULLIF(BTRIM(v_buyer_attribution #>> '{firstTouch,campaign}'), ''),
        NULLIF(BTRIM(v_buyer_attribution #>> '{purchaseSession,source}'), ''),
        NULLIF(BTRIM(v_buyer_attribution #>> '{purchaseSession,medium}'), ''),
        NULLIF(BTRIM(v_buyer_attribution #>> '{purchaseSession,campaign}'), '')
    )
    RETURNING cakegenie_orders.order_id INTO v_order_id;

    INSERT INTO public.cakegenie_order_items (
        order_id, source_cart_item_id, cake_type, cake_thickness, cake_size,
        base_price, addon_price, final_price, quantity, original_image_url,
        customized_image_url, customization_details
    )
    SELECT
        v_order_id, cart.cart_item_id, cart.cake_type, cart.cake_thickness,
        cart.cake_size, cart.base_price, cart.addon_price, cart.final_price,
        cart.quantity, cart.original_image_url, cart.customized_image_url,
        cart.customization_details
    FROM public.cakegenie_cart cart
    WHERE (cart.user_id = p_user_id OR cart.session_id = p_user_id::text)
      AND cart.expires_at > NOW()
      AND (p_cart_item_ids IS NULL OR cart.cart_item_id::text = ANY(p_cart_item_ids));

    RETURN QUERY SELECT v_order_id, v_order_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_discount_code_on_confirmed_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    IF NEW.discount_code_id IS NULL
       OR NEW.payment_status NOT IN ('paid', 'partial') THEN
        RETURN NEW;
    END IF;

    -- A downpayment can later become fully paid. Count that order only once.
    IF NOT EXISTS (
        SELECT 1
        FROM public.discount_code_usage usage
        WHERE usage.discount_code_id = NEW.discount_code_id
          AND usage.order_id = NEW.order_id
    ) THEN
        INSERT INTO public.discount_code_usage (
            discount_code_id,
            user_id,
            order_id,
            discount_amount_applied
        )
        VALUES (
            NEW.discount_code_id,
            NEW.user_id,
            NEW.order_id,
            COALESCE(NEW.discount_amount, 0)
        );

        UPDATE public.discount_codes
           SET times_used = times_used + 1
         WHERE code_id = NEW.discount_code_id;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS redeem_discount_code_on_confirmed_payment
    ON public.cakegenie_orders;

CREATE TRIGGER redeem_discount_code_on_confirmed_payment
AFTER UPDATE OF payment_status ON public.cakegenie_orders
FOR EACH ROW
EXECUTE FUNCTION public.redeem_discount_code_on_confirmed_payment();

-- One-time correction for old pending/failed attempts that were recorded as
-- redeemed before this migration. Paid, partial, and refunded uses stay put.
CREATE TEMP TABLE discount_codes_to_recount (
    code_id uuid PRIMARY KEY
) ON COMMIT DROP;

WITH released_usage AS (
    DELETE FROM public.discount_code_usage usage
    USING public.cakegenie_orders orders
    WHERE orders.order_id = usage.order_id
      AND COALESCE(orders.payment_status, '') NOT IN ('paid', 'partial', 'refunded')
    RETURNING usage.discount_code_id
)
INSERT INTO discount_codes_to_recount (code_id)
SELECT DISTINCT discount_code_id
FROM released_usage;

UPDATE public.discount_codes code
SET times_used = (
    SELECT COUNT(*)
    FROM public.discount_code_usage usage
    JOIN public.cakegenie_orders orders
      ON orders.order_id = usage.order_id
    WHERE usage.discount_code_id = code.code_id
      AND orders.payment_status IN ('paid', 'partial', 'refunded')
)
WHERE code.code_id IN (SELECT code_id FROM discount_codes_to_recount);

-- Pending orders no longer increment discount counters, so expiry cleanup
-- only cancels stale orders and preserves its existing result contract.
CREATE OR REPLACE FUNCTION public.cleanup_abandoned_pending_orders(
    p_age interval DEFAULT interval '24 hours'
)
RETURNS TABLE(
    cancelled_count integer,
    refunded_count integer,
    refunded_codes jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
    v_cancelled_count integer := 0;
BEGIN
    UPDATE public.cakegenie_orders
    SET
        order_status = 'cancelled',
        payment_status = 'expired',
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE payment_status IN ('pending', 'awaiting_payment')
      AND updated_at < NOW() - p_age;

    GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;

    cancelled_count := v_cancelled_count;
    refunded_count := 0;
    refunded_codes := '[]'::jsonb;
    RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.cleanup_abandoned_pending_orders(interval) IS
    'Cancels cakegenie_orders rows pending payment longer than the requested age. Pending orders do not redeem discount codes.';
