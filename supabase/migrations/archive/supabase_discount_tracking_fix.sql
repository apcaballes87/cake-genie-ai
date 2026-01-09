-- ============================================
-- Discount Code Tracking Fix for Cake Genie
-- ============================================
-- This script adds discount_code_id tracking to orders and updates the create_order_from_cart RPC function
-- Run this in your Supabase SQL Editor

-- ============================================
-- STEP 1: Add discount_code_id column to cakegenie_orders table
-- ============================================

-- Check if column already exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'cakegenie_orders'
        AND column_name = 'discount_code_id'
    ) THEN
        ALTER TABLE public.cakegenie_orders
        ADD COLUMN discount_code_id UUID NULL
        REFERENCES public.discount_codes(code_id) ON DELETE SET NULL;

        COMMENT ON COLUMN public.cakegenie_orders.discount_code_id IS 'Foreign key to discount_codes table to track which discount code was used';

        RAISE NOTICE 'Column discount_code_id added to cakegenie_orders table';
    ELSE
        RAISE NOTICE 'Column discount_code_id already exists in cakegenie_orders table';
    END IF;
END $$;

-- ============================================
-- STEP 2: Drop old versions and create the new create_order_from_cart RPC function
-- ============================================

-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS public.create_order_from_cart(UUID, UUID, DATE, TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.create_order_from_cart(UUID, UUID, DATE, TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC, UUID);

-- Create the new function with discount_code_id parameter
CREATE OR REPLACE FUNCTION public.create_order_from_cart(
    p_user_id UUID,
    p_delivery_address_id UUID,
    p_delivery_date DATE,
    p_delivery_time_slot TEXT,
    p_subtotal NUMERIC,
    p_delivery_fee NUMERIC,
    p_delivery_instructions TEXT DEFAULT NULL,
    p_discount_amount NUMERIC DEFAULT 0,
    p_discount_code_id UUID DEFAULT NULL
)
RETURNS TABLE(order_id UUID, order_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
        payment_status
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
        'pending'
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
    WHERE cart.user_id = p_user_id
    AND cart.expires_at > NOW();

    -- Delete cart items after copying to order
    DELETE FROM public.cakegenie_cart
    WHERE user_id = p_user_id
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
$$;

-- Add comment to the function
COMMENT ON FUNCTION public.create_order_from_cart IS 'Creates an order from cart items, tracks discount code usage, and clears the cart';

-- ============================================
-- STEP 3: Verify discount_code_usage table exists
-- ============================================

-- Check if discount_code_usage table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'discount_code_usage'
    ) THEN
        CREATE TABLE public.discount_code_usage (
            usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            discount_code_id UUID NOT NULL REFERENCES public.discount_codes(code_id) ON DELETE CASCADE,
            user_id UUID NOT NULL,
            order_id UUID NOT NULL REFERENCES public.cakegenie_orders(order_id) ON DELETE CASCADE,
            discount_amount_applied NUMERIC NOT NULL DEFAULT 0,
            used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT unique_code_per_order UNIQUE (discount_code_id, order_id)
        );

        -- Add index for faster lookups
        CREATE INDEX idx_discount_usage_code ON public.discount_code_usage(discount_code_id);
        CREATE INDEX idx_discount_usage_user ON public.discount_code_usage(user_id);
        CREATE INDEX idx_discount_usage_order ON public.discount_code_usage(order_id);

        COMMENT ON TABLE public.discount_code_usage IS 'Tracks which discount codes were used in which orders';

        RAISE NOTICE 'Table discount_code_usage created successfully';
    ELSE
        -- Check if discount_amount_applied column exists, if not add it
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'discount_code_usage'
            AND column_name = 'discount_amount_applied'
        ) THEN
            ALTER TABLE public.discount_code_usage
            ADD COLUMN discount_amount_applied NUMERIC NOT NULL DEFAULT 0;

            RAISE NOTICE 'Column discount_amount_applied added to discount_code_usage table';
        END IF;

        RAISE NOTICE 'Table discount_code_usage already exists';
    END IF;
END $$;

-- ============================================
-- STEP 4: Verification Queries
-- ============================================

-- Check if discount_code_id column was added to orders
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'cakegenie_orders'
AND column_name = 'discount_code_id';

-- Check the function signature
SELECT
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'create_order_from_cart';

-- Check discount_code_usage table structure
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'discount_code_usage'
ORDER BY ordinal_position;

-- Show success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Update TypeScript types to include discount_code_id in CakeGenieOrder interface';
    RAISE NOTICE '2. The supabaseService.ts already passes p_discount_code_id, so it should work now';
    RAISE NOTICE '3. Test order creation with a discount code';
END $$;
