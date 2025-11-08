-- Fix RLS policies for discount_codes table
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Users can view active discount codes" ON discount_codes;

-- Create a new policy that allows users to view all active discount codes
CREATE POLICY "Users can view active discount codes" 
  ON discount_codes FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

COMMENT ON POLICY "Users can view active discount codes" ON discount_codes 
  IS 'Allow users to view all active, non-expired discount codes';