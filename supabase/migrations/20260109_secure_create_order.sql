-- Migration to secure create_order_from_cart with server-side discount validation
-- File: supabase/migrations/20260109_secure_create_order.sql

-- Drop existing functions to avoid conflict (specifically the one matching the full signature)
DROP FUNCTION IF EXISTS public.create_order_from_cart(
    uuid, uuid, date, text, numeric, numeric, text, numeric, uuid, text, text, text, text, numeric, numeric, text[]
);

CREATE OR REPLACE FUNCTION public.create_order_from_cart(
    p_user_id uuid,
    p_delivery_address_id uuid,
    p_delivery_date date,
    p_delivery_time_slot text,
    p_subtotal numeric,
    p_delivery_fee numeric,
    p_delivery_instructions text DEFAULT NULL::text,
    p_discount_amount numeric DEFAULT 0, -- Kept for signature compatibility but IGNORED for calculation
    p_discount_code_id uuid DEFAULT NULL::uuid,
    p_recipient_name text DEFAULT NULL::text,
    p_recipient_phone text DEFAULT NULL::text,
    p_delivery_address text DEFAULT NULL::text,
    p_delivery_city text DEFAULT NULL::text,
    p_delivery_latitude numeric DEFAULT NULL::numeric,
    p_delivery_longitude numeric DEFAULT NULL::numeric,
    p_cart_item_ids text[] DEFAULT NULL::text[]
)
RETURNS TABLE(order_id UUID, order_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_total_amount NUMERIC;
    v_calculated_discount NUMERIC := 0;
    v_discount_record RECORD;
    v_usage_count INTEGER;
    v_user_orders_count INTEGER;
    v_base_amount NUMERIC;
BEGIN
    -- Base amount for discount calculation (Subtotal + Delivery Fee usually, or just Subtotal?)
    -- Let's stick to Subtotal + Fee to be generous, or just Subtotal if strict.
    -- Most systems apply discount to subtotal. Let's use p_subtotal for percentage calc base.
    -- But if it's a fixed amount off, it comes off the total.
    v_base_amount := p_subtotal; 
    
    -- 1. Server-Side Discount Validation & Calculation
    IF p_discount_code_id IS NOT NULL THEN
        -- Fetch discount code details
        SELECT * INTO v_discount_record
        FROM public.discount_codes
        WHERE code_id = p_discount_code_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid discount code ID provided';
        END IF;

        -- Validate Active
        IF v_discount_record.is_active IS FALSE THEN
             RAISE EXCEPTION 'Discount code is not active';
        END IF;

        -- Validate Expiry
        IF v_discount_record.expires_at IS NOT NULL AND v_discount_record.expires_at < NOW() THEN
            RAISE EXCEPTION 'Discount code has expired';
        END IF;

        -- Validate Usage Limit
        IF v_discount_record.max_uses IS NOT NULL AND v_discount_record.times_used >= v_discount_record.max_uses THEN
            RAISE EXCEPTION 'Discount code usage limit reached';
        END IF;

        -- Validate Minimum Order Amount
        IF v_discount_record.minimum_order_amount IS NOT NULL AND p_subtotal < v_discount_record.minimum_order_amount THEN
            RAISE EXCEPTION 'Minimum order amount of % required', v_discount_record.minimum_order_amount;
        END IF;

        -- Validate User Restriction
        IF v_discount_record.user_id IS NOT NULL AND v_discount_record.user_id != p_user_id THEN
            RAISE EXCEPTION 'This discount code is not valid for this user';
        END IF;
        
        -- Removed new_users_only check as column does not exist in schema

        -- Calculate Discount
        IF v_discount_record.discount_amount IS NOT NULL THEN
            v_calculated_discount := v_discount_record.discount_amount;
        ELSIF v_discount_record.discount_percentage IS NOT NULL THEN
            v_calculated_discount := (p_subtotal * v_discount_record.discount_percentage) / 100;
        END IF;
        
        -- Cap discount at subtotal + delivery fee (Total Order Value)
        -- Ensuring we don't pay the customer.
        v_calculated_discount := LEAST(v_calculated_discount, p_subtotal + p_delivery_fee);
        
    END IF;

    -- 2. Calculate Total Amount
    -- Ensure it's never negative (though LEAST above helps, explicitly GREATEST here adds safety)
    v_total_amount := GREATEST(0, p_subtotal + p_delivery_fee - v_calculated_discount);

    -- 3. Generate unique order number (format: ORD-YYYYMMDD-XXXXX)
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');

    -- 4. Create the order
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
        delivery_phone, -- mapped from p_recipient_phone in VALUES below
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
        v_calculated_discount, -- Use server-calculated discount
        p_discount_code_id,
        v_total_amount,
        'pending',
        'pending',
        p_recipient_name,
        p_recipient_phone, -- Matches delivery_phone column logic from previous migration
        p_delivery_address,
        p_delivery_city,
        p_delivery_latitude,
        p_delivery_longitude
    )
    RETURNING cakegenie_orders.order_id INTO v_order_id;

    -- 5. Copy cart items to order_items
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

    -- 6. Delete cart items
    DELETE FROM public.cakegenie_cart
    WHERE (user_id = p_user_id OR session_id = p_user_id::text)
    AND expires_at > NOW()
    AND (
        p_cart_item_ids IS NULL
        OR cart_item_id::text = ANY(p_cart_item_ids)
    );

    -- 7. Record Discount Usage (Atomic update)
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
            v_calculated_discount
        );

        -- Increment the times_used counter
        -- Simple increment. Conflict handling not strictly needed as normal UPDATE locks the row.
        UPDATE public.discount_codes
        SET times_used = times_used + 1
        WHERE code_id = p_discount_code_id;
    END IF;

    -- Return the order details
    RETURN QUERY SELECT v_order_id, v_order_number;
END;
$$;

COMMENT ON FUNCTION public.create_order_from_cart IS 'Creates an order from cart items with secure server-side discount validation.';
