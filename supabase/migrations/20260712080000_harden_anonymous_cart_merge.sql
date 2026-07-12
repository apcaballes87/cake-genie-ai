-- Preserve a guest cart when an anonymous session is replaced by a
-- registered session during checkout sign-in.
--
-- The previous function was SECURITY DEFINER but accepted any caller and
-- arbitrary user IDs. Keep the ownership transfer server-side for RLS while
-- requiring the caller to be the authenticated destination user.

CREATE OR REPLACE FUNCTION public.merge_anonymous_cart_to_user(
  p_anonymous_user_id UUID,
  p_real_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_real_user_id THEN
    RAISE EXCEPTION 'Only the destination user can merge this cart';
  END IF;

  IF p_anonymous_user_id = p_real_user_id THEN
    RAISE EXCEPTION 'Anonymous and destination users must be different';
  END IF;

  UPDATE public.cakegenie_cart
  SET
    user_id = p_real_user_id,
    session_id = NULL,
    updated_at = NOW()
  WHERE user_id IS NULL
    AND session_id = p_anonymous_user_id::TEXT
    AND expires_at > NOW();

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN json_build_object(
    'success', TRUE,
    'updated_count', v_updated_count,
    'message', format('Merged %s items from anonymous cart', v_updated_count)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_anonymous_cart_to_user(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_anonymous_cart_to_user(UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.merge_anonymous_cart_to_user(UUID, UUID) IS
  'Moves unexpired anonymous cart rows to the authenticated destination user during sign-in.';
