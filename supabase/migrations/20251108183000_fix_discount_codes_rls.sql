-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Service role can insert discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Service role can update discount codes" ON discount_codes;

-- New simpler policies

-- Anyone can READ active discount codes (for validation)
-- This allows the frontend to query and validate codes
CREATE POLICY "Anyone can view active discount codes"
  ON discount_codes FOR SELECT
  USING (is_active = true);

-- Only authenticated users can see their user-specific codes
CREATE POLICY "Users can view their own specific codes"
  ON discount_codes FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can INSERT (via backend functions)
CREATE POLICY "Service role can insert discount codes"
  ON discount_codes FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only service role can UPDATE (for usage increment)
CREATE POLICY "Service role can update discount codes"
  ON discount_codes FOR UPDATE
  TO service_role
  USING (true);

-- No one can DELETE (keep codes for audit trail)
-- DELETE is blocked by default when no policy exists