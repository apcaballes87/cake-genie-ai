# End-to-End Test Plan for Discount Codes

## Prerequisites
1. Supabase Service Role Key added to `.env.local`
2. Development server running (`npm run dev`)
3. Test discount codes created using `create-test-discount-codes.js`

## Test Steps

### 1. Create Test Discount Codes
```bash
node tests/create-test-discount-codes.js
```

Expected output:
- ✅ Created code: WELCOME50
- ✅ Created code: PERCENT20
- ✅ Created code: TEST100
- ✅ Created code: HOLIDAY25
- ✅ Created code: EXPIRED
- ✅ Created code: INACTIVE

### 2. Add Items to Cart
1. Navigate to http://localhost:5174
2. Search for a cake design
3. Customize the cake
4. Add to cart
5. Repeat to add multiple items if desired

### 3. Go to Cart Page
1. Click on the cart icon in the header
2. Verify items are displayed correctly

### 4. Check Available Codes
1. Look for the "Have a Discount Code?" section
2. Verify any available codes for the user are displayed as clickable buttons

### 5. Apply Discount Code
1. Enter "WELCOME50" in the discount code input field
2. Click "Apply" button
3. Verify success message appears: "Discount applied! ₱50.00 off"

### 6. Verify Discount in Total
1. Check that the cart totals section shows:
   - Subtotal: [original amount]
   - Discount: -₱50.00 (in green)
   - Delivery Fee: ₱150.00
   - Total: [original amount + 150 - 50]

### 7. Complete Checkout
1. Fill in delivery details
2. Select delivery date and time
3. Click "Place Order - ₱[amount]" button
4. Complete payment process (test payment method)

### 8. Verify Order Creation
1. Check that order was created successfully
2. Redirected to order confirmation page

## Database Verification

### Check Order Details
```sql
SELECT 
  order_id,
  order_number,
  discount_amount,
  discount_code_id,
  total_amount
FROM cakegenie_orders 
ORDER BY created_at DESC 
LIMIT 1;
```

Expected results:
- discount_amount = 50.00
- discount_code_id = [UUID of the WELCOME50 code]
- total_amount = [subtotal + 150 - 50]

### Check Discount Code Usage
```sql
SELECT 
  code,
  times_used,
  max_uses
FROM discount_codes 
WHERE code = 'WELCOME50';
```

Expected results:
- times_used should be incremented by 1
- If it was 0 before, it should now be 1

## Test Cases

### Valid Code
- Code: WELCOME50
- Expected: ✅ Valid, ₱50 discount applied

### Percentage Code with Minimum Order
- Code: PERCENT20
- With order amount ≥ ₱500: ✅ Valid, 20% discount applied
- With order amount < ₱500: ❌ Invalid, minimum order message

### Expired Code
- Code: EXPIRED
- Expected: ❌ Invalid, expired message

### Inactive Code
- Code: INACTIVE
- Expected: ❌ Invalid, not active message

## Expected Results Summary

| Test Case | Expected Result |
|-----------|----------------|
| WELCOME50 with valid order | ✅ Discount applied, times_used incremented |
| PERCENT20 with ₱600 order | ✅ 20% discount (₱120) applied |
| PERCENT20 with ₱400 order | ❌ Minimum order requirement not met |
| EXPIRED | ❌ Code has expired |
| INACTIVE | ❌ Code is not active |
| Non-existent code | ❌ Invalid discount code |

## Troubleshooting

If discount codes don't appear:
1. Check that the user is logged in
2. Verify codes were created successfully
3. Check that codes haven't expired
4. Verify codes are active

If discount isn't applied to total:
1. Check that the discountAmount is being passed correctly
2. Verify the total calculation includes the discount
3. Check browser console for errors

If order creation fails:
1. Check that discount_code_id is being passed to createOrderFromCart
2. Verify RPC function handles discount_code_id correctly
3. Check database constraints