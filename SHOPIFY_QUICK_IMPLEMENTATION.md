# Shopify Integration - Quick Implementation (Hash Routing)

## 🎯 3 Simple Code Changes

---

## Change 1: Update Shopify Page

**File:** Shopify `/pages/cake-price-calculator` HTML template

**Location:** Find around line 380 where upload completes

**Find:**
```javascript
status.innerHTML = `✅ Uploaded!<br><img src="${lastPublicUrl}"...`;
```

**Replace entire section with:**
```javascript
status.innerHTML = `
  ✅ Image uploaded successfully!<br>
  <img src="${lastPublicUrl}" style="max-width:60%;margin-top:1rem;border-radius:8px;" alt="Uploaded cake design" />
  <div style="margin-top:1.5rem;">
    <button id="customize-cake-btn" class="btn" style="width:100%;font-size:1rem;padding:0.75rem;">
      🎨 Customize Your Cake Design with AI
    </button>
    <p style="font-size:0.85rem;color:#666;margin:0.5rem 0 0;">Get full AI analysis & edit your design!</p>
  </div>
`;

const customizeBtn = document.getElementById('customize-cake-btn');
if (customizeBtn) {
  customizeBtn.addEventListener('click', () => {
    const encodedUrl = encodeURIComponent(lastPublicUrl);
    const encodedRowId = encodeURIComponent(currentRowId || '');

    // ⚠️ REPLACE THIS URL WITH YOUR ACTUAL GENIEPH DOMAIN
    const geniephUrl = `https://YOUR-DOMAIN.com/?image=${encodedUrl}&source=shopify&shopify_rowid=${encodedRowId}`;

    window.location.href = geniephUrl;
  });
}
```

**⚠️ Critical:** Replace `YOUR-DOMAIN.com` with your real domain (e.g., `genieph.vercel.app`)

---

## Change 2: Update App.tsx

**File:** `/Users/apcaballes/genieph/src/App.tsx`

**Location:** Insert **AFTER line 174** (after the `useDesignSharing` hook declaration)

**Insert this complete useEffect:**

```typescript
  // ========================================
  // SHOPIFY INTEGRATION: Auto-redirect to customization
  // ========================================
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const imageUrl = urlParams.get('image');
    const source = urlParams.get('source');
    const shopifyRowId = urlParams.get('shopify_rowid');

    if (imageUrl && source === 'shopify') {
      console.log('🛍️ Shopify redirect detected - Image URL:', imageUrl);

      // Store in sessionStorage for customization page
      sessionStorage.setItem('shopify_image_url', decodeURIComponent(imageUrl));
      if (shopifyRowId) {
        sessionStorage.setItem('shopify_rowid', decodeURIComponent(shopifyRowId));
        sessionStorage.setItem('came_from_shopify', 'true');
      }

      // Navigate to customization using hash routing
      window.location.hash = '#/customizing';

      // Clean URL (remove query params, keep hash)
      const cleanUrl = `${window.location.origin}${window.location.pathname}#/customizing`;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);
  // ========================================
  // END SHOPIFY INTEGRATION
  // ========================================

```

**Visual Guide:**
```typescript
Line 170→  const { isShareModalOpen, shareData, isSavingDesign, ... } = useDesignSharing({
Line 171→    editedImage, originalImagePreview, cakeInfo, ...
Line 172→    ...
Line 173→  });
Line 174→
Line 175→  // ADD SHOPIFY INTEGRATION HERE ⬅️⬅️⬅️
Line 176→
Line 177→  // --- UI-DRIVEN HOOKS ---
```

---

## Change 3: Update Customizing Page

**File:** `/Users/apcaballes/genieph/src/app/customizing/page.tsx`

**Location:** Find existing `useEffect` hooks (usually around lines 50-100), add this **AFTER** the scroll restoration effect (if present)

**Insert this complete useEffect:**

```typescript
  // ========================================
  // SHOPIFY INTEGRATION: Auto-load image
  // ========================================
  useEffect(() => {
    const shopifyImageUrl = sessionStorage.getItem('shopify_image_url');
    const shopifyRowId = sessionStorage.getItem('shopify_rowid');

    if (shopifyImageUrl && !analysisResult && !isAnalyzing) {
      console.log('🎨 Auto-loading Shopify image:', shopifyImageUrl);

      toast.loading('Loading your Shopify design...', { id: 'shopify-load' });

      fetch(shopifyImageUrl)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.blob();
        })
        .then(blob => {
          const file = new File([blob], 'shopify-cake.jpg', { type: blob.type });

          handleImageUpload(
            file,
            (result) => {
              console.log('✅ Shopify image analyzed successfully');
              toast.success('Design loaded and analyzed!', { id: 'shopify-load' });

              if (shopifyRowId) {
                console.log('Shopify Row ID:', shopifyRowId);
              }
            },
            (error) => {
              console.error('❌ Failed to analyze Shopify image:', error);
              toast.error('Failed to analyze design. Please try uploading again.', { id: 'shopify-load' });
            },
            { imageUrl: shopifyImageUrl }
          );

          // Clear storage after loading
          sessionStorage.removeItem('shopify_image_url');
          sessionStorage.removeItem('shopify_rowid');
        })
        .catch(error => {
          console.error('❌ Failed to fetch Shopify image:', error);
          toast.error('Failed to load image from Shopify', { id: 'shopify-load' });

          sessionStorage.removeItem('shopify_image_url');
          sessionStorage.removeItem('shopify_rowid');
        });
    }
  }, [analysisResult, isAnalyzing, handleImageUpload]);
  // ========================================
  // END SHOPIFY INTEGRATION
  // ========================================

