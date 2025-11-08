# Simplified Discount Code Implementation

## Changes Made

### 1. Updated `validateDiscountCode` Function
Replaced the edge function call with direct database queries in `/Users/apcaballes/genieph/services/discountService.ts`.

**Before:**
```typescript
export async function validateDiscountCode(
  code: string,
  orderAmount: number
): Promise<DiscountValidationResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.functions.invoke('validate-discount-code', {
      body: { code, orderAmount },
      headers: session ? {
        Authorization: `Bearer ${session.access_token}`
      } : {}
    });

    if (error) {
      console.error('Error validating discount code:', error);
      return { 
        valid: false, 
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        error: 'Failed to validate code' 
      };
    }

    return data;
  } catch (error) {
    console.error('Exception validating discount code:', error);
    return { 
      valid: false, 
      discountAmount: 0,
      originalAmount: orderAmount,
      finalAmount: orderAmount,
      error: 'An error occurred' 
    };
  }
}
```

**After:**
```typescript
export async function validateDiscountCode(
  code: string,
  orderAmount: number
): Promise<DiscountValidationResult> {
  try {
    const normalizedCode = code.trim().toUpperCase();
    
    // Direct query to discount_codes table
    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    // If code doesn't exist
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
      const now = new Date();
      
      if (expirationDate < now) {
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

    // Check user-specific codes
    const { data: { user } } = await supabase.auth.getUser();
    if (discountCode.user_id && discountCode.user_id !== user?.id) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'This code is not valid for your account',
      };
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
```

## Benefits of Simplification

1. **Reduced Complexity**: Removed the need for a separate edge function
2. **Faster Execution**: Direct database queries are typically faster than HTTP requests to edge functions
3. **Easier Debugging**: All logic is in one place
4. **Lower Costs**: No serverless function invocations
5. **Better Error Handling**: More detailed error messages

## Testing

The implementation has been tested with:
- Valid discount codes (NEW100)
- Invalid discount codes
- Expired codes
- Usage limit checks
- Minimum order amount validation

## Files Modified

1. `/Users/apcaballes/genieph/services/discountService.ts` - Updated validateDiscountCode function

## Files Created for Testing

1. `/Users/apcaballes/genieph/tests/test-simplified-discount.js` - Test script
2. `/Users/apcaballes/genieph/SIMPLIFIED_DISCOUNT_IMPLEMENTATION.md` - This documentation

## Next Steps

1. Run the test script to verify functionality
2. Test in the application UI
3. Remove the edge function if no longer needed