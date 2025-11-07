# Contribution Tracking Fix - Deployment Checklist

## Files to Verify
- [ ] `/Users/apcaballes/genieph/supabase/functions/xendit-webhook/index.ts` exists
- [ ] `/Users/apcaballes/genieph/supabase/migrations/20251105000000_update_design_amount_collected.sql` exists
- [ ] `/Users/apcaballes/genieph/apply-migration.sql` exists
- [ ] `/Users/apcaballes/genieph/DEPLOYMENT_INSTRUCTIONS.md` exists

## Database Migration
- [ ] Function `update_design_amount_collected` created in Supabase
- [ ] Function can be executed by anon and authenticated users

## Function Deployment
- [ ] Xendit webhook function deployed to Supabase
- [ ] Function is accessible at the webhook URL

## Xendit Configuration
- [ ] Webhook configured in Xendit dashboard
- [ ] Webhook URL: `https://cqmhanqnfybyxezhobkx.supabase.co/functions/v1/xendit-webhook`
- [ ] Webhook event: `invoice.paid`

## Testing
- [ ] Make a test contribution
- [ ] Complete the payment
- [ ] Refresh shared design page
- [ ] Verify amount collected is updated

## Verification Commands
```bash
# Check if files exist
ls -la /Users/apcaballes/genieph/supabase/functions/xendit-webhook/
ls -la /Users/apcaballes/genieph/supabase/migrations/

# Check deployed functions
npx supabase functions list

# Check function logs (after deployment)
npx supabase functions logs xendit-webhook
```