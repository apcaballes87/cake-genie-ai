# Shopify Page Modification - Auto-Redirect to genie.ph

## Instructions

In your Shopify page code, find this section (around line 750-760 in the `handleFile` function):

### FIND THIS CODE:

```javascript
status.innerHTML = `✅ Uploaded!<br><img src="${lastPublicUrl}" style="max-width:60%;margin-top:1rem;" alt="Uploaded cake design" />`;

const newRowUuid = genUUID();
```

### REPLACE WITH THIS CODE:

```javascript
// ========================================
// SHOPIFY → GENIE.PH AUTO-REDIRECT INTEGRATION
// ========================================
status.innerHTML = `
  ✅ Image uploaded successfully!<br>
  <img src="${lastPublicUrl}" style="max-width:60%;margin-top:1rem;border-radius:8px;" alt="Uploaded cake design" />
  <div style="margin-top:1.5rem;text-align:center;">
    <div id="loading-spinner" style="margin:0 auto 1rem;"></div>
    <p style="font-size:1rem;color:#d66c84;font-weight:600;margin:0;">
      Preparing your design for AI customization...
    </p>
    <p style="font-size:0.85rem;color:#666;margin:0.5rem 0 0;">
      Redirecting to genie.ph in <span id="countdown">2</span> seconds
    </p>
  </div>
`;

// Auto-redirect to genie.ph after 2 seconds with countdown
const encodedUrl = encodeURIComponent(lastPublicUrl);
const encodedRowId = encodeURIComponent(currentRowId || '');
const geniephUrl = `https://genie.ph/#/customizing?image=${encodedUrl}&source=shopify&shopify_rowid=${encodedRowId}`;

let countdown = 2;
const countdownEl = document.getElementById('countdown');

const countdownInterval = setInterval(() => {
  countdown--;
  if (countdownEl) {
    countdownEl.textContent = countdown;
  }
  if (countdown <= 0) {
    clearInterval(countdownInterval);
  }
}, 1000);

// Redirect after 2 seconds
setTimeout(() => {
  window.location.href = geniephUrl;
}, 2000);
// ========================================
// END INTEGRATION
// ========================================

const newRowUuid = genUUID();
```

## Your Production URL: genie.ph ✅

The code already uses your production domain:
```javascript
const geniephUrl = `https://genie.ph/#/customizing?image=${encodedUrl}&source=shopify&shopify_rowid=${encodedRowId}`;
```

This will redirect customers from your Shopify store to **https://genie.ph** with the uploaded cake image.

## What This Does

1. **After image upload completes:** Shows the uploaded image
2. **Shows loading spinner** with message: "Preparing your design for AI customization..."
3. **Countdown timer:** "Redirecting to genie.ph in 2 seconds" (counts down: 2... 1...)
4. **Automatic redirect:** After 2 seconds, automatically redirects to genie.ph with:
   - Encoded Shopify image URL
   - Shopify row ID for tracking
5. **GeniePH auto-loads:** Image automatically loads and AI analysis starts
6. **User experience:** Seamless automatic transition from Shopify → genie.ph

## Testing

### Local Testing (Development)

If testing locally first, use:
```javascript
const geniephUrl = `http://localhost:5173/#/customizing?image=${encodedUrl}&source=shopify&shopify_rowid=${encodedRowId}`;
```

### Production Testing

After deploying GeniePH, use:
```javascript
const geniephUrl = `https://YOUR-PRODUCTION-DOMAIN.com/#/customizing?image=${encodedUrl}&source=shopify&shopify_rowid=${encodedRowId}`;
```

## Visual Guide

**Before:**
```
[Image uploaded]
✅ Uploaded!
[Image preview]
```

**After (with auto-redirect):**
```
[Image uploaded]
✅ Image uploaded successfully!
[Image preview with rounded corners]

        [Loading Spinner Animation]

    Preparing your design for AI customization...

    Redirecting to genie.ph in 2 seconds
           ↓ (countdown: 2... 1...)
    [Automatic redirect to genie.ph]
