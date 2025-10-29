# Xendit Payment Integration

## Database Schema

The Xendit payment integration requires a specific database table structure to store payment information.

### xendit_payments Table

```sql
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
```

### Indexes

For optimal query performance, the following indexes should be created:

```sql
CREATE INDEX IF NOT EXISTS idx_xendit_payments_order_id ON xendit_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_xendit_payments_invoice_id ON xendit_payments(xendit_invoice_id);
CREATE INDEX IF NOT EXISTS idx_xendit_payments_status ON xendit_payments(status);
```

## Edge Functions

There are two edge functions that handle Xendit payments:

1. `create-xendit-payment` - Creates a new Xendit invoice and stores the payment record
2. `verify-xendit-payment` - Verifies the payment status with Xendit and updates the database

## Troubleshooting

### "Could not find the 'xendit_invoice_id' column" Error

This error occurs when the `xendit_payments` table doesn't have the required `xendit_invoice_id` column or when the Supabase schema cache is outdated.

#### Solution:

1. Ensure the `xendit_payments` table exists with the correct schema
2. Run the migration script to create/update the table structure
3. Refresh the Supabase schema cache by restarting the Supabase project or running:
   ```sql
   SELECT supabase.refresh_schema_cache();
   ```

### Environment Variables

Make sure the following environment variables are set in your Supabase project:

- `XENDIT_SECRET_KEY` - Your Xendit secret API key
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

These should be set in the Supabase Dashboard under Settings > Configuration > Environment Variables.