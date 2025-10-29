-- Add the missing paid_amount column to xendit_payments table
-- This column is required by the verify-xendit-payment edge function

ALTER TABLE xendit_payments
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10, 2);

-- Add a comment to document the column
COMMENT ON COLUMN xendit_payments.paid_amount IS 'The actual amount paid by the customer (from Xendit webhook)';