```

**User Flow:**
1. Upload image on Shopify ✅
2. See success message + loading spinner
3. Wait 2 seconds (with countdown)
4. **Automatically** redirect to genie.ph
5. Image loads on genie.ph
6. AI analyzes cake
7. User customizes design

## Complete Modified Section

Here's the complete section with context:

```javascript
async function handleFile(file){
    resetStateUI(); await ensureAuth();
    status.textContent = 'Uploading…';
    dropArea.textContent = `Selected: ${file.name.length>30? file.name.slice(0,27)+'…' : file.name}`;

    try{
      const prepared = await downscaleAndCompress(file);
      const path = `${Date.now()}.${prepared.ext || 'jpg'}`;
      const { data: upData, error: upErr } = await sb.storage.from(BUCKET_NAME).upload(path, prepared.blob);
      if (upErr) throw upErr;

      const { data: urlData } = sb.storage.from(BUCKET_NAME).getPublicUrl(upData.path);
      lastPublicUrl = urlData.publicUrl;

      // ========================================
      // SHOPIFY → GENIE.PH AUTO-REDIRECT INTEGRATION
      // ========================================
      status.innerHTML = `
        ✅ Image uploaded successfully!<br>
        <img src="${lastPublicUrl}" style="max-width:60%;margin-top:1rem;border-radius:8px;" alt="Uploaded cake design" />
        <div style="margin-top:1.5rem;text-align:center;">
          <div id="loading-spinner" style="margin:0 auto 1rem;"></div>
          <p style="font-size:1rem;color:#d66c84;font-weight:600;margin:0;">
            Preparing your design for AI customization...
          </p>
          <p style="font-size:0.85rem;color:#666;margin:0.5rem 0 0;">
            Redirecting to genie.ph in <span id="countdown">2</span> seconds
          </p>
        </div>
      `;

      // Auto-redirect to genie.ph after 2 seconds with countdown
      const encodedUrl = encodeURIComponent(lastPublicUrl);
      const encodedRowId = encodeURIComponent(currentRowId || '');
      const geniephUrl = `https://genie.ph/#/customizing?image=${encodedUrl}&source=shopify&shopify_rowid=${encodedRowId}`;

      let countdown = 2;
      const countdownEl = document.getElementById('countdown');

      const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownEl) {
          countdownEl.textContent = countdown;
        }
        if (countdown <= 0) {
          clearInterval(countdownInterval);
        }
      }, 1000);

      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = geniephUrl;
      }, 2000);
      // ========================================
      // END INTEGRATION
      // ========================================

      const newRowUuid = genUUID();
      const { data: insData, error: insErr } = await sb.from(TABLE_UPLOADS).insert({ rowid: newRowUuid, image: lastPublicUrl }).select('rowid').single();
      if (insErr) throw insErr;
      currentRowId = insData?.rowid || newRowUuid;

      setRowIdInUrl(currentRowId); cacheSave();

      document.getElementById('pricing-result').innerHTML = `<p>⏳ Processing your design...</p><div id="progress-container"><div id="progress-bar"></div></div><div id="progress-label">0%</div>`;
      startProgressBar(PROCESS_SECS);
      listenForUpdate(currentRowId);
      finalizeTimer = setTimeout(() => { if (!pricingArrived) finalizeProcessing(currentRowId); }, PROCESS_SECS*1000);
    }catch(err){ console.error(err); status.textContent = `❌ ${err.message}`; }
  }
```

## Deployment Checklist

- [ ] Update Shopify page code with auto-redirect (code already has genie.ph URL ✅)
- [ ] Save and publish Shopify page
- [ ] Test by uploading an image on Shopify
- [ ] Verify countdown appears (2 seconds)
- [ ] Confirm auto-redirect to genie.ph happens
- [ ] Verify image loads in genie.ph
- [ ] Verify AI analysis runs

## Troubleshooting

**Countdown doesn't appear:**
- Check browser console for JavaScript errors
- Verify the code was inserted in the correct location

**Redirect goes nowhere:**
- Verify you updated the production URL
- Check for typos in the domain name

**Image doesn't load in GeniePH:**
- Verify GeniePH app changes are deployed (from previous step)
- Check browser console for errors
- Verify image URL is publicly accessible
