-- Server-side order pricing guards (security patch, stage 1a).
--
-- Incident: a customer edited the price on their own cakegenie_cart row
-- (final_price = 0.01). create_order_from_cart copied it into
-- cakegenie_order_items, the live trigger update_cakegenie_order_total rebuilt
-- the order total from the items, and the payment function trusted that total.
--
-- This migration makes the database the source of truth for prices:
--   1. a price-sanity trigger on cakegenie_cart and cakegenie_order_items
--   2. create_order_from_cart / create_split_order_from_cart ignore the client
--      subtotal, take the user from auth.uid(), and refuse empty or non-positive
--      item totals
--
-- This is a guard, not a full re-pricer: add-on prices are still computed in
-- the browser (see stage 2 in the incident plan). The trigger raises the floor
-- so that free / near-free / hand-built items are rejected.

-- ---------------------------------------------------------------------------
-- 1. Price sanity trigger
-- ---------------------------------------------------------------------------

-- Lowest legitimate item price ever ordered in the last 180 days is 399; the
-- floor sits well below that so price changes and promos never trip it.
CREATE OR REPLACE FUNCTION public.enforce_item_price_sanity()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY DEFINER: customers cannot read the catalog tables directly, and the
-- trigger must still be able to look prices up. The caller's role is read from
-- the request JWT via auth.role(), which is unaffected by SECURITY DEFINER.
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    c_min_final_price constant numeric := 99;
    -- Base prices have changed over time (e.g. Bento 299 -> 499), so compare to
    -- the catalog with a wide tolerance instead of requiring an exact match.
    c_catalog_floor_ratio constant numeric := 0.5;
    v_catalog_min numeric;
    v_role text := coalesce(auth.role(), current_user);
BEGIN
    -- Trusted server-side writers (edge functions, admin tools, migrations).
    IF v_role IN ('service_role', 'postgres', 'supabase_admin') THEN
        RETURN NEW;
    END IF;

    IF NEW.quantity IS NULL OR NEW.quantity < 1 OR NEW.quantity > 100 THEN
        RAISE EXCEPTION 'Invalid item quantity' USING ERRCODE = '22023';
    END IF;

    IF NEW.base_price IS NULL OR NEW.base_price < 0
       OR NEW.addon_price IS NULL OR NEW.addon_price < 0
       OR NEW.final_price IS NULL THEN
        RAISE EXCEPTION 'Invalid item price' USING ERRCODE = '22023';
    END IF;

    IF abs(NEW.final_price - (NEW.base_price + NEW.addon_price)) > 0.01 THEN
        RAISE EXCEPTION 'Item price does not match base price plus add-ons' USING ERRCODE = '22023';
    END IF;

    -- Real cakes always carry a type and size; hand-built rows do not.
    IF nullif(btrim(NEW.cake_type), '') IS NULL OR nullif(btrim(NEW.cake_size), '') IS NULL THEN
        RAISE EXCEPTION 'Item is missing cake type or size' USING ERRCODE = '22023';
    END IF;

    IF NEW.final_price < c_min_final_price THEN
        RAISE EXCEPTION 'Item price is below the minimum allowed' USING ERRCODE = '22023';
    END IF;

    -- When the type / size / thickness exists in a catalog, the price may not be
    -- far below the cheapest matching catalog entry.
    SELECT min(price) INTO v_catalog_min
    FROM (
        SELECT price::numeric AS price
        FROM public.productsizes_cakegenie
        WHERE type = NEW.cake_type AND cakesize = NEW.cake_size
          AND (NEW.cake_thickness IS NULL OR thickness = NEW.cake_thickness)
        UNION ALL
        SELECT price::numeric
        FROM public.productsizes_cakesandmemories
        WHERE type = NEW.cake_type AND cakesize = NEW.cake_size
          AND (NEW.cake_thickness IS NULL OR thickness = NEW.cake_thickness)
    ) catalog;

    IF v_catalog_min IS NOT NULL AND NEW.final_price < v_catalog_min * c_catalog_floor_ratio THEN
        RAISE EXCEPTION 'Item price is below the allowed range for this cake' USING ERRCODE = '22023';
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_item_price_sanity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_cart_item_price_sanity ON public.cakegenie_cart;
CREATE TRIGGER enforce_cart_item_price_sanity
    BEFORE INSERT OR UPDATE OF base_price, addon_price, final_price, quantity, cake_type, cake_size, cake_thickness
    ON public.cakegenie_cart
    FOR EACH ROW EXECUTE FUNCTION public.enforce_item_price_sanity();

