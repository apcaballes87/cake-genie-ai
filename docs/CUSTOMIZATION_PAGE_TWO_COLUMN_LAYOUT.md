# Customization Page Two-Column Layout Fix

## Problem

The customization page (`/app/customizing/page.tsx`) was displaying as a single column across all screen sizes (mobile to desktop), instead of:

- **Mobile (<768px)**: 1 column (stacked vertically)
- **Tablet/Desktop (≥768px)**: 2 columns (side-by-side)

## Root Cause

1. **Missing closing `</div>` tag** for the LEFT column - the RIGHT column was nested INSIDE the LEFT column instead of being a sibling
2. **Tailwind's `md:` responsive utilities were NOT being applied** by the JIT compiler for unknown reasons

## The Working Solution

**Use inline styles instead of Tailwind's responsive classes.**

### File: `/Users/apcaballes/genieph/src/app/customizing/page.tsx`

#### Two-Column Container (around line 1204)

```tsx
<div className="w-full flex gap-3" style={{ flexDirection: window.innerWidth >= 768 ? 'row' : 'column' }}>
```

#### LEFT Column (around line 1207)

```tsx
<div className="flex flex-col gap-2" style={{ width: window.innerWidth >= 768 ? 'calc(50% - 6px)' : '100%' }}>
    {/* Cake image and controls */}
</div>
```

#### RIGHT Column (around line 1441)

```tsx
<div className="flex flex-col gap-2" style={{ width: window.innerWidth >= 768 ? 'calc(50% - 6px)' : '100%' }}>
    {/* FeatureList - Cake Options */}
</div>
```

## Structure Overview

```
<div className="w-full flex gap-3" style={{ flexDirection: ... }}>  ← 2-COLUMN CONTAINER
    
    <div style={{ width: ... }}>  ← LEFT COLUMN
        {/* Cake image */}
    </div>
    
    <div style={{ width: ... }}>  ← RIGHT COLUMN
        {/* FeatureList / Cake Options */}
    </div>
    
</div>
```

## How to Verify It's Working

1. **Add test borders** (temporary):
   - Blue border on 2-column container
   - Green border on LEFT column (cake image)
   - Red border on RIGHT column (Cake Options)

2. **Expected behavior**:
   - Mobile: Blue border wraps both green and red stacked vertically
   - Desktop: Blue border wraps green and red side-by-side
   - Both columns should have content inside their borders

3. **DevTools check**:
   - Inspect the 2-column container div
   - On desktop: `flex-direction: row`
   - On mobile: `flex-direction: column`

## What NOT to Do

❌ **DO NOT use Tailwind's responsive classes** like `md:flex-row` or `md:w-[calc(50%-6px)]` - they don't get applied by Tailwind JIT for unknown reasons

❌ **DO NOT close the LEFT column div inside the image container** - it must close AFTER all left column content and BEFORE the RIGHT column opens

❌ **DO NOT add extra closing divs** - count opening and closing divs carefully to ensure they're balanced

## Critical Div Structure

The closing divs must be in this exact order:

1. Close the white image container div
2. Close the LEFT column div ← THIS WAS MISSING
3. Open the RIGHT column div
4. Close the white FeatureList container div
5. Close the RIGHT column div
6. Close the 2-column container div
7. Close the parent page container div

## If This Breaks Again

1. **Check div count**: Run this in terminal from project root:

   ```bash
   awk 'NR>=1130 && NR<=1968 {opens+=gsub(/<div/,"<div"); closes+=gsub(/<\/div>/,"</div>")} END {print "Opens: " opens ", Closes: " closes ", Balance: " (opens-closes)}' src/app/customizing/page.tsx
   ```

   Balance should be 0.

2. **Add colored borders** to visually debug:

   ```tsx
   <div className="w-full flex gap-3 border-4 border-blue-500" ...>
   <div className="flex flex-col gap-2 border-4 border-green-500" ...>
   <div className="flex flex-col gap-2 border-4 border-red-500" ...>
   ```

3. **Verify the inline styles are present** - do NOT rely on Tailwind's `md:` classes

## Date Fixed

December 1, 2025

## Fixed By

After multiple attempts including:

- Trying to use Tailwind's `lg:` breakpoint (1024px)
- Trying to use Tailwind's `md:` breakpoint (768px)
- Restarting dev server to regenerate Tailwind CSS
- Adding and removing various closing divs

**Final working solution**: Inline JavaScript styles using `window.innerWidth >= 768` to conditionally apply flex-direction and widths.
