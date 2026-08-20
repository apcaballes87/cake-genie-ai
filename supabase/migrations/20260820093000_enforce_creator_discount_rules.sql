-- Centralize discount calculation for both regular and split checkout paths.
-- Creator codes are email-bound and can optionally be scoped to cake types.

CREATE OR REPLACE FUNCTION public.calculate_discount_for_order(
    p_discount_code_id UUID,
    p_user_id UUID,
    p_subtotal NUMERIC,
    p_cart_item_ids TEXT[] DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $function$
DECLARE
    v_discount_record RECORD;
    v_customer_email TEXT;
    v_eligible_subtotal NUMERIC;
    v_discount NUMERIC := 0;
BEGIN
    IF p_discount_code_id IS NULL THEN
        RETURN 0;
    END IF;

    SELECT *
    INTO v_discount_record
    FROM public.discount_codes
    WHERE code_id = p_discount_code_id
    FOR UPDATE;

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
       AND COALESCE(v_discount_record.times_used, 0) >= v_discount_record.max_uses THEN
        RAISE EXCEPTION 'Discount code usage limit reached';
    END IF;

    IF v_discount_record.minimum_order_amount IS NOT NULL
       AND p_subtotal < v_discount_record.minimum_order_amount THEN
        RAISE EXCEPTION 'Minimum order amount of % required', v_discount_record.minimum_order_amount;
    END IF;

    IF v_discount_record.user_id IS NOT NULL
       AND v_discount_record.user_id <> p_user_id THEN
        RAISE EXCEPTION 'This discount code is not valid for this user';
    END IF;

    IF v_discount_record.eligible_email IS NOT NULL THEN
        SELECT lower(trim(email))
        INTO v_customer_email
        FROM public.cakegenie_users
        WHERE user_id = p_user_id;

        IF v_customer_email IS NULL
           OR v_customer_email <> lower(trim(v_discount_record.eligible_email)) THEN
            RAISE EXCEPTION 'This discount code is only valid for the creator email';
        END IF;
    END IF;

    IF v_discount_record.one_per_user
       AND p_user_id IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM public.discount_code_usage
           WHERE discount_code_id = p_discount_code_id
             AND user_id = p_user_id
       ) THEN
        RAISE EXCEPTION 'You have already used this discount code';
    END IF;

    IF v_discount_record.new_users_only
       AND EXISTS (
           SELECT 1
           FROM public.cakegenie_orders
           WHERE user_id = p_user_id
             AND payment_status IN ('paid', 'partial', 'refunded')
       ) THEN
        RAISE EXCEPTION 'This code is only for new customers';
    END IF;

    IF v_discount_record.applies_to_cake_types IS NOT NULL
       AND cardinality(v_discount_record.applies_to_cake_types) > 0 THEN
        SELECT COALESCE(SUM(cart.final_price * cart.quantity), 0)
        INTO v_eligible_subtotal
        FROM public.cakegenie_cart AS cart
        WHERE (cart.user_id = p_user_id OR cart.session_id = p_user_id::TEXT)
          AND cart.expires_at > NOW()
          AND (
              p_cart_item_ids IS NULL
              OR cart.cart_item_id::TEXT = ANY(p_cart_item_ids)
          )
          AND lower(cart.cake_type) = ANY (
              SELECT lower(allowed_type)
              FROM unnest(v_discount_record.applies_to_cake_types) AS allowed_type
          );

        IF v_eligible_subtotal <= 0 THEN
            RAISE EXCEPTION 'This discount code requires an eligible bento cake in your cart';
        END IF;
    ELSE
        v_eligible_subtotal := p_subtotal;
    END IF;

    IF v_discount_record.discount_amount IS NOT NULL THEN
        v_discount := v_discount_record.discount_amount;
    ELSIF v_discount_record.discount_percentage IS NOT NULL THEN
        v_discount := v_eligible_subtotal * v_discount_record.discount_percentage / 100;
    END IF;

    IF v_discount_record.max_discount_amount IS NOT NULL THEN
        v_discount := LEAST(v_discount, v_discount_record.max_discount_amount);
    END IF;

    RETURN LEAST(GREATEST(v_discount, 0), v_eligible_subtotal);
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_creator_discount_code(
    p_code TEXT,
    p_order_amount NUMERIC,
    p_email TEXT DEFAULT NULL,
    p_eligible_subtotal NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    valid BOOLEAN,
    code_id UUID,
    discount_amount NUMERIC,
    original_amount NUMERIC,
    final_amount NUMERIC,
    message TEXT,
    free_delivery BOOLEAN,
    discount_type TEXT,
    discount_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $function$
DECLARE
    v_discount_record RECORD;
    v_normalized_code TEXT := upper(trim(COALESCE(p_code, '')));
    v_base_amount NUMERIC;
    v_discount NUMERIC := 0;
BEGIN
    SELECT *
    INTO v_discount_record
    FROM public.discount_codes
    WHERE upper(code) = v_normalized_code;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0::NUMERIC, p_order_amount,
            p_order_amount, 'Invalid discount code', FALSE, NULL::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_discount_record.is_active IS FALSE THEN
        RETURN QUERY SELECT FALSE, v_discount_record.code_id, 0::NUMERIC, p_order_amount,
            p_order_amount, 'This discount code is no longer active', FALSE, NULL::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_discount_record.expires_at IS NOT NULL
       AND v_discount_record.expires_at < NOW() THEN
        RETURN QUERY SELECT FALSE, v_discount_record.code_id, 0::NUMERIC, p_order_amount,
            p_order_amount, 'This discount code has expired', FALSE, NULL::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_discount_record.max_uses IS NOT NULL
       AND COALESCE(v_discount_record.times_used, 0) >= v_discount_record.max_uses THEN
        RETURN QUERY SELECT FALSE, v_discount_record.code_id, 0::NUMERIC, p_order_amount,
            p_order_amount, 'This discount code has reached its usage limit', FALSE, NULL::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_discount_record.eligible_email IS NOT NULL
       AND lower(trim(COALESCE(p_email, ''))) <> lower(trim(v_discount_record.eligible_email)) THEN
        RETURN QUERY SELECT FALSE, v_discount_record.code_id, 0::NUMERIC, p_order_amount,
            p_order_amount, 'This code is only valid for the creator email', FALSE, NULL::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_discount_record.minimum_order_amount IS NOT NULL
       AND p_order_amount < v_discount_record.minimum_order_amount THEN
        RETURN QUERY SELECT FALSE, v_discount_record.code_id, 0::NUMERIC, p_order_amount,
            p_order_amount, format('Minimum order amount of ₱%s required', v_discount_record.minimum_order_amount), FALSE, NULL::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_discount_record.applies_to_cake_types IS NOT NULL
       AND cardinality(v_discount_record.applies_to_cake_types) > 0 THEN
        IF p_eligible_subtotal IS NULL OR p_eligible_subtotal <= 0 THEN
            RETURN QUERY SELECT FALSE, v_discount_record.code_id, 0::NUMERIC, p_order_amount,
                p_order_amount, 'This code requires an eligible bento cake in your cart', FALSE, NULL::TEXT, 0::NUMERIC;
            RETURN;
        END IF;
        v_base_amount := p_eligible_subtotal;
    ELSE
        v_base_amount := p_order_amount;
    END IF;

    IF v_discount_record.discount_amount IS NOT NULL THEN
        v_discount := v_discount_record.discount_amount;
    ELSIF v_discount_record.discount_percentage IS NOT NULL THEN
        v_discount := v_base_amount * v_discount_record.discount_percentage / 100;
    END IF;

    IF v_discount_record.max_discount_amount IS NOT NULL THEN
        v_discount := LEAST(v_discount, v_discount_record.max_discount_amount);
    END IF;

    v_discount := LEAST(GREATEST(v_discount, 0), v_base_amount);

    RETURN QUERY SELECT
        TRUE,
        v_discount_record.code_id,
        v_discount,
        p_order_amount,
        GREATEST(0, p_order_amount - v_discount),
        'Discount code applied successfully!',
        COALESCE(v_discount_record.free_delivery, FALSE),
        CASE
            WHEN v_discount_record.discount_percentage IS NOT NULL THEN 'percentage'
            WHEN v_discount_record.discount_amount IS NOT NULL THEN 'fixed'
            ELSE 'free_delivery'
        END,
        COALESCE(v_discount_record.discount_percentage, v_discount_record.discount_amount, 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.validate_creator_discount_code(TEXT, NUMERIC, TEXT, NUMERIC)
    TO anon, authenticated;

REVOKE ALL ON FUNCTION public.calculate_discount_for_order(UUID, UUID, NUMERIC, TEXT[])
    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.calculate_discount_for_order(UUID, UUID, NUMERIC, TEXT[])
    TO service_role;

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
BEGIN
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
    v_calculated_discount numeric := 0;
    v_now_manila_date date := timezone('Asia/Manila', now())::date;
    v_buyer_attribution jsonb := COALESCE(p_buyer_attribution, '{}'::jsonb);
BEGIN
    IF p_split_message = 'downpayment_50'
       AND p_delivery_date < (v_now_manila_date + 3) THEN
        RAISE EXCEPTION 'A minimum of 3 days lead time is required for 50%% downpayments.';
    END IF;

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
SET search_path = public, pg_catalog, pg_temp
AS $function$
DECLARE
    v_max_uses INTEGER;
    v_times_used INTEGER;
    v_is_active BOOLEAN;
BEGIN
    IF NEW.discount_code_id IS NULL
       OR NEW.payment_status NOT IN ('paid', 'partial') THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.discount_code_usage usage
        WHERE usage.discount_code_id = NEW.discount_code_id
          AND usage.order_id = NEW.order_id
    ) THEN
        SELECT max_uses, COALESCE(times_used, 0), COALESCE(is_active, FALSE)
        INTO v_max_uses, v_times_used, v_is_active
        FROM public.discount_codes
        WHERE code_id = NEW.discount_code_id
        FOR UPDATE;

        IF NOT v_is_active THEN
            RAISE EXCEPTION 'Discount code is no longer active';
        END IF;

        IF v_max_uses IS NOT NULL AND v_times_used >= v_max_uses THEN
            RAISE EXCEPTION 'Discount code usage limit reached';
        END IF;

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
           SET times_used = v_times_used + 1
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
