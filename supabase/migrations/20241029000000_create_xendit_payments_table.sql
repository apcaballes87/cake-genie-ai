-- Create xendit_payments table
CREATE TABLE IF NOT EXISTS xendit_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  xendit_invoice_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_link_url TEXT,
  expiry_date TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  paid_amount DECIMAL(10, 2),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_xendit_payments_order_id ON xendit_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_xendit_payments_invoice_id ON xendit_payments(xendit_invoice_id);
CREATE INDEX IF NOT EXISTS idx_xendit_payments_status ON xendit_payments(status);