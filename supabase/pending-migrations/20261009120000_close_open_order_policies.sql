-- Close the open order policies (security patch, stage 1b: destructive part).
--
-- GATED. Apply only after ALL of these are true:
--   1. 20261009110000_order_access_rpcs_and_staff_policies.sql is applied.
--   2. The app version using the submit_payment_proof and
--      get_order_for_contribution RPCs is deployed.
--   3. Each Genie dashboard staff account has app_metadata.genie_role = 'admin'
--      (or is a row in merchant_staff) and has signed in again.
--   4. Verified on a branch: dashboard lists and updates orders, payment-proof
--      upload works, /contribute/[orderId] loads for a logged-out visitor.
--
-- Rollback (restores the old, insecure behaviour):
--   create policy "Allow public read access for dashboard" on public.cakegenie_orders for select using (true);
--   create policy "Allow public update for dashboard" on public.cakegenie_orders for update using (true) with check (true);
--   create policy "Allow public read access for dashboard" on public.cakegenie_order_items for select using (true);

DROP POLICY IF EXISTS "Allow public read access for dashboard" ON public.cakegenie_orders;
DROP POLICY IF EXISTS "Allow public update for dashboard" ON public.cakegenie_orders;
DROP POLICY IF EXISTS "Allow public read access for dashboard" ON public.cakegenie_order_items;

-- Customers read their own orders through orders_select_v2. These two owner
-- policies let a customer insert or edit their own order directly (including
-- total_amount), which would bypass the price fixes, so they go too. Orders and
-- items are created only by create_order_from_cart (SECURITY DEFINER).
DROP POLICY IF EXISTS "Users can update their own orders" ON public.cakegenie_orders;
DROP POLICY IF EXISTS "Users can create own orders" ON public.cakegenie_orders;
DROP POLICY IF EXISTS "Users can create order items for own orders" ON public.cakegenie_order_items;

-- order_contributions: a user could flip their own contribution to "paid" and a
-- SECURITY DEFINER trigger would then mark the whole order paid. Owners keep read
-- access only; the edge functions (service role) create and update contributions.
DROP POLICY IF EXISTS "Users can view their own contributions" ON public.order_contributions;
CREATE POLICY "Users can view their own contributions" ON public.order_contributions
    FOR SELECT
    USING (auth.uid() = user_id);
