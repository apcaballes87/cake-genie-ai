// Debug script to help identify cart issues
console.log('=== Cart Debug Script ===\n');

console.log('1. Checking localStorage for cart items...');
try {
  // Check if localStorage is accessible
  const localStorageItems = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cart_')) {
      const value = localStorage.getItem(key);
      localStorageItems.push({ key, value });
    }
  }
  console.log('Cart-related localStorage items:', localStorageItems);
} catch (e) {
  console.error('Error accessing localStorage:', e);
}

console.log('\n2. Checking for common cart issues...');

console.log('\n3. Suggested debugging steps:');
console.log('- Check browser console for errors (F12)');
console.log('- Verify network requests to Supabase');
console.log('- Check if user is properly authenticated');
console.log('- Verify cart items are being added to the database');
console.log('- Check expiration dates on cart items');

console.log('\n4. Common causes of cart issues:');
console.log('- Authentication problems (user session)');
console.log('- Database RLS policies preventing access');
console.log('- Network connectivity issues');
console.log('- Expired cart items (older than 7 days)');
console.log('- JavaScript errors preventing cart update');

console.log('\n5. To troubleshoot further:');
console.log('- Try adding an item to cart and check Network tab');
console.log('- Look for errors in browser console');
console.log('- Verify database connection');
console.log('- Check if cart items exist in cakegenie_cart table');