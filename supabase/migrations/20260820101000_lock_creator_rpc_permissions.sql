-- Only the server-side service role may create creator applications or invoke
-- the internal order discount calculation helper.
REVOKE ALL ON FUNCTION public.submit_creator_application(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, INTEGER, TEXT, BOOLEAN
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_creator_application(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, INTEGER, TEXT, BOOLEAN
) TO service_role;

REVOKE ALL ON FUNCTION public.calculate_discount_for_order(UUID, UUID, NUMERIC, TEXT[])
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.calculate_discount_for_order(UUID, UUID, NUMERIC, TEXT[])
    TO service_role;
