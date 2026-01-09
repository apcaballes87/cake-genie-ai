# ✅ Shopify Integration - Changes Complete!

## What I've Done

I've successfully implemented the **GeniePH app side** of the Shopify integration. Here's what was changed:

### File 1: ✅ [src/App.tsx](src/App.tsx:270-321)

**Added Shopify auto-redirect and image loading (lines 270-321)**

This code:
- Detects when users arrive from Shopify via URL parameters (`?image=...&source=shopify`)
- Automatically fetches the image from the Shopify URL
- Triggers the AI analysis workflow
- Navigates to the customization page
- Shows loading/error toasts for user feedback

**How it works:**
```typescript
// Detects: https://yourdomain.com/?image={SHOPIFY_URL}&source=shopify&shopify_rowid={ID}
// → Auto-loads image
// → Navigates to: https://yourdomain.com/#/customizing
// → AI analysis starts automatically
```

### File 2: ✅ [src/app/customizing/page.tsx](src/app/customizing/page.tsx)

**No changes needed** - All logic is handled in App.tsx for cleaner architecture.

---

## What You Need to Do Next

### Step 1: Update Your Shopify Page 🛍️

You need to add the "Customize with AI" button to your Shopify cake calculator page.

**File:** Shopify Admin → Pages → `cake-price-calculator` → Edit HTML/Code

**Find this line (around line 380):**
```javascript
status.innerHTML = `✅ Uploaded!<br><img src="${lastPublicUrl}"...`;
```

**Replace with:**
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
    const geniephUrl = `https://YOUR-PRODUCTION-DOMAIN.com/?image=${encodedUrl}&source=shopify&shopify_rowid=${encodedRowId}`;

    window.location.href = geniephUrl;
  });
}
```

**⚠️ CRITICAL:** Replace `YOUR-PRODUCTION-DOMAIN.com` with your actual GeniePH production URL!

Examples:
- `https://genieph.vercel.app`
- `https://yourdomain.com`
- `https://cake.yourdomain.com`

---

## Testing Locally

### Test the GeniePH App Side (Already Working!)

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Simulate a Shopify redirect in your browser:**
   ```
   http://localhost:5173/?image=https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/uploadopenai/test.jpg&source=shopify
   ```

3. **Expected behavior:**
   - Toast notification: "Loading your design from Shopify..."
   - URL changes to: `http://localhost:5173/#/customizing`
   - Image loads and AI analysis starts
   - You see the customization interface with analysis results

### Debug in Browser Console

```javascript
// Check if Shopify data was detected
console.log('Shopify metadata:', {
  rowid: sessionStorage.getItem('shopify_rowid'),
  cameFrom: sessionStorage.getItem('came_from_shopify')
});

// Check current URL
console.log('Current hash:', window.location.hash);
```

---

## Production Deployment

### 1. Deploy GeniePH App

```bash
# Build the app
npm run build

# Deploy to your hosting (Vercel, Netlify, etc.)
# Example for Vercel:
vercel --prod
```

### 2. Get Your Production URL

After deployment, you'll get a URL like:
- `https://genieph.vercel.app`
- `https://your-app-name.vercel.app`

### 3. Update Shopify Page

1. Go to your Shopify Admin
2. Navigate to: Online Store → Pages → `cake-price-calculator`
3. Find the JavaScript code section
4. Update the `geniephUrl` line with your production URL:
   ```javascript
   const geniephUrl = `https://genieph.vercel.app/?image=${encodedUrl}&source=shopify&shopify_rowid=${encodedRowId}`;
   ```
5. Save and publish

### 4. Test End-to-End

1. Go to your Shopify store: `https://www.cakesandmemories.com/pages/cake-price-calculator`
2. Upload a cake image
3. Click "Customize Your Cake Design with AI"
4. Should redirect to your GeniePH app
5. Image should auto-load and analyze
6. Verify customization works

---

## User Flow (How It Works)

```
┌─────────────────────────────────────────────────────┐
│ 1. Customer uploads image on Shopify               │
│    → Image stored in Supabase uploadopenai bucket  │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│ 2. "Customize with AI" button appears              │
│    → Customer clicks button                        │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│ 3. Redirect to GeniePH with image URL              │
│    → https://genieph.app/?image={URL}&source=shopify│
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│ 4. GeniePH App.tsx detects redirect                │
│    → Fetches image from Shopify URL                │
│    → Starts AI analysis                            │
│    → Navigates to /#/customizing                   │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│ 5. Gemini AI analyzes cake                         │
│    → Phase 1: Features (fast)                      │
│    → Phase 2: Coordinates (background)             │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│ 6. Customer customizes design                      │
│    → Edit colors, toppers, messages                │
│    → See real-time pricing                         │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│ 7. Add to cart → Checkout → Order complete!        │
└─────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Issue: Button doesn't appear on Shopify
**Fix:** Check browser console for JavaScript errors

### Issue: Redirect goes to wrong URL
**Fix:** Verify you updated the production URL in Shopify script

### Issue: Image doesn't load in GeniePH
**Debug:**
```javascript
// In browser console:
console.log('URL params:', new URLSearchParams(window.location.search).get('image'));
```
**Fix:** Verify image URL is accessible (test in browser)

### Issue: AI analysis fails
**Debug:**
```javascript
// Check Gemini API key
console.log('Has API key:', !!import.meta.env.VITE_GEMINI_API_KEY);
```
**Fix:** Verify environment variables are set in production

---

## Optional Enhancements

### Track Shopify Conversions (Database)

Add tracking to your cart:

```sql
-- Migration
ALTER TABLE cart_items
ADD COLUMN shopify_rowid UUID,
ADD COLUMN source TEXT DEFAULT 'genieph';
```

Then in your cart add function:
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

### Add "Back to Store" Link

In customizing page, add this banner:

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

---

## Summary

✅ **GeniePH app changes:** COMPLETE
⏳ **Shopify page update:** YOU NEED TO DO THIS
⏳ **Production deployment:** NEXT STEP
⏳ **End-to-end testing:** AFTER DEPLOYMENT

**Total implementation time:** ~5 minutes to update Shopify page
**Risk level:** Very low (systems remain independent)
**Rollback:** Simply remove the button from Shopify page

---

## Questions?

If you run into issues:
1. Check browser console for errors
2. Verify environment variables are set
3. Test the flow step by step
4. Review the detailed guides in the repo

Good luck! 🎉
