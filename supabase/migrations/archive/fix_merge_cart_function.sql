-- ============================================
-- Fix: merge_anonymous_cart_to_user Function
-- ============================================
-- This fixes the "character varying = uuid" error

-- Drop the old function if it exists
DROP FUNCTION IF EXISTS merge_anonymous_cart_to_user(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS merge_anonymous_cart_to_user(UUID, UUID);
DROP FUNCTION IF EXISTS merge_anonymous_cart_to_user(TEXT, TEXT);

-- Create the corrected function
CREATE OR REPLACE FUNCTION merge_anonymous_cart_to_user(
  p_anonymous_user_id UUID,
  p_real_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER := 0;
  v_deleted_count INTEGER := 0;
BEGIN
  -- Update all cart items from anonymous session to authenticated user
  -- Convert session_id items to user_id items
  UPDATE cakegenie_cart
  SET
    user_id = p_real_user_id,
    session_id = NULL,
    updated_at = NOW()
  WHERE session_id = p_anonymous_user_id::TEXT
    AND expires_at > NOW();

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Optionally, delete duplicate items if user already has same item
  -- (Uncomment if you want to prevent duplicates)
  /*
  DELETE FROM cakegenie_cart c1
  WHERE c1.user_id = p_real_user_id
    AND EXISTS (
      SELECT 1 FROM cakegenie_cart c2
      WHERE c2.user_id = p_real_user_id
        AND c2.cart_item_id < c1.cart_item_id
        AND c2.original_image_url = c1.original_image_url
    );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  */

  RETURN json_build_object(
    'success', TRUE,
    'updated_count', v_updated_count,
    'deleted_duplicates', v_deleted_count,
    'message', format('Merged %s items from anonymous cart', v_updated_count)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION merge_anonymous_cart_to_user(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION merge_anonymous_cart_to_user(UUID, UUID) TO anon;

-- Test the function (optional - comment out if you don't want to test now)
/*
SELECT merge_anonymous_cart_to_user(
  '00000000-0000-0000-0000-000000000000'::UUID,  -- dummy anonymous ID
  '11111111-1111-1111-1111-111111111111'::UUID   -- dummy user ID
);
*/
