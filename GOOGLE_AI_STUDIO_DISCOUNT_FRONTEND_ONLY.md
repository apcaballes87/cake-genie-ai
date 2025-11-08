# Discount Code Feature - FRONTEND IMPLEMENTATION ONLY (Google AI Studio)

Copy and paste this prompt to Google AI Studio to implement ONLY the frontend discount code functionality.

**NOTE: The database is already fully set up. You only need to implement the client-side code.**

---

## PROMPT FOR GOOGLE AI STUDIO:

```
I need you to implement the FRONTEND/CLIENT-SIDE discount code feature for my e-commerce cake ordering app.

🔴 IMPORTANT: THE DATABASE IS ALREADY FULLY SET UP
- All tables exist (discount_codes, discount_code_usage)
- All RLS policies are configured
- Orders table already has discount_amount and discount_code_id columns
- DO NOT create any SQL migrations or database changes

✅ What you need to implement:
1. Discount validation service (TypeScript)
2. Cart page UI for discount codes
3. State management for applied discounts
4. Integration with order creation
5. Usage tracking after successful orders

---

## STEP 1: UNDERSTAND THE DATABASE SCHEMA (Reference Only)

You'll be querying these existing tables:

### discount_codes table
```
code_id - UUID primary key
code - VARCHAR(50) - The discount code (e.g., "NEW100")
discount_amount - NUMERIC - Fixed amount off (e.g., 100.00)
discount_percentage - NUMERIC - Percentage off (e.g., 20.00 for 20%)
is_active - BOOLEAN - Whether code is currently active
expires_at - TIMESTAMP - Optional expiration date
times_used - INTEGER - How many times code has been used
max_uses - INTEGER - Maximum allowed uses
min_order_amount - NUMERIC - Minimum order total required
one_per_user - BOOLEAN - Each user can only use once
new_users_only - BOOLEAN - Only for users with no previous orders
user_id - UUID - Optional, for user-specific codes
```

### discount_code_usage table
```
usage_id - UUID primary key
discount_code_id - UUID (FK to discount_codes)
user_id - UUID (FK to auth.users)
order_id - UUID (FK to orders)
used_at - TIMESTAMP
```

### orders table (has these discount columns)
```
discount_amount - NUMERIC
discount_code_id - UUID (FK to discount_codes)
```

---

## STEP 2: CREATE DISCOUNT VALIDATION SERVICE

Create file: `services/discountService.ts` (or `.js`)

```typescript
import { createClient } from '@supabase/supabase-js';

// Use your existing Supabase client initialization
// Adjust this to match your project's setup
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
 * Validates a discount code and returns the calculated discount
 * Checks all restrictions: active, expired, usage limits, user restrictions, etc.
 */
export async function validateDiscountCode(
  code: string,
  orderAmount: number
): Promise<DiscountValidationResult> {
  try {
    const normalizedCode = code.trim().toUpperCase();
    console.log('🎫 Validating discount code:', { code: normalizedCode, orderAmount });

    // Query the discount_codes table
    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    // Code doesn't exist
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

    // Check if code is user-specific
    if (discountCode.user_id && discountCode.user_id !== user?.id) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'This code is not valid for your account',
      };
    }

    // Check if user needs to be logged in
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

    // Calculate discount amount
    let discountAmount = 0;
    if (discountCode.discount_amount > 0) {
      // Fixed amount discount
      discountAmount = discountCode.discount_amount;
    } else if (discountCode.discount_percentage > 0) {
      // Percentage discount
      discountAmount = (orderAmount * discountCode.discount_percentage) / 100;
    }

    // Ensure discount doesn't exceed order amount
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
 * Records that a user used a discount code (call after order creation)
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

## STEP 3: ADD DISCOUNT STATE TO CART PAGE

In your cart/checkout page component, add these state variables:

```typescript
import { useState } from 'react';
import { validateDiscountCode, DiscountValidationResult } from '@/services/discountService';

// Inside your component:
const [discountCode, setDiscountCode] = useState('');
const [appliedDiscount, setAppliedDiscount] = useState<DiscountValidationResult | null>(null);
const [isValidatingCode, setIsValidatingCode] = useState(false);

// Handler for applying discount
const handleApplyDiscount = async () => {
  if (!discountCode.trim()) {
    alert('Please enter a discount code');
    return;
  }

  setIsValidatingCode(true);
  const result = await validateDiscountCode(discountCode.toUpperCase(), subtotal);
  setIsValidatingCode(false);

  if (result.valid) {
    setAppliedDiscount(result);
    alert(result.message || 'Discount applied!');
  } else {
    setAppliedDiscount(null);
    alert(result.message || 'Invalid discount code');
  }
};

// Handler for removing discount
const handleRemoveDiscount = () => {
  setAppliedDiscount(null);
  setDiscountCode('');
};

// Calculate totals with discount
const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
const deliveryFee = 150; // Or your delivery fee logic
const discountAmount = appliedDiscount?.discountAmount || 0;
const total = subtotal + deliveryFee - discountAmount;
```

---

## STEP 4: ADD DISCOUNT UI TO CART PAGE

Add this UI wherever you show the cart totals:

