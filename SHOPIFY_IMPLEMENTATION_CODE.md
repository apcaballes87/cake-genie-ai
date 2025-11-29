# Shopify Integration - Code Implementation

This file contains the exact code changes needed to integrate Shopify with GeniePH.

## File 1: Update Shopify Page Script

**Location:** Shopify Liquid template for `/pages/cake-price-calculator`

**Find this section (around line 380 in your provided code):**
```javascript
const { data: urlData } = sb.storage.from(BUCKET_NAME).getPublicUrl(upData.path);
lastPublicUrl = urlData.publicUrl;
status.innerHTML = `✅ Uploaded!<br><img src="${lastPublicUrl}" style="max-width:60%;margin-top:1rem;" alt="Uploaded cake design" />`;
```

**Replace with:**
```javascript
const { data: urlData } = sb.storage.from(BUCKET_NAME).getPublicUrl(upData.path);
lastPublicUrl = urlData.publicUrl;

// Show upload success with customization button
status.innerHTML = `
  ✅ Image uploaded successfully!<br>
  <img src="${lastPublicUrl}" style="max-width:60%;margin-top:1rem;border-radius:8px;" alt="Uploaded cake design" />
  <div style="margin-top:1.5rem;display:flex;flex-direction:column;gap:0.75rem;">
    <button id="customize-cake-btn" class="btn" style="width:100%;font-size:1rem;padding:0.75rem;">
      🎨 Customize Your Cake Design with AI
    </button>
    <p style="font-size:0.85rem;color:#666;margin:0;">
      Get full AI analysis, edit colors, toppers, and messages!
    </p>
  </div>
`;

// Add event listener to the customize button
const customizeBtn = document.getElementById('customize-cake-btn');
if (customizeBtn) {
  customizeBtn.addEventListener('click', () => {
    // Encode the image URL for safe transmission
    const encodedUrl = encodeURIComponent(lastPublicUrl);
    const encodedRowId = encodeURIComponent(currentRowId || '');

    // Build the redirect URL to your GeniePH app
    // REPLACE 'https://yourgeniephapp.com' with your actual GeniePH domain
    const geniephUrl = `https://yourgeniephapp.com/?image=${encodedUrl}&source=shopify&shopify_rowid=${encodedRowId}`;

    // Redirect to GeniePH app
    window.location.href = geniephUrl;

    // Alternative: Open in new tab (uncomment if preferred)
    // window.open(geniephUrl, '_blank');
  });
}
```

**Important:** Replace `https://yourgeniephapp.com` with your actual GeniePH app URL (e.g., `https://genieph.vercel.app` or your production domain).

---

## File 2: Update `src/App.tsx`

**File:** `/Users/apcaballes/genieph/src/App.tsx`

**Add this import at the top:**
```typescript
import { useEffect } from 'react'; // If not already imported
```

**Add this useEffect hook inside the App component (near the top, after state declarations):**
```typescript
// Detect Shopify redirect with image URL parameter
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const imageUrl = urlParams.get('image');
  const source = urlParams.get('source');
  const shopifyRowId = urlParams.get('shopify_rowid');

  if (imageUrl && source === 'shopify') {
    console.log('🛍️ Shopify redirect detected');
    console.log('Image URL:', imageUrl);
    console.log('Shopify Row ID:', shopifyRowId);

    // Store data in sessionStorage for the customization page to use
    sessionStorage.setItem('shopify_image_url', imageUrl);
    if (shopifyRowId) {
      sessionStorage.setItem('shopify_rowid', shopifyRowId);
    }

    // Navigate to customization page
    setCurrentPage('customizing');

    // Clean up URL parameters (remove them from address bar)
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, []);
```

**Add this function before the return statement in App component:**
```typescript
// Helper function to check if we're coming from Shopify
const isShopifyRedirect = (): boolean => {
  return sessionStorage.getItem('shopify_image_url') !== null;
};
```

---

## File 3: Update `src/app/customizing/page.tsx`

**File:** `/Users/apcaballes/genieph/src/app/customizing/page.tsx`

**Add this useEffect hook near the top of the component (after state declarations):**

