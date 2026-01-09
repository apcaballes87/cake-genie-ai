# Discount Code Tracking Fix - Implementation Guide

## 🎯 Overview

This fix adds complete discount code tracking to your Cake Genie orders system. After applying this fix:
- ✅ Orders will track which discount code was used
- ✅ Discount code usage will be recorded in `discount_code_usage` table
- ✅ Usage limits will be enforced (one-time use codes, max uses, etc.)
- ✅ Analytics on discount code performance will be available

## 📋 What Was the Problem?

The `create_order_from_cart` RPC function in your database didn't accept the `p_discount_code_id` parameter that your frontend was trying to pass. This caused a 404 error when placing orders with discount codes.

## 🔧 What This Fix Does

1. **Adds `discount_code_id` column** to `cakegenie_orders` table to track which code was used
2. **Updates the `create_order_from_cart` RPC function** to accept and handle `p_discount_code_id`
3. **Records discount usage** in `discount_code_usage` table automatically
4. **Increments usage counter** on the discount code
5. **Updates TypeScript types** to match the new database schema

## 📝 Step-by-Step Implementation

### Step 1: Run the SQL Migration

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/cqmhanqnfybyxezhobkx
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase_discount_tracking_fix.sql`
5. Paste it into the SQL Editor
6. Click **Run** or press `Cmd/Ctrl + Enter`
7. Wait for the migration to complete (you should see success messages)

### Step 2: Verify the Migration

After running the SQL, you should see output messages like:
```
✅ Column discount_code_id added to cakegenie_orders table
✅ Function create_order_from_cart updated
✅ Table discount_code_usage created/verified
✅ Migration completed successfully!
```

### Step 3: Verify TypeScript Types

The TypeScript types have already been updated in:
- ✅ `/src/lib/database.types.ts` - Added `discount_code_id: string | null` to `CakeGenieOrder` interface

### Step 4: Test the Fix

1. **Start your development server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Test with a discount code**:
   - Add items to your cart
   - Go to the cart page
   - Apply a valid discount code
   - Complete the checkout process
   - Place the order

3. **Verify in Supabase**:
   - Go to Supabase Dashboard > Table Editor
   - Check `cakegenie_orders` table - the new order should have a `discount_code_id` value
   - Check `discount_code_usage` table - should have a new record for this usage
   - Check `discount_codes` table - the `times_used` counter should be incremented

## 🔍 Database Schema Changes

### New Column in `cakegenie_orders`
```sql
discount_code_id UUID NULL REFERENCES discount_codes(code_id)
```

### Updated RPC Function Signature
```sql
create_order_from_cart(
    p_user_id UUID,
    p_delivery_address_id UUID,
    p_delivery_date DATE,
    p_delivery_time_slot TEXT,
    p_subtotal NUMERIC,
    p_delivery_fee NUMERIC,
    p_delivery_instructions TEXT DEFAULT NULL,
    p_discount_amount NUMERIC DEFAULT 0,
    p_discount_code_id UUID DEFAULT NULL  -- ✨ NEW PARAMETER
)
```

### New/Updated Table: `discount_code_usage`
```sql
CREATE TABLE discount_code_usage (
    usage_id UUID PRIMARY KEY,
    discount_code_id UUID NOT NULL,
    user_id UUID NOT NULL,
    order_id UUID NOT NULL,
    discount_amount_applied NUMERIC NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

## 📊 What the Fix Tracks

After this fix, you'll be able to:

1. **See which discount codes were used in each order**
   ```sql
   SELECT o.order_number, dc.code, o.discount_amount
   FROM cakegenie_orders o
   LEFT JOIN discount_codes dc ON o.discount_code_id = dc.code_id
   WHERE o.discount_amount > 0;
   ```

2. **Track total usage and revenue impact per discount code**
   ```sql
   SELECT
       dc.code,
       COUNT(dcu.usage_id) as total_uses,
       SUM(dcu.discount_amount_applied) as total_discount_given
   FROM discount_codes dc
   LEFT JOIN discount_code_usage dcu ON dc.code_id = dcu.discount_code_id
   GROUP BY dc.code_id, dc.code
   ORDER BY total_discount_given DESC;
   ```

3. **Enforce usage limits** - The RPC function automatically:
   - Increments the `times_used` counter
   - Records usage in `discount_code_usage` table
   - This allows validation of one-time use and max usage limits

## 🚨 Troubleshooting

### Issue: Migration fails with "column already exists"
**Solution**: This is fine! The migration is idempotent - it checks if changes are already applied.

### Issue: Still getting 404 error after migration
**Solution**:
1. Verify the migration ran successfully by checking the verification queries at the end
2. Clear your browser cache and reload
3. Check that the function exists: Go to Supabase > Database > Functions

### Issue: Discount codes not being tracked
**Solution**:
1. Verify `discount_code_id` column exists in orders table
2. Check that discount_code_usage table was created
3. Look at browser console for any errors
4. Verify the discount code has a valid `code_id` in the `discount_codes` table

## 📞 Support

If you encounter any issues:
1. Check the browser console for errors
2. Check Supabase logs in Dashboard > Logs > Postgres Logs
3. Verify all tables and columns exist using the verification queries in the SQL file

## ✅ Checklist

- [ ] Ran `supabase_discount_tracking_fix.sql` in Supabase SQL Editor
- [ ] Verified all success messages appeared
- [ ] Confirmed `discount_code_id` column exists in `cakegenie_orders`
- [ ] Confirmed `discount_code_usage` table exists
- [ ] TypeScript types updated (already done)
- [ ] Tested order creation with a discount code
- [ ] Verified discount usage was recorded in database
- [ ] Verified `times_used` counter incremented

## 🎉 Success Indicators

You'll know the fix worked when:
1. ✅ Orders complete successfully with discount codes (no 404 error)
2. ✅ Orders show `discount_code_id` in database
3. ✅ `discount_code_usage` table has new records
4. ✅ Discount code `times_used` counter increases
5. ✅ One-time use codes can't be reused

---

**Implementation Date**: 2025-11-18
**Files Modified**:
- `src/lib/database.types.ts` ✅ Already updated
- `supabase_discount_tracking_fix.sql` ✅ Created (needs to be run in Supabase)

**Files Already Correct** (no changes needed):
- `src/services/supabaseService.ts` - Already passes `p_discount_code_id`
- `src/app/cart/page.tsx` - Already passes `discountCodeId` to service
