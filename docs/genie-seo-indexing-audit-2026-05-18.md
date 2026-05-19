# Genie.ph SEO, Indexing, SSR, and UX Audit

Audit date: May 18, 2026  
Prepared in repo: `genieph-nextjs`  
Primary data window: February 17, 2026 to May 17, 2026 for GSC, February 17, 2026 to May 18, 2026 for Clarity  
Primary properties: Google Search Console `sc-domain:genie.ph`, Microsoft Clarity for `https://genie.ph`

## Executive Summary

Genie.ph is crawlable and the most important entry pages are indexable. Googlebot is receiving real server-rendered metadata, canonical tags, image tags, and JSON-LD on the landing page, `/customizing`, category pages, and sampled design pages. The issue is not a hard technical block.

The main risk is quality and prioritization. Search visibility has grown quickly, but CTR is falling as impressions scale. The commercial pages are visible, yet most of the strongest organic traffic is still blog-led, while `/customizing` and category pages underperform relative to their importance. A sample category page, `/customizing/category/birthday-cakes`, is crawled but currently not indexed, and its rendered metadata has visible copy duplication such as `Birthday Cakes Cake Designs` and `birthday cakes cakes`.

The design catalog has strong baseline SEO data, but the sitemap and indexing strategy are aggressive: roughly 19k submitted URLs and 18k+ images, with many similar customizer URLs competing for crawl budget. Product/design pages can index and receive rich results, but weak or duplicate design URLs should be filtered more strictly.

Clarity shows meaningful UX friction on the commercial path. `/customizing` had `2,391` page views, `1,528` dead clicks, `42` rage clicks, `245` quick backs, and recurring React hydration errors. That is a conversion problem first, but it also weakens the experience of users arriving from search.

### Highest Priority Findings

| Priority | Finding | Evidence | Recommended action |
| --- | --- | --- | --- |
| P0 | Category metadata/copy duplication is visible to crawlers | `Birthday Cakes Cake Designs in Cebu`, `birthday cakes cakes` in raw HTML sample | Fix pluralization and normalize category display labels in `src/app/customizing/category/[keyword]/page.tsx` |
| P0 | `/customizing` has heavy UX friction | `1,528` dead clicks, `42` rage clicks, `245` quick backs | Investigate click targets, disabled states, loading states, and customizer hydration/runtime errors |
| P0 | React hydration errors appear on homepage and customizer | Clarity reports React error `#418` on both pages | Reproduce with production build and fix mismatched server/client markup |
| P0 | Sitemap submission strategy is noisy | Sitemap index valid with warning; child `sitemap-customized-cakes-9.xml` exists, direct submitted chunks look stale/incomplete | Submit only the index unless chunk-level tracking is intentional; align child chunks and lastmod semantics |
| P1 | Category pages are crawled but not necessarily indexed | `/customizing/category/birthday-cakes` is `Crawled - currently not indexed` | Add more unique, useful category content and stronger internal linking |
| P1 | Homepage has duplicate H1s and missing image alts | Raw HTML sample shows two identical H1s and 5 missing alts | Reduce to one primary H1 and fix missing decorative/content alts |
| P1 | Catalog metadata is strong overall, but low-quality rows remain | Updated follow-up audit: 0 weak alts, 0 generic alts, 67 rows missing dimensions, 11 of those with image URLs, 1,406 tiny measured images | Keep sitemap quality gates and inspect broken/unmeasurable image URLs |

## GSC Performance

GSC shows fast search visibility growth, but the growth is not yet converting into strong commercial-page CTR.

### Topline, Last 90 Days

| Metric | Value |
| --- | ---: |
| Clicks | `5,983` |
| Impressions | `514,264` |
| Average CTR | `1.16%` |
| Average position | `6.3` |

The daily trend shows impressions rising from hundreds per day in mid-February to roughly 9k to 11k per day in early and mid-May. CTR dropped over the same period, especially from late April through mid-May, where daily CTR often sat below `0.90%` despite much higher impressions.

### Key Pages

