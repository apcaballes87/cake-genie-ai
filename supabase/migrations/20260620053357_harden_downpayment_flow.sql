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
    p_cart_item_ids text[] DEFAULT NULL::text[]
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
        amount_collected
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
        0
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
      AND cart.expires_at > now()
      AND (
        p_cart_item_ids IS NULL
        OR cart.cart_item_id = ANY(p_cart_item_ids)
      );

    DELETE FROM public.cakegenie_cart
    WHERE (user_id = p_user_id OR session_id = p_user_id::text)
      AND expires_at > now()
      AND (
        p_cart_item_ids IS NULL
        OR cart_item_id = ANY(p_cart_item_ids)
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

CREATE OR REPLACE FUNCTION public.handle_order_contribution_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_total_collected numeric := 0;
    v_order_total numeric := 0;
    v_split_message text;
    v_required_downpayment numeric := 0;
    v_next_payment_status text := 'pending';
    v_next_order_status text := 'pending';
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    PERFORM 1
      FROM public.cakegenie_orders
     WHERE order_id = NEW.order_id
     FOR UPDATE;

    SELECT total_amount, split_message
      INTO v_order_total, v_split_message
      FROM public.cakegenie_orders
     WHERE order_id = NEW.order_id;

    SELECT COALESCE(SUM(amount), 0)
      INTO v_total_collected
      FROM public.order_contributions
     WHERE order_id = NEW.order_id
       AND status = 'paid';

    v_required_downpayment := round(v_order_total / 2.0, 2);

    IF round(v_total_collected, 2) >= round(v_order_total, 2) THEN
        v_next_payment_status := 'paid';
        v_next_order_status := 'confirmed';
    ELSIF v_split_message = 'downpayment_50'
      AND round(v_total_collected, 2) >= v_required_downpayment THEN
        v_next_payment_status := 'partial';
        v_next_order_status := 'confirmed';
    END IF;

    UPDATE public.cakegenie_orders
       SET amount_collected = v_total_collected,
           payment_status = v_next_payment_status,
           order_status = v_next_order_status
     WHERE order_id = NEW.order_id;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_cart_for_paid_order(
    p_order_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_order_user_id uuid;
    v_payment_status text;
    v_deleted_count integer;
BEGIN
    SELECT user_id, payment_status
      INTO v_order_user_id, v_payment_status
      FROM public.cakegenie_orders
     WHERE order_id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'clear_cart_for_paid_order: order % not found', p_order_id;
    END IF;

    IF v_payment_status IS DISTINCT FROM 'paid'
       AND v_payment_status IS DISTINCT FROM 'partial' THEN
        RAISE EXCEPTION 'clear_cart_for_paid_order: order % is not paid (current payment_status=%)',
            p_order_id, v_payment_status;
    END IF;

    IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_order_user_id THEN
        RAISE EXCEPTION 'clear_cart_for_paid_order: caller is not the order owner';
    END IF;

    WITH deleted AS (
        DELETE FROM public.cakegenie_cart
         WHERE (user_id = v_order_user_id OR session_id = v_order_user_id::text)
           AND expires_at > now()
        RETURNING cart_item_id
    )
    SELECT count(*) INTO v_deleted_count FROM deleted;

    RETURN v_deleted_count;
END;
$function$;

COMMENT ON FUNCTION public.clear_cart_for_paid_order IS
    'Clears cakegenie_cart rows for a paid or partially paid order. Idempotent: '
    'returns the number of cart rows actually removed (0 on subsequent calls). '
    'Defense-in-depth: verifies the order is payment_status=paid or partial before '
    'deleting. Called by xendit-webhook and verify-xendit-payment after the order '
    'has been funded enough to confirm the booking.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_contributions_unique_payment_request_id
    ON public.order_contributions (xendit_payment_request_id)
    WHERE xendit_payment_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_contributions_unique_invoice_id
    ON public.order_contributions (xendit_invoice_id)
    WHERE xendit_invoice_id IS NOT NULL;
