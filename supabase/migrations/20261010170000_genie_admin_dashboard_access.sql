-- Admin dashboard access through Supabase Auth instead of a service-role key.
-- A dashboard admin is a signed-in user whose JWT carries
-- app_metadata.genie_role = 'admin' (see private.is_genie_admin()).
-- Policies below grant exactly the operations the dashboard performs.
-- Additive: existing customer-facing policies are untouched.

DO $$
DECLARE
  r record;
  op text;
  cmd text;
  policy_name text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('ai_prompts',                    'S,I,U'),
      ('ai_provider_settings',          'S,U'),
      ('ai_training_data',              'S,I'),
      ('availability_settings',         'S,U'),
      ('blocked_dates',                 'S,I,U'),
      ('cakegenie_addresses',           'S'),
      ('cakegenie_analysis_cache',      'S,I,U,D'),
      ('cakegenie_cart',                'S,D'),
      ('cakegenie_order_items',         'S,D'),
      ('cakegenie_orders',              'S,U,D'),
      ('cakegenie_reports',             'S'),
      ('cakegenie_reviews',             'S,U,D'),
      ('cakegenie_search_analytics',    'S,I,U'),
      ('cakegenie_shared_designs',      'S,D'),
      ('cakegenie_supplier_signups',    'S,I,U,D'),
      ('cakegenie_users',               'S,U'),
      ('chat_conversations',            'S,U'),
      ('chat_messages',                 'S,I,U'),
      ('creators',                      'S'),
      ('discount_codes',                'S,I,U'),
      ('genie_visit_events',            'S'),
      ('order_contributions',           'S,I'),
      ('pricing_rules',                 'S,I,U,D'),
      ('productsizes_cakegenie',        'S,U'),
      ('productsizes_cakesandmemories', 'S,U')
    ) AS t(tbl, ops)
  LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN
      RAISE NOTICE 'skipping missing table %', r.tbl;
      CONTINUE;
    END IF;

    FOREACH op IN ARRAY string_to_array(r.ops, ',') LOOP
      cmd := CASE op WHEN 'S' THEN 'SELECT' WHEN 'I' THEN 'INSERT' WHEN 'U' THEN 'UPDATE' WHEN 'D' THEN 'DELETE' END;
      policy_name := 'genie_admin_dashboard_' || lower(cmd) || '_' || r.tbl;

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, r.tbl);

      IF cmd = 'SELECT' OR cmd = 'DELETE' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR %s TO authenticated USING ((SELECT private.is_genie_admin()))',
          policy_name, r.tbl, cmd);
      ELSIF cmd = 'INSERT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_genie_admin()))',
          policy_name, r.tbl);
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT private.is_genie_admin())) WITH CHECK ((SELECT private.is_genie_admin()))',
          policy_name, r.tbl);
      END IF;
    END LOOP;
  END LOOP;
END
$$;

-- Storage: supplier signup images are replaced/removed by dashboard admins.
DROP POLICY IF EXISTS genie_admin_dashboard_update_supplier_images ON storage.objects;
CREATE POLICY genie_admin_dashboard_update_supplier_images ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'supplier-signup-images' AND (SELECT private.is_genie_admin()))
  WITH CHECK (bucket_id = 'supplier-signup-images' AND (SELECT private.is_genie_admin()));

DROP POLICY IF EXISTS genie_admin_dashboard_delete_supplier_images ON storage.objects;
CREATE POLICY genie_admin_dashboard_delete_supplier_images ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'supplier-signup-images' AND (SELECT private.is_genie_admin()));

-- These SECURITY DEFINER helpers were callable by anyone (including anonymous
-- visitors) and bypass RLS, letting the public delete or toggle discount codes.
CREATE OR REPLACE FUNCTION public.delete_discount_code(code_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT private.is_genie_admin()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.discount_codes WHERE code_id = code_id_param;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_discount_code_status(code_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT private.is_genie_admin()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.discount_codes SET is_active = NOT is_active WHERE code_id = code_id_param;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_discount_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_discount_code_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_discount_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_discount_code_status(uuid) TO authenticated;
