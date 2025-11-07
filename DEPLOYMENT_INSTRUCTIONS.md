# Contribution Tracking Fix - Manual Deployment Instructions

## Overview
This fix resolves the issue where paid contributions were not being reflected on shared design pages.

## Files Created
1. `supabase/functions/xendit-webhook/index.ts` - Webhook function to handle Xendit payment notifications
2. `supabase/migrations/20251105000000_update_design_amount_collected.sql` - Database function to update amount collected
3. `apply-migration.sql` - Direct SQL script to apply the database migration

## Step-by-Step Deployment

### Step 1: Apply Database Migration
1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy the contents of `apply-migration.sql` and run it
4. Confirm the function `update_design_amount_collected` was created

### Step 2: Deploy Xendit Webhook Function
1. Open your terminal
2. Navigate to your project directory:
   ```bash
   cd /Users/apcaballes/genieph
   ```
3. Deploy the function:
   ```bash
   npx supabase functions deploy xendit-webhook
   ```

### Step 3: Configure Xendit Webhook
1. Log in to your Xendit dashboard
2. Go to the "Webhooks" section
3. Add a new webhook:
   - URL: `https://cqmhanqnfybyxezhobkx.supabase.co/functions/v1/xendit-webhook`
   - Event: `invoice.paid`
4. Save the webhook

## Testing
1. Make a contribution payment
2. Complete the payment process
3. Refresh the shared design page
4. Verify the amount collected is updated correctly

## Troubleshooting
If you encounter issues:
1. Check Supabase function logs:
   ```bash
   npx supabase functions logs xendit-webhook
   ```
2. Verify the database function exists:
   - In Supabase SQL Editor, run: `\df update_design_amount_collected`
3. Check that contribution records are being created with the correct `xendit_external_id`