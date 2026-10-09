-- Order access without open policies (security patch, stage 1b: additive part).
--
-- Safe to apply at any time: it only ADDS functions and policies. The matching
-- destructive step (dropping the open policies) is
-- 20261009120000_close_open_order_policies.sql and must run only after
--   1. the app version that calls these RPCs is deployed, and
--   2. every dashboard staff account has the genie_role claim (see below).
--
-- Why: the policies "Allow public read access for dashboard" (SELECT USING true)
-- and "Allow public update for dashboard" (UPDATE USING true) on cakegenie_orders
-- let anyone with the public anon key read every customer's name, phone and
-- address and mark any order paid or change its total.
--
-- Genie staff access: auth.jwt() -> app_metadata -> genie_role = 'admin'.
-- Set it once per staff account (SQL editor, service role):
--   update auth.users
--      set raw_app_meta_data = raw_app_meta_data || '{"genie_role":"admin"}'::jsonb
--    where email = 'staff@example.com';
-- app_metadata can only be changed server-side, never by the user. The staff
-- member must sign out and back in for the claim to appear in their JWT.
-- Merchant staff keep using the existing private.user_has_merchant_access policies.

CREATE OR REPLACE FUNCTION private.is_genie_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
    SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'genie_role', '') = 'admin';
$function$;

REVOKE EXECUTE ON FUNCTION private.is_genie_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_genie_admin() TO authenticated;

DROP POLICY IF EXISTS genie_admin_select_orders ON public.cakegenie_orders;
CREATE POLICY genie_admin_select_orders ON public.cakegenie_orders
    FOR SELECT TO authenticated
    USING ((SELECT private.is_genie_admin()));

DROP POLICY IF EXISTS genie_admin_update_orders ON public.cakegenie_orders;
CREATE POLICY genie_admin_update_orders ON public.cakegenie_orders
    FOR UPDATE TO authenticated
    USING ((SELECT private.is_genie_admin()))
    WITH CHECK ((SELECT private.is_genie_admin()));

DROP POLICY IF EXISTS genie_admin_select_order_items ON public.cakegenie_order_items;
CREATE POLICY genie_admin_select_order_items ON public.cakegenie_order_items
    FOR SELECT TO authenticated
    USING ((SELECT private.is_genie_admin()));

-- ---------------------------------------------------------------------------
-- Payment proof upload (uploadPaymentProof in src/services/supabaseService.ts)
-- used a direct client UPDATE of cakegenie_orders. This RPC can only set
-- payment_proof_url and move the caller's own pending order to "verifying".
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_payment_proof(p_order_id uuid, p_payment_proof_url text)
RETURNS public.cakegenie_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_order public.cakegenie_orders;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    UPDATE public.cakegenie_orders
       SET payment_proof_url = p_payment_proof_url,
           payment_status = 'verifying'
     WHERE order_id = p_order_id
       AND user_id = auth.uid()
       AND payment_status IN ('pending', 'verifying')
    RETURNING * INTO v_order;

    IF v_order.order_id IS NULL THEN
        RAISE EXCEPTION 'Order not found or not awaiting payment' USING ERRCODE = 'P0002';
    END IF;

    RETURN v_order;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.submit_payment_proof(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Friend-contribution page (/contribute/[orderId]) used to read the whole order,
-- every contribution row and the organizer through the open read policies.
-- Whitelisted RPC instead: no delivery address, phone, buyer attribution, or
-- contributor emails / payment URLs. Only split orders, only by order id.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_order_for_contribution(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
    SELECT jsonb_build_object(
        'order_id', o.order_id,
        'order_number', o.order_number,
        'total_amount', o.total_amount,
        'amount_collected', o.amount_collected,
        'order_status', o.order_status,
        'payment_status', o.payment_status,
        'is_split_order', o.is_split_order,
        'split_message', o.split_message,
        'split_count', o.split_count,
        'organizer_user_id', o.organizer_user_id,
        'delivery_date', o.delivery_date,
        'cakegenie_order_items', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'item_id', i.item_id,
                'cake_type', i.cake_type,
                'cake_size', i.cake_size,
                'cake_thickness', i.cake_thickness,
                'final_price', i.final_price,
                'quantity', i.quantity,
                'customized_image_url', i.customized_image_url,
                'customization_details', i.customization_details
            ))
            FROM public.cakegenie_order_items i
            WHERE i.order_id = o.order_id
        ), '[]'::jsonb),
        'order_contributions', '[]'::jsonb,
        'organizer', (
            SELECT jsonb_build_object('first_name', u.first_name, 'email', u.email)
            FROM public.cakegenie_users u
            WHERE u.user_id = o.organizer_user_id
        )
    )
    FROM public.cakegenie_orders o
    WHERE o.order_id = p_order_id
      AND o.is_split_order = true;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_order_for_contribution(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_for_contribution(uuid) TO anon, authenticated;
