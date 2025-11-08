# Cart Troubleshooting Guide

## Common Issues and Solutions

### 1. Cart Items Not Showing After Adding

**Possible Causes:**
- Authentication/session issues
- Database RLS policies
- Expired cart items
- Network connectivity problems
- JavaScript errors

**Troubleshooting Steps:**

1. **Check Browser Console**
   - Open Developer Tools (F12)
   - Look for any error messages
   - Check for authentication errors

2. **Verify Network Requests**
   - In Network tab, look for requests to:
     - `/rest/v1/cakegenie_cart`
     - Authentication endpoints
   - Check if requests are successful (200 status)
   - Look for any 401/403 errors

3. **Check Database Access**
   - Verify user is properly authenticated
   - Check if cart items are being added to `cakegenie_cart` table
   - Verify expiration dates on cart items (should be 7 days in future)

4. **Authentication Issues**
   - Check if user session is valid
   - Verify anonymous sessions are enabled in Supabase
   - Check for auth state change events

### 2. Cart Context Issues

**In CartContext.tsx:**
- Check `loadCartData` function
- Verify `getCartPageData` service function
- Check `getCartItems` function
- Look for timeout issues (currently 5 seconds)

### 3. Database Issues

**RLS Policies:**
- Check policies on `cakegenie_cart` table
- Verify user can read their own cart items
- Check expiration date filtering

**Query Issues:**
- Verify `expires_at > NOW()` condition
- Check user_id vs session_id logic

### 4. Debugging Steps

1. **Add Logging:**
   ```javascript
   console.log('Cart items:', cartItems);
   console.log('User:', currentUser);
   console.log('Session ID:', sessionId);
   ```

2. **Check Local Storage:**
   - Look for cart-related items in localStorage
   - Check expiration dates

3. **Database Queries:**
   - Run direct queries to check cart items:
     ```sql
     SELECT * FROM cakegenie_cart WHERE user_id = 'USER_ID' OR session_id = 'SESSION_ID';
     ```

### 5. Quick Fixes to Try

1. **Refresh the page** - Sometimes auth state needs to sync
2. **Clear browser cache and localStorage** - Remove stale data
3. **Check internet connection** - Network issues can cause timeouts
4. **Verify Supabase configuration** - Check .env variables
5. **Check for JavaScript errors** - Look in browser console

### 6. Code Verification Points

1. **CartProvider Initialization:**
   - Check `useEffect` that initializes user session
   - Verify anonymous session creation

2. **addToCartOptimistic Function:**
   - Check optimistic update logic
   - Verify rollback on error

3. **getCartItems Service:**
   - Check expiration date filtering
   - Verify user_id vs session_id logic

### 7. Testing Database Directly

Run these queries in Supabase SQL editor:

```sql
-- Check if cart items exist for user
SELECT * FROM cakegenie_cart 
WHERE (user_id = 'USER_UUID' OR session_id = 'SESSION_ID') 
AND expires_at > NOW();

-- Check RLS policies
SELECT * FROM pg_policy WHERE polrelid = 'cakegenie_cart'::regclass;
```

### 8. Environment Variables

Verify these are correctly set in `.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 9. Common Error Messages

- **"Could not verify user session"** - Authentication issue
- **"RLS violation"** - Database access policy issue
- **"Cart loading timed out"** - Network or database performance issue

If you continue to have issues, please provide:
1. Browser console errors
2. Network request failures
3. Screenshots of the issue
4. Steps to reproduce