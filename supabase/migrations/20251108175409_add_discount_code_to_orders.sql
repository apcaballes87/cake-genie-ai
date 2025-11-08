-- Add discount_code_id to orders table
ALTER TABLE cakegenie_orders 
ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES discount_codes(code_id);

-- Create index for reporting
CREATE INDEX IF NOT EXISTS idx_orders_discount_code 
ON cakegenie_orders(discount_code_id);

COMMENT ON COLUMN cakegenie_orders.discount_code_id IS 'Reference to the discount code used';