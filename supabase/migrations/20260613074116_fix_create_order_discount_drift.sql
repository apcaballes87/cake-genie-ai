-- Reassert the discounted create_order_from_cart body in production.
--
-- Why this exists:
-- - The remote migration history includes `20260612130000_defer_cart_clear_to_payment`,
--   but the live `public.create_order_from_cart(...)` body drifted back to an
--   older implementation that ignores discount validation and always stores
--   `discount_amount = 0` with `total_amount = subtotal + delivery_fee`.
-- - That mismatch causes the cart UI to show the discounted total while the
--   saved order row, and therefore the downstream Xendit invoice amount, uses
--   the undiscounted amount.
--
-- Scope:
-- - Replace only the live `create_order_from_cart` function body for the
--   current 17-argument signature.
-- - Preserve the existing cart-clear contract introduced on 2026-06-12.

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
    p_clear_cart boolean DEFAULT FALSE
)
RETURNS TABLE(order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_total_amount NUMERIC;
    v_calculated_discount NUMERIC := 0;
    v_discount_record RECORD;
    v_base_amount NUMERIC;
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
        delivery_longitude
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
        p_delivery_longitude
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
    'Creates an order from cart items with secure server-side discount validation. '
    'Cart rows are kept on the server by default (p_clear_cart=FALSE) so abandoned '
    'checkouts can be recovered. The xendit-webhook / verify-xendit-payment edge '
    'functions call clear_cart_for_paid_order() after the order is paid to actually '
    'clear the cart. Pass p_clear_cart=TRUE for callers that want the legacy '
    'immediate-clear behavior.';
