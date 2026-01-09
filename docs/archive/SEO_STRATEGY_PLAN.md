# SEO Strategy for E-commerce Product Pages

## Overview
Multi-pronged strategy to optimize shared cake design pages for Google Search, Google Images, and Google Shopping.

---

## 1. Technical & On-Page SEO Enhancements

### Dynamic `<title>` Tag
**Formula:**
```html
<title>[Cake Title] | Custom Cake Design | Genie.ph</title>
```

**Example:**
```html
<title>K-Pop Demon Hunter Themed Cake | Custom Cake Design | Genie.ph</title>
```

### Dynamic `<meta name="description">`
**Formula:**
```html
<meta name="description" content="Design and purchase a custom [Cake Title]. This [Size] [Type] cake features [list of 2-3 key decorations]. Customize and get an instant price at Genie.ph.">
```

### Canonical URL
**Tag:**
```html
<link rel="canonical" href="https://genie.ph/designs/my-awesome-cake-1234" />
```

---

## 2. Structured Data (Product Schema)

**The Most Important Step for E-commerce**

Embed a `<script type="application/ld+json">` block with Product schema:

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "K-Pop Demon Hunter Themed Cake",
  "image": "https://.../image-url.jpg",
  "description": "A custom 8\" Round 1 Tier cake inspired by K-Pop Demon Hunters, featuring printout toppers and gumpaste details. Fully customizable.",
  "sku": "design-id-12345",
  "brand": {
    "@type": "Brand",
    "name": "Genie.ph"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://genie.ph/designs/my-awesome-cake-1234",
    "priceCurrency": "PHP",
    "price": "2500.00",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2025-12-31"
  }
}
```

### Why This is Critical:
- Enables Google rich results (price/availability in search listings)
- Required for Google Shopping and Google Images product listings
- Makes pages eligible for enhanced search features

---

## 3. Google Images SEO

### Descriptive Alt Text
**Formula:**
```html
<img alt="A photo of a [Cake Title] showing [key decorations]." />
```

### High-Quality Images
- Already storing good quality images ✓

### ImageObject Schema Enhancement
Add to Product schema:
```json
"image": {
  "@type": "ImageObject",
  "url": "https://.../image-url.jpg",
  "height": "1080",
  "width": "1080"
}
```

---

## 4. Google Shopping Integration

### Two-Step Process:

#### Step 1: Implement Product Structured Data
- Covered in Section 2 above
- Makes pages eligible for automatic Google crawling

#### Step 2: Create Product Feed for Google Merchant Center
**Implementation Plan:**
- Create scheduled serverless function (runs daily)
- Query `cakegenie_shared_designs` table in Supabase
- Generate XML/CSV feed with required fields:
  - ID
  - Title
  - Description
  - Link
  - Image link
  - Price
  - Availability
- Submit feed URL to Google Merchant Center account

**Benefits:**
- Automated feed generation
- New shared designs automatically pushed to Google Shopping
- No manual work required

---

## Implementation Summary

### Phase 1: Enhance Serverless Function (`share-design`)
1. Modify function to fetch all necessary data (price, details, etc.) from database
2. Inject rich HTML dynamically:
   - Dynamic `<title>` and `<meta name="description">`
   - `<link rel="canonical">` tag
   - Complete `<script type="application/ld+json">` with Product, Offer, and ImageObject schemas

### Phase 2: Create Product Feed
1. Develop new scheduled serverless function
2. Generate product feed XML file
3. Submit to Google Merchant Center

---

## Expected Results

Each shared design will become a fully-fledged, SEO-optimized product page with:
- ✅ Enhanced visibility in Google Search
- ✅ Rich snippets in search results
- ✅ Presence in Google Images
- ✅ Eligibility for Google Shopping
- ✅ Automatic indexing of new designs

---

## Status: READY FOR IMPLEMENTATION

This plan is saved and ready to execute when needed. All steps are documented and can be implemented sequentially.