```typescript
// Handle Shopify image auto-load
useEffect(() => {
  const shopifyImageUrl = sessionStorage.getItem('shopify_image_url');
  const shopifyRowId = sessionStorage.getItem('shopify_rowid');

  if (shopifyImageUrl && !analysisResult) {
    console.log('🎨 Auto-loading Shopify image for customization');

    // Create a toast notification
    toast.loading('Loading your Shopify design...', { id: 'shopify-load' });

    // Fetch the image and convert to File object
    fetch(shopifyImageUrl)
      .then(response => response.blob())
      .then(blob => {
        const file = new File([blob], 'shopify-cake-design.jpg', { type: blob.type });

        // Trigger the image upload analysis
        // This will use your existing handleImageUpload from useImageManagement
        handleImageUpload(
          file,
          (result) => {
            // Success callback
            console.log('✅ Shopify image analyzed successfully');
            toast.success('Design loaded and analyzed!', { id: 'shopify-load' });

            // Store Shopify reference for later
            if (shopifyRowId) {
              // You can store this in your cart item or order metadata
              console.log('Shopify Row ID:', shopifyRowId);
            }
          },
          (error) => {
            // Error callback
            console.error('❌ Failed to analyze Shopify image:', error);
            toast.error('Failed to analyze design. Please try uploading again.', { id: 'shopify-load' });
          },
          {
            imageUrl: shopifyImageUrl, // Pass the URL for caching
          }
        );

        // Clear sessionStorage after loading (prevent re-loading on refresh)
        sessionStorage.removeItem('shopify_image_url');
        sessionStorage.removeItem('shopify_rowid');
      })
      .catch(error => {
        console.error('❌ Failed to fetch Shopify image:', error);
        toast.error('Failed to load image from Shopify', { id: 'shopify-load' });

        // Clear storage on error
        sessionStorage.removeItem('shopify_image_url');
        sessionStorage.removeItem('shopify_rowid');
      });
  }
}, []); // Empty dependency array = run once on mount
```

**Important:** Make sure you have access to `handleImageUpload` from your `useImageManagement` hook in this component.

---

## File 4: Optional - Add Loading State for Better UX

**File:** `/Users/apcaballes/genieph/src/app/customizing/page.tsx`

**Enhance the useEffect to show better loading UI:**

```typescript
// Enhanced version with loading state
const [isLoadingShopifyImage, setIsLoadingShopifyImage] = useState(false);

useEffect(() => {
  const shopifyImageUrl = sessionStorage.getItem('shopify_image_url');
  const shopifyRowId = sessionStorage.getItem('shopify_rowid');

  if (shopifyImageUrl && !analysisResult) {
    console.log('🎨 Auto-loading Shopify image for customization');

    setIsLoadingShopifyImage(true);
    toast.loading('Loading your Shopify design...', { id: 'shopify-load' });

    fetch(shopifyImageUrl)
      .then(response => response.blob())
      .then(blob => {
        const file = new File([blob], 'shopify-cake-design.jpg', { type: blob.type });

        handleImageUpload(
          file,
          (result) => {
            console.log('✅ Shopify image analyzed successfully');
            toast.success('Design loaded! Start customizing below.', { id: 'shopify-load' });
            setIsLoadingShopifyImage(false);

            // Track analytics (optional)
            // trackEvent('shopify_image_loaded', { shopifyRowId });
          },
          (error) => {
            console.error('❌ Failed to analyze Shopify image:', error);
            toast.error('Failed to analyze design. Please try uploading again.', { id: 'shopify-load' });
            setIsLoadingShopifyImage(false);
          },
          {
            imageUrl: shopifyImageUrl,
          }
        );

        sessionStorage.removeItem('shopify_image_url');
        sessionStorage.removeItem('shopify_rowid');
      })
      .catch(error => {
        console.error('❌ Failed to fetch Shopify image:', error);
        toast.error('Failed to load image from Shopify', { id: 'shopify-load' });
        setIsLoadingShopifyImage(false);

        sessionStorage.removeItem('shopify_image_url');
        sessionStorage.removeItem('shopify_rowid');
      });
  }
}, []);

// Then in your JSX, you can show a loading overlay:
{isLoadingShopifyImage && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-md text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500 mx-auto mb-4"></div>
      <h3 className="text-lg font-semibold mb-2">Loading from Shopify</h3>
      <p className="text-gray-600">Analyzing your cake design with AI...</p>
    </div>
  </div>
)}
```

---

## File 5: Optional - Add "Back to Store" Link

**File:** `/Users/apcaballes/genieph/src/app/customizing/page.tsx`

**Add a button to let users return to the Shopify store:**

```typescript
// Add this in your customization page header or navigation
const shopifyStoreUrl = 'https://www.cakesandmemories.com/pages/cake-price-calculator';

// In your JSX:
<div className="flex items-center gap-2 mb-4">
  <button
    onClick={() => window.location.href = shopifyStoreUrl}
    className="flex items-center gap-2 text-pink-600 hover:text-pink-700 transition-colors"
  >
    <ArrowLeft className="w-4 h-4" />
    <span>Back to Store</span>
  </button>
  <span className="text-gray-400">|</span>
  <span className="text-sm text-gray-600">From: Cakes & Memories</span>
</div>
```

---

## File 6: Database Tracking (Optional)

If you want to track which designs came from Shopify:

**Create a new Supabase migration:**

```sql
-- Migration: Add Shopify tracking to cart items
ALTER TABLE cart_items
ADD COLUMN shopify_rowid UUID,
ADD COLUMN source TEXT DEFAULT 'genieph';

-- Index for faster queries
CREATE INDEX idx_cart_items_shopify_rowid ON cart_items(shopify_rowid);
CREATE INDEX idx_cart_items_source ON cart_items(source);

-- Create linking table for bi-directional sync (optional)
CREATE TABLE shopify_genieph_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_rowid UUID,
  genieph_cart_item_id UUID REFERENCES cart_items(id),
  shopify_image_url TEXT,
  genieph_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index
CREATE INDEX idx_shopify_links_shopify_rowid ON shopify_genieph_links(shopify_rowid);
```

