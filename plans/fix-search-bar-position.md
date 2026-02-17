# Fix Search Bar Position on Collections Pages

## Problem

The search bar on the collections page and collections/[category] page has different positioning compared to the landing page and search results page.

## Analysis

### Current Implementation Differences

| Aspect | Landing Page | Search Results | Collections | Collections/[category] |
|--------|-------------|----------------|-------------|------------------------|
| Outer container | No py-10 | No py-10 | `py-10` | `py-10` |
| Header wrapper | Direct flex container | Direct flex container | Extra wrapper with `max-w-4xl px-4 mb-4` | Extra wrapper with `max-w-4xl px-4 mb-4` |
| Padding top | `pt-6` on flex row | `pt-6` on flex row | No pt-6 | No pt-6 |
| Container width | `max-w-7xl` | `max-w-7xl` | `max-w-4xl` | `max-w-4xl` |
| Input padding right | `pr-12` | `pr-12` | `pr-24` | `pr-24` |

### Key Issues

1. **Extra vertical padding**: Collections pages have `py-10` on the outer container, pushing content down
2. **Narrower container**: Collections pages use `max-w-4xl` instead of `max-w-7xl`
3. **Missing top padding**: No `pt-6` on the header flex row
4. **Extra wrapper div**: An unnecessary wrapper around the header

## Proposed Changes

### CollectionsClient.tsx

**Before:**

```tsx
<div className="min-h-screen py-10 pb-24 md:pb-10">
    {/* Search Header */}
    <div className="w-full max-w-4xl mx-auto px-4 mb-4">
        <div className="flex items-center gap-2 md:gap-4">
            ...
        </div>
    </div>
    ...
</div>
```

**After:**

```tsx
<div className="min-h-screen pb-24 md:pb-0">
    {/* Search Header */}
    <div className="w-full max-w-7xl mx-auto px-4">
        <div className="w-full flex items-center gap-2 md:gap-4 mb-4 pt-6">
            ...
        </div>
    </div>
    ...
</div>
```

### CategoryClient.tsx

Same changes as CollectionsClient.tsx - update the outer container and header structure.

## Files to Modify

1. [`src/app/collections/CollectionsClient.tsx`](src/app/collections/CollectionsClient.tsx)
   - Remove `py-10` from outer container
   - Change `max-w-4xl` to `max-w-7xl` on header wrapper
   - Add `pt-6` to the header flex row
   - Adjust padding structure to match search results page

2. [`src/app/collections/[category]/CategoryClient.tsx`](src/app/collections/[category]/CategoryClient.tsx)
   - Same changes as CollectionsClient.tsx

## Visual Comparison

```
Landing Page / Search Results:
┌────────────────────────────────────────────────────────────┐
│ [Logo]     [Search Bar....................] [Profile] [Cart] │  <- pt-6
└────────────────────────────────────────────────────────────┘

Collections (Current):
┌────────────────────────────────────────┐
│                                        │  <- py-10 gap
│   [Back] [Search Bar........] [Cart]   │  <- no pt-6
│                                        │
└────────────────────────────────────────┘

Collections (After Fix):
┌────────────────────────────────────────────────────────────┐
│ [Back]     [Search Bar....................]         [Cart] │  <- pt-6
└────────────────────────────────────────────────────────────┘
```
