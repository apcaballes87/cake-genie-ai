# Discount Code Feature - Implementation Instructions for Google AI Studio

Copy and paste this entire prompt to Google AI Studio to implement the complete discount code feature in your older app version.

---

## PROMPT FOR GOOGLE AI STUDIO:

```
I need you to implement a comprehensive discount code feature for my e-commerce cake ordering app. This feature supports:

✅ Basic discount codes with validation
✅ Fixed amount discounts (e.g., ₱100 off)
✅ Percentage discounts (e.g., 20% off)
✅ Expiration dates
✅ Usage limits (max uses)
✅ Minimum order amount requirements
✅ One-time use per user restriction
✅ New users only restriction (users who never ordered before)
✅ User-specific codes
✅ Usage tracking and audit trail

Please implement this STEP-BY-STEP following the exact specifications below:

---

## STEP 1: CREATE DATABASE TABLES & MIGRATIONS

Create these Supabase SQL migrations IN ORDER:

### Migration 1: Create discount_codes table
File: `supabase/migrations/[timestamp]_create_discount_codes_table.sql`

```sql
CREATE TABLE IF NOT EXISTS discount_codes (
  code_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  discount_amount NUMERIC(10, 2) DEFAULT 0,
  discount_percentage NUMERIC(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  times_used INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 1,
  min_order_amount NUMERIC(10, 2) DEFAULT 0,
  one_per_user BOOLEAN DEFAULT false,
  new_users_only BOOLEAN DEFAULT false,
  reason VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_discount CHECK (
    (discount_amount > 0 AND discount_percentage = 0) OR
    (discount_percentage > 0 AND discount_amount = 0)
  ),
  CONSTRAINT valid_max_uses CHECK (max_uses > 0),
  CONSTRAINT valid_percentage CHECK (discount_percentage BETWEEN 0 AND 100)
);

CREATE INDEX idx_discount_codes_code ON discount_codes(code);
CREATE INDEX idx_discount_codes_user_id ON discount_codes(user_id);
CREATE INDEX idx_discount_codes_active ON discount_codes(is_active) WHERE is_active = true;

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE discount_codes IS 'Stores promotional and contributor discount codes';
COMMENT ON COLUMN discount_codes.one_per_user IS 'If true, each user can only use this code once';
COMMENT ON COLUMN discount_codes.new_users_only IS 'If true, only users who have never placed an order can use this code';
```

### Migration 2: Create usage tracking table
File: `supabase/migrations/[timestamp]_create_discount_usage_table.sql`

```sql
CREATE TABLE IF NOT EXISTS discount_code_usage (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID NOT NULL REFERENCES discount_codes(code_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(order_id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_user_code_usage UNIQUE (discount_code_id, user_id)
);

CREATE INDEX idx_discount_usage_code ON discount_code_usage(discount_code_id);
CREATE INDEX idx_discount_usage_user ON discount_code_usage(user_id);
CREATE INDEX idx_discount_usage_order ON discount_code_usage(order_id);

ALTER TABLE discount_code_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
  ON discount_code_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert usage"
  ON discount_code_usage FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON TABLE discount_code_usage IS 'Tracks which users have used which discount codes';
```

### Migration 3: Add discount fields to orders table
File: `supabase/migrations/[timestamp]_add_discount_to_orders.sql`

```sql
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES discount_codes(code_id);

CREATE INDEX idx_orders_discount_code ON orders(discount_code_id);

COMMENT ON COLUMN orders.discount_code_id IS 'Reference to the discount code used';
```

### Migration 4: Setup RLS policies for discount_codes
File: `supabase/migrations/[timestamp]_discount_codes_rls.sql`

```sql
CREATE POLICY "Allow anonymous read access to discount codes"
  ON discount_codes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can insert discount codes"
  ON discount_codes FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update discount codes"
  ON discount_codes FOR UPDATE
  TO service_role
  USING (true);
```

---

## STEP 2: CREATE DISCOUNT SERVICE

Create file: `services/discountService.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

// Use your Supabase client initialization method
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface DiscountValidationResult {
  valid: boolean;
  discountAmount: number;
  codeId?: string;
  originalAmount: number;
  finalAmount: number;
  message?: string;
}

/**
 * Validate a discount code
 * Returns validation result with calculated discount
 */
export async function validateDiscountCode(
  code: string,
  orderAmount: number
): Promise<DiscountValidationResult> {
  try {
    const normalizedCode = code.trim().toUpperCase();
    console.log('🎫 Validating discount code:', { code: normalizedCode, orderAmount });

    // Query discount code
    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    if (error || !discountCode) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'Invalid discount code',
      };
    }

    // Check if active
    if (!discountCode.is_active) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'This discount code is no longer active',
      };
    }

    // Check expiration
    if (discountCode.expires_at) {
      const expirationDate = new Date(discountCode.expires_at);
      if (expirationDate < new Date()) {
        return {
          valid: false,
          discountAmount: 0,
          originalAmount: orderAmount,
          finalAmount: orderAmount,
          message: `This code expired on ${expirationDate.toLocaleDateString()}`,
        };
      }
    }

    // Check usage limit
    if (discountCode.times_used >= discountCode.max_uses) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'This discount code has reached its usage limit',
      };
    }

    // Check minimum order amount
    if (discountCode.min_order_amount && orderAmount < discountCode.min_order_amount) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: `Minimum order amount of ₱${discountCode.min_order_amount} required`,
      };
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Check user-specific codes
    if (discountCode.user_id && discountCode.user_id !== user?.id) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'This code is not valid for your account',
      };
    }

    // Check authentication requirement
    if ((discountCode.one_per_user || discountCode.new_users_only) && !user) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'You must be logged in to use this discount code',
      };
    }

    // Check new users only restriction
    if (discountCode.new_users_only && user) {
      const { data: previousOrders } = await supabase
        .from('orders')
        .select('order_id')
        .eq('user_id', user.id)
        .limit(1);

      if (previousOrders && previousOrders.length > 0) {
        return {
          valid: false,
          discountAmount: 0,
          originalAmount: orderAmount,
          finalAmount: orderAmount,
          message: 'This code is only for new customers',
        };
      }
    }

    // Check one-per-user restriction
    if (discountCode.one_per_user && user) {
      const { data: previousUsage } = await supabase
        .from('discount_code_usage')
        .select('usage_id')
        .eq('discount_code_id', discountCode.code_id)
        .eq('user_id', user.id)
        .limit(1);

      if (previousUsage && previousUsage.length > 0) {
        return {
          valid: false,
          discountAmount: 0,
          originalAmount: orderAmount,
          finalAmount: orderAmount,
          message: 'You have already used this discount code',
        };
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (discountCode.discount_amount > 0) {
      discountAmount = discountCode.discount_amount;
    } else if (discountCode.discount_percentage > 0) {
      discountAmount = (orderAmount * discountCode.discount_percentage) / 100;
    }

    const finalAmount = Math.max(0, orderAmount - discountAmount);

    return {
      valid: true,
      discountAmount,
      codeId: discountCode.code_id,
      originalAmount: orderAmount,
      finalAmount,
      message: 'Discount code applied successfully!',
    };
  } catch (error) {
    console.error('Error validating discount code:', error);
    return {
      valid: false,
      discountAmount: 0,
      originalAmount: orderAmount,
      finalAmount: orderAmount,
      message: 'Error validating discount code',
    };
  }
}

