-- clear_cart_for_paid_order is called only from payment edge functions. Keep
-- browser roles from invoking this SECURITY DEFINER function with an order ID.

REVOKE EXECUTE ON FUNCTION public.clear_cart_for_paid_order(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_cart_for_paid_order(uuid) TO service_role;

COMMENT ON FUNCTION public.clear_cart_for_paid_order(uuid) IS
  'Service-role-only payment helper. For a fully paid order, removes only active cart rows referenced by source_cart_item_id. Legacy orders without source IDs safely remove nothing.';