| Page | Clicks | Impressions | CTR | Position | Read |
| --- | ---: | ---: | ---: | ---: | --- |
| `/blog/jollibee-vs-mcdonalds-kids-party-packages-2026` | `3,309` | `154,089` | `2.15%` | `5.6` | Blog traffic is carrying acquisition |
| `/` | `98` | `1,664` | `5.89%` | `10.0` | Branded and some commercial demand, but not top 5 for money terms |
| `/customizing` | `17` | `2,020` | `0.84%` | `8.8` | Important commercial page, weak CTR |
| `/customizing/kuromi-light-purple-1-tier-cake-e3c3` | `18` | `3,969` | `0.45%` | `8.6` | Strong impression volume, weak snippet pull |
| `/customizing/katseye-kpop-white-1-tier-cake-00f0` | `15` | `2,117` | `0.71%` | `7.3` | Theme demand exists |

### Query Read

Commercial/customizer pages rank for design-led queries, but CTR is thin:

| Query | Page | Clicks | Impressions | CTR | Position |
| --- | --- | ---: | ---: | ---: | ---: |
| `kuromi cake design` | `/customizing/kuromi-light-purple-1-tier-cake-e3c3` | `13` | `2,513` | `0.52%` | `9.7` |
| `custom cake` | `/customizing` | `2` | `66` | `3.03%` | `9.0` |
| `katseye cake design` | `/customizing/katseye-kpop-pink-1-tier-cake-00c3` | `2` | `505` | `0.40%` | `4.0` |
| `tanduay cake design` | `/customizing/tanduay-daddy-brown-1-tier-cake-af87` | `2` | `327` | `0.61%` | `4.4` |

The roadblock is not only ranking. Some URLs have decent average positions but low CTR, which suggests the title/snippet/image result is not compelling enough or search intent is being split across similar URLs.

## Indexing And Sitemap Health

### URL Inspection Samples

| URL | Indexing status | Crawl status | Google canonical | Rich results |
| --- | --- | --- | --- | --- |
| `https://genie.ph/` | Submitted and indexed | Last crawled May 18, 2026, mobile | `https://genie.ph/` | Not reported in sample |
| `https://genie.ph/customizing` | Submitted and indexed | Last crawled May 9, 2026, mobile | `https://genie.ph/customizing` | Not reported in sample |
| `https://genie.ph/customizing/category/birthday-cakes` | Crawled, currently not indexed | Last crawled April 13, 2026, mobile | `https://genie.ph/customizing/category/birthday-cakes` | Not indexed |
| `https://genie.ph/customizing/kuromi-light-purple-1-tier-cake-e3c3` | Submitted and indexed | Last crawled May 17, 2026, mobile | Same URL | Product snippets, Breadcrumbs, Image Metadata |
| `https://genie.ph/customizing/anniversary-red-gold-cake-c180fdfcff370f0f` | Submitted and indexed | Last crawled May 12, 2026, mobile | Same URL | Product snippets, Breadcrumbs, Image Metadata |

The sample design pages prove that Google can index customizer detail URLs and detect product/image rich result signals. The category page sample points to a quality/usefulness issue rather than a robots or fetch failure.

### Sitemap Observations

| Sitemap item | GSC status |
| --- | --- |
| `https://genie.ph/sitemap.xml` | Valid sitemap index, 1 warning |
| `https://genie.ph/sitemap-images.xml` | Valid, `9,402` URLs |
| Child `sitemap-customized-cakes-0.xml` through `8.xml` | Valid, `1,000` URLs each |
| Child `sitemap-customized-cakes-9.xml` | Present in child sitemap list, `351` URLs |
| `sitemap-designs-0.xml` | Present in child sitemap list, `66` URLs |

Concern: the sitemap index is being downloaded correctly, but direct submitted chunk entries appear separately and older. This can make diagnostics harder and may hide whether Google is evaluating the current sitemap index or stale chunk submissions. The safer default is to submit only `https://genie.ph/sitemap.xml` unless there is a deliberate need for chunk-level GSC reporting.

Relevant Google guidance:

