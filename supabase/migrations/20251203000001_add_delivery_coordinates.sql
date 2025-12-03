-- Migration to add delivery coordinates to cakegenie_orders table
-- This allows storing latitude/longitude for guest orders where delivery_address_id is NULL

-- Add coordinate columns to cakegenie_orders
ALTER TABLE public.cakegenie_orders
ADD COLUMN IF NOT EXISTS delivery_latitude numeric,
ADD COLUMN IF NOT EXISTS delivery_longitude numeric;

-- Add comments for documentation
COMMENT ON COLUMN public.cakegenie_orders.delivery_latitude IS 'Latitude coordinate for delivery address (used for guest orders)';
COMMENT ON COLUMN public.cakegenie_orders.delivery_longitude IS 'Longitude coordinate for delivery address (used for guest orders)';

-- Update create_order_from_cart RPC to include coordinates
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
    p_delivery_longitude numeric DEFAULT NULL::numeric
)
RETURNS TABLE(order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_total_amount NUMERIC;
BEGIN
    -- Calculate total amount
    v_total_amount := p_subtotal + p_delivery_fee - p_discount_amount;

    -- Generate unique order number (format: ORD-YYYYMMDD-XXXXX)
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');

    -- Create the order
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
        p_delivery_longitude
    )
    RETURNING cakegenie_orders.order_id INTO v_order_id;

    -- Copy cart items to order_items
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
    AND cart.expires_at > NOW();

    -- Delete cart items after copying to order
    DELETE FROM public.cakegenie_cart
    WHERE (user_id = p_user_id OR session_id = p_user_id::text)
    AND expires_at > NOW();

    -- If a discount code was used, record it in discount_code_usage
    IF p_discount_code_id IS NOT NULL THEN
        -- Insert into discount_code_usage table
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

        -- Increment the times_used counter on the discount code
        UPDATE public.discount_codes
        SET times_used = times_used + 1
        WHERE code_id = p_discount_code_id;
    END IF;

    -- Return the order details
    RETURN QUERY SELECT v_order_id, v_order_number;
END;
$function$;

-- Update create_split_order_from_cart RPC to include coordinates
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
    -- Split order parameters
    p_is_split_order boolean DEFAULT false,
    p_split_message text DEFAULT NULL::text,
    p_split_count integer DEFAULT NULL::integer
)
RETURNS TABLE(order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_total_amount NUMERIC;
BEGIN
    -- Calculate total amount
    v_total_amount := p_subtotal + p_delivery_fee - p_discount_amount;

    -- Generate unique order number (format: ORD-YYYYMMDD-XXXXX)
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');

    -- Create the order
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
        -- Split order fields
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
        -- Split order values
        p_is_split_order,
        p_split_message,
        p_split_count,
        CASE WHEN p_is_split_order THEN p_user_id ELSE NULL END,
        0 -- Initial amount_collected
    )
    RETURNING cakegenie_orders.order_id INTO v_order_id;

    -- Copy cart items to order_items
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
    AND cart.expires_at > NOW();

    -- Delete cart items after copying to order
    DELETE FROM public.cakegenie_cart
    WHERE (user_id = p_user_id OR session_id = p_user_id::text)
    AND expires_at > NOW();

    -- If a discount code was used, record it in discount_code_usage
    IF p_discount_code_id IS NOT NULL THEN
        -- Insert into discount_code_usage table
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

        -- Increment the times_used counter on the discount code
        UPDATE public.discount_codes
        SET times_used = times_used + 1
        WHERE code_id = p_discount_code_id;
    END IF;

    -- Return the order details
    RETURN QUERY SELECT v_order_id, v_order_number;
END;
$function$;

-- Verification query
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'cakegenie_orders'
AND column_name IN ('delivery_latitude', 'delivery_longitude')
ORDER BY column_name;
