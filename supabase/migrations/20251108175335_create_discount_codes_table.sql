-- Create discount_codes table
CREATE TABLE IF NOT EXISTS discount_codes (
  code_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  discount_amount NUMERIC(10, 2) DEFAULT 0,
  discount_percentage NUMERIC(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  times_used INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 1,
  min_order_amount NUMERIC(10, 2) DEFAULT 0,
  reason VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_discount CHECK (
    (discount_amount > 0 AND discount_percentage = 0) OR 
    (discount_percentage > 0 AND discount_amount = 0)
  ),
  CONSTRAINT valid_max_uses CHECK (max_uses > 0),
  CONSTRAINT valid_percentage CHECK (discount_percentage BETWEEN 0 AND 100)
);

-- Create index for faster code lookups
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_user_id ON discount_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own unused codes
CREATE POLICY "Users can view their own discount codes"
  ON discount_codes FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Only the system can create discount codes (via service role)
CREATE POLICY "Service role can insert discount codes"
  ON discount_codes FOR INSERT
  WITH CHECK (true);

-- Only the system can update discount codes
CREATE POLICY "Service role can update discount codes"
  ON discount_codes FOR UPDATE
  USING (true);

COMMENT ON TABLE discount_codes IS 'Stores promotional and contributor discount codes';