- [Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

## SSR And Googlebot Visibility

The Next.js App Router implementation is mostly healthy for crawlability:

- `src/app/layout.tsx` defines sitewide metadata, robots directives, Open Graph/Twitter defaults, and organization/website JSON-LD.
- `src/app/page.tsx` defines homepage metadata, canonical, Open Graph data, and a `CollectionPage`/`WebSite` graph.
- `src/app/customizing/page.tsx` defines static metadata, canonical, and a `CollectionPage` JSON-LD block.
- `src/app/customizing/[slug]/page.tsx` fetches design data server-side, emits dynamic metadata, canonical, image metadata, product-related meta fields, and JSON-LD.
- `src/app/customizing/category/[keyword]/page.tsx` fetches category designs server-side and emits category metadata, CollectionPage/ImageGallery schema, and breadcrumbs.

Googlebot-style raw HTML confirms crawlers receive real page information before client-side React behavior:

| URL | Status | Title | Canonical | H1 sample | Images | Missing alts | JSON-LD types |
| --- | ---: | --- | --- | --- | ---: | ---: | --- |
| `/` | `200` | `Best Online Cake Delivery for Rush Orders in Cebu` | `https://genie.ph` | duplicate H1: same title twice | `31` | `5` | `Bakery`, `WebSite`, `CollectionPage` |
| `/customizing` | `200` | `Cake Designs & Customization | Genie.ph` | `https://genie.ph/customizing` | `Customize Your Cake Design` | `14` | `0` | `Bakery`, `WebSite`, `CollectionPage` |
| `/customizing/category/birthday-cakes` | `200` | `Birthday Cakes Cake Designs in Cebu | Genie.ph` | category URL | `Birthday Cake Designs` | `30` | `0` | `Bakery`, `WebSite`, `CollectionPage`, `BreadcrumbList` |
| `/customizing/kuromi-light-purple-1-tier-cake-e3c3` | `200` | `Kuromi Cake - 1002 Cake Design with Price | Php 1,299 | Genie.ph` | design URL | duplicate H1: `Kuromi Cake - 1002` | `32` | `0` | `Bakery`, `WebSite`, `Product`, `ItemPage`, `BreadcrumbList` |

Important nuance: `/customizing` has SSR metadata and schema, but the actual customization tool is mostly client component behavior. Google can see the page's SEO envelope, but the highest-value interactive states and user-selected details depend on JavaScript. Individual design pages are stronger SEO landing pages because their product-specific metadata and schema are assembled server-side.

Relevant Google guidance:

- [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Technical requirements](https://developers.google.com/search/docs/essentials/technical)

## Metadata, Titles, Descriptions, And Image Data

### Page Samples

| Page | Strengths | Issues |
| --- | --- | --- |
| Homepage `/` | Clear title, commercial delivery promise, index/follow, SSR schema | Duplicate H1, 5 missing image alts, canonical lacks trailing slash while Google selected slash |
| `/customizing` | Strong category/customization description, 0 missing alts, crawlable theme links | Commercial intent is broad, CTR is low, client-heavy tool experience |
| `/customizing/category/birthday-cakes` | Server-rendered grid, 30 image alts, CollectionPage and Breadcrumb schema | Title/description copy duplication, category page crawled but not indexed |
| Sample design page | Product/Image/Breadcrumb rich results, strong alt text, price in title/schema | Very long description may be rewritten; duplicate H1; some titles include noisy IDs or price phrasing |

### Category Copy Bug

The category page currently turns `birthday-cakes` into `Birthday Cakes`, then appends cake-related words again:

- Title sample: `Birthday Cakes Cake Designs in Cebu | Genie.ph`
- Description sample: `Browse birthday cakes cake designs... Order custom birthday cakes cakes...`

This is small in code but large in SEO perception. It makes the page look machine-generated and may contribute to `Crawled - currently not indexed`.

### DB-Wide Image SEO Audit

Command run:

```bash
npx tsx scripts/audit-image-seo.ts
```

Latest verification was run on May 19, 2026. The catalog grew slightly since the May 18 plan snapshot, from `10,296` to `10,299` rows. The quality profile is effectively unchanged.

| Metric | Value |
| --- | ---: |
| Scanned rows | `10,299` |
| Empty `alt_text` | `0` |
| `alt_text` p25/p50/p75/p90 | `101 / 111 / 122 / 131` chars |
| Weak alts under 60 chars | `60` (`0.6%`) |
| Empty SEO titles | `0` |
| Empty SEO descriptions | `0` |
| Missing image dimensions | `126` (`1.2%`) |
| Original image URL not `.webp` | `88` (`0.9%`) |
| Rows with dimensions | `10,173` (`98.8%`) |
| Tiny images under 300px in either dimension | `1,396` (`13.7%` of measured) |
| Generic/boilerplate alts | `11` (`0.1%`) |

Weakest sample rows include generic or awkward metadata:

| URL | Alt text | SEO title |
| --- | --- | --- |
| `/customizing/custom-cake-white-2-tier-fondant-cake-0000` | `Custom cake design` | `Custom Cake | Genie.ph` |
| `/customizing/custom-cake-white-1-tier-cake-383c` | `Custom cake design` | `Custom Cake | Genie.ph` |
| `/customizing/custom-cake-white-rectangle-cake-ffff` | `Custom cake design` | `Custom Cake | Genie.ph` |
| `/customizing/custom-cake-pink-1-tier-cake-e8f0` | `Custom cake design` | `Custom Cake | Genie.ph` |
| `/customizing/new-year-2026-white-1-tier-cake-ffff` | `New Year 2026 cake design` | `New Year 2026 Cake | Genie.ph` |

Relevant Google guidance:

- [Image SEO](https://developers.google.com/search/docs/appearance/google-images)
- [Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)

## Clarity UX Red Flags

### `/customizing`

| Metric | Value |
| --- | ---: |
| Page views | `2,391` |
| Dead clicks | `1,528` |
| Rage clicks | `42` |
| Quick backs | `245` |
| Average session duration for visitors to matching URLs | `151.99s` |
| Average scroll depth | `60.44%` |
| Device sessions | `3,444` mobile, `1,197` PC, `182` tablet |

Top JavaScript errors on pages matching `/customizing`:

| Error | Count |
| --- | ---: |
| `Script error.` | `86` |
| `Cannot read properties of null (reading 'parentNode')` | `30` |
| `Unable to store cookie` | `10` |
| React hydration error `#418` text mismatch | `5` |
| `undefined is not an object (evaluating 'window.webkit.messageHandlers')` | `4` |
| `Maximum call stack size exceeded.` | `4` |
| `Cannot update design: missing original image, icing design, or cake info.` | `2` |
| React hydration error `#418` HTML mismatch | `2` |

The customizer is commercially important and heavily mobile. Dead clicks at this volume suggest users are tapping elements that look interactive, tapping during loading states, or hitting controls whose response is delayed or disabled without clear feedback.

### Homepage `/`

| Metric | Value |
| --- | ---: |
| Page views | `3,387` |
| Dead clicks | `253` |
| Rage clicks | `18` |
| Quick backs | `361` |
| Average scroll depth | `40.28%` |

Top homepage JavaScript errors:

| Error | Count |
| --- | ---: |
| React hydration error `#418` HTML mismatch | `12` |
| `Script error.` | `4` |
| Lead form socket callback error | `2` |

The homepage is indexed, but the scroll depth and quick backs indicate a persuasion gap. Search users may not be getting to the commercial proof and action points quickly enough.

## Ranking Roadblocks

1. Commercial pages underperform relative to blog traffic. The site is very strong at acquiring informational traffic, but `/`, `/customizing`, and category pages are not yet capturing enough money-intent demand.
2. Category pages look programmatic. The birthday category sample is server-rendered, but copy duplication and thin category-specific value likely reduce perceived usefulness.
3. Crawl budget is spread across many similar design URLs. Google can index good design pages, but the catalog needs stronger quality gates so weak/generic/adult/duplicate pages do not dilute crawl attention.
4. CTR is low on high-impression design queries. Several pages rank around positions 4 to 9 but have sub-1% CTR. Titles, descriptions, and image result attractiveness should be tested.
5. `/customizing` UX friction can leak users. Dead clicks, rage clicks, quick backs, and hydration errors are not direct ranking factors in a simple sense, but they hurt the commercial outcome of the SEO traffic.
6. Homepage has mixed signals. Duplicate H1s, missing alts, and canonical slash mismatch are not catastrophic, but they are easy cleanup items on the most important brand/commercial page.

## Prioritized Implementation Recommendations

### P0

1. Fix category metadata pluralization in `src/app/customizing/category/[keyword]/page.tsx`.
   - Normalize category names into a core term and display label.
   - Avoid appending `Cake` or `Cakes` when the decoded keyword already contains it.
   - Apply the same normalized label to title, description, OG alt, schema names, H1, intro copy, and breadcrumbs.

2. Investigate and fix React hydration error `#418` on `/` and `/customizing`.
   - Run a production build locally.
   - Inspect browser console on first load and mobile viewport.
   - Look for server/client mismatches caused by dates, randomized content, hydration-only state, browser-only APIs, animation text, or conditional markup.

3. Clean sitemap submission strategy.
   - Prefer submitting only `https://genie.ph/sitemap.xml`.
   - Keep child sitemaps discoverable through the index.
   - Ensure all child chunks in the index correspond to current generated URLs.
   - Use `<lastmod>` only for meaningful page content changes, not every request.

### P1

4. Strengthen category pages.
   - Add unique above-the-fold category intro copy for top categories.
   - Add visible category-specific FAQs as HTML, not FAQPage schema.
   - Add internal links to related categories, price calculator, how-to-order, and best matching design pages.
   - Consider ItemList in addition to ImageGallery where the page is primarily a list of designs.

5. Reduce duplicate H1 patterns on homepage and design pages.
   - Keep one primary page H1.
   - Use lower-level headings for repeated hero/desktop/mobile variants.
   - Align homepage canonical format with Google's selected canonical, likely `https://genie.ph/`.

6. Improve weak image metadata rows.
   - Backfilled weak/generic alts to 0 remaining weak alts and 0 generic alts in the follow-up audit.
   - Backfilled 59 measurable image dimensions.
   - Remaining dimension gaps are 56 rows without `original_image_url` and 11 rows with broken/unmeasurable image URLs.
   - Review 1,406 tiny measured images and keep low-quality images excluded from sitemaps if they are not useful search results.

7. Add a sitemap quality threshold for customizer URLs.
   - Exclude generic `Custom Cake` rows.
   - Exclude adult/brand-risk rows unless intentionally targeted.
   - Exclude rows with weak alt/title/description or tiny images.
   - Consolidate duplicate slugs and near-duplicate designs before sitemap inclusion.

### P2

8. Improve CTR for commercial pages.
   - Test titles around `custom cake Cebu`, `same-day cake delivery Cebu`, `cake design with price`, and `customize/order online`.
   - Keep titles readable and avoid noisy ID/price stuffing where it weakens trust.
   - Shorten overly long meta descriptions so the first 150 to 170 characters carry the main query and value proposition.

9. Improve `/customizing` tap feedback and loading states.
   - Audit high-dead-click controls in Clarity recordings.
   - Make disabled controls visibly disabled with explanatory labels.
   - Add immediate feedback for upload/analyze/update actions.
   - Ensure mobile sticky actions do not overlap tappable content.

10. Clean up remaining customizer heading semantics.
   - Keep the hidden fallback H1 on plain `/customizing`.
   - Do not render the hidden fallback H1 when a visible product/design H1 is already rendered.
   - Verify `/customizing`, `/customizing/[slug]`, and product customizer states each expose one intended primary H1.

11. Fix the remaining `/customizing` pricing-rule console warning.
   - Investigate `No pricing rule found for: type="icing_text", category="message"`.
   - Add or normalize the missing pricing rule/config path.
   - Confirm the warning is gone in a production browser check.

12. Reduce Supabase FTS pressure during static generation.
   - Avoid calling the heavier `search_products` RPC across many prerendered pages during `next build`.
   - Use lighter indexed related-product filters for build-time related design slots.
   - Keep the FTS RPC available for runtime search/API paths where richer recall matters.
   - Confirm `npm run build` completes without repeated `57014 canceling statement due to statement timeout` logs.

## Validation Plan

After implementing fixes:

1. Run:

```bash
npx tsx scripts/audit-image-seo.ts
```

2. Run targeted tests:

```bash
npm test -- src/app/customizing/category/[keyword]/page.test.tsx src/app/page.metadata.test.tsx src/lib/sitemap/indexability.test.ts src/app/customizing/[slug]/page.test.tsx
```

3. Run:

```bash
npm run build
```

4. Re-run Googlebot-style HTML extraction for:
   - `https://genie.ph/`
   - `https://genie.ph/customizing`
   - `https://genie.ph/customizing/category/birthday-cakes`
   - `https://genie.ph/customizing/kuromi-light-purple-1-tier-cake-e3c3`

5. Confirm for each sample:
   - `200` status
   - Expected title and description
   - Expected canonical
   - `index, follow`
   - Single intended H1
   - No missing content-image alts
   - Expected JSON-LD types

6. Reinspect in GSC after deployment:
   - `/`
   - `/customizing`
   - `/customizing/category/birthday-cakes`
   - Three high-impression design URLs

7. Recheck Clarity after 14 days:
   - Dead clicks
   - Rage clicks
   - Quick backs
   - React hydration errors
   - Customizer runtime errors

## Assumptions And Constraints

- GA4 is out of scope because no GA4 connector is currently available in this session.
- This report is an audit artifact and recommendation set. It does not change application behavior.
- The current priority is to improve commercial SEO quality and crawl efficiency, not to grow the already-successful informational blog channel.
- Googlebot can render JavaScript, but the safer SEO surface is still server-rendered HTML for metadata, structured data, primary content, and links.
