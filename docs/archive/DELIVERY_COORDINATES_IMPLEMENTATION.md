# Delivery Coordinates Implementation Summary

## Overview

Added support for storing Google Maps coordinates (latitude/longitude) for guest user delivery addresses directly in the orders table.

## Changes Made

### 1. Database Migration

**File**: `/supabase/migrations/20251203000001_add_delivery_coordinates.sql`

- Added `delivery_latitude` and `delivery_longitude` columns to `cakegenie_orders` table
- Updated `create_order_from_cart()` RPC function to accept and store coordinates
- Updated `create_split_order_from_cart()` RPC function to accept and store coordinates

### 2. TypeScript Types

**File**: `/src/lib/database.types.ts`

Updated `CakeGenieOrder` interface to include:

```typescript
delivery_latitude?: number | null;
delivery_longitude?: number | null;
```

### 3. Service Layer

**File**: `/src/services/supabaseService.ts`

Updated both order creation functions:

- `createOrderFromCart()` - Added `latitude` and `longitude` to `guestAddress` parameter
- `createSplitOrderFromCart()` - Added `latitude` and `longitude` to `guestAddress` parameter

Both functions now pass coordinates to the database RPC functions.

### 4. Cart Page

**File**: `/src/app/cart/page.tsx`

Updated both order submission handlers to include coordinates:

- `handleSubmitOrder()` - Passes `latitude` and `longitude` from `effectiveGuestAddress`
- `handleSplitWithFriends()` - Passes `latitude` and `longitude` from `effectiveGuestAddress`

## How It Works

### For Guest Users

1. Guest fills out the address form (which already captures coordinates via Google Maps)
2. The `AddressForm` component stores coordinates in the `CakeGenieAddress` object
3. When placing an order, coordinates are extracted from `effectiveGuestAddress.latitude` and `effectiveGuestAddress.longitude`
4. Coordinates are passed to the RPC function as `p_delivery_latitude` and `p_delivery_longitude`
5. Database stores coordinates directly in the order record

### For Registered Users

- Coordinates are already stored in the `cakegenie_addresses` table
- The order references the address via `delivery_address_id`
- The new columns remain `NULL` for registered users (not needed since they have the address reference)

## Database Schema

```sql
-- New columns in cakegenie_orders
delivery_latitude NUMERIC NULL
delivery_longitude NUMERIC NULL
```

These columns are:

- **Nullable**: Only populated for guest orders
- **Type**: `NUMERIC` for precision
- **Purpose**: Store exact delivery location for guest orders where `delivery_address_id` is NULL

## Next Steps

### To Apply This Migration

**Option 1: Remote Database (Recommended)**
Run the migration SQL directly in your Supabase SQL Editor:

1. Go to your Supabase Dashboard → SQL Editor
2. Copy the contents of `/supabase/migrations/20251203000001_add_delivery_coordinates.sql`
3. Execute the SQL

**Option 2: Local Development**
If you have Docker Desktop running:

```bash
npx supabase db reset
```

### Testing Checklist

- [ ] Migration applied successfully
- [ ] Guest user can place order with address
- [ ] Coordinates are saved in `delivery_latitude` and `delivery_longitude` columns
- [ ] Split orders also save coordinates
- [ ] Registered user orders still work (coordinates remain NULL)
- [ ] Order details page displays correctly

## Benefits

✅ **Precise Location Data**: Exact coordinates for delivery routing
✅ **No RLS Complications**: Coordinates stored directly in order (no separate address table)
✅ **Guest-Friendly**: Works seamlessly with anonymous checkout
✅ **Backward Compatible**: Existing orders and registered user flow unaffected
✅ **Future-Proof**: Enables delivery route optimization and distance calculations

## Data Flow

```
Guest User Flow:
AddressForm (captures lat/lng via Google Maps)
    ↓
guestAddress state (includes latitude, longitude)
    ↓
createOrderFromCart({ guestAddress: { ..., latitude, longitude } })
    ↓
RPC: create_order_from_cart(p_delivery_latitude, p_delivery_longitude)
    ↓
cakegenie_orders table (delivery_latitude, delivery_longitude columns)
```

## Files Modified

1. ✅ `/supabase/migrations/20251203000001_add_delivery_coordinates.sql` (NEW)
2. ✅ `/src/lib/database.types.ts`
3. ✅ `/src/services/supabaseService.ts`
4. ✅ `/src/app/cart/page.tsx`

---

**Note**: The `AddressForm` component already captures coordinates when users select an address from Google Maps autocomplete. No changes needed there - the coordinates are already available in the `CakeGenieAddress` object via the `latitude` and `longitude` fields.
