-- A complimentary bento code covers one bento cake only.

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
    v_eligible_quantity INTEGER;
    v_discount NUMERIC := 0;
BEGIN
    IF p_discount_code_id IS NULL THEN
        RETURN 0;
    END IF;

    SELECT * INTO v_discount_record
    FROM public.discount_codes
    WHERE code_id = p_discount_code_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid discount code ID provided'; END IF;
    IF v_discount_record.is_active IS FALSE THEN RAISE EXCEPTION 'Discount code is not active'; END IF;
    IF v_discount_record.expires_at IS NOT NULL AND v_discount_record.expires_at < NOW() THEN RAISE EXCEPTION 'Discount code has expired'; END IF;
    IF v_discount_record.max_uses IS NOT NULL AND COALESCE(v_discount_record.times_used, 0) >= v_discount_record.max_uses THEN RAISE EXCEPTION 'Discount code usage limit reached'; END IF;
    IF v_discount_record.minimum_order_amount IS NOT NULL AND p_subtotal < v_discount_record.minimum_order_amount THEN RAISE EXCEPTION 'Minimum order amount of % required', v_discount_record.minimum_order_amount; END IF;
    IF v_discount_record.user_id IS NOT NULL AND v_discount_record.user_id <> p_user_id THEN RAISE EXCEPTION 'This discount code is not valid for this user'; END IF;

    IF v_discount_record.eligible_email IS NOT NULL THEN
        SELECT lower(trim(email)) INTO v_customer_email
        FROM public.cakegenie_users
        WHERE user_id = p_user_id;
        IF v_customer_email IS NULL OR v_customer_email <> lower(trim(v_discount_record.eligible_email)) THEN
            RAISE EXCEPTION 'This discount code is only valid for the creator email';
        END IF;
    END IF;

    IF v_discount_record.one_per_user AND p_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.discount_code_usage
        WHERE discount_code_id = p_discount_code_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'You have already used this discount code';
    END IF;

    IF v_discount_record.new_users_only AND EXISTS (
        SELECT 1 FROM public.cakegenie_orders
        WHERE user_id = p_user_id AND payment_status IN ('paid', 'partial', 'refunded')
    ) THEN
        RAISE EXCEPTION 'This code is only for new customers';
    END IF;

    IF v_discount_record.applies_to_cake_types IS NOT NULL
       AND cardinality(v_discount_record.applies_to_cake_types) > 0 THEN
        SELECT COALESCE(SUM(cart.final_price * cart.quantity), 0), COALESCE(SUM(cart.quantity), 0)
        INTO v_eligible_subtotal, v_eligible_quantity
        FROM public.cakegenie_cart AS cart
        WHERE (cart.user_id = p_user_id OR cart.session_id = p_user_id::TEXT)
          AND cart.expires_at > NOW()
          AND (p_cart_item_ids IS NULL OR cart.cart_item_id::TEXT = ANY(p_cart_item_ids))
          AND lower(cart.cake_type) = ANY (
              SELECT lower(allowed_type)
              FROM unnest(v_discount_record.applies_to_cake_types) AS allowed_type
          );

        IF v_eligible_subtotal <= 0 THEN
            RAISE EXCEPTION 'This discount code requires an eligible bento cake in your cart';
        END IF;

        IF v_discount_record.code_purpose = 'creator_bento' AND v_eligible_quantity > 1 THEN
            RAISE EXCEPTION 'The free-bento code can be used for one bento cake per order';
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

DROP FUNCTION IF EXISTS public.validate_creator_discount_code(TEXT, NUMERIC, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.validate_creator_discount_code(
    p_code TEXT,
    p_order_amount NUMERIC,
    p_email TEXT DEFAULT NULL,
    p_eligible_subtotal NUMERIC DEFAULT NULL,
    p_eligible_quantity INTEGER DEFAULT NULL
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
    SELECT * INTO v_discount_record
    FROM public.discount_codes
    WHERE upper(code) = v_normalized_code;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0::NUMERIC, p_order_amount, p_order_amount,
            'Invalid discount code', FALSE, NULL::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_discount_record.is_active IS FALSE THEN
        RETURN QUERY SELECT FALSE, v_discount_record.code_id, 0::NUMERIC, p_order_amount, p_order_amount,
            'This discount code is no longer active', FALSE, NULL::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_discount_record.expires_at IS NOT NULL AND v_discount_record.expires_at < NOW() THEN
        RETURN QUERY SELECT FALSE, v_discount_record.code_id, 0::NUMERIC, p_order_amount, p_order_amount,
            'This discount code has expired', FALSE, NULL::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_discount_record.max_uses IS NOT NULL AND COALESCE(v_discount_record.times_used, 0) >= v_discount_record.max_uses THEN
        RETURN QUERY SELECT FALSE, v_discount_record.code_id, 0::NUMERIC, p_order_amount, p_order_amount,
            'This discount code has reached its usage limit', FALSE, NULL::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_discount_record.eligible_email IS NOT NULL
       AND lower(trim(COALESCE(p_email, ''))) <> lower(trim(v_discount_record.eligible_email)) THEN
        RETURN QUERY SELECT FALSE, v_discount_record.code_id, 0::NUMERIC, p_order_amount, p_order_amount,
            'This code is only valid for the creator email', FALSE, NULL::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_discount_record.minimum_order_amount IS NOT NULL AND p_order_amount < v_discount_record.minimum_order_amount THEN
        RETURN QUERY SELECT FALSE, v_discount_record.code_id, 0::NUMERIC, p_order_amount, p_order_amount,
            format('Minimum order amount of ₱%s required', v_discount_record.minimum_order_amount), FALSE, NULL::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_discount_record.applies_to_cake_types IS NOT NULL
       AND cardinality(v_discount_record.applies_to_cake_types) > 0 THEN
        IF p_eligible_subtotal IS NULL OR p_eligible_subtotal <= 0 THEN
            RETURN QUERY SELECT FALSE, v_discount_record.code_id, 0::NUMERIC, p_order_amount, p_order_amount,
                'This code requires an eligible bento cake in your cart', FALSE, NULL::TEXT, 0::NUMERIC;
            RETURN;
        END IF;
        IF v_discount_record.code_purpose = 'creator_bento' AND COALESCE(p_eligible_quantity, 0) > 1 THEN
            RETURN QUERY SELECT FALSE, v_discount_record.code_id, 0::NUMERIC, p_order_amount, p_order_amount,
                'The free-bento code can be used for one bento cake per order', FALSE, NULL::TEXT, 0::NUMERIC;
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

    RETURN QUERY SELECT TRUE, v_discount_record.code_id, v_discount, p_order_amount,
        GREATEST(0, p_order_amount - v_discount), 'Discount code applied successfully!',
        COALESCE(v_discount_record.free_delivery, FALSE),
        CASE
            WHEN v_discount_record.discount_percentage IS NOT NULL THEN 'percentage'
            WHEN v_discount_record.discount_amount IS NOT NULL THEN 'fixed'
            ELSE 'free_delivery'
        END,
        COALESCE(v_discount_record.discount_percentage, v_discount_record.discount_amount, 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.validate_creator_discount_code(TEXT, NUMERIC, TEXT, NUMERIC, INTEGER)
    TO anon, authenticated;
