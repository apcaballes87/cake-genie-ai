-- Migration: Add Xendit Payment Request API v3 columns
-- Date: 2026-06-10

-- Add xendit_payment_request_id and payment_token_id to xendit_payments
ALTER TABLE xendit_payments ADD COLUMN IF NOT EXISTS xendit_payment_request_id TEXT;
ALTER TABLE xendit_payments ADD COLUMN IF NOT EXISTS payment_token_id TEXT;

-- Add xendit_payment_request_id and payment_token_id to order_contributions
ALTER TABLE order_contributions ADD COLUMN IF NOT EXISTS xendit_payment_request_id TEXT;
ALTER TABLE order_contributions ADD COLUMN IF NOT EXISTS payment_token_id TEXT;

-- Add indexes for the new payment_request_id columns (for webhook lookups)
CREATE INDEX IF NOT EXISTS idx_xendit_payments_payment_request_id ON xendit_payments(xendit_payment_request_id);
CREATE INDEX IF NOT EXISTS idx_order_contributions_payment_request_id ON order_contributions(xendit_payment_request_id);

COMMENT ON COLUMN xendit_payments.xendit_payment_request_id IS 'Xendit Payment Request API v3 ID (pr-...)';
COMMENT ON COLUMN xendit_payments.payment_token_id IS 'Xendit token ID for PAY_AND_SAVE returning users';
COMMENT ON COLUMN order_contributions.xendit_payment_request_id IS 'Xendit Payment Request API v3 ID (pr-...)';
COMMENT ON COLUMN order_contributions.payment_token_id IS 'Xendit token ID for PAY_AND_SAVE returning users';
