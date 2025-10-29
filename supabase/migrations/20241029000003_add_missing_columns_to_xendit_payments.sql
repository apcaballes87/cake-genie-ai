-- Add missing columns to xendit_payments table
ALTER TABLE xendit_payments 
ADD COLUMN IF NOT EXISTS xendit_external_id TEXT;

ALTER TABLE xendit_payments 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add NOT NULL constraints and index for better performance
ALTER TABLE xendit_payments 
ALTER COLUMN xendit_external_id SET NOT NULL;

ALTER TABLE xendit_payments 
ALTER COLUMN user_id SET NOT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_xendit_payments_external_id ON xendit_payments(xendit_external_id);
CREATE INDEX IF NOT EXISTS idx_xendit_payments_user_id ON xendit_payments(user_id);