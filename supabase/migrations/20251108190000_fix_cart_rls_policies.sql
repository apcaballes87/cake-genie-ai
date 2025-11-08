-- Fix RLS policies for cakegenie_cart table to ensure proper access
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own cart" ON cakegenie_cart;
DROP POLICY IF EXISTS "Users can insert into own cart" ON cakegenie_cart;
DROP POLICY IF EXISTS "Users can update own cart items" ON cakegenie_cart;
DROP POLICY IF EXISTS "Users can delete own cart items" ON cakegenie_cart;

-- Allow users to SELECT their own cart items
CREATE POLICY "Users can view their own cart items"
  ON cakegenie_cart FOR SELECT
  USING (
    auth.uid() = user_id 
    OR session_id IS NOT NULL  -- Allow anonymous carts
  );

-- Allow users to INSERT their own cart items
CREATE POLICY "Users can add to their own cart"
  ON cakegenie_cart FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR (user_id IS NULL AND session_id IS NOT NULL)
  );

-- Allow users to UPDATE their own cart items
CREATE POLICY "Users can update their own cart"
  ON cakegenie_cart FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR session_id IS NOT NULL
  );

-- Allow users to DELETE their own cart items
CREATE POLICY "Users can delete their own cart items"
  ON cakegenie_cart FOR DELETE
  USING (
    auth.uid() = user_id 
    OR session_id IS NOT NULL
  );

-- Ensure RLS is enabled
ALTER TABLE cakegenie_cart ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "Users can view their own cart items" ON cakegenie_cart 
  IS 'Allow users to view their own cart items by user_id or session_id';
COMMENT ON POLICY "Users can add to their own cart" ON cakegenie_cart 
  IS 'Allow users to add items to their own cart';
COMMENT ON POLICY "Users can update their own cart" ON cakegenie_cart 
  IS 'Allow users to update their own cart items';
COMMENT ON POLICY "Users can delete their own cart items" ON cakegenie_cart 
  IS 'Allow users to delete their own cart items';