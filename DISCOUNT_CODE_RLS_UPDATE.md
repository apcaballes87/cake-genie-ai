# Discount Code RLS Policy Update

## Changes Made

### 1. Updated RLS Policies
Created new Row Level Security policies for the `discount_codes` table:

1. **"Anyone can view active discount codes"**
   - Allows anyone to read active discount codes for validation
   - Policy: `USING (is_active = true)`

2. **"Users can view their own specific codes"**
   - Allows authenticated users to see their user-specific codes
   - Policy: `USING (auth.uid() = user_id)`

3. **"Service role can insert discount codes"**
   - Only service role can insert new discount codes
   - Policy: `TO service_role WITH CHECK (true)`

4. **"Service role can update discount codes"**
   - Only service role can update discount codes (for usage tracking)
   - Policy: `TO service_role USING (true)`

### 2. Migration File
Created migration file: `/Users/apcaballes/genieph/supabase/migrations/20251108183000_fix_discount_codes_rls.sql`

### 3. Edge Function Decision
Kept the edge function as backup but no longer using it in the application.

## Benefits

1. **Simplified Access**: Frontend can now directly query discount codes for validation
2. **Better Performance**: No need for HTTP requests to edge functions
3. **Clear Permissions**: Explicit policies for different user roles
4. **Security**: Maintained proper access controls with service role restrictions
5. **Flexibility**: Can revert to edge function if needed

## Verification

✅ Successfully applied new RLS policies
✅ Verified access to discount codes with new policies
✅ Confirmed both TEST100 and NEW100 codes are accessible
✅ Edge function preserved as backup option

## Testing

The new policies allow:
- Anyone to view active discount codes (for validation)
- Authenticated users to see their specific codes
- Service role to insert and update codes
- No direct deletion (maintains audit trail)

## Next Steps

1. Test the discount code validation in the application
2. Monitor for any permission issues
3. Remove edge function after confirming direct access works reliably