DROP TRIGGER IF EXISTS enforce_order_item_price_sanity ON public.cakegenie_order_items;
CREATE TRIGGER enforce_order_item_price_sanity
    BEFORE INSERT OR UPDATE OF base_price, addon_price, final_price, quantity, cake_type, cake_size, cake_thickness
    ON public.cakegenie_order_items
    FOR EACH ROW EXECUTE FUNCTION public.enforce_item_price_sanity();

-- ---------------------------------------------------------------------------
-- 2. Order RPCs: server decides user, subtotal and a sane delivery fee
-- ---------------------------------------------------------------------------

-- Highest delivery fee in src/lib/commerce/deliveryRates.ts is 600. Anything
-- outside 0..1000 is not a real fee. (Stage 2: compute the fee from the address.)
CREATE OR REPLACE FUNCTION public.assert_valid_order_inputs(
    p_user_id uuid,
    p_delivery_fee numeric
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $function$
BEGIN
    IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not allowed to create an order for this user' USING ERRCODE = '42501';
    END IF;

    IF p_delivery_fee IS NULL OR p_delivery_fee < 0 OR p_delivery_fee > 1000 THEN
        RAISE EXCEPTION 'Invalid delivery fee' USING ERRCODE = '22023';
    END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_valid_order_inputs(uuid, numeric) FROM PUBLIC, anon, authenticated;

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
    v_subtotal numeric;
    v_total_amount numeric;
    v_calculated_discount numeric := 0;
    v_buyer_attribution jsonb := COALESCE(p_buyer_attribution, '{}'::jsonb);
BEGIN
    PERFORM public.assert_valid_order_inputs(p_user_id, p_delivery_fee);

    -- The client-sent subtotal is ignored: price the rows that will be ordered.
    SELECT COALESCE(SUM(cart.final_price * cart.quantity), 0) INTO v_subtotal
    FROM public.cakegenie_cart cart
    WHERE (cart.user_id = p_user_id OR cart.session_id = p_user_id::text)
      AND cart.expires_at > NOW()
      AND (p_cart_item_ids IS NULL OR cart.cart_item_id::text = ANY(p_cart_item_ids));

    IF v_subtotal <= 0 THEN
        RAISE EXCEPTION 'Cart is empty' USING ERRCODE = '22023';
    END IF;

    v_calculated_discount := public.calculate_discount_for_order(
        p_discount_code_id,
        p_user_id,
        v_subtotal,
        p_cart_item_ids
    );

    v_total_amount := GREATEST(0, v_subtotal + p_delivery_fee - v_calculated_discount);
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
        p_delivery_time_slot, p_delivery_instructions, v_subtotal, p_delivery_fee,
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
    v_subtotal numeric;
    v_total_amount numeric;
    v_calculated_discount numeric := 0;
    v_now_manila_date date := timezone('Asia/Manila', now())::date;
    v_buyer_attribution jsonb := COALESCE(p_buyer_attribution, '{}'::jsonb);
BEGIN
    PERFORM public.assert_valid_order_inputs(p_user_id, p_delivery_fee);

    IF p_split_message = 'downpayment_50'
       AND p_delivery_date < (v_now_manila_date + 3) THEN
        RAISE EXCEPTION 'A minimum of 3 days lead time is required for 50%% downpayments.';
    END IF;

    SELECT COALESCE(SUM(cart.final_price * cart.quantity), 0) INTO v_subtotal
    FROM public.cakegenie_cart cart
    WHERE (cart.user_id = p_user_id OR cart.session_id = p_user_id::text)
      AND cart.expires_at > NOW()
      AND (p_cart_item_ids IS NULL OR cart.cart_item_id::text = ANY(p_cart_item_ids));

    IF v_subtotal <= 0 THEN
        RAISE EXCEPTION 'Cart is empty' USING ERRCODE = '22023';
    END IF;

    v_calculated_discount := public.calculate_discount_for_order(
        p_discount_code_id,
        p_user_id,
        v_subtotal,
        p_cart_item_ids
    );

    v_total_amount := GREATEST(0, v_subtotal + p_delivery_fee - v_calculated_discount);
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
        p_delivery_time_slot, p_delivery_instructions, v_subtotal, p_delivery_fee,
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