```

---

## Testing

### 1. Local Testing

**Simulate Shopify redirect in browser:**
```
http://localhost:5173/?image=https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/uploadopenai/test.jpg&source=shopify
```

**Expected behavior:**
1. URL changes to: `http://localhost:5173/#/customizing`
2. Toast appears: "Loading your Shopify design..."
3. Image loads and AI analyzes
4. Toast changes to: "Design loaded and analyzed!"

### 2. Debug Steps

**Check if redirect detected (App.tsx):**
```javascript
// Open browser console, paste this:
console.log('Shopify URL?', sessionStorage.getItem('shopify_image_url'));
```

**Check if customization page received it:**
```javascript
// On customization page, paste this:
console.log('Has Shopify image?', sessionStorage.getItem('shopify_image_url'));
console.log('Current hash:', window.location.hash);
```

### 3. Verify Each Step

- [ ] **Step 1:** Upload image on Shopify ✅
- [ ] **Step 2:** "Customize" button appears ✅
- [ ] **Step 3:** Click button → redirects to GeniePH ✅
- [ ] **Step 4:** URL shows `#/customizing` ✅
- [ ] **Step 5:** Image auto-loads ✅
- [ ] **Step 6:** AI analysis runs ✅
- [ ] **Step 7:** User can customize ✅

---

## Common Issues

### ❌ Issue: "Customize" button doesn't appear
**Fix:** Check Shopify page console for JavaScript errors

### ❌ Issue: Redirect goes to wrong URL
**Fix:** Verify you replaced `YOUR-DOMAIN.com` in Shopify script

### ❌ Issue: Image doesn't auto-load
**Fix:**
```javascript
// In browser console on customization page
console.log(sessionStorage.getItem('shopify_image_url'));
// Should show the image URL - if null, App.tsx didn't set it
```

### ❌ Issue: URL shows `/#/?image=...` instead of `/#/customizing`
**Fix:** Check App.tsx useEffect is setting `window.location.hash` correctly

### ❌ Issue: Double hash `##` in URL
**Fix:** Make sure Shopify redirect URL has NO hash symbol:
```javascript
// ✅ Correct
const url = 'https://domain.com/?image=...';

// ❌ Wrong
const url = 'https://domain.com/#/?image=...';
```

---

## Deployment

### Before Deploying

1. **Test locally first** with the localhost URL
2. **Verify all 3 code changes** are in place
3. **Check environment variables** are set (Gemini API key, Supabase keys)

### Production Deployment

1. **Deploy GeniePH** to production (Vercel/Netlify)
2. **Get production URL** (e.g., `https://genieph.vercel.app`)
3. **Update Shopify page** with production URL in the script
4. **Test end-to-end** with a real cake image

### After Deployment

1. **Monitor browser console** for errors
2. **Check Supabase logs** for storage/database issues
3. **Verify Gemini API calls** are working (Google Cloud Console)
4. **Track conversions** (Shopify → GeniePH → Cart → Checkout)

---

## Optional Enhancements

### Add "Back to Store" Link

In `customizing/page.tsx`, add this near the top of the JSX:

```tsx
{sessionStorage.getItem('came_from_shopify') && (
  <div className="mb-4 p-3 bg-pink-50 border border-pink-200 rounded-lg flex items-center justify-between">
    <span className="text-sm">From: <strong>Cakes & Memories</strong></span>
    <a href="https://www.cakesandmemories.com" className="text-pink-600 hover:text-pink-700 text-sm font-medium">
      ← Back to Store
    </a>
  </div>
)}
```

### Track in Database

**Optional SQL migration to track Shopify conversions:**

```sql
ALTER TABLE cart_items
ADD COLUMN shopify_rowid UUID,
ADD COLUMN source TEXT DEFAULT 'genieph';
```

**Then in your cart add function:**
```typescript
const shopifyRowId = sessionStorage.getItem('shopify_rowid');

const cartItem = {
  // ... existing fields
  shopify_rowid: shopifyRowId || null,
  source: shopifyRowId ? 'shopify' : 'genieph',
};

// Clear after adding
if (shopifyRowId) {
  sessionStorage.removeItem('shopify_rowid');
  sessionStorage.removeItem('came_from_shopify');
}
```

---

## Summary

**Total Changes:** 3 files
**Total Time:** 15-20 minutes
**Difficulty:** ⭐⭐ Easy
**Risk:** ⭐ Very Low (independent systems)

**Flow:**
```
Shopify Upload → Click "Customize" → Redirect with ?image= →
GeniePH App.tsx detects → Sets sessionStorage → Hash routing to /#/customizing →
Customizing page loads → Auto-fetch image → AI analysis → User customizes → Cart → Checkout
```

✅ **Hash routing compatible**
✅ **Mobile friendly**
✅ **No data loss**
✅ **Easy rollback**
✅ **Production ready**
