ALTER TABLE public.cakegenie_orders
  ADD COLUMN IF NOT EXISTS buyer_attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS buyer_first_touch_source text,
  ADD COLUMN IF NOT EXISTS buyer_first_touch_medium text,
  ADD COLUMN IF NOT EXISTS buyer_first_touch_campaign text,
  ADD COLUMN IF NOT EXISTS buyer_purchase_session_source text,
  ADD COLUMN IF NOT EXISTS buyer_purchase_session_medium text,
  ADD COLUMN IF NOT EXISTS buyer_purchase_session_campaign text,
  ADD COLUMN IF NOT EXISTS ga_purchase_mirrored_at timestamptz;

DROP FUNCTION IF EXISTS public.create_order_from_cart(
    uuid, uuid, date, text, numeric, numeric, text, numeric, uuid, text, text, text, text, numeric, numeric, text[], boolean
);

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
        user_id,
        order_number,
        delivery_address_id,
        delivery_date,
        delivery_time_slot,
        delivery_instructions,
        subtotal,
        delivery_fee,
        discount_amount,
        discount_code_id,
        total_amount,
        order_status,
        payment_status,
        recipient_name,
        delivery_phone,
        delivery_address,
        delivery_city,
        delivery_latitude,
        delivery_longitude,
        buyer_attribution,
        buyer_first_touch_source,
        buyer_first_touch_medium,
        buyer_first_touch_campaign,
        buyer_purchase_session_source,
        buyer_purchase_session_medium,
        buyer_purchase_session_campaign
    )
    VALUES (
        p_user_id,
        v_order_number,
        p_delivery_address_id,
        p_delivery_date,
        p_delivery_time_slot,
        p_delivery_instructions,
        p_subtotal,
        p_delivery_fee,
        v_calculated_discount,
        p_discount_code_id,
        v_total_amount,
        'pending',
        'pending',
        p_recipient_name,
        p_recipient_phone,
        p_delivery_address,
        p_delivery_city,
        p_delivery_latitude,
        p_delivery_longitude,
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
        order_id,
        cake_type,
        cake_thickness,
        cake_size,
        base_price,
        addon_price,
        final_price,
        quantity,
        original_image_url,
        customized_image_url,
        customization_details
    )
    SELECT
        v_order_id,
        cart.cake_type,
        cart.cake_thickness,
        cart.cake_size,
        cart.base_price,
        cart.addon_price,
        cart.final_price,
        cart.quantity,
        cart.original_image_url,
        cart.customized_image_url,
        cart.customization_details
    FROM public.cakegenie_cart cart
    WHERE (cart.user_id = p_user_id OR cart.session_id = p_user_id::text)
      AND cart.expires_at > NOW()
      AND (
        p_cart_item_ids IS NULL
        OR cart.cart_item_id::text = ANY(p_cart_item_ids)
      );

    IF p_clear_cart THEN
        DELETE FROM public.cakegenie_cart
         WHERE (user_id = p_user_id OR session_id = p_user_id::text)
           AND expires_at > NOW()
           AND (
             p_cart_item_ids IS NULL
             OR cart_item_id::text = ANY(p_cart_item_ids)
           );
    END IF;

    IF p_discount_code_id IS NOT NULL THEN
        INSERT INTO public.discount_code_usage (
            discount_code_id,
            user_id,
            order_id,
            discount_amount_applied
        )
        VALUES (
            p_discount_code_id,
            p_user_id,
            v_order_id,
            v_calculated_discount
        );

        UPDATE public.discount_codes
           SET times_used = times_used + 1
         WHERE code_id = p_discount_code_id;
    END IF;

    RETURN QUERY SELECT v_order_id, v_order_number;
END;
$function$;

COMMENT ON FUNCTION public.create_order_from_cart IS
    'Creates an order from cart items with secure server-side discount validation and buyer attribution capture. '
    'Cart rows are kept on the server by default (p_clear_cart=FALSE) so abandoned '
    'checkouts can be recovered. The xendit-webhook / verify-xendit-payment edge '
    'functions call clear_cart_for_paid_order() after the order is paid to actually '
    'clear the cart. Pass p_clear_cart=TRUE for callers that want the legacy '
    'immediate-clear behavior.';

DROP FUNCTION IF EXISTS public.create_split_order_from_cart(
    uuid, uuid, date, text, numeric, numeric, text, numeric, uuid, text, text, text, text, numeric, numeric, boolean, text, integer, text[]
);

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
        user_id,
        order_number,
        delivery_address_id,
        delivery_date,
        delivery_time_slot,
        delivery_instructions,
        subtotal,
        delivery_fee,
        discount_amount,
        discount_code_id,
        total_amount,
        order_status,
        payment_status,
        recipient_name,
        delivery_phone,
        delivery_address,
        delivery_city,
        delivery_latitude,
        delivery_longitude,
        is_split_order,
        split_message,
        split_count,
        organizer_user_id,
        amount_collected,
        buyer_attribution,
        buyer_first_touch_source,
        buyer_first_touch_medium,
        buyer_first_touch_campaign,
        buyer_purchase_session_source,
        buyer_purchase_session_medium,
        buyer_purchase_session_campaign
    )
    VALUES (
        p_user_id,
        v_order_number,
        p_delivery_address_id,
        p_delivery_date,
        p_delivery_time_slot,
        p_delivery_instructions,
        p_subtotal,
        p_delivery_fee,
        p_discount_amount,
        p_discount_code_id,
        v_total_amount,
        'pending',
        'pending',
        p_recipient_name,
        p_recipient_phone,
        p_delivery_address,
        p_delivery_city,
        p_delivery_latitude,
        p_delivery_longitude,
        p_is_split_order,
        p_split_message,
        p_split_count,
        CASE WHEN p_is_split_order THEN p_user_id ELSE NULL END,
        0,
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
        order_id,
        cake_type,
        cake_thickness,
        cake_size,
        base_price,
        addon_price,
        final_price,
        quantity,
        original_image_url,
        customized_image_url,
        customization_details
    )
    SELECT
        v_order_id,
        cart.cake_type,
        cart.cake_thickness,
        cart.cake_size,
        cart.base_price,
        cart.addon_price,
        cart.final_price,
        cart.quantity,
        cart.original_image_url,
        cart.customized_image_url,
        cart.customization_details
    FROM public.cakegenie_cart cart
    WHERE (cart.user_id = p_user_id OR cart.session_id = p_user_id::text)
      AND cart.expires_at > NOW()
      AND (
        p_cart_item_ids IS NULL
        OR cart.cart_item_id::text = ANY(p_cart_item_ids)
      );

    DELETE FROM public.cakegenie_cart
    WHERE (user_id = p_user_id OR session_id = p_user_id::text)
      AND expires_at > NOW()
      AND (
        p_cart_item_ids IS NULL
        OR cart_item_id::text = ANY(p_cart_item_ids)
      );

    IF p_discount_code_id IS NOT NULL THEN
        INSERT INTO public.discount_code_usage (
            discount_code_id,
            user_id,
            order_id,
            discount_amount_applied
        )
        VALUES (
            p_discount_code_id,
            p_user_id,
            v_order_id,
            p_discount_amount
        );

        UPDATE public.discount_codes
           SET times_used = times_used + 1
         WHERE code_id = p_discount_code_id;
    END IF;

    RETURN QUERY SELECT v_order_id, v_order_number;
END;
$function$;
