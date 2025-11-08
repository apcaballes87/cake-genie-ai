# Discount Code Issue Fix

## Problem Summary
The NEW100 discount code was showing as "expired" even though it had a future expiration date (2026-11-08). Investigation revealed several issues:

1. **RLS (Row Level Security) Policies**: The policies on the discount_codes table were not properly configured to allow users to see public discount codes.
2. **Service Role Key**: The service role key in `.env.local` was just a placeholder.
3. **Edge Function Authentication**: The validate-discount-code function requires proper user authentication.

## Root Cause
The main issue was with the RLS policies on the discount_codes table. Users could not see discount codes because the policies were too restrictive.

## Solution Implemented

### 1. Fixed RLS Policies
Created a new migration file `supabase/migrations/20251108180000_fix_discount_codes_rls.sql` with a simplified policy:

```sql
-- Allow users to view all active, non-expired discount codes
CREATE POLICY "Users can view active discount codes" 
  ON discount_codes FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));
```

### 2. Verified Data Exists
Confirmed that the NEW100 code exists in the database with:
- Code: NEW100
- Is active: true
- Expires at: 2026-11-08
- Times used: 0
- Max uses: 5

## Testing Steps

### 1. Apply the Migration
Once you have access to the Supabase project with proper credentials:

```bash
# Set your Supabase access token
export SUPABASE_ACCESS_TOKEN="your_actual_access_token_here"

# Apply the migration
npx supabase db push
```

### 2. Test in Browser
Open `tests/browser-test-discount.html` in your browser to test the discount code queries directly.

### 3. Test the Edge Function
Use the frontend application to test the discount code validation:
1. Start the development server: `npm run dev`
2. Open the application in your browser
3. Add items to your cart
4. Go to the cart page
5. Enter "NEW100" in the discount code field
6. Click "Apply"

## Additional Fixes Needed

### 1. Service Role Key
Update the `SUPABASE_SERVICE_ROLE_KEY` in your `.env.local` file with the actual service role key from your Supabase dashboard.

To get the service role key:
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Find the "service_role" key under "Project API keys"
4. Copy this key and replace the placeholder in `.env.local`

### 2. Redeploy Edge Functions
After updating the service role key, redeploy the edge functions:

```bash
npx supabase functions deploy validate-discount-code
```

## Verification

After implementing these fixes, the NEW100 discount code should work correctly:
- It should be visible in the discount code list
- It should validate successfully when applied to orders
- It should not show as expired

## Future Considerations

1. **User-Specific Codes**: If you want to implement user-specific discount codes, you'll need to update the RLS policy to include `auth.uid() = user_id` condition.
2. **Logging**: Add more detailed logging to the edge function to help with debugging.
3. **Error Handling**: Improve error messages to be more user-friendly.