# Blog featured image swap checklist

Goal: every published blog post serves a featured image from a domain we control
(`cqmhanqnfybyxezhobkx.supabase.co` or `genie.ph`) so Google grants Article
rich-result eligibility.

Spec reference:
[Article structured data – image guidelines](https://developers.google.com/search/docs/appearance/structured-data/article).

## How to swap an image

1. Create or pick an original image. Recommended: 1200x630 (16:9) WebP or JPG,
   under 200 KB, with the post's main subject in the center 80%.
2. Upload to Supabase storage in the `blogs` bucket. Suggested path:
   `blogs/<slug>/featured.webp`.
3. Public URL pattern:
   `https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/blogs/<slug>/featured.webp`
4. Update the row:
   ```sql
   UPDATE public.blogs
   SET image = '<new public URL>',
       updated_at = NOW()
   WHERE slug = '<slug>';
   ```
5. After swapping, request reindex of the blog URL in Search Console > URL
   Inspection > Request Indexing.

## Replace these (third-party hot-linked, copyright risk)

| Slug | Current host | Date |
|---|---|---|
| how-to-organize-an-anjo-world-kids-birthday-party-cebu-2026 | cdn-agjai.nitrocdn.com | 2026-03-09 |
| timezone-birthday-party-philippines-2026 | i.ytimg.com | 2026-03-09 |
| red-ribbon-vs-goldilocks-birthday-cake-2026 | i.ytimg.com | 2026-03-09 |
| kidzooona-birthday-party-guide | images.smartparenting.com.ph | 2026-03-09 |
| bento-cake-guide-2026 | images.squarespace-cdn.com | 2026-03-06 |
| katseye-cake-guide-kpop-fans-2026 | i.etsystatic.com | 2026-02-28 |
| how-to-get-marriage-license-metro-cebu | media.assettype.com | 2026-02-27 |
| baptismal-guide-metro-cebu-2026 | d11qgm9a5k858y.cloudfront.net | 2026-02-24 |
| jollibee-vs-mcdonalds-kids-party-packages-2026 | www.moneymax.ph | 2026-02-23 |
| best-play-areas-kids-birthday-parties-metro-cebu | images.unsplash.com | 2026-01-14 |

Note on `images.unsplash.com`: Unsplash images are licensed for free use and
hot-linking is permitted, so technically that one isn't a copyright issue.
But Google still prefers same-property images for Article eligibility, so
re-host it.

Note on `i.ytimg.com`: those are YouTube thumbnails. Do not re-host without
permission. Replace with an original image instead.

## Add an image (currently missing)

Posts without any featured image. They render fine, but `og:image`,
`twitter:image`, and the JSON-LD `image` property are all empty, which hurts
social-card preview and Discover eligibility.

| Slug | Date |
|---|---|
| lemon-square-cake-alternatives-cebu | 2026-04-05 |
| estrels-caramel-cake-alternatives-cebu | 2026-04-05 |
| best-cake-alternatives-goldilocks-red-ribbon-cebu | 2026-04-05 |
| mary-grace-cake-alternatives-cebu | 2026-04-05 |
| top-5-cake-design-themes-girls-4-9-years-2026 | 2026-03-08 |
| top-5-cake-design-themes-girls-1-3-years | 2026-03-08 |
| top-5-cake-design-themes-boys-4-9-years-2026 | 2026-03-08 |
| top-5-cake-design-themes-boys-1-3-years | 2026-03-08 |
| custom-cake-cebu-guide-2026 | 2026-03-06 |
| mc-host-directory-metro-cebu-2026 | 2026-03-01 |
| best-play-areas-kids-birthday-parties-metro-cebu-2026 | 2026-01-14 |

## Already OK (no action)

| Slug | Image |
|---|---|
| bento-cake-designs-guide-every-style-2026 | supabase |
| minimalist-cake-designs-ideas-2026 | supabase |
| genie-ph-idiscount-partnership-20-percent-off | supabase |
| how-to-get-best-value-ordering-custom-cake | supabase |

## After swap: validate

1. Visit `https://search.google.com/test/rich-results` and paste the post URL.
   Confirm "Articles" appears under detected items.
2. In Search Console > URL Inspection, run "Test live URL" and check that
   "Detected items" now includes "Articles" alongside "Breadcrumbs" and
   "Image metadata".
3. Click "Request indexing" once the live test passes.
