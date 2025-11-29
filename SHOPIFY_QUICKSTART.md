# Shopify Integration - Quick Start Guide

## 🎯 Goal
Allow Shopify customers to upload a cake image on your Shopify store and seamlessly redirect to GeniePH for AI analysis and full customization.

## 📋 Prerequisites
- ✅ Shopify store with cake price calculator page
- ✅ GeniePH app deployed and accessible
- ✅ Supabase project configured
- ✅ Gemini API key active

## 🚀 Implementation (15 minutes)

### Step 1: Update Shopify Page (5 min)

**File:** Shopify admin → Pages → `cake-price-calculator` → Edit code

**Find:** Line ~380 where image upload completes
```javascript
status.innerHTML = `✅ Uploaded!<br><img src="${lastPublicUrl}"...`;
```

**Replace with:** (Copy from `SHOPIFY_IMPLEMENTATION_CODE.md` - File 1)
```javascript
status.innerHTML = `
  ✅ Image uploaded successfully!<br>
  <img src="${lastPublicUrl}" style="max-width:60%;margin-top:1rem;border-radius:8px;" alt="Uploaded cake design" />
  <div style="margin-top:1.5rem;">
    <button id="customize-cake-btn" class="btn" style="width:100%;">
      🎨 Customize Your Cake Design with AI
    </button>
  </div>
`;

document.getElementById('customize-cake-btn').addEventListener('click', () => {
  const encodedUrl = encodeURIComponent(lastPublicUrl);
  const geniephUrl = `https://YOUR-GENIEPH-URL.com/?image=${encodedUrl}&source=shopify`;
  window.location.href = geniephUrl;
});
```

**⚠️ Important:** Replace `YOUR-GENIEPH-URL.com` with your actual GeniePH domain!

### Step 2: Update GeniePH App.tsx (3 min)

**File:** `src/App.tsx`

**Add after state declarations:**
```typescript
// Detect Shopify redirect
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const imageUrl = urlParams.get('image');
  const source = urlParams.get('source');

  if (imageUrl && source === 'shopify') {
    sessionStorage.setItem('shopify_image_url', imageUrl);
    setCurrentPage('customizing');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, []);
```

### Step 3: Update Customizing Page (5 min)

**File:** `src/app/customizing/page.tsx`

**Add this useEffect near the top:**
```typescript
// Auto-load Shopify image
useEffect(() => {
  const shopifyImageUrl = sessionStorage.getItem('shopify_image_url');

  if (shopifyImageUrl && !analysisResult) {
    toast.loading('Loading your Shopify design...', { id: 'shopify-load' });

    fetch(shopifyImageUrl)
      .then(response => response.blob())
      .then(blob => {
        const file = new File([blob], 'shopify-cake.jpg', { type: blob.type });

        handleImageUpload(
          file,
          (result) => {
            toast.success('Design loaded!', { id: 'shopify-load' });
          },
          (error) => {
            toast.error('Failed to analyze design', { id: 'shopify-load' });
          },
          { imageUrl: shopifyImageUrl }
        );

        sessionStorage.removeItem('shopify_image_url');
      });
  }
}, []);
```

### Step 4: Deploy & Test (2 min)

1. **Deploy GeniePH:**
   ```bash
   npm run build
   # Deploy to Vercel/Netlify/etc.
   ```

2. **Update Shopify page with production URL**

3. **Test the flow:**
   - Go to Shopify cake calculator
   - Upload an image
   - Click "Customize Your Cake Design with AI"
   - Verify redirect to GeniePH
   - Verify image auto-loads and analyzes
   - ✅ Done!

## 🔄 User Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Shopify Store                                          │
│  cakesandmemories.com/pages/cake-price-calculator       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ 1. Customer uploads cake image
                   ↓
         ┌─────────────────────┐
         │  Image Optimization │
         │  - Compress         │
         │  - Upload to        │
         │    Supabase         │
         └──────────┬──────────┘
                    │
                    │ 2. Upload complete
                    ↓
         ┌─────────────────────┐
         │  "Customize" Button │
         │  appears            │
         └──────────┬──────────┘
                    │
                    │ 3. Customer clicks button
                    ↓
┌───────────────────────────────────────────────────────────┐
│  Redirect to GeniePH                                      │
│  yourdomain.com/?image={URL}&source=shopify               │
└──────────────────┬────────────────────────────────────────┘
                   │
                   │ 4. App.tsx detects parameters
                   ↓
         ┌─────────────────────┐
         │  Navigate to        │
         │  Customizing Page   │
         └──────────┬──────────┘
                    │
                    │ 5. Auto-load image
                    ↓
         ┌─────────────────────┐
         │  Gemini AI Analysis │
         │  - Phase 1: Features│
         │  - Phase 2: Coords  │
         └──────────┬──────────┘
                    │
                    │ 6. Analysis complete
                    ↓
         ┌─────────────────────┐
         │  Customer           │
         │  Customizes Design  │
         │  - Edit toppers     │
         │  - Change colors    │
         │  - Add messages     │
         └──────────┬──────────┘
                    │
                    │ 7. Add to cart
                    ↓
         ┌─────────────────────┐
         │  Checkout & Payment │
         │  (Existing flow)    │
         └─────────────────────┘
```