/**
 * Record discount code usage after order creation
 */
export async function recordDiscountCodeUsage(
  discountCodeId: string,
  userId: string,
  orderId: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('discount_code_usage')
      .insert({
        discount_code_id: discountCodeId,
        user_id: userId,
        order_id: orderId,
      });

    if (error) {
      console.error('Error recording discount usage:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception recording discount usage:', error);
    return { success: false, error };
  }
}
```

---

## STEP 3: INTEGRATE INTO CART PAGE

Update your cart/checkout page to include discount functionality:

```typescript
import { useState, useEffect } from 'react';
import { validateDiscountCode } from '@/services/discountService';

// Add state for discount
const [discountCode, setDiscountCode] = useState('');
const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
const [isValidatingCode, setIsValidatingCode] = useState(false);

// Handle applying discount
const handleApplyDiscount = async () => {
  if (!discountCode.trim()) return;

  setIsValidatingCode(true);
  const result = await validateDiscountCode(discountCode.toUpperCase(), subtotal);
  setIsValidatingCode(false);

  if (result.valid) {
    setAppliedDiscount(result);
    // Show success message
  } else {
    setAppliedDiscount(null);
    // Show error message with result.message
  }
};

// Handle removing discount
const handleRemoveDiscount = () => {
  setAppliedDiscount(null);
  setDiscountCode('');
};

// Calculate total with discount
const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
const deliveryFee = 150;
const discountAmount = appliedDiscount?.discountAmount || 0;
const total = subtotal + deliveryFee - discountAmount;
```

### Add UI for discount code input:

```tsx
{/* Discount Code Section */}
<div className="border-t pt-4">
  <h3 className="font-semibold mb-3">Have a Discount Code?</h3>

  {!appliedDiscount ? (
    <div className="flex gap-2">
      <input
        type="text"
        value={discountCode}
        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
        placeholder="Enter code"
        className="flex-1 px-3 py-2 border rounded-lg uppercase"
        maxLength={20}
      />
      <button
        onClick={handleApplyDiscount}
        disabled={isValidatingCode || !discountCode.trim()}
        className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50"
      >
        {isValidatingCode ? 'Validating...' : 'Apply'}
      </button>
    </div>
  ) : (
    <div className="bg-green-50 border border-green-300 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-green-800">
            ✅ Code: {discountCode}
          </p>
          <p className="text-sm text-green-700">
            Saving ₱{appliedDiscount.discountAmount?.toFixed(2)}
          </p>
        </div>
        <button
          onClick={handleRemoveDiscount}
          className="text-red-600 hover:text-red-800"
        >
          Remove
        </button>
      </div>
    </div>
  )}