**Then update your cart add function:**

```typescript
// In your addToCart function
const shopifyRowId = sessionStorage.getItem('shopify_rowid');

const cartItem = {
  // ... existing fields
  shopify_rowid: shopifyRowId || null,
  source: shopifyRowId ? 'shopify' : 'genieph',
  // ... rest of fields
};

// Clear after adding to cart
if (shopifyRowId) {
  sessionStorage.removeItem('shopify_rowid');
}
```

---

## Testing Checklist

### Phase 1: Local Testing
- [ ] Update Shopify page with new button code
- [ ] Update App.tsx with redirect detection
- [ ] Update customizing page with auto-load logic
- [ ] Test URL parameter parsing
- [ ] Test sessionStorage flow

### Phase 2: Image Flow Testing
- [ ] Upload image on Shopify page
- [ ] Verify "Customize" button appears
- [ ] Click button - verify redirect to GeniePH
- [ ] Verify image auto-loads in GeniePH
- [ ] Verify Gemini AI analysis starts
- [ ] Verify analysis results display correctly

### Phase 3: Customization Testing
- [ ] Verify all editing tools work
- [ ] Test topper modifications
- [ ] Test color changes
- [ ] Test message editing
- [ ] Test icing customization

### Phase 4: Cart & Checkout
- [ ] Add customized design to cart
- [ ] Verify cart item includes Shopify tracking (if implemented)
- [ ] Test checkout flow
- [ ] Verify order creation
- [ ] Check order details in database

### Phase 5: Error Handling
- [ ] Test with invalid image URL
- [ ] Test with network errors
- [ ] Test with AI analysis failures
- [ ] Verify error messages display correctly
- [ ] Verify graceful fallbacks

---

## Environment Variables

Make sure these are set in your GeniePH `.env` file:

```env
# Supabase
VITE_SUPABASE_URL=https://congofivupobtfudnhni.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Gemini AI
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Shopify store URL for "Back to Store" links
VITE_SHOPIFY_STORE_URL=https://www.cakesandmemories.com
```

---

## Deployment Notes

### GeniePH App Deployment
1. Deploy updated code to production (Vercel/Netlify/etc.)
2. Verify environment variables are set
3. Test the production URL

### Shopify Page Update
1. Update the `geniephUrl` in the Shopify script to your production URL
2. Example: `const geniephUrl = \`https://genieph.vercel.app/?image=...\``
3. Save and publish the Shopify page

### CORS Considerations
- Shopify images are publicly accessible
- No CORS issues expected
- If issues arise, add Shopify domain to Supabase CORS settings

---

## Troubleshooting

### Issue: Image doesn't auto-load in GeniePH
**Solution:** Check browser console for:
- URL parameter parsing errors
- sessionStorage values
- Fetch errors

### Issue: Redirect doesn't work
**Solution:** Verify:
- Button event listener is attached
- URL encoding is correct
- GeniePH URL is correct (no typos)

### Issue: AI analysis fails
**Solution:** Check:
- Gemini API key is valid
- Image format is supported
- Image size is reasonable
- Network connectivity

### Issue: Cart doesn't save Shopify reference
**Solution:** Verify:
- Database migration ran successfully
- sessionStorage contains shopify_rowid
- Cart add function includes the field

---

## Analytics & Monitoring

Track these metrics to measure success:

```typescript
// Add analytics events
function trackShopifyIntegration(event: string, data?: any) {
  // Example using custom analytics
  console.log('📊 Analytics:', event, data);

  // If using Google Analytics
  // gtag('event', event, data);

  // If using Mixpanel
  // mixpanel.track(event, data);
}

// Usage:
trackShopifyIntegration('shopify_redirect_received', { imageUrl });
trackShopifyIntegration('shopify_image_analyzed', { shopifyRowId });
trackShopifyIntegration('shopify_design_customized', { changes });
trackShopifyIntegration('shopify_cart_added', { cartItemId });
```

**Key Metrics to Track:**
- Redirect count (Shopify → GeniePH)
- Auto-load success rate
- Analysis completion rate
- Customization engagement
- Conversion to cart
- Order completion rate

---

## Next Steps

1. ✅ Implement the code changes above
2. ✅ Test locally with ngrok or local tunneling
3. ✅ Deploy to staging environment
4. ✅ Test end-to-end flow
5. ✅ Deploy to production
6. ✅ Monitor analytics
7. ✅ Gather user feedback
8. ✅ Iterate and improve

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify all environment variables
3. Test each step of the flow independently
4. Check Supabase logs
5. Review Gemini API usage/errors
