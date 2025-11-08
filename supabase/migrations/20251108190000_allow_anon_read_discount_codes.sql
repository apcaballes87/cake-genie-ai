-- Allow anonymous users to read ALL discount codes (not just active ones)
-- This is needed for the frontend validation to work

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Anyone can view active discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Users can view their own specific codes" ON discount_codes;

-- Create a more permissive SELECT policy
-- Allow anyone (including anonymous users) to SELECT all discount codes
-- The validation logic in the app will check is_active, expiration, etc.
CREATE POLICY "Allow anonymous read access to discount codes"
  ON discount_codes FOR SELECT
  TO anon, authenticated
  USING (true);

-- Keep the other policies for INSERT/UPDATE
-- (They should already exist from previous migrations)
