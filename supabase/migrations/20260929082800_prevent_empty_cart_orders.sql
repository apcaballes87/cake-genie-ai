-- Fail closed when checkout refers to cart rows that were never saved or no
-- longer belong to the current owner. Row locks keep those rows available
-- until the order items are copied in the same transaction.
CREATE OR REPLACE FUNCTION public.assert_checkout_cart_items(
    p_user_id uuid,
    p_cart_item_ids text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_owned_item_count integer;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Cart owner is required to create an order.';
    END IF;

    IF p_cart_item_ids IS NULL OR cardinality(p_cart_item_ids) = 0 THEN
        RAISE EXCEPTION 'At least one saved cart item is required to create an order.';
    END IF;

    IF cardinality(p_cart_item_ids) <> (
        SELECT count(DISTINCT requested.cart_item_id)
        FROM unnest(p_cart_item_ids) AS requested(cart_item_id)
        WHERE requested.cart_item_id IS NOT NULL
          AND btrim(requested.cart_item_id) <> ''
    ) THEN
        RAISE EXCEPTION 'The cart item list is invalid. Refresh your cart and try again.';
    END IF;

    PERFORM cart.cart_item_id
    FROM public.cakegenie_cart AS cart
    WHERE cart.cart_item_id::text = ANY(p_cart_item_ids)
      AND (cart.user_id = p_user_id OR cart.session_id = p_user_id::text)
      AND cart.expires_at > NOW()
      AND cart.customized_image_url ~* '^https?://'
    ORDER BY cart.cart_item_id
    FOR UPDATE OF cart;

    SELECT count(DISTINCT requested.cart_item_id)
    INTO v_owned_item_count
    FROM unnest(p_cart_item_ids) AS requested(cart_item_id)
    JOIN public.cakegenie_cart AS cart
      ON cart.cart_item_id::text = requested.cart_item_id
    WHERE (cart.user_id = p_user_id OR cart.session_id = p_user_id::text)
      AND cart.expires_at > NOW()
      AND cart.customized_image_url ~* '^https?://';

    IF v_owned_item_count <> cardinality(p_cart_item_ids) THEN
        RAISE EXCEPTION 'One or more cakes are still being saved or are no longer in your cart. Refresh your cart and try again.';
    END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_checkout_cart_items(uuid, text[])
    FROM PUBLIC, anon, authenticated;

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
    v_buyer_attribution jsonb := COALESCE(p_buyer_attribution, '{}'::jsonb);
    v_order_item_count integer;
BEGIN
    PERFORM public.assert_checkout_cart_items(p_user_id, p_cart_item_ids);

    v_calculated_discount := public.calculate_discount_for_order(
        p_discount_code_id,
        p_user_id,
        p_subtotal,
        p_cart_item_ids
    );

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
    FROM public.cakegenie_cart AS cart
    WHERE (cart.user_id = p_user_id OR cart.session_id = p_user_id::text)
      AND cart.expires_at > NOW()
      AND cart.customized_image_url ~* '^https?://'
      AND cart.cart_item_id::text = ANY(p_cart_item_ids);

    GET DIAGNOSTICS v_order_item_count = ROW_COUNT;
    IF v_order_item_count <> cardinality(p_cart_item_ids) THEN
        RAISE EXCEPTION 'The cart changed before the order was created. Refresh your cart and try again.';
    END IF;

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
    v_calculated_discount numeric := 0;
    v_now_manila_date date := timezone('Asia/Manila', now())::date;
    v_buyer_attribution jsonb := COALESCE(p_buyer_attribution, '{}'::jsonb);
    v_order_item_count integer;
BEGIN
    IF p_split_message = 'downpayment_50'
       AND p_delivery_date < (v_now_manila_date + 3) THEN
        RAISE EXCEPTION 'A minimum of 3 days lead time is required for 50%% downpayments.';
    END IF;

    PERFORM public.assert_checkout_cart_items(p_user_id, p_cart_item_ids);

    v_calculated_discount := public.calculate_discount_for_order(
        p_discount_code_id,
        p_user_id,
        p_subtotal,
        p_cart_item_ids
    );

    v_total_amount := GREATEST(0, p_subtotal + p_delivery_fee - v_calculated_discount);
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');

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
        v_calculated_discount, p_discount_code_id, v_total_amount, 'pending',
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
    FROM public.cakegenie_cart AS cart
    WHERE (cart.user_id = p_user_id OR cart.session_id = p_user_id::text)
      AND cart.expires_at > NOW()
      AND cart.customized_image_url ~* '^https?://'
      AND cart.cart_item_id::text = ANY(p_cart_item_ids);

    GET DIAGNOSTICS v_order_item_count = ROW_COUNT;
    IF v_order_item_count <> cardinality(p_cart_item_ids) THEN
        RAISE EXCEPTION 'The cart changed before the order was created. Refresh your cart and try again.';
    END IF;

    RETURN QUERY SELECT v_order_id, v_order_number;
END;
$function$;
