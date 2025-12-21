# Merchant Admin Dashboard - Implementation Guide

## Overview

Build a merchant-facing admin page where bakeshops can:

1. **Set up their merchant profile** (business info, images, contact)
2. **Add products via image upload** (AI auto-generates details)
3. **Manage their product catalog**

---

## Phase 1: Merchant Profile Setup

### Route: `/merchant/admin`

**Features:**

- Form to create/edit merchant profile
- Image upload for profile picture and cover photo
- Contact information (address, phone, social links)
- Business settings (delivery fee, lead days)

**Database:** `cakegenie_merchants` (already exists)

**Implementation:**

```tsx
// src/app/merchant/admin/page.tsx
// Form fields: business_name, slug, description, address, city, phone, etc.
// Use react-hook-form for validation
// Upload images to Supabase Storage
```

---

## Phase 2: AI-Powered Product Upload

### Key Flow

```
Upload Image → AI Analysis → Extract Details → Save to Cache + Products
```

### Step-by-Step

1. **Merchant uploads cake image**
   - Use existing `ImageUploader` component
   - Support multiple images for batch upload

2. **AI generates product details**

   ```typescript
   // Call existing analyzeCakeFeaturesOnly() function
   const analysis = await analyzeCakeFeaturesOnly(imageData);
   
   // Extract from analysis:
   // - keywords → title (e.g., "Among Us Cake")
   // - cakeType → category
   // - price → suggested price
   // - Generate description from detected features
   ```

3. **Save to database**

   ```typescript
   // 1. Save to cakegenie_analysis_cache (get p_hash)
   await cacheAnalysisResult(pHash, imageUrl, analysis);
   
   // 2. Create product with p_hash link
   await supabase.from('cakegenie_merchant_products').insert({
     merchant_id,
     p_hash,  // Links to analysis cache
     title: generateTitle(analysis.keywords),
     slug: slugify(title),
     short_description: generateDescription(analysis),
     image_url,
     custom_price: analysis.price,
     cake_type: analysis.cakeType,
     category: detectCategory(analysis),
     is_active: true
   });
   ```

---

## Phase 3: Product Management

### Features

- Grid view of all products
- Edit product details (override AI suggestions)
- Toggle product visibility (is_active)
- Delete products
- Reorder products (sort_order)

### UI Components

```tsx
// ProductGrid - Display all merchant products
// ProductEditModal - Edit individual product
// ProductBulkUpload - Upload multiple images at once
```

---

## New Files to Create

```
src/app/merchant/admin/
├── page.tsx                    # Main admin dashboard
├── MerchantAdminClient.tsx     # Client component
├── components/
│   ├── ProfileForm.tsx         # Merchant profile editor
│   ├── ProductGrid.tsx         # Product catalog grid
│   ├── ProductUploader.tsx     # Image upload with AI
│   ├── ProductEditModal.tsx    # Edit product details
│   └── BulkUploadModal.tsx     # Multi-image upload
```

---

## AI Title/Description Generation

```typescript
// src/services/merchantProductService.ts

export function generateProductTitle(keywords: string): string {
  // Take first keyword, capitalize, add "Cake" if not present
  const title = keywords.split(',')[0].trim();
  return title.toLowerCase().endsWith('cake') ? title : `${title} Cake`;
}

export function generateProductDescription(analysis: HybridAnalysisResult): string {
  const parts = [];
  
  if (analysis.cakeType) parts.push(`A beautiful ${analysis.cakeType} style cake`);
  if (analysis.cakeSize) parts.push(`in ${analysis.cakeSize} size`);
  
  // Add detected toppers
  if (analysis.mainToppers?.length) {
    parts.push(`featuring ${analysis.mainToppers[0].description}`);
  }
  
  // Add icing details
  if (analysis.icingDesign?.drip) parts.push('with elegant drip decoration');
  
  return parts.join(' ') + '.';
}

export function detectCategory(analysis: HybridAnalysisResult): string {
  // Detect from keywords or toppers
  const keywords = (analysis.keywords || '').toLowerCase();
  if (keywords.includes('wedding')) return 'Wedding';
  if (keywords.includes('birthday')) return 'Birthday';
  if (keywords.includes('christmas') || keywords.includes('holiday')) return 'Holiday';
  return 'Custom';
}
```

---

## Database Queries Needed

```typescript
// src/services/supabaseService.ts

// Create merchant product from AI analysis
export async function createMerchantProduct(
  merchantId: string,
  imageFile: File,
  overrides?: Partial<CakeGenieMerchantProduct>
): Promise<SupabaseServiceResponse<CakeGenieMerchantProduct>>

// Update merchant product
export async function updateMerchantProduct(
  productId: string,
  updates: Partial<CakeGenieMerchantProduct>
): Promise<SupabaseServiceResponse<CakeGenieMerchantProduct>>

// Delete merchant product
export async function deleteMerchantProduct(
  productId: string
): Promise<SupabaseServiceResponse<null>>

// Reorder merchant products
export async function reorderMerchantProducts(
  merchantId: string,
  productOrder: { productId: string; sortOrder: number }[]
): Promise<SupabaseServiceResponse<null>>
```

---

## RLS Policies to Add

```sql
-- Merchants can insert their own products
CREATE POLICY "Merchants can insert own products"
ON cakegenie_merchant_products
FOR INSERT
WITH CHECK (
  merchant_id IN (
    SELECT merchant_id FROM cakegenie_merchants WHERE user_id = auth.uid()
  )
);

-- Merchants can delete their own products
CREATE POLICY "Merchants can delete own products"
ON cakegenie_merchant_products
FOR DELETE
USING (
  merchant_id IN (
    SELECT merchant_id FROM cakegenie_merchants WHERE user_id = auth.uid()
  )
);
```

---

## UI/UX Considerations

1. **Drag-and-drop** for image upload
2. **Preview before save** - show AI-generated details for review
3. **Inline editing** - click to edit any field
4. **Bulk operations** - select multiple products to delete/hide
5. **Toast notifications** for success/error feedback
