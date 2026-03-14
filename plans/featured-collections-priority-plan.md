# Featured Collections Priority Implementation Plan

## Summary

Modify the landing page "Find the Perfect Cake by Theme" section to prioritize showing these specific collections first:

- Bini Cake (bini-cake)
- Kpop Cake (kpop-cake)
- Kpop Demon Hunters Cake (kpop-demon-hunters-cake)
- Kuromi Cake (kuromi-cake)
- Roblox Cake (roblox-cake)
- Barbie Cake (barbie-cake)

## Implementation Approach

The featured collections will be reordered in the `FeaturedCollections` component to prioritize these specific slugs.

## Files to Modify

1. `src/components/landing/FeaturedCollections.tsx` - Add logic to reorder collections based on featured slugs

## Implementation Steps

1. Add a `featuredSlugs` prop to FeaturedCollections component
2. Reorder categories to put featured items first, maintaining order of featured, then the rest
3. Update `src/app/LandingClient.tsx` to pass featured slugs to FeaturedCollections
4. (Optional) The data already comes from page.tsx via props, so we could also reorder in the parent

## Testing

- Verify all 6 collections appear first in the landing page
- Ensure the rest of the collections still display after the featured ones
