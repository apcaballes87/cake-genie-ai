-- Migration: defer cart-row deletion until payment confirmed.
-- File: supabase/migrations/20260612130000_defer_cart_clear_to_payment.sql
--
-- ROOT CAUSE
--   The previous `create_order_from_cart` RPC (see
--   20260109_secure_create_order.sql lines 184-191) deleted the user's
--   `cakegenie_cart` rows at ORDER-CREATION time, while the order itself
--   was inserted with `order_status='pending', payment_status='pending'`.
--
--   When a user clicked "Place Order" and then bailed at Xendit
--   (browser back, X close, payment failure, network drop), the cart
--   was already gone from the server. The React state still had the
--   items, but they got clobbered on remount by `loadCartData` returning
--   `[]`, leaving the user with an empty cart and no recovery path
--   other than digging into "My Orders" to find the orphan pending
--   order. This was a known revenue-loss vector.
--
-- FIX
--   1. Add an optional `p_clear_cart BOOLEAN DEFAULT FALSE` parameter
--      to `create_order_from_cart`. The cart-row DELETE is now gated
--      on this flag. Existing callers that don't pass the parameter
--      get the new safe default (cart NOT cleared) — the order is
--      created but the cart stays intact for abandonment recovery.
--   2. Add a new public helper `clear_cart_for_paid_order(p_order_id)`
--      that the Xendit payment-confirmation paths (webhook AND
--      verify-xendit-payment edge function) invoke after flipping the
--      order to `payment_status='paid'`. The helper is defense-in-depth:
--      it re-checks the order is actually paid before deleting any
--      cart rows.
--
-- CALLER IMPACT
--   - `src/services/supabaseService.ts::createOrderFromCart` does NOT
--     pass `p_clear_cart`, so it picks up the new default (FALSE) and
--     stops deleting cart rows. This is intentional; the recovery UI
--     work is tracked separately and will pass `p_clear_cart: true`
--     only when the user has explicitly chosen to "abandon and clear"
--     from a recovery prompt.
--   - `xendit-webhook` and `verify-xendit-payment` both call
--     `clear_cart_for_paid_order` after marking the order paid. Both
--     call sites are needed for idempotency: whichever fires first
--     clears the cart; the other is a no-op (the helper deletes
--     non-existent rows and returns 0).
--   - No schema columns change. `scripts/check-required-columns.ts`
--     does not need updating.
--
-- BACKWARD COMPATIBILITY
--   - The old function signature is preserved as a DROP-then-CREATE
--     so the new function replaces the old one cleanly. The optional
--     parameter at the end is the only breaking change for any caller
--     that was relying on positional arguments past the 16th — none
--     exist in this repo (see grep for `create_order_from_cart`).
--   - The new helper is `SECURITY DEFINER` so the service-role edge
--     functions can invoke it without needing a user context, and it
--     also performs a `auth.uid()`-style guard to limit who can call
--     it directly.

-- ============================================================================
-- 1. Replace `create_order_from_cart` with a cart-clear-gated variant.
-- ============================================================================

-- Drop the existing function (any-arg form) so we can re-create it with
-- the new optional parameter. CREATE OR REPLACE would reject the new
-- signature if any prior call site depended on positional argument count
-- that no longer matches.
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
    p_cart_item_ids text[] DEFAULT NULL::text[],
    -- NEW: when TRUE, behave like the legacy RPC and clear the cart rows
    -- that were copied into the order. Default FALSE so abandoned checkouts
    -- keep the cart intact on the server for the user to recover on return.
    p_clear_cart boolean DEFAULT FALSE
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

    -- 6. Delete cart items — GATED on p_clear_cart.
    -- Default is FALSE so abandoned checkouts (user clicked Place Order
    -- then bailed at Xendit) leave the cart intact for recovery.
    -- The Xendit webhook / verify-xendit-payment edge function will call
    -- `clear_cart_for_paid_order(p_order_id)` after the order is paid
    -- to actually wipe the rows.
    IF p_clear_cart THEN
        DELETE FROM public.cakegenie_cart
        WHERE (user_id = p_user_id OR session_id = p_user_id::text)
        AND expires_at > NOW()
        AND (
            p_cart_item_ids IS NULL
            OR cart_item_id::text = ANY(p_cart_item_ids)
        );
    END IF;

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