```tsx
{/* Discount Code Section */}
<div className="border-t border-gray-200 pt-4 mt-4">
  <h3 className="text-sm font-semibold text-gray-700 mb-3">
    Have a Discount Code?
  </h3>

  {!appliedDiscount ? (
    <div className="flex gap-2">
      <input
        type="text"
        value={discountCode}
        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
        placeholder="Enter code"
        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg uppercase font-mono focus:outline-none focus:ring-2 focus:ring-pink-500"
        maxLength={20}
      />
      <button
        onClick={handleApplyDiscount}
        disabled={isValidatingCode || !discountCode.trim()}
        className="px-4 py-2 bg-pink-600 text-white text-sm font-semibold rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isValidatingCode ? 'Validating...' : 'Apply'}
      </button>
    </div>
  ) : (
    <div className="bg-green-50 border border-green-300 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-green-800">
            ✅ Code Applied: <span className="font-mono">{discountCode}</span>
          </p>
          <p className="text-xs text-green-700 mt-1">
            Saving ₱{appliedDiscount.discountAmount?.toFixed(2)}
          </p>
        </div>
        <button
          onClick={handleRemoveDiscount}
          className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  )}
</div>

{/* Price Breakdown with Discount */}
<div className="space-y-2 mt-4">
  <div className="flex justify-between text-sm text-gray-600">
    <span>Subtotal:</span>
    <span>₱{subtotal.toFixed(2)}</span>
  </div>

  <div className="flex justify-between text-sm text-gray-600">
    <span>Delivery Fee:</span>
    <span>₱{deliveryFee.toFixed(2)}</span>
  </div>

  {appliedDiscount && (
    <div className="flex justify-between text-sm text-green-600 font-semibold">
      <span>Discount ({discountCode}):</span>
      <span>-₱{discountAmount.toFixed(2)}</span>
    </div>
  )}

  <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2 mt-2">
    <span>Total:</span>
    <span>₱{total.toFixed(2)}</span>
  </div>
</div>
```

---

## STEP 5: UPDATE ORDER CREATION

When creating an order, include the discount information:

```typescript
// In your order creation function
const createOrder = async () => {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Prepare order data
    const orderData = {
      user_id: user?.id,
      subtotal: subtotal,
      delivery_fee: deliveryFee,
      discount_amount: appliedDiscount?.discountAmount || 0,
      discount_code_id: appliedDiscount?.codeId || null,
      total_amount: total,
      // ... your other order fields ...
    };

    // Insert order
    const { data: order, error } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (error) throw error;

    // Record discount usage if applicable
    if (appliedDiscount?.codeId && user?.id && order?.order_id) {
      const { recordDiscountCodeUsage } = await import('@/services/discountService');

      // This is fire-and-forget - don't fail the order if this errors
      recordDiscountCodeUsage(
        appliedDiscount.codeId,
        user.id,
        order.order_id
      ).catch(err => {
        console.error('Failed to record discount usage:', err);
        // Don't throw - order was successful
      });
    }

    // Clear discount state after successful order
    setAppliedDiscount(null);
    setDiscountCode('');

    return order;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};
```

---

## STEP 6: TESTING CHECKLIST

Test these scenarios to ensure everything works:

✅ **Basic Validation:**
- Enter valid code → Should calculate discount correctly
- Enter invalid code → Should show error message
- Enter code and remove it → Totals should update

✅ **Restrictions:**
- Apply code below minimum order → Should reject
- Apply expired code → Should reject with expiration date
- Apply code that reached max uses → Should reject

✅ **User Restrictions:**
- Apply one-per-user code → Should work first time
- Try same code again after order → Should reject with "already used"
- Apply new-user-only code as returning customer → Should reject

✅ **Order Integration:**
- Complete order with discount → Should save discount_amount and discount_code_id
- Check discount_code_usage table → Should have usage record

✅ **UI/UX:**
- Input shows uppercase as you type
- Apply button disabled when validating
- Success/error messages appear
- Discount shows in totals breakdown
- Remove button clears discount

---

## VALIDATION LOGIC FLOW

For your reference, here's how validation works:

```
User enters code → Normalize (trim, uppercase)
  ↓
Query discount_codes table
  ↓
Check in order:
  1. Code exists
  2. is_active = true
  3. Not expired (expires_at > now)
  4. Usage limit not reached (times_used < max_uses)
  5. Meets minimum order (orderAmount >= min_order_amount)
  6. User matches user_id (if user-specific code)
  7. User is authenticated (if one_per_user or new_users_only)
  8. User is new (if new_users_only = true)
  9. User hasn't used before (if one_per_user = true)
  ↓
Calculate discount:
  - If discount_amount > 0: use fixed amount
  - Else if discount_percentage > 0: apply percentage to subtotal
  ↓
Return result with valid/invalid and message
```

---

## IMPORTANT NOTES

1. **Two Types of Discounts:**
   - Fixed amount: `discount_amount` field (e.g., 100 = ₱100 off)
   - Percentage: `discount_percentage` field (e.g., 20 = 20% off)
   - A code has EITHER amount OR percentage, never both

2. **Usage Tracking:**
   - `discount_code_usage` table records who used what code
   - UNIQUE constraint on (discount_code_id, user_id) prevents duplicate usage
   - Recorded AFTER successful order creation (fire-and-forget)

3. **New User Definition:**
   - "New user" = user with ZERO orders in the database
   - Checked by querying orders table for user_id

4. **Error Handling:**
   - All validation errors return friendly messages
   - Usage recording doesn't fail the order if it errors
   - Console logs help with debugging

5. **Security:**
   - RLS policies already configured on the database
   - Frontend can READ discount codes but not INSERT/UPDATE
   - Only service role can modify discount codes

---

Please implement all steps above. The database is ready - you only need to create the frontend code!

Test thoroughly with the provided checklist and let me know when complete.
```

---

## HOW TO USE THIS PROMPT

1. Copy everything between the triple backticks (starting from "I need you to implement...")
2. Paste into Google AI Studio
3. The AI will implement only the frontend discount code feature
4. No database changes will be made (database is already set up)
5. Test with the checklist provided

This is a frontend-only implementation guide! 🎨
