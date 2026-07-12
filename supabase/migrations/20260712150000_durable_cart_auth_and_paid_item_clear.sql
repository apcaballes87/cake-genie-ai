-- Make anonymous carts durable across full-page OAuth redirects and ensure
-- payment completion removes only the cart rows represented by that order.

ALTER TABLE public.cakegenie_cart
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

-- Extend currently active carts to the new 30-day lifetime without reviving
-- carts that have already expired.
UPDATE public.cakegenie_cart
SET
  expires_at = created_at + interval '30 days',
  updated_at = now()
WHERE expires_at > now()
  AND created_at IS NOT NULL
  AND created_at + interval '30 days' > now()
  AND expires_at < created_at + interval '30 days';

ALTER TABLE public.cakegenie_order_items
  ADD COLUMN IF NOT EXISTS source_cart_item_id uuid;

CREATE INDEX IF NOT EXISTS idx_cakegenie_order_items_source_cart_item_id
  ON public.cakegenie_order_items (source_cart_item_id)
  WHERE source_cart_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cart_auth_transfers (
  transfer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  source_anonymous_user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  claimed_by uuid,
  claimed_at timestamptz,
  moved_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cart_auth_transfers_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT cart_auth_transfers_claim_is_consistent CHECK (
    (claimed_by IS NULL AND claimed_at IS NULL)
    OR (claimed_by IS NOT NULL AND claimed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_cart_auth_transfers_expiry
  ON public.cart_auth_transfers (expires_at);

ALTER TABLE public.cart_auth_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cart_auth_transfers FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.begin_anonymous_cart_transfer()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_source_user_id uuid := auth.uid();
  v_is_anonymous boolean;
  v_token text;
  v_token_hash text;
  v_expires_at timestamptz := now() + interval '10 minutes';
BEGIN
  IF v_source_user_id IS NULL THEN
    RAISE EXCEPTION 'An authenticated anonymous session is required';
  END IF;

  SELECT is_anonymous
    INTO v_is_anonymous
    FROM auth.users
   WHERE id = v_source_user_id;

  IF COALESCE(v_is_anonymous, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Only anonymous sessions can prepare a cart transfer';
  END IF;

  -- Opportunistic cleanup keeps this short-lived claim table bounded without
  -- ever deleting a replay record that may be needed for a retry.
  DELETE FROM public.cart_auth_transfers
   WHERE expires_at < now() - interval '1 day';

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.cart_auth_transfers (
    token_hash,
    source_anonymous_user_id,
    expires_at
  )
  VALUES (
    v_token_hash,
    v_source_user_id,
    v_expires_at
  );

  RETURN jsonb_build_object(
    'token', v_token,
    'expires_at', v_expires_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_anonymous_cart_transfer(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_destination_user_id uuid := auth.uid();
  v_destination_is_anonymous boolean;
  v_transfer public.cart_auth_transfers%ROWTYPE;
  v_token_hash text;
  v_updated_count integer := 0;
BEGIN
  IF v_destination_user_id IS NULL OR COALESCE(btrim(p_token), '') = '' THEN
    RAISE EXCEPTION 'A signed-in destination user and transfer token are required';
  END IF;

  SELECT is_anonymous
    INTO v_destination_is_anonymous
    FROM auth.users
   WHERE id = v_destination_user_id;

  IF COALESCE(v_destination_is_anonymous, true) THEN
    RAISE EXCEPTION 'A registered destination user is required';
  END IF;

  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT *
    INTO v_transfer
    FROM public.cart_auth_transfers
   WHERE token_hash = v_token_hash
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cart transfer was not found';
  END IF;

  IF v_transfer.claimed_by IS NOT NULL THEN
    IF v_transfer.claimed_by IS DISTINCT FROM v_destination_user_id THEN
      RAISE EXCEPTION 'Cart transfer was already claimed by another user';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'already_claimed', true,
      'source_anonymous_user_id', v_transfer.source_anonymous_user_id,
      'updated_count', v_transfer.moved_count
    );
  END IF;

  IF v_transfer.expires_at <= now() THEN
    RAISE EXCEPTION 'Cart transfer has expired';
  END IF;

  UPDATE public.cakegenie_cart
     SET user_id = v_destination_user_id,
         session_id = NULL,
         updated_at = now()
   WHERE user_id IS NULL
     AND session_id = v_transfer.source_anonymous_user_id::text
     AND expires_at > now();

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  UPDATE public.cart_auth_transfers
     SET claimed_by = v_destination_user_id,
         claimed_at = now(),
         moved_count = v_updated_count
   WHERE transfer_id = v_transfer.transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_claimed', false,
    'source_anonymous_user_id', v_transfer.source_anonymous_user_id,
    'updated_count', v_updated_count
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.begin_anonymous_cart_transfer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_anonymous_cart_transfer() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.claim_anonymous_cart_transfer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_anonymous_cart_transfer(text) TO authenticated, service_role;

-- The previous raw-ID merge endpoint remains defined for compatibility with
-- migration history, but browser callers can no longer invoke it.
REVOKE EXECUTE ON FUNCTION public.merge_anonymous_cart_to_user(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_anonymous_cart_to_user(uuid, uuid) TO service_role;

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
    v_discount_record record;
    v_base_amount numeric;
    v_buyer_attribution jsonb := COALESCE(p_buyer_attribution, '{}'::jsonb);
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

    -- p_clear_cart is retained for RPC compatibility, but payment completion
    -- is now the only path that removes cart rows.
    IF p_discount_code_id IS NOT NULL THEN
        INSERT INTO public.discount_code_usage (
            discount_code_id, user_id, order_id, discount_amount_applied
        )
        VALUES (
            p_discount_code_id, p_user_id, v_order_id, v_calculated_discount
        );

        UPDATE public.discount_codes
           SET times_used = times_used + 1
         WHERE code_id = p_discount_code_id;
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
    v_now_manila_date date := timezone('Asia/Manila', now())::date;
    v_buyer_attribution jsonb := COALESCE(p_buyer_attribution, '{}'::jsonb);
BEGIN
    IF p_split_message = 'downpayment_50'
       AND p_delivery_date < (v_now_manila_date + 3) THEN
        RAISE EXCEPTION 'A minimum of 3 days lead time is required for 50%% downpayments.';
    END IF;

    v_total_amount := p_subtotal + p_delivery_fee - p_discount_amount;
    v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 99999)::text, 5, '0');

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
        p_discount_amount, p_discount_code_id, v_total_amount, 'pending',
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

    IF p_discount_code_id IS NOT NULL THEN
        INSERT INTO public.discount_code_usage (
            discount_code_id, user_id, order_id, discount_amount_applied
        )
        VALUES (
            p_discount_code_id, p_user_id, v_order_id, p_discount_amount
        );

        UPDATE public.discount_codes
           SET times_used = times_used + 1
         WHERE code_id = p_discount_code_id;
    END IF;

    RETURN QUERY SELECT v_order_id, v_order_number;
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
    v_deleted_count integer := 0;
BEGIN
    SELECT user_id, payment_status
      INTO v_order_user_id, v_payment_status
      FROM public.cakegenie_orders
     WHERE order_id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'clear_cart_for_paid_order: order % not found', p_order_id;
    END IF;

    -- A 50% downpayment leaves every cart row intact. Only a fully paid order
    -- may remove the source rows it actually copied into order_items.
    IF v_payment_status IS DISTINCT FROM 'paid' THEN
        RETURN 0;
    END IF;

    IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_order_user_id THEN
        RAISE EXCEPTION 'clear_cart_for_paid_order: caller is not the order owner';
    END IF;

    WITH deleted AS (
        DELETE FROM public.cakegenie_cart cart
         USING public.cakegenie_order_items order_item
         WHERE order_item.order_id = p_order_id
           AND order_item.source_cart_item_id IS NOT NULL
           AND cart.cart_item_id = order_item.source_cart_item_id
           AND (cart.user_id = v_order_user_id OR cart.session_id = v_order_user_id::text)
           AND cart.expires_at > now()
        RETURNING cart.cart_item_id
    )
    SELECT count(*) INTO v_deleted_count FROM deleted;

    RETURN v_deleted_count;
END;
$function$;

COMMENT ON FUNCTION public.clear_cart_for_paid_order(uuid) IS
  'For a fully paid order, removes only active cart rows referenced by source_cart_item_id. Legacy orders without source IDs safely remove nothing.';
