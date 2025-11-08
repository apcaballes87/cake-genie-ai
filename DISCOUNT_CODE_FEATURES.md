# Discount Code Features - User Restrictions

## Overview
Added two powerful user restriction features to discount codes:
1. **One-time use per user** - Each user can only use the code once
2. **New users only** - Only users who have never placed an order can use the code

## Database Changes

### New Columns in `discount_codes` table:
- `one_per_user` (BOOLEAN) - If true, each user can only use this code once
- `new_users_only` (BOOLEAN) - If true, only users with no previous orders can use this code

### New Table: `discount_code_usage`
Tracks which users have used which discount codes:
- `usage_id` (UUID, PRIMARY KEY)
- `discount_code_id` (UUID, FOREIGN KEY to discount_codes)
- `user_id` (UUID, FOREIGN KEY to auth.users)
- `order_id` (UUID, FOREIGN KEY to cakegenie_orders)
- `used_at` (TIMESTAMP)

**Constraint:** `UNIQUE(discount_code_id, user_id)` - Prevents duplicate usage records

## How It Works

### Validation Logic
When a user applies a discount code, the system checks:

1. **New Users Only Check** (if `new_users_only = true`):
   - Queries `cakegenie_orders` for any orders by this user
   - If orders exist → Reject with "This code is only for new customers"
   - If no orders → Allow to proceed

2. **One Per User Check** (if `one_per_user = true`):
   - Queries `discount_code_usage` table for this user + code combination
   - If usage record exists → Reject with "You have already used this discount code"
   - If no record → Allow to proceed

3. **Usage Tracking**:
   - After successful order creation, inserts record into `discount_code_usage`
   - Tracks: discount_code_id, user_id, order_id, timestamp
   - Fire-and-forget pattern (doesn't fail order if tracking fails)

### Authentication Requirement
- Users **must be logged in** to use codes with either restriction
- Anonymous users get: "You must be logged in to use this discount code"

## Example Discount Codes

### Code: ONETIME50
```
discount_amount: 50
one_per_user: true
new_users_only: false
```
- Any user can use it, but only once
- After using once, they can't use it again
- Perfect for "refer a friend" scenarios

### Code: WELCOME100
```
discount_amount: 100
one_per_user: false
new_users_only: true
```
- Only works for users with no previous orders
- They could technically use it multiple times on same cart
- After their first order, code becomes invalid for them

### Code: FIRSTORDER75
```
discount_amount: 75
one_per_user: true
new_users_only: true
```
- **Combines both restrictions**
- Only for new users
- And only usable once
- Perfect for true "first order" discounts

### Code: UNLIMITED25
```
discount_percentage: 25
one_per_user: false
new_users_only: false
min_order_amount: 500
```
- No user restrictions
- Users can use multiple times
- Only limited by min order amount

## Testing

### Step 1: Apply Migration
Run this SQL in Supabase SQL Editor:
```sql
-- The migration file: 20251108200000_add_discount_user_restrictions.sql
-- Adds one_per_user and new_users_only columns
-- Creates discount_code_usage table
```

### Step 2: Create Test Codes
```bash
node tests/create-restricted-discount-codes.js
```

This creates 4 test codes with different restriction combinations.

### Step 3: Test Scenarios

**Test ONETIME50:**
1. Log in as a user
2. Add items to cart
3. Apply ONETIME50 → Should work ✅
4. Complete the order
5. Add new items to cart
6. Try ONETIME50 again → Should fail with "already used" ❌

**Test WELCOME100:**
1. Log in as a brand new user (never ordered)
2. Apply WELCOME100 → Should work ✅
3. Complete an order
4. Try WELCOME100 on a new cart → Should fail with "only for new customers" ❌

**Test FIRSTORDER75:**
1. Log in as brand new user
2. Apply FIRSTORDER75 → Should work ✅
3. Complete the order
4. Try again → Should fail (both restrictions apply) ❌

**Test Anonymous User:**
1. Without logging in, try any restricted code
2. Should get "You must be logged in" ❌

## Console Logging

The validation function has detailed logging:
```
🎫 Validating discount code
📊 Query result
🔍 Checking if user is new
🔍 Checking if user has used this code before
✅ User is new, eligible for code
✅ User has not used this code before
📝 Recording discount code usage
```

Check browser console to debug any issues.

## Files Changed

1. **Migration:** `supabase/migrations/20251108200000_add_discount_user_restrictions.sql`
   - Adds new columns and usage tracking table

2. **Validation:** `services/discountService.ts`
   - Added new validation checks
   - Added `recordDiscountCodeUsage()` function

3. **Order Creation:** `services/supabaseService.ts`
   - Records usage after successful order

4. **Test Script:** `tests/create-restricted-discount-codes.js`
   - Creates test codes with restrictions

## Security Notes

- ✅ Usage tracking uses `UNIQUE` constraint to prevent duplicate records
- ✅ RLS policies on `discount_code_usage` table
- ✅ Fire-and-forget usage recording doesn't fail orders
- ✅ All checks happen server-side (can't be bypassed by client)
- ✅ Validation happens before order creation
- ✅ Usage is only recorded after successful order

## Next Steps

1. Apply the migration to your database
2. Run the test script to create sample codes
3. Test each scenario
4. Monitor console logs for any issues
5. Create your own production discount codes with restrictions as needed

## Creating Codes Manually

In Supabase dashboard, when creating a discount code:

```sql
INSERT INTO discount_codes (
  code,
  discount_amount,
  is_active,
  max_uses,
  expires_at,
  one_per_user,      -- TRUE for one-time per user
  new_users_only,    -- TRUE for new customers only
  reason
) VALUES (
  'MYCODE',
  100,
  true,
  1000,
  NOW() + INTERVAL '1 year',
  true,              -- Set restriction here
  false,             -- Set restriction here
  'My custom code'
);
```

That's it! Your discount codes now support sophisticated user restrictions. 🎉