## ✅ Testing Checklist

### Basic Flow
- [ ] Image uploads successfully on Shopify
- [ ] "Customize" button appears
- [ ] Clicking button redirects to GeniePH
- [ ] URL parameters are correct
- [ ] sessionStorage is set properly

### GeniePH Integration
- [ ] Image auto-loads in customization page
- [ ] Loading toast appears
- [ ] Gemini AI analysis starts
- [ ] Analysis results display correctly
- [ ] All editing tools work

### End-to-End
- [ ] Customer can customize design
- [ ] Add to cart works
- [ ] Checkout completes
- [ ] Order appears in database

## 🐛 Common Issues & Fixes

### Issue 1: Button doesn't appear
**Cause:** JavaScript event listener not attached
**Fix:** Check browser console, ensure `customize-cake-btn` ID matches

### Issue 2: Redirect doesn't work
**Cause:** Wrong GeniePH URL
**Fix:** Verify production URL, check for typos

### Issue 3: Image doesn't auto-load
**Cause:** sessionStorage not set
**Fix:** Check App.tsx useEffect, verify URL parameters

### Issue 4: AI analysis fails
**Cause:** Invalid Gemini API key or network error
**Fix:** Check environment variables, test API key separately

### Issue 5: CORS error
**Cause:** Supabase bucket not public
**Fix:** Verify `uploadopenai` bucket is set to public

## 📊 What Gets Stored Where

### Shopify Database (`uploadpricing2`)
- `rowid`: UUID of upload
- `image`: Public URL of uploaded image
- `priceaddon`: Shopify's pricing calculation
- `infoaddon`: Shopify's cake info

### GeniePH Database (`cakegenie_analysis_cache`)
- `p_hash`: Perceptual hash of image
- `analysis_json`: Full Gemini AI analysis
- `original_image_url`: Compressed image URL

### GeniePH Cart (`cart_items`)
- All customization details
- Original & edited image URLs
- Customer modifications
- (Optional) `shopify_rowid` for tracking

## 🎨 Customization Options

### Option 1: Open in New Tab
```javascript
// Change this:
window.location.href = geniephUrl;

// To this:
window.open(geniephUrl, '_blank');
```

### Option 2: Pass More Context
```javascript
const geniephUrl = `https://your-app.com/?image=${encodedUrl}&source=shopify&type=${selectedCakeType}&height=${selectedHeight}`;
```

Then in GeniePH:
```typescript
const cakeType = urlParams.get('type');
const cakeHeight = urlParams.get('height');
// Pre-populate selections
```

### Option 3: Add "Back to Store" Link
In customizing page:
```typescript
<button onClick={() => window.location.href = 'https://cakesandmemories.com'}>
  ← Back to Store
</button>
```

## 🚢 Deployment Checklist

### Before Going Live
- [ ] Test on staging environment
- [ ] Verify Gemini API has sufficient quota
- [ ] Check Supabase storage limits
- [ ] Test on mobile devices
- [ ] Test on different browsers
- [ ] Set up error monitoring (Sentry, etc.)

### Production Deployment
- [ ] Update Shopify page with production URL
- [ ] Deploy GeniePH to production
- [ ] Verify environment variables
- [ ] Test end-to-end flow
- [ ] Monitor first few conversions

### Post-Launch
- [ ] Monitor error logs
- [ ] Track conversion rates
- [ ] Gather customer feedback
- [ ] Optimize based on usage data

## 📈 Success Metrics to Track

1. **Redirect Rate:** % of Shopify uploads that click "Customize"
2. **Analysis Success Rate:** % of redirects that complete AI analysis
3. **Customization Rate:** % that edit the design
4. **Conversion Rate:** % that add to cart
5. **Order Completion:** % that checkout successfully

## 🆘 Need Help?

### Debugging Steps
1. **Check browser console** for JavaScript errors
2. **Check network tab** for failed requests
3. **Check sessionStorage** in devtools
4. **Check Supabase logs** for storage/database errors
5. **Check Gemini API usage** in Google Cloud Console

### Useful Console Commands
```javascript
// Check if Shopify redirect data exists
console.log(sessionStorage.getItem('shopify_image_url'));

// Check URL parameters
console.log(new URLSearchParams(window.location.search).get('image'));

// Test image fetch
fetch('YOUR_IMAGE_URL').then(r => console.log('Image accessible:', r.ok));
```

## 💡 Tips for Best Results

1. **Image Quality:** Ensure Shopify images are high quality (Gemini works better with clear images)
2. **Loading States:** Always show loading feedback to users
3. **Error Handling:** Provide clear error messages and fallback options
4. **Mobile First:** Test thoroughly on mobile devices (most traffic)
5. **Analytics:** Track the funnel to identify drop-off points

## 🎉 You're Ready!

Follow the 3 steps above, test thoroughly, and you'll have a seamless Shopify → GeniePH integration!

**Estimated Total Time:** 15-30 minutes
**Difficulty:** Easy
**Risk:** Low (both systems remain independent)

---

**Questions?** Review the detailed implementation guide in `SHOPIFY_IMPLEMENTATION_CODE.md`
