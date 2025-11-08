-- Add user restriction fields to discount_codes table

-- Add column for one-time use per user
ALTER TABLE discount_codes
ADD COLUMN IF NOT EXISTS one_per_user BOOLEAN DEFAULT false;

-- Add column for new users only restriction
ALTER TABLE discount_codes
ADD COLUMN IF NOT EXISTS new_users_only BOOLEAN DEFAULT false;

-- Create a table to track which users have used which codes
CREATE TABLE IF NOT EXISTS discount_code_usage (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID NOT NULL REFERENCES discount_codes(code_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES cakegenie_orders(order_id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- A user can only use a specific code once
  CONSTRAINT unique_user_code_usage UNIQUE (discount_code_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_discount_usage_code ON discount_code_usage(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_user ON discount_code_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_order ON discount_code_usage(order_id);

-- Enable RLS on the usage table
ALTER TABLE discount_code_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage history
CREATE POLICY "Users can view their own usage"
  ON discount_code_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert usage records
CREATE POLICY "Service role can insert usage"
  ON discount_code_usage FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add comments
COMMENT ON COLUMN discount_codes.one_per_user IS 'If true, each user can only use this code once';
COMMENT ON COLUMN discount_codes.new_users_only IS 'If true, only users who have never placed an order can use this code';
COMMENT ON TABLE discount_code_usage IS 'Tracks which users have used which discount codes';