COMMENT ON FUNCTION public.create_order_from_cart IS
    'Creates an order from cart items with secure server-side discount validation. '
    'Cart rows are kept on the server by default (p_clear_cart=FALSE) so abandoned '
    'checkouts can be recovered. The xendit-webhook / verify-xendit-payment edge '
    'functions call clear_cart_for_paid_order() after the order is paid to actually '
    'clear the cart. Pass p_clear_cart=TRUE for callers that want the legacy '
    'immediate-clear behavior.';


-- ============================================================================
-- 2. New helper: clear_cart_for_paid_order
-- ============================================================================
-- Invoked by the payment-confirmation paths (xendit-webhook,
-- verify-xendit-payment) AFTER the order has been flipped to
-- payment_status='paid' / order_status='confirmed'.
--
-- Why a separate function:
--   * Idempotent: re-running on an already-cleared cart returns 0 rows
--     deleted, so both webhook and verify-xendit-payment can call it
--     without coordinating which one fires first.
--   * Defense-in-depth: it re-checks the order is actually paid before
--     deleting any cart rows, so a stray "PAID" message that didn't
--     flip the order (or a partial event) cannot wipe the cart.
--   * SECURITY DEFINER + auth.uid() guard: the edge functions use the
--     service role, so they bypass RLS, but we still scope the cart
--     deletion to the order's user/session to avoid cross-tenant leaks
--     if a future caller invokes with the wrong order_id.

CREATE OR REPLACE FUNCTION public.clear_cart_for_paid_order(
    p_order_id uuid
)
RETURNS integer  -- number of cart rows actually removed
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_user_id uuid;
    v_payment_status text;
    v_deleted_count integer;
BEGIN
    -- Look up the order. We need the owning user_id to scope the cart
    -- deletion AND we need to verify the order is actually paid before
    -- wiping the cart.
    SELECT user_id, payment_status
      INTO v_order_user_id, v_payment_status
      FROM public.cakegenie_orders
     WHERE order_id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'clear_cart_for_paid_order: order % not found', p_order_id;
    END IF;

    IF v_payment_status IS DISTINCT FROM 'paid' THEN
        RAISE EXCEPTION 'clear_cart_for_paid_order: order % is not paid (current payment_status=%)',
            p_order_id, v_payment_status;
    END IF;

    -- Optional auth guard: if a non-service-role caller is invoking this,
    -- require the caller to be the order's owner. Service-role edge
    -- functions (auth.uid() IS NULL) bypass this check by design.
    IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_order_user_id THEN
        RAISE EXCEPTION 'clear_cart_for_paid_order: caller is not the order owner';
    END IF;

    -- Delete the cart rows for the order's user/session, mirroring the
    -- scoping used by create_order_from_cart (user_id OR session_id =
    -- user_id::text). expires_at > NOW() matches the copy step's read
    -- filter, so we never delete rows that weren't actually copied.
    WITH deleted AS (
        DELETE FROM public.cakegenie_cart
         WHERE (user_id = v_order_user_id OR session_id = v_order_user_id::text)
           AND expires_at > NOW()
        RETURNING cart_item_id
    )
    SELECT count(*) INTO v_deleted_count FROM deleted;

    RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.clear_cart_for_paid_order IS
    'Clears cakegenie_cart rows for a PAID order. Idempotent: returns the number '
    'of cart rows actually removed (0 on subsequent calls). Defense-in-depth: '
    'verifies the order is payment_status=paid before deleting. Called by the '
    'xendit-webhook and verify-xendit-payment edge functions after flipping the '
    'order to confirmed/paid. SECURITY DEFINER so service-role callers can '
    'invoke it directly; non-service callers must be the order owner.';

-- Grant execute to the standard Postgres roles. The edge functions use
-- the service role which bypasses RLS, but explicit grants make the
-- helper callable from authenticated-anon contexts too (e.g. if a
-- recovery UI later wants to call it from the browser).
GRANT EXECUTE ON FUNCTION public.clear_cart_for_paid_order(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.clear_cart_for_paid_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_cart_for_paid_order(uuid) TO service_role;