</div>

{/* Show discount in totals */}
<div className="space-y-2 mt-4">
  <div className="flex justify-between">
    <span>Subtotal:</span>
    <span>₱{subtotal.toFixed(2)}</span>
  </div>
  <div className="flex justify-between">
    <span>Delivery Fee:</span>
    <span>₱{deliveryFee.toFixed(2)}</span>
  </div>
  {appliedDiscount && (
    <div className="flex justify-between text-green-600 font-semibold">
      <span>Discount:</span>
      <span>-₱{discountAmount.toFixed(2)}</span>
    </div>
  )}
  <div className="flex justify-between text-lg font-bold border-t pt-2">
    <span>Total:</span>
    <span>₱{total.toFixed(2)}</span>
  </div>
</div>
```

---

## STEP 4: UPDATE ORDER CREATION

When creating an order, pass the discount information:

```typescript
// In your order creation function
const createOrder = async () => {
  // ... your existing order creation logic ...

  const orderData = {
    // ... your existing order fields ...
    subtotal: subtotal,
    delivery_fee: deliveryFee,
    discount_amount: appliedDiscount?.discountAmount || 0,
    discount_code_id: appliedDiscount?.codeId || null,
    total_amount: total,
  };

  const { data: order, error } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();

  if (error) throw error;

  // Record discount usage if applicable
  if (appliedDiscount?.codeId && user?.id) {
    const { recordDiscountCodeUsage } = await import('@/services/discountService');
    await recordDiscountCodeUsage(
      appliedDiscount.codeId,
      user.id,
      order.order_id
    );
  }

  return order;
};
```

---

## STEP 5: CREATE TEST DISCOUNT CODES

Run this SQL in Supabase to create test codes:

```sql
-- Fixed amount code (₱100 off, unlimited uses)
INSERT INTO discount_codes (code, discount_amount, is_active, max_uses)
VALUES ('NEW100', 100, true, 1000);

-- Percentage code (20% off, new users only)
INSERT INTO discount_codes (code, discount_percentage, is_active, max_uses, new_users_only, min_order_amount)
VALUES ('NEWCUSTOMER20', 20, true, 500, true, 500);

-- One-time per user code (₱50 off)
INSERT INTO discount_codes (code, discount_amount, is_active, max_uses, one_per_user)
VALUES ('ONETIME50', 50, true, 1000, true);

-- First order only (₱75 off, new users, one time)
INSERT INTO discount_codes (code, discount_amount, is_active, max_uses, one_per_user, new_users_only)
VALUES ('FIRSTORDER75', 75, true, 500, true, true);
```

---

## STEP 6: TESTING CHECKLIST

Test these scenarios:

✅ Apply valid discount code → Should calculate correct discount
✅ Apply invalid code → Should show error
✅ Apply expired code → Should reject
✅ Apply code below min order → Should reject
✅ Apply one-per-user code twice → Second time should reject
✅ Apply new-user-only code as returning customer → Should reject
✅ Apply code, then remove it → Total should update
✅ Complete order with discount → Should save to database
✅ Check discount_code_usage table → Should have usage record

---

## VALIDATION FLOW

The system validates in this order:
1. Code exists in database
2. Code is active (is_active = true)
3. Not expired (if expires_at is set)
4. Usage limit not reached (times_used < max_uses)
5. Minimum order amount met (if min_order_amount is set)
6. User matches (if code is user-specific)
7. User is authenticated (if one_per_user or new_users_only)
8. User is new (if new_users_only)
9. User hasn't used before (if one_per_user)
10. Calculate discount (fixed amount OR percentage)
11. Return validation result

---

## IMPORTANT NOTES

1. **Mutually Exclusive Discounts**: A code can have EITHER `discount_amount` OR `discount_percentage`, not both (enforced by database constraint)

2. **Usage Tracking**: Uses `discount_code_usage` table with UNIQUE constraint on (discount_code_id, user_id) to prevent duplicate usage

3. **Fire-and-Forget Recording**: Usage recording happens after order creation and doesn't fail the order if it errors

4. **RLS Policies**:
   - Anyone can READ discount codes (validation happens in app)
   - Only service role can INSERT/UPDATE
   - Users can only see their own usage history

5. **New User Definition**: A "new user" is someone with ZERO previous orders in the database

6. **Console Logging**: Extensive logging for debugging - check browser console when testing

---

Please implement all steps above and let me know when complete. Test with the provided test codes and verify all scenarios work correctly.
```

---

## USAGE

1. Copy everything between the triple backticks above
2. Paste into Google AI Studio
3. The AI will implement the entire discount code feature step-by-step
4. Review each step as it completes
5. Test thoroughly using the checklist provided

This prompt contains:
- ✅ Complete database schema
- ✅ All TypeScript service code
- ✅ Frontend integration
- ✅ Order creation updates
- ✅ Test data creation
- ✅ Validation logic flow
- ✅ Testing checklist

The AI will have everything needed to implement this feature from scratch!
