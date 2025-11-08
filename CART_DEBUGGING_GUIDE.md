# Cart Debugging Guide

## Current Status

✅ **RLS Policies Updated**: Fixed cart RLS policies to ensure proper access
✅ **Debug Logging Added**: Enhanced logging in CartContext and cart page
✅ **Migration Applied**: Applied database migration to fix policies

## Debugging Steps

### Step 1: Check Browser Console for Errors

1. Open your browser's Developer Tools (F12)
2. Go to the Console tab
3. Refresh the page
4. Look for any error messages (especially red errors)
5. Try adding an item to cart
6. Check for errors during the add process

**What to look for:**
- Authentication errors
- Network errors
- JavaScript exceptions
- RLS policy violations

### Step 2: Check Network Tab for Failed Requests

1. Open Developer Tools → Network tab
2. Try adding an item to cart
3. Look for these requests:
   - POST to `/rest/v1/cakegenie_cart` (adding item)
   - GET to `/rest/v1/cakegenie_cart` (loading cart)
4. Check response status codes:
   - 200: Success
   - 401/403: Authentication/authorization issues
   - 404: Not found
   - 500: Server error

### Step 3: Check Authentication State

In the browser console, run:
```javascript
// Check current session
supabase.auth.getSession().then(({ data, error }) => {
  console.log('Session:', data, 'Error:', error);
});

// Check current user
supabase.auth.getUser().then(({ data, error }) => {
  console.log('User:', data, 'Error:', error);
});
```

### Step 4: Test Direct Database Access

Check if items are being added to the database:
```sql
SELECT 
  cart_item_id,
  user_id,
  session_id,
  cake_type,
  cake_size,
  quantity,
  created_at,
  expires_at,
  expires_at > NOW() as is_not_expired
FROM cakegenie_cart
ORDER BY created_at DESC
LIMIT 10;
```

### Step 5: Verify RLS Policies

Check that the policies allow proper access:
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'cakegenie_cart';
```

## Common Issues and Solutions

### 1. Authentication Issues
**Symptoms**: 
- "Could not verify user session" errors
- 401/403 status codes

**Solutions**:
- Ensure anonymous sign-ins are enabled in Supabase
- Check that the session is being created properly
- Verify SUPABASE_ANON_KEY is correct

### 2. RLS Policy Issues
**Symptoms**: 
- Empty cart despite items being added
- 403 Forbidden errors

**Solutions**:
- ✅ Already fixed with updated policies
- Policies now allow access by user_id OR session_id

### 3. Expiration Issues
**Symptoms**: 
- Items not showing in cart
- Items disappearing quickly

**Solutions**:
- Check that expires_at is set correctly (7 days in future)
- Verify server and client time zones match

### 4. JavaScript Errors
**Symptoms**: 
- Cart not updating
- UI not responding

**Solutions**:
- Check browser console for errors
- Look for unhandled promise rejections
- Verify all dependencies are loaded

## Testing Process

1. **Clear Browser Data**:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   // Then refresh the page
   ```

2. **Add Test Item**:
   - Go to design page
   - Create a cake design
   - Add to cart
   - Watch console for logs

3. **Check Cart Page**:
   - Navigate to cart
   - Verify items are displayed
   - Check console for rendering logs

## Expected Console Output

When everything works correctly, you should see:

```
🔄 Initializing cart provider...
🔑 Session data: {session object}
✅ Existing session found: {user-id} Is anonymous: false/true
🆔 Set session ID for anonymous user: {session-id}
📦 Loading cart data for user: {user-id}
🔍 Query parameters: {userIdForQuery, sessionIdForQuery, isAnonymous}
📊 Cart data response: {data object}
✅ Cart items loaded: 1
🏁 Cart loading finished
```

When adding an item:
```
🛒 Adding item to cart: {item details}
👤 User for cart add: {user-id} Is anonymous: false/true
🔵 Attempting to add to cart: {parameters}
🟢 Successfully added to cart: {item object}
```

## Next Steps

1. Try the debugging steps above
2. Report any error messages you see
3. Check if items are being added to the database
4. Verify the authentication state
5. Test with a fresh browser session

If you continue to have issues, please share:
1. Browser console output
2. Network tab results
3. Database query results
4. Steps to reproduce the issue