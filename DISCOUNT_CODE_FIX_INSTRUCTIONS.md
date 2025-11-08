# Discount Code Issue - Complete Fix Instructions

## Status
✅ **Partially Fixed**: The core issue (RLS policies) has been resolved.
🟡 **Partially Complete**: Some steps require manual action with Supabase credentials.

## What Was Fixed
1. ✅ **RLS Policies**: Updated database policies to allow users to view active discount codes
2. ✅ **Edge Function**: Enhanced with better logging for debugging
3. ✅ **Migration File**: Created for consistent deployment

## Remaining Steps

### 1. Update Service Role Key
The service role key in your `.env.local` file is still a placeholder. You need to update it:

1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Find the "service_role" key under "Project API keys"
4. Copy this key
5. Update your `.env.local` file:
```
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

### 2. Deploy the Updated Edge Function
After updating the service role key, deploy the updated edge function:

```bash
npx supabase functions deploy validate-discount-code
```

### 3. Test the Discount Code
1. Start your development server:
```bash
npm run dev
```

2. Open your application in the browser
3. Add items to your cart
4. Go to the cart page
5. Enter "NEW100" in the discount code field
6. Click "Apply"

## Verification Commands
You can run these commands to verify the fix:

1. Check that the NEW100 code exists:
```sql
SELECT code, is_active, expires_at FROM discount_codes WHERE code = 'NEW100';
```

2. Check that the RLS policy is in place:
```sql
SELECT polname FROM pg_policy WHERE polrelid = 'discount_codes'::regclass;
```

## Troubleshooting

### If the discount code still doesn't work:
1. Check the edge function logs:
```bash
# After deploying, you can check logs (if your Supabase CLI supports it)
npx supabase functions logs validate-discount-code
```

2. Verify the service role key is correct by testing database access

3. Make sure you're testing with a logged-in user (anonymous users may have different access)

### If you see authentication errors:
1. Ensure you're using a proper user session token, not an anon key
2. Check that the user is properly authenticated in your application

## Technical Details

### RLS Policy
The new policy allows users to view all active, non-expired discount codes:
```sql
CREATE POLICY "Users can view active discount codes" 
  ON discount_codes FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));
```

### Edge Function Improvements
The edge function now includes:
- Detailed logging at each step
- Better error messages
- More comprehensive debugging information

## Migration
The fix has been saved as a migration file:
`supabase/migrations/20251108180000_fix_discount_codes_rls.sql`

This ensures the fix can be consistently applied across environments.