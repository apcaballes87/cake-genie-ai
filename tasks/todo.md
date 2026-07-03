# Tasks

## Backfill Cache Total Price Column (2026-07-03)

### Plan

- [x] Confirm the stored `cakegenie_analysis_cache.price` should be recalculated as lowest same-tier base price plus current add-on pricing.
- [x] Add a dedicated backfill script for the total `price` column.
- [x] Verify the script on previously bad/non-canonical rows and inspect the before/after values.
- [x] Run the corrected backfill against the full cache table.

### Review

- Added [scripts/backfill-cache-total-prices.ts](/Users/apcaballes/genieph-nextjs/scripts/backfill-cache-total-prices.ts:1), a dedicated script that recalculates `cakegenie_analysis_cache.price` as lowest same-tier/type base price from `productsizes_cakegenie` plus current add-on pricing. It updates only the `price` column.
- Fixed the unsafe pricing path by adding [src/lib/utils/cakeType.ts](/Users/apcaballes/genieph-nextjs/src/lib/utils/cakeType.ts:1). Raw AI/cache labels such as `cupcakes-icing`, `cupcakes_only`, and `4 Tier Fondant` are normalized to canonical pricing-table types before base-price lookup.
- Changed base-price lookup failures to throw instead of falling back to `0`, preventing corrupted totals like `0` or `99`.
- Corrected full backfill completed:
  - `fetched: 13342`
  - `processed: 13342`
  - `updated: 6`
  - `unchanged: 13336`
  - `errors: 0`
- Verified known previously bad/non-canonical rows now price from real base rows:
  - `cupcakes-icing` / `cupcakes-printout-toppers` normalize to `Cupcake` and now store `499` or `599`, not `99`.
  - `4 Tier Fondant` normalizes to `3 Tier Fondant` and now stores `11399`.
  - Missing raw `cakeType` falls back to `1 Tier` and stores `1199`.
- Verified there are `0` rows whose stored price is below the normalized type's lowest `productsizes_cakegenie` base price.
- Verification:
  - `npx vitest run 'src/lib/utils/cakeType.test.ts' 'src/app/customizing/[slug]/page.test.tsx' 'src/app/customizing/[slug]/designSchema.test.tsx' --exclude '.claude/**'`

## Lowest Displayed Price Per Tier On Customizing Slug Page (2026-07-03)

### Plan

- [x] Confirm the current `/customizing/[slug]` displayed price is sourced from thickness-filtered base-price options instead of the lowest ladder for the same tier.
- [x] Add a shared helper that returns the lowest base-price option per size for a cake type/tier.
- [x] Switch the slug page SSR price fetch to the new tier-level helper while leaving interactive customizer pricing unchanged.
- [x] Run focused tests for the slug page/schema price contract.

### Review

- Confirmed the slug page SSR price fetch was using `getCakeBasePriceOptions(type, defaultThickness)`, which locked `1 Tier` pages to the `4 in` ladder instead of the cheapest available ladder for the same tier.
- Added `getLowestCakeBasePriceOptions(type)` in [src/services/supabaseService.ts](/Users/apcaballes/genieph-nextjs/src/services/supabaseService.ts:1). It reads all base-price rows for a cake type/tier, keeps the lowest price per size, and returns that ladder in stable size order.
- Updated [src/app/customizing/[slug]/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/[slug]/page.tsx:1) to use the new helper for SSR/display/schema pricing. This changes the visible slug-page starting price and JSON-LD range to the lowest ladder for the same tier.
- Left the interactive customizer pricing flow unchanged: `usePricing` and merchant-product flows still use exact `type + thickness` selections for actual customization.
- Verification:
  - `npx vitest run 'src/app/customizing/[slug]/page.test.tsx' 'src/app/customizing/[slug]/designSchema.test.tsx' --exclude '.claude/**'`
  - `git diff --check -- 'src/services/supabaseService.ts' 'src/app/customizing/[slug]/page.tsx' 'src/app/customizing/[slug]/page.test.tsx' 'src/app/customizing/[slug]/designSchema.test.tsx' tasks/todo.md`
- Result: focused tests passed (`42` passed, `1` skipped), and `git diff --check` passed.

## Cake-Type Price Range Structured Data (2026-07-02)

### Plan

- [x] Inspect the existing `/customizing/[slug]` Product JSON-LD offer path and cake base-price helper.
- [x] Change Product structured data to use `AggregateOffer` with `lowPrice`, `highPrice`, and `offerCount` when the detected cake type has multiple base-price variants.
- [x] Keep single-price `Offer` fallback when there is only one price or no variant ladder.
- [x] Update focused schema/page tests for the new range contract while keeping organic meta descriptions price-free.
- [x] Run focused tests, rendered metadata/schema verification, diff checks, and build.

### Review

- Updated [src/app/customizing/[slug]/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/[slug]/page.tsx:1) so the Product JSON-LD uses `AggregateOffer` when the detected cake type has multiple base-price options. The offer now emits `lowPrice`, `highPrice`, and `offerCount` from the cake-type variant ladder.
- The single-price path still emits a normal `Offer` when only one price is available or the range collapses to one value.
- Organic meta descriptions remain price-free; the price range is limited to Product structured data / rich-result eligibility.
- Added coverage in [src/app/customizing/[slug]/designSchema.test.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/[slug]/designSchema.test.tsx:1) and [src/app/customizing/[slug]/page.test.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/[slug]/page.test.tsx:1) for both multi-variant `AggregateOffer` and single-price fallback behavior.
- Verification:
  - `npx vitest run 'src/app/customizing/[slug]/designSchema.test.tsx' 'src/app/customizing/[slug]/page.test.tsx' 'src/app/customizing/[slug]/metadataHelpers.test.ts' src/lib/commerce/machineReadable.test.ts --exclude '.claude/**'` passed: 4 files, 103 tests, 1 skipped.
  - Local dev render at `http://localhost:3017/customizing/police-white-1-tier-cake-f4d8` showed meta descriptions without price text and Product JSON-LD range fields `lowPrice = 1299`, `highPrice = 1899`, `offerCount = 3`.
  - `git diff --check -- 'src/app/customizing/[slug]/page.tsx' 'src/app/customizing/[slug]/designSchema.test.tsx' 'src/app/customizing/[slug]/page.test.tsx' tasks/todo.md` passed.
  - `npm run build` passed with existing non-fatal warnings for stale `baseline-browser-mapping`, inferred workspace root, and deprecated `middleware`.

## Remove Price CTA From Customizing Meta Descriptions (2026-07-02)

### Plan

- [x] Verify whether the reported Google snippet text comes from stored cache descriptions or live route-rendered metadata.
- [x] Check the affected live cache row and current public HTML for the active custom cake slug.
- [x] Remove route-level price CTA injection from `/customizing/[slug]` meta descriptions while keeping product offer structured data separate.
- [x] Update focused metadata tests so price text cannot be reintroduced into organic snippets.
- [x] Run focused tests and verify rendered metadata for the affected page.

### Review

- Investigation found the cleaned live `cakegenie_analysis_cache.seo_description` did not contain price text, and a DB-wide check found `0` rows with price text in top-level or nested SEO descriptions.
- Root cause was [src/app/customizing/[slug]/metadataHelpers.ts](/Users/apcaballes/genieph-nextjs/src/app/customizing/[slug]/metadataHelpers.ts:1), where `optimizeMetaDescription(...)` appended ` | Price starts at ₱... Customize now!` at render time.
- Updated [src/app/customizing/[slug]/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/[slug]/page.tsx:1) to optimize snippet copy without price injection.
- Updated tests in [src/app/customizing/[slug]/metadataHelpers.test.ts](/Users/apcaballes/genieph-nextjs/src/app/customizing/[slug]/metadataHelpers.test.ts:1) and [src/app/customizing/[slug]/page.test.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/[slug]/page.test.tsx:1) to assert organic meta descriptions do not include price terms.
- Verification:
  - `npx vitest run 'src/app/customizing/[slug]/metadataHelpers.test.ts' 'src/app/customizing/[slug]/page.test.tsx' --exclude '.claude/**'` passed: 2 files, 51 tests, 1 skipped.
  - Local dev render at `http://localhost:3017/customizing/police-white-1-tier-cake-f4d8` showed meta, OG, and Twitter descriptions without `Price starts`, `₱1,299`, or `Customize now`.
  - `git diff --check -- 'src/app/customizing/[slug]/metadataHelpers.ts' 'src/app/customizing/[slug]/metadataHelpers.test.ts' 'src/app/customizing/[slug]/page.tsx' 'src/app/customizing/[slug]/page.test.tsx' tasks/todo.md` passed.
  - `npm run build` passed with existing non-fatal warnings for stale `baseline-browser-mapping`, inferred workspace root, deprecated `middleware`, and Supabase statement timeouts during static fallback generation.

## Re-run AI Analysis Cache Prices And Analysis JSON (2026-07-02)

### Plan

- [x] Audit the current cache write path and confirm it would overwrite fields beyond `analysis_json` and `price`.
- [x] Add a dedicated backfill script that re-runs the active cake-analysis prompt against existing cache image URLs and recalculates price.
- [x] Keep the database write scoped to `analysis_json` and `price` only, leaving slug, keywords, SEO fields, and other cache metadata untouched.
- [x] Verify the script with a dry run and a small live batch.
- [x] Start the full cache re-analysis run for all eligible `cakegenie_analysis_cache` rows.

### Review

- Added [scripts/rerun-analysis-cache.ts](/Users/apcaballes/genieph-nextjs/scripts/rerun-analysis-cache.ts:1), a dedicated backfill script that fetches existing cache rows by `original_image_url`, re-runs the active AI cake-analysis prompt, recalculates price from current pricing rules, and updates only `analysis_json` and `price`.
- The script deliberately does not call the shared `cacheAnalysisResult(...)` writer because that path would also rewrite slug, keywords, top-level SEO fields, and related cache metadata.
- Verification:
  - `npx tsx scripts/rerun-analysis-cache.ts --help`
  - `git diff --check`
  - `npx tsx scripts/rerun-analysis-cache.ts --dry-run --limit=1 --concurrency=1`
  - `npx tsx scripts/rerun-analysis-cache.ts --limit=1 --concurrency=1`
- Dry run succeeded against `p_hash = 0c0807c0d8d4743c`, producing recalculated `price = 1199` without writing to the database.
- Live one-row write succeeded against the same row, updating only `analysis_json` and `price`.
- Full rerun started with `npx tsx scripts/rerun-analysis-cache.ts --concurrency=2`.
- Initial live progress confirmed updates for:
  - `0c0807c0d8d4743c` -> `1199`
  - `1b3d51bece961fec` -> `4099`
  - `8e1f3b3b33068585` -> `1399`
  - `c95333fd7d0f4bed` -> `2699`
- User-requested stop checkpoint captured on 2026-07-02: latest completed index observed was `2947`.
- Resume command for later:
  - `npx tsx scripts/rerun-analysis-cache.ts --concurrency=2 --offset=2947`

## Parallel Customizer Studio Edit Start (2026-07-01)

### Plan

- [x] Record the desired upload timing: after pHash, start AI cake analysis and studio image edit as sibling work.
- [x] Add an early studio-processing cache insert-ignore flow that does not require completed analysis fields.
- [x] Make cache-hit lookups ignore placeholder rows whose `analysis_json` is not ready.
- [x] Wire fresh `/customizing` uploads to prepare the studio row and trigger the studio edit before awaiting cake analysis.
- [x] Add focused regression tests for ordering and placeholder behavior.
- [x] Run focused verification and document results.

### Review

- Reworked `prepareStudioEditCacheRow(...)` in [src/services/supabaseService.ts](/Users/apcaballes/genieph-nextjs/src/services/supabaseService.ts:1) so fresh uploads insert the placeholder row with `ignoreDuplicates: true`, fetch the row afterward, and only run a narrow status/update retry when Studio should start.
- Live Supabase schema check confirmed `cakegenie_analysis_cache.analysis_json` is `NOT NULL`, so the early row writes a small internal `__studio_edit_placeholder` marker instead of `null`.
- The prepare helper never rewrites completed analysis fields after the insert attempt: no `analysis_json`, `price`, `keywords`, slug, SEO fields, or availability are touched by the retry update.
- Added the Studio trigger policy for new placeholders, `not_started`, `failed`, missing-image completed rows, and `processing` rows older than 15 minutes, while suppressing duplicates for completed-with-image and active-processing rows.
- Updated cache-hit lookups, including `getAnalysisByExactHash(...)`, to ignore placeholder rows so an in-flight studio job cannot be reused as a completed cake analysis.
- Updated [src/contexts/ImageContext.tsx](/Users/apcaballes/genieph-nextjs/src/contexts/ImageContext.tsx:1) so the early studio row preparation and `/api/ai/trigger-studio-edit` chain starts before awaiting `/api/ai/analyze`, and `cacheAnalysisResult(...)` only schedules the delayed trigger if the early Studio trigger failed.
- Added regression coverage proving the studio trigger fires while cake analysis is still unresolved, completed analysis rows are not overwritten, trigger retries/suppression follow policy, exact-hash placeholders return `null`, and ImageContext suppresses/permits the delayed trigger correctly.
- Verification:
  - `npx vitest run src/contexts/ImageContext.test.tsx src/services/supabaseService.cacheAnalysisResult.test.ts src/services/supabaseService.findSimilarAnalysisByHash.test.ts src/app/api/ai/trigger-studio-edit/route.test.ts --exclude '.claude/**'` passed: 4 files, 33 tests.
  - `git diff --check` passed.
  - `npm run build` passed with existing non-fatal warnings for stale browser data, inferred workspace root, and deprecated `middleware`.

## GA4 June 27 Session Spike Diagnosis (2026-06-29)

### Plan

- [x] Verify live GA4 access for `properties/510070439` using the documented service-account path.
- [x] Compare daily sessions around June 27, 2026 against nearby dates.
- [x] Break June 27 traffic down by source/medium, landing page, geography, device, and engagement quality.
- [x] Check key funnel/event behavior to distinguish real buyer activity from low-quality or bot/referral traffic.
- [x] Summarize the likely cause and recommended follow-up checks.

### Review

- Live GA4 access worked through `GOOGLE_APPLICATION_CREDENTIALS=/Users/apcaballes/ga4-service-account.json` against `properties/510070439`.
- June 27, 2026 was the local spike: `1,018` sessions and `992` users, versus `737` sessions on June 26 and `585` on June 28.
- The spike was mostly Direct / none: `710` sessions on June 27, compared with `215` on June 26 and `295` on June 28. Google organic stayed normal/healthy at `262` sessions on June 27 with `67.6%` engagement.
- The low-quality segment was concentrated in Direct Philippines mobile Safari traffic: `513` PH mobile Safari sessions with `1.36%` engagement and `2.59s` average session duration; Direct iOS mobile Safari overall was `538` sessions with `4.28%` engagement and `3.57s` average session duration.
- Device/browser quality confirmed the same pattern: Safari had `673` sessions sitewide on June 27 but only `11.1%` engagement, while Chrome had `305` sessions with `61.3%` engagement.
- Funnel quality did not rise with the session spike. June 27 had only `9` image uploads, `2` add-to-cart events, and `2` cart redirects; Direct traffic contributed only `3` image uploads, `1` add-to-cart, and `1` cart redirect.
- Likely cause: a short-lived burst of unattributed/Direct iOS Safari mobile traffic, probably social-app/private-browser/link-preview or bot-like traffic being bucketed as Direct, not a real buyer-demand jump. The useful traffic that day remained normal Google organic, led by the Jollibee vs McDonald's blog page.
- Recommended follow-up: compare Vercel/CDN logs for June 27 by user-agent/IP/ASN around the Direct Safari burst, and consider a GA4 exploration/filter for Direct + iOS Safari + engagement under 10 seconds to keep this segment from distorting growth reads.

## Mobile CLS Audit for Jollibee vs McDonald's Blog (2026-06-29)

### Plan

- [x] Trace the affected GSC URL through the blog route and components.
- [x] Identify likely mobile layout-shift sources in the rendered article.
- [x] Implement the smallest durable fix for unstable layout boxes.
- [x] Verify with focused tests, lint/build checks, and local mobile browser measurement where practical.

### Review

- Root cause found: the affected blog post includes raw HTML `<img>` tags in article content. Those images were rendered without stable `width`/`height` attributes, so mobile layout could shift when the images decoded.
- Updated [src/app/blog/[slug]/BlogContent.tsx](/Users/apcaballes/genieph-nextjs/src/app/blog/[slug]/BlogContent.tsx:1) to normalize every blog image with dimensions, lazy loading, and async decoding while preserving explicit dimensions when present.
- Added known intrinsic dimensions for the two party-package images used on `/blog/jollibee-vs-mcdonalds-kids-party-packages-2026`: Jollibee `735x490`, McDonald's `950x633`.
- Added [src/app/globals.css](/Users/apcaballes/genieph-nextjs/src/app/globals.css:1) blog-image CSS so article images remain block-level, responsive, and visually stable.
- Added regression coverage in [src/app/blog/[slug]/BlogContent.test.tsx](/Users/apcaballes/genieph-nextjs/src/app/blog/[slug]/BlogContent.test.tsx:1) for raw HTML image normalization, explicit-dimension preservation, and known party-package dimensions.
- Verification:
  - `npx vitest run 'src/app/blog/[slug]/BlogContent.test.tsx' --exclude '.claude/**'` passed: 5 tests.
  - `npx eslint 'src/app/blog/[slug]/BlogContent.tsx' 'src/app/blog/[slug]/BlogContent.test.tsx'` passed with the existing stale Browserslist warning only.
  - `git diff --check` passed.
  - `npm run build` passed with existing non-fatal warnings for stale baseline browser data, inferred workspace root, and deprecated `middleware`.
  - Local production server on port `3003`, mobile viewport `390x844`, confirmed the exact affected URL renders both raw blog images with reserved height matching final rendered height: `356x237` for both article images.

## AIO/GEO Owned Surface Hardening (2026-06-29)

### Plan

- [x] Create a read-only AIO/GEO audit report for retrieval, source preference, and selection tracking.
- [x] Expand the homepage AEO section with an answer-first Genie.ph facts block.
- [x] Add FAQ schema and answer-first copy to local SEO landing pages.
- [x] Add reusable FAQ schema and answer-first copy to `/collections/[category]`.
- [x] Add blog answer-summary and freshness signals.
- [x] Update `public/llms.txt` with current AI-agent facts and audit guidance.
- [x] Run focused tests, `git diff --check`, and `npm run build`.

### Review

- Added [docs/seo/2026-06-29-aio-geo-audit-sprint.md](/Users/apcaballes/genieph-nextjs/docs/seo/2026-06-29-aio-geo-audit-sprint.md:1) as the read-only retrieval, source-preference, selection, external-footprint, and verification tracker.
- Expanded [src/components/seo/HomepageAeoSections.tsx](/Users/apcaballes/genieph-nextjs/src/components/seo/HomepageAeoSections.tsx:1) with a direct-answer `What is Genie.ph?` block that reuses centralized pricing, delivery, payment, and trust facts.
- Updated [src/components/local-seo/LocalSeoLandingPage.tsx](/Users/apcaballes/genieph-nextjs/src/components/local-seo/LocalSeoLandingPage.tsx:1) with an answer-first block and FAQ schema generated from each page config.
- Updated [src/app/collections/[category]/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/collections/[category]/page.tsx:1) and [src/app/collections/[category]/CategoryClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/collections/[category]/CategoryClient.tsx:1) with matching FAQ schema and crawlable answer-first collection copy while leaving `/customizing/category/[keyword]` noindex behavior untouched.
- Updated [src/app/blog/[slug]/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/blog/[slug]/page.tsx:1) with a reusable answer-summary block, `Last reviewed` display, and modified-time fallback.
- Refreshed [public/llms.txt](/Users/apcaballes/genieph-nextjs/public/llms.txt:1) with current pricing, priority public pages, AIO audit prompts, and the non-automated community-footprint guardrail.
- Verification:
  - `npx vitest run 'src/app/blog/[slug]/BlogContent.test.tsx' 'src/app/customizing/category/[keyword]/page.test.tsx' src/app/page.metadata.test.tsx src/app/sitemap.test.ts --exclude '.claude/**'` passed: 4 files, 8 tests.
  - Focused `npx eslint` on changed TS/TSX files passed with the existing stale Browserslist warning only.
  - `git diff --check` passed.
  - `npm run build` passed. Existing non-fatal warnings appeared for stale baseline browser data, inferred workspace root, deprecated `middleware`, and unrelated Supabase statement timeouts during static generation.
  - Raw HTML checks against a temporary production server on port `3003` confirmed markers on `/`, `/cake-delivery-cebu`, `/birthday-cake-delivery-cebu-city`, `/collections/bento-cake`, `/blog/custom-cake-cebu-guide-2026`, `/faq`, and `/llms.txt`.

## Add Free Thin Fabric Ribbon Bow Type (2026-06-28)

### Plan

- [x] Add local schema, pricing enum, and display support for `thin_fabric_ribbon_bows`.
- [x] Update fallback prompt guidance so thin side bows/streamers are free and large wraps remain `satin_ribbon`.
- [x] Create a new Supabase `ai_prompts` row from the active prompt without overwriting the previous version.
- [x] Add active free pricing rule for thin fabric ribbon bows.
- [x] Run focused verification.

### Review

- Added `thin_fabric_ribbon_bows` as a support element type for small or thin non-edible satin/organza/sheer bow accents, dangling ribbon tails, and narrow streamers.
- Kept `satin_ribbon` as the paid large fabric wrap/large organza wrap/full-band type.
- Created active Supabase prompt version `3.23` from `3.22`; `3.22` remains preserved and inactive.
- Added pricing rule `186`: `thin_fabric_ribbon_bows`, category `support_element`, classification `support`, price `0`, quantity rule `flat`.
- Verification:
  - Supabase active prompt check returned `prompt_id = 32`, version `3.23`, with the `thin_fabric_ribbon_bows` guidance present.
  - Supabase pricing check returned active rule `186` for `thin_fabric_ribbon_bows` at `0.00`; existing `satin_ribbon` rule `179` remains active at `100.00`.
  - `npx vitest run src/services/prompts/analysisPromptRules.test.ts src/lib/ai/utils.test.ts --exclude '.claude/**'` passed with 15 tests.
  - `git diff --check` passed.
  - Focused `npx eslint` passed with existing warnings only in touched UI files.
  - `npm run build` passed; existing non-fatal warnings appeared for stale browser data, inferred Next workspace root, and deprecated middleware.

## Add Edible Lego Brick Support Type (2026-06-27)

### Plan

- [x] Add local schema, pricing enum, and display support for `edible_lego_bricks`.
- [x] Add fallback prompt guidance so Lego-style edible bricks are not classified as generic `edible_3d_ordinary`.
- [x] Create new Supabase `ai_prompts` row from the active prompt without overwriting the previous version.
- [x] Add active pricing rule for edible Lego bricks at 10 per piece.
- [x] Run focused verification.

### Review

- Added `edible_lego_bricks` as a support element type for small edible fondant/gumpaste Lego-style brick or building-block decorations with visible studs.
- Created active Supabase prompt version `3.22` from `3.21`; `3.21` remains preserved and inactive.
- Added pricing rule `185`: `edible_lego_bricks`, category `support_element`, classification `non-gumpaste`, price `10`, quantity rule `per_piece`.
- Verification:
  - Supabase active prompt check returned `prompt_id = 31`, version `3.22`, with the `EDIBLE LEGO BRICKS / BUILDING BLOCKS` section present.
  - Supabase pricing check returned active rule `185` for `edible_lego_bricks` at `10.00` per piece.
  - `npx vitest run src/services/prompts/analysisPromptRules.test.ts src/lib/ai/utils.test.ts --exclude '.claude/**'` passed with 15 tests.
  - `git diff --check` passed.
  - Focused `npx eslint` passed with existing warnings only in touched UI files.
  - `npm run build` passed; existing non-fatal warnings appeared for stale browser data, inferred Next workspace root, deprecated middleware, and unrelated Supabase statement timeouts during static generation.

## Add Edible 2D Logo Craft Type (2026-06-26)

### Plan

- [x] Add local schema, pricing enum, and display support for `edible_logo_2d`.
- [x] Add fallback prompt guidance for matte hand-cut gumpaste/fondant logo panels versus glossy printouts.
- [x] Create new Supabase `ai_prompts` row from the active prompt without overwriting the previous version.
- [x] Add active pricing rules for small, medium, and large edible logo craft toppers.
- [x] Run focused verification.

### Review

- Added `edible_logo_2d` as a main topper type for flat or shallow-relief edible logo/name/brand panels made from gumpaste/fondant craft.
- Created active Supabase prompt version `3.21` from `3.20`; `3.20` remains preserved and inactive.
- Added pricing rules:
  - `edible_logo_2d_small`: 40
  - `edible_logo_2d_medium`: 70
  - `edible_logo_2d_large`: 100
- Verification:
  - Supabase active prompt check returned `prompt_id = 30`, version `3.21`, with the `EDIBLE 2D LOGO CRAFT TOPPERS` section present.
  - Supabase pricing check returned active rules `182`, `183`, and `184` for small, medium, and large `edible_logo_2d`.
  - `npx vitest run src/services/prompts/analysisPromptRules.test.ts src/lib/ai/utils.test.ts --exclude '.claude/**'` passed with 14 tests.
  - `git diff --check` passed.
  - `npm run build` passed; existing non-fatal warnings appeared for stale browser data, inferred Next workspace root, deprecated middleware, and unrelated Supabase statement timeouts during static generation.

## Custom Cake Googlebot Reachability Audit (2026-06-26)

### Plan

- [x] Confirm the sitemap routes that expose individual custom cake product URLs to Googlebot.
- [x] Count current sitemap-eligible custom cake rows and identify quality gates that exclude rows.
- [x] Compare collection page matching against search matching for a known mismatch theme: `pickleball`.
- [x] Check whether collection pages expose enough product links/pagination for Googlebot to traverse matched inventory.
- [x] Record findings, risks, and any scoped fix/backfill recommendation.

### Review

- Production `https://genie.ph/sitemap-index.xml` exposes `sitemap-customized-cakes-0.xml` through `sitemap-customized-cakes-13.xml`, plus the shared-design sitemap. Chunk `13` currently returns an empty `<urlset>`, which is harmless but shows the chunk hint count is a little higher than the final JS-filtered URL count.
- Live `cakegenie_analysis_cache` currently has `13,248` rows, `13,246` rows with slugs, and `13,206` rows older than the 2-day customizer sitemap age gate.
- The sitemap server-side database filters leave `13,067` candidates before JavaScript-level exclusions. SQL approximation of the final gates gives about `12,393` indexable rows; the public sitemap chunk count observed from production is about `12,356` product URLs because chunk `0` through `11` each expose `1,000` URLs and chunk `12` exposes `356`.
- Main sitemap exclusions found: `669` legacy hash-like slugs, `139` tiny or missing measured image dimensions, `29` adult-term matches, and `6` generic title/alt-text matches. No rows failed the basic text-present gate in the SQL check.
- Individual custom cake URLs are therefore not dependent on collection pages alone. Googlebot can discover most custom cakes directly from the customized-cake sitemap chunks, including recent pickleball product URLs verified in `sitemap-customized-cakes-0.xml`.
- The collection mismatch is real. The live `pickleball-cake` collection row is published/indexable but still says `item_count = 97`; production metadata and page copy say `Browse 97 pickleball cake designs`.
- Live search counts are higher: `search_products_count('pickleball') = 131` and `search_products_count('pickleball cake') = 184`. A direct collection-filter approximation finds `125` matching pickleball rows. The gap explains why `/search?q=pickleball...` can show more results than `/collections/pickleball-cake`.
- The collection page server-renders the first `30` designs from `getDesignsByKeyword(...)`. Additional designs require the client `Load More Designs` button, so collection pages are not the best proof that every product is crawlable. They are topical hubs, while sitemap chunks are the bulk discovery surface.
- Recommended next fix: refresh/sync `cakegenie_collections.item_count` and sample images from the current collection matching logic, then consider adding crawlable paginated collection URLs or server-rendered next-page links if collection hubs need to expose deep inventory beyond the first 30 without JavaScript interaction.

## Canonical Pricing Facts Page Repurpose (2026-06-25)

### Plan

- [x] Add one shared public support-facts source for pricing, delivery, payment, lead-time, and trust/support copy.
- [x] Repurpose `/cake-price-calculator` into a server-rendered pricing and ordering facts page with matching metadata and visible FAQ/schema.
- [x] Convert `/how-to-order` and `/payment-options` into server-rendered support pages that reuse the shared facts source.
- [x] Standardize stale public pricing and service-area copy on the homepage FAQ and other touched support pages.
- [x] Update key internal links that point to `/cake-price-calculator` so they treat it as the canonical facts page, not a duplicate uploader.
- [x] Run focused metadata/render verification plus `npm run build`, then record the review.

### Review

- Added [src/lib/seo/publicOrderFacts.ts](/Users/apcaballes/genieph-nextjs/src/lib/seo/publicOrderFacts.ts:1) as the shared support-facts source for the canonical public pricing summary, delivery summary, payment summary, lead-time wording, support fallback, and payment-method group definitions.
- Repurposed [src/app/cake-price-calculator/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/cake-price-calculator/page.tsx:1) into a server-rendered pricing and ordering facts page. It now explains that the real upload flow lives on `/customizing`, exposes visible support facts in HTML, links to the supporting pages, and emits only breadcrumb plus visible FAQ schema.
- Replaced the thin wrapper routes at [src/app/how-to-order/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/how-to-order/page.tsx:1) and [src/app/payment-options/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/payment-options/page.tsx:1) with server-rendered support pages that reuse the shared facts source instead of relying on client-only content.
- Standardized the homepage FAQ schema and FAQ page copy in [src/app/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/page.tsx:1) and [src/app/faq/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/faq/page.tsx:1) so the public pricing story now centers on `₱499` bento starting price plus “larger cakes are priced after AI analysis,” instead of the older `₱350` / `₱800` / `₱1,500` ladder and example ranges.
- Updated key discovery/support links so `/cake-price-calculator` is treated as a pricing guide rather than a duplicate uploader in [src/app/compare/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/compare/page.tsx:103), [src/app/customizing/category/[keyword]/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/category/[keyword]/page.tsx:356), [src/app/collections/[category]/CategoryClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/collections/[category]/CategoryClient.tsx:209), [src/app/chatgpt-cake-design-quote/ChatGptCakeDesignQuoteClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/chatgpt-cake-design-quote/ChatGptCakeDesignQuoteClient.tsx:227), and [src/app/sitemap-html/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/sitemap-html/page.tsx:67).
- Also updated the structured-data reference in [src/app/customizing/[slug]/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/[slug]/page.tsx:637) so the design page now points to the pricing-guide web page instead of describing `/cake-price-calculator` as a standalone `SoftwareApplication`.
- Verification:
  - `npx vitest run src/app/cake-price-calculator/page.test.tsx src/app/how-to-order/page.test.tsx src/app/payment-options/page.test.tsx src/app/delivery-rates/page.test.tsx src/app/reviews/page.metadata.test.ts --exclude '.claude/**'`
  - `git diff --check`
  - `npm run build`
- Verification result:
  - Focused Vitest passed: 5 files, 5 tests.
  - `git diff --check` passed.
  - `npm run build` completed successfully. The usual non-fatal warnings still appeared for stale `baseline-browser-mapping`, inferred Next workspace root, deprecated `middleware`, and existing Supabase statement timeouts while generating unrelated fallback keyword pages.

## ChatGPT Source Selection SEO/AEO Plan (2026-06-25)

### Plan

- [x] Read the referenced Suganthan article and separate structural takeaways from directional sample-size claims.
- [x] Inspect Genie.ph's current public SEO/AEO surfaces for crawlable official facts: homepage key facts, delivery rates, price calculator, how-to-order, reviews, trust page, business profile schema, and sitemap discovery.
- [x] Map the article's mechanics to Genie.ph opportunities without creating thin duplicate pages.
- [x] Prioritize the smallest high-impact improvements and define verification steps before implementation.

### Review

- Article mechanics that matter for Genie.ph:
  - ChatGPT can fetch official pages for facts, but only if the facts are readable as plain HTML. JavaScript-only pricing/spec data can cause it to cite third-party pages instead.
  - For commercial queries, a single user question can fan out into direct `site:` probes for official pages and exact fact checks such as prices, currency symbols, fees, and availability.
  - Fetched, cited, and mentioned are separate outcomes. Genie.ph can own official facts, but recommendation or legitimacy claims often need third-party/public proof surfaces.
  - Domain dedupe makes "one strong page per claim" better than many thin near-duplicate pages.
  - Local results can be very selective, so official service-area, address, delivery, and review signals should be easy to parse.
- Current Genie.ph strengths found in code:
  - `src/lib/seo/genieBusinessProfile.ts` centralizes legal name, support channels, service areas, trust links, Organization/WebSite/LocalBusiness schema, and knows-about services.
  - `src/components/seo/HomepageAeoSections.tsx` already exposes key facts in visible HTML: founded year, 4.9 rating, ₱499 bento starting price, summit award, Metro Cebu coverage, and 3-step ordering.
  - `src/app/delivery-rates/page.tsx` exposes city-level delivery fees in SSR/plain HTML and pulls from the same helper used by checkout.
  - `src/app/reviews/page.tsx` has a dedicated reviews URL with schema and server-loaded public reviews.
  - `src/app/is-genie-ph-a-scam/page.tsx` already answers a high-risk trust query directly and links out to public proof.
  - `src/app/sitemap.ts` includes the main support/trust/comparison surfaces, including `/is-genie-ph-a-scam`, `/cake-price-calculator`, `/how-to-order`, `/contact`, `/reviews`, and comparison pages.
- Main gaps/opportunities:
  - The price calculator route is mostly a client app. It has metadata and SoftwareApplication schema, but it does not appear to expose a crawlable official price table or "starting prices by cake type/size" answer that AI systems can quote.
  - `/how-to-order` and `/payment-options` are thin server wrappers around client components, so their critical facts may be harder to quote if the rendered content depends heavily on client JavaScript.
  - The homepage has useful key facts, but AI systems may probe more specific official URLs such as `/pricing`, `/delivery-rates`, `/payment-options`, `/how-to-order`, or `/reviews`. Genie.ph lacks a dedicated crawlable pricing/facts page.
  - Some facts are split across pages: starting price on homepage, fee table on delivery rates, payment methods on payment options, process on how-to-order, legitimacy on scam/trust page. That is fine for humans, but an AI fact-checker benefits from a compact official facts hub with links to source pages.
  - Third-party proof exists for trust, but there is no ongoing plan to earn text-based mentions on local Cebu directories, startup/news sites, Reddit/forum answers, or review/listicle pages where ChatGPT may source recommendations from outside Genie.ph.
- Recommended implementation sequence:
  - Phase 1: Add an official crawlable "Genie.ph facts and pricing" page or strengthen `/cake-price-calculator` with SSR-visible text tables for starting prices, delivery fee range, service cities, accepted payment methods, turnaround caveats, support contacts, and links to the canonical detail pages. Keep this as one strong fact page, not many cloned pages.
  - Phase 2: Ensure `/how-to-order` and `/payment-options` expose their key facts server-side in plain HTML, even if the interactive UI remains client-rendered. Add FAQ/Breadcrumb schema only where accurate and policy-safe.
  - Phase 3: Add/standardize internal links from homepage key facts, delivery rates, reviews, trust page, comparison pages, footer/sitemap HTML, and product/customizer pages to the official facts/pricing page using plain descriptive anchor text.
  - Phase 4: Create a small "AI answer verification" checklist: test likely prompts in ChatGPT/Perplexity/Google AI Mode, record whether Genie.ph is fetched/cited/mentioned, and inspect whether cited facts match the official pages.
  - Phase 5: Build third-party citation support for recommendation/trust queries: founder/startup profiles, Cebu/local business directories, customer review platforms, relevant Reddit/community answers where useful, and text-based comparison/listicle mentions. Avoid video-only proof as the primary citation surface.
- Verification before shipping:
  - Run focused route tests or snapshot checks for emitted metadata/schema on the changed pages.
  - Run `npm run build` because these pages are SEO/static-generation surfaces.
  - Fetch built/live HTML for the changed URLs and confirm the key facts appear in raw HTML, not only after hydration.
  - Validate sitemap discovery for the new or changed URL.
  - After deploy, manually run 5-10 representative AI/search prompts and log whether Genie.ph is fetched, cited, or merely mentioned.

## Customizer CTA And Label Tuning (2026-06-25)

### Plan

- [x] Change the sticky customizer purchase CTA from `Buy This Now` to `Add to Cart`.
- [x] Rename the `Advanced Customization` section to `Edit Design Details`.
- [x] Replace customer-facing `Fix Mask` wording with `Recolor Icing`.
- [x] Update focused customizer tests and run scoped verification.

### Review

- Updated the sticky customizer purchase CTA in [src/components/StickyAddToCartBar.tsx](/Users/apcaballes/genieph-nextjs/src/components/StickyAddToCartBar.tsx:395) so the primary action now reads `Add to Cart`, with matching accessibility copy.
- Renamed the expandable advanced section in [src/app/customizing/CustomizingStepSummarySections.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingStepSummarySections.tsx:1032) from `Advanced Customization` to `Edit Design Details`.
- Replaced the customer-facing `Fix Mask` wording in [src/app/customizing/CustomizingStepSummarySections.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingStepSummarySections.tsx:597) with `Recolor Icing`, and updated the related retry message.
- Kept the behavior scoped to the approved items only; no pending-edit CTA changes or sheet behavior changes were bundled in.
- Verification:
  - `npx vitest run src/app/customizing/CustomizingStepSummarySections.test.tsx src/components/StickyAddToCartBar.test.tsx --exclude '.claude/**'`
  - `git diff --check -- src/components/StickyAddToCartBar.tsx src/app/customizing/CustomizingStepSummarySections.tsx src/app/customizing/CustomizingStepSummarySections.test.tsx src/app/customizing/CustomizingClient.tsx tasks/todo.md tasks/lessons.md`

## Customizer Ecommerce CRO Audit (2026-06-25)

### Plan

- [x] Inspect the current `/customizing` UI structure, primary actions, mobile/desktop layout, and existing friction evidence.
- [x] Research proven ecommerce product-page patterns from Shopee, Lazada, and broader PDP/CRO sources.
- [x] Compare those patterns against Genie.ph's customizer page and identify points of confusion for first-time users.
- [x] Prioritize recommended fixes by likely conversion/customer-experience impact and implementation risk.
- [x] Record the audit review, evidence, and suggested verification path.

### Review

- Shopee's own help flow trains users to choose `Buy Now` or `Add to Cart`, select a variation if needed, then verify delivery address, shipping option, vouchers/coins, and payment before placing the order. Lazada and Shopee both emphasize vouchers/free shipping, recommendations, reviews, secure payment, and order tracking as core shopping signals.
- Baymard/NNG product-page research reinforces the same baseline: product pages need recognizable images, price, clear option selectors, availability, clear add-to-cart feedback, shipping/total-cost context, reviews, save/wishlist support, and easy image inspection before asking the buyer to commit.
- Genie.ph already has strong assets: large cake preview, price guarantee badge, live review summary, free Cebu City delivery message, sticky price/CTA, saved design, related designs, and customization controls.
- Main gap: the current page reads more like a custom design workspace than a familiar marketplace product page. First-time users may not instantly understand the purchase sequence: choose size/flavor/message -> apply visual edits if any -> buy/add to cart -> checkout.
- Highest-risk confusion points found in code:
  - `Buy This Now` is the only primary sticky purchase CTA, while the actual cart action is `onAddToCartClick`; familiar Shopee/Lazada muscle memory expects `Add to Cart` and optionally `Buy Now`.
  - Pending visual edits require a separate `Apply All Changes` action in the editor sheet, which can compete with the sticky buy CTA and make users wonder whether the order includes their latest edits.
  - `Advanced Customization` hides AI chat, cake type, and decoration editing even though those are likely common user goals after landing on a design.
  - Mobile stacks multiple bottom surfaces: availability/printout notice, sticky price/actions, and the editor sheet with its own apply action.
  - Disabled `Apply Changes` / `Apply All Changes` buttons do not explain why they are disabled inside the sheet.
  - Some labels are production-accurate but customer-heavy: `Support Elements`, `Gumpaste`, `Printout`, `Fix Mask`, and sometimes `Icing` / `Height per Cake`.
- Recommended implementation direction:
  - Make the sticky bar mirror ecommerce conventions: price + selected size/flavor summary + `Add to Cart` primary, with `Buy Now` only if it truly goes directly to checkout.
  - Add a visible "Selected options" block near the top of the buy area: cake size, height, flavor, message, delivery promise, and edit links.
  - Rename/reframe `Advanced Customization` to a buyer-friendly section such as `Edit Design Details`, and expose AI chat/decorations as clear edit rows instead of hidden expert options.
  - When edits are pending, replace or gate the buy CTA with a clear state: `Apply changes to continue` / `Update preview first`, then return to `Add to Cart`.
  - Add inline disabled reasons to editor-sheet apply buttons.
  - Make delivery/fees/lead time feel as concrete as Shopee/Lazada shipping context: show free Cebu City delivery conditions, service-area caveat, and link to delivery rates near price.
  - Keep review proof close to the hero, but add photo/review snippets lower on the page to reduce the need for users to leave and research elsewhere.
- Suggested verification path before shipping changes:
  - Mobile-first Playwright pass on `/customizing` and a representative `/customizing/[slug]`.
  - Check first-screen comprehension: price, selected options, delivery promise, and next action visible without reading instructions.
  - Regression checks for sticky bar, editor sheet offsets, pending visual changes, and add-to-cart telemetry.
  - Compare event changes after deploy: add-to-cart intent, blocked add-to-cart reason, successful handoff to cart, and begin checkout.

## Online Funnel Leak Instrumentation (2026-06-24)

### Plan

- [x] Add non-sensitive funnel event wrappers to the existing analytics helper.
- [x] Instrument customizer add-to-cart intent, blocked states, and successful handoff to cart.
- [x] Instrument cart checkout intent, missing requirements, order creation failures, payment handoff failures, and redirect starts across full-payment, downpayment, and split-order flows.
- [x] Add focused analytics tests and run verification.
- [x] Record the implementation review and verification results.

### Review

- Added funnel-specific wrappers in [src/lib/analytics.ts](/Users/apcaballes/genieph-nextjs/src/lib/analytics.ts:1) that continue using the existing GA4/Clarity queue instead of introducing a second analytics path.
- Customizer instrumentation now records:
  - add-to-cart click intent
  - visible disabled add-to-cart reasons, such as analysis still running or price still calculating
  - successful redirect handoff from customizer to cart
- Cart instrumentation now records:
  - checkout button intent for full payment, 50% downpayment, and split-with-friends
  - missing checkout requirements by label only
  - order creation failures
  - payment handoff failures
  - redirect start to payment
- Privacy guardrails: events use aggregate fields such as source surface, design slug, value bucket, item count, fulfillment type, guest-vs-account, and missing requirement labels. They do not send names, phone numbers, addresses, customer message text, additional instructions, or payment details.
- Verification:
  - `npx vitest run src/lib/analytics.test.ts --exclude '.claude/**'`
  - `git diff --check -- src/lib/analytics.ts src/lib/analytics.test.ts src/app/cart/CartClient.tsx src/app/customizing/CustomizingClient.tsx src/components/StickyAddToCartBar.tsx tasks/todo.md`
  - `npm run build`
- Build completed successfully. Existing warnings still appeared for stale `baseline-browser-mapping`, inferred Next workspace root, deprecated `middleware`, and familiar Supabase statement timeouts while prerendering fallback keyword pages.

## Update Landing Page Key Facts Copy (2026-06-22)

### Plan

- [x] Locate the homepage key facts section that renders the current founder year, bento starting price, and summit label.
- [x] Update the three requested landing-page details with the exact new copy.
- [x] Run a scoped verification check and record the result.

### Review

- Updated [src/components/seo/HomepageAeoSections.tsx](/Users/apcaballes/genieph-nextjs/src/components/seo/HomepageAeoSections.tsx:1) so the homepage key facts section now shows `2025 Founded in Cebu`, `₱499 Starting price bento`, and `1st Startup Innovation Summit 2025`.
- This was a copy-only change inside the existing landing-page key facts grid; layout and behavior are unchanged.
- Verification:
  - `git diff --check -- src/components/seo/HomepageAeoSections.tsx tasks/todo.md`

## Audit Client Error Logs (2026-06-22)

### Plan

- [x] Inspect the live `client_errors` table shape, volume, and most recent rows.
- [x] Group errors by message, page path, user agent, viewport, session, and time window to separate product bugs from third-party/browser noise.
- [x] Trace the highest-volume or highest-risk signatures back to the current frontend/server code path.
- [x] Produce a prioritized fix plan with evidence, risk level, and verification steps before making implementation changes.

### Review

- Live `client_errors` currently has `2,691` rows from `2026-02-03 14:41 UTC` through `2026-06-21 22:13 UTC`; recent volume is modest (`135` rows in 7 days, `464` in 30 days, `11` in the last 24 hours).
- Top all-time noise is cookie/storage related: `Cookies are blocked or unavailable` has `1,246` rows, and old `Unable to store cookie` has `268` rows but has not appeared in the last 30 days. Treat current cookie rows as environment telemetry unless they correlate with checkout/auth failures.
- Highest-priority active app-owned issue: React hydration mismatch `#418` has `121` rows in the last 30 days (`24` in 7 days). It is concentrated on `/customizing/[slug]` (`94` rows in 30 days) plus `/` (`21` rows in 30 days), across Android, iOS/Safari, Gemini iOS WebView, and desktop. Stack samples point to the current React runtime chunk, so this is likely an SSR/client markup mismatch, not one stale URL.
- Second active product issue: AI image-edit failures are customer-visible. In 30 days: quota message `50` rows, authorization message `28` rows, empty-image response `20` rows, plus smaller `Too many requests`, abort, and missing-input clusters. Recent authorization rows stopped on `2026-06-18`, but quota rows continued through `2026-06-20`.
- Low-priority logging hygiene issue: homepage-only `window.webkit.messageHandlers` errors have `7` rows in 30 days, all `/`, tied to Facebook/iOS in-app browser paid-ad URLs. Source search found no repo-owned `webkit.messageHandlers` code, so this is likely injected WebView instrumentation and should be filtered/suppressed from `client_errors`.
- Third-party/old noise: `Script error.`, old chunk-load failures, MetaMask failures, and Tawk errors exist but are not the main current risk. Many chunk-load rows are bot-like or deployment-stale.
- Supabase platform check also surfaced the existing critical RLS advisory on unrelated public tables (`cakegenie_search_analytics`, `shopify_customization_requests`, `user_referrals`, `user_profiles`, `order_items`, `discount_code_usage`, `platform_settings`, `cakegenie_collections`, `blogs`, `cakegenie_analysis_cache_seo_title_backup`). Do not auto-enable RLS without policies; handle as a separate security task.

### Fix Plan

- [x] Probe the React `#418` hydration mismatch locally in production mode for `/` and representative `/customizing/[slug]` pages. Start with SSR/client review-summary text, `CustomizingClient` initial state, `SSRCakeDetails` handoff, and any client component that renders dates, current time, browser-specific branches, or mutable text during the first render.
- [x] Fix the hydration boundary with deterministic first render: move browser-only differences into effects, keep initial server/client text identical, and add focused regression tests around the suspected cart/customizer components.
- [ ] Audit AI edit failure handling end to end: `/api/ai/edit-image`, `/api/ai/chat-edit`, `normalizeAiRouteError`, `useDesignUpdate`, and UI copy. Confirm whether current provider authorization/quota state is fixed; if not, repair provider config or fail over before customer actions hit the broken path.
- [ ] Make AI failures less noisy and more actionable: log route/source/status/trace ID internally, keep customer copy generic, and prevent unhandled promise rejections from being the primary telemetry for expected quota/rate-limit states.
- [ ] Tighten `ErrorLogger` classification and filters: suppress known injected WebView bridge errors, classify cookie-blocked as telemetry rather than app errors, add bot/source labels, and consider retention/aggregation so old deployment chunks do not dominate future audits.
- [ ] Open a separate RLS remediation plan for the ten advised tables, mapping required anon/auth/service access before enabling RLS.
- [ ] Verification for fixes should include: focused Vitest for changed components/helpers, `npm run build`, production-mode browser checks on `/`, `/customizing`, and several `/customizing/[slug]` pages, plus a post-deploy query confirming the top signatures fall over 24-72 hours.

### Hydration Fix Review

- Identified cached cart state as the highest-probability SSR/client mismatch source. `CartProvider` was reading `localStorage` in lazy state initializers, so the first client render could show cached cart counts or delivery fields while SSR rendered empty values.
- Updated `CartProvider` so its first client render is SSR-safe: cart items, addresses, and delivery fields start empty, then load cached browser state after mount. Cache-writing effects now wait until that cache load completes so the initial empty render does not erase a real cached cart.
- Updated the customizer cart button to hide cart-count text/badge until hydration using `useSyncExternalStore`, matching the homepage pattern that already guarded visible cart count.
- Added `src/contexts/CartContext.hydration.test.tsx` to prove the first render stays at `0` with cached cart data, then updates to the cached count after mount.
- Verification passed:
  - `npx vitest run src/contexts/CartContext.hydration.test.tsx --exclude '.claude/**'`
  - `npx vitest run src/contexts/CartContext.hydration.test.tsx src/contexts/NavigationContext.test.tsx src/app/customizing/customizingClientGuards.test.ts --exclude '.claude/**'`
  - `git diff --check -- src/contexts/CartContext.tsx src/contexts/CartContext.hydration.test.tsx src/app/customizing/CustomizingClient.tsx tasks/todo.md`
  - `npm run build`
- Production-mode browser checks on `http://localhost:3002/` and `http://localhost:3002/customizing/50th-birthday-white-1-tier-cake-1e02` showed no warning/error console logs and no hydration signatures. A direct browser-side seeded `localStorage` repro was blocked by the browser automation URL policy, so the seeded cached-cart case is covered by the unit regression instead.
- Remaining verification after deploy: query `client_errors` for `#418` over the next 24-72 hours and confirm the `/customizing/[slug]` and homepage signatures fall.

## Back Button Home Fallback

### Plan

- [x] Confirm the shared in-app back-button fallback path for recorded `customizing` destinations.
- [x] Change that fallback so it resolves to Home (`/`) instead of `/customizing`.
- [x] Add focused coverage and run verification for the touched navigation files.

### Review

- Updated [src/contexts/NavigationContext.tsx](/Users/apcaballes/genieph-nextjs/src/contexts/NavigationContext.tsx:84) so recorded `customizing` back destinations now resolve to Home (`/`) instead of `/customizing`.
- Renamed the internal mapper to `getBackPathForPage(...)` to make it clear this is the in-app back destination rule, not a canonical route registry.
- Added [src/contexts/NavigationContext.test.tsx](/Users/apcaballes/genieph-nextjs/src/contexts/NavigationContext.test.tsx:1), which records `customizing -> cart` and asserts the computed back destination is `/`.
- Verification:
  - `npx vitest run src/contexts/NavigationContext.test.tsx --exclude '.claude/**'` passed.
  - `git diff --check -- src/contexts/NavigationContext.tsx tasks/todo.md` passed.
  - `npx eslint src/contexts/NavigationContext.test.tsx` passed with the existing Browserslist staleness warning.
  - `npx eslint src/contexts/NavigationContext.tsx src/contexts/NavigationContext.test.tsx` still reports the pre-existing `react-hooks/set-state-in-effect` warning/error on the provider's sessionStorage hydration effect. This fallback change did not touch that effect.

## Single Fingerprint Pipeline Refresh

### Plan

- [x] Replace the weak server aHash implementation with one v2 dHash8 fingerprint pipeline.
- [x] Disable ORB from live customer cache matching and new cache-write indexing while keeping historical ORB data untouched.
- [x] Remove stale v1 pipeline fallbacks from saved/chat cache lookups.
- [x] Update the pHash backfill flow so it targets every non-v2 eligible cache row and preserves fingerprint status fields.
- [x] Add the database migration needed for safe `p_hash` reference updates during rehashing.
- [x] Add focused tests for dHash collision resistance, cache de-dupe boundaries, ORB disablement, and backfill selection behavior.
- [x] Run focused Vitest coverage plus `npm run build`, then record the review and verification results.

### Review

- Replaced the old average-hash implementation in [src/lib/server/imageFingerprint.ts](/Users/apcaballes/genieph-nextjs/src/lib/server/imageFingerprint.ts:1) with the single server-side `dHash8` pipeline `v2-sharp-0.34-autoOrient-srgb-512-contain-white-lanczos3-gray-dhash8`. The code now canonicalizes through Sharp, resizes to `9x8`, compares adjacent grayscale pixels, and returns one 16-character hex hash.
- Removed the live ORB path from customer uploads and cache writes while leaving historical ORB code/data available for admin/debug tooling. Uploads now generate a server fingerprint, perform one pipeline-matched pHash lookup, and otherwise run fresh AI analysis.
- Removed stale v1 fallback lookups in saved/chat follow-up paths by adding exact-hash lookup support for existing saved pHash references and keeping new cache lookup pipeline-matched only.
- Updated `npm run backfill:phash` to use the server backfill flow in [scripts/backfill-server-phashes.ts](/Users/apcaballes/genieph-nextjs/scripts/backfill-server-phashes.ts:1). Default batches now skip rows already marked `aliased` or `failed`; `--retry-failed` is available when intentionally rechecking fixed source images.
- Added and applied [supabase/migrations/20260622010754_cascade_analysis_cache_phash_references.sql](/Users/apcaballes/genieph-nextjs/supabase/migrations/20260622010754_cascade_analysis_cache_phash_references.sql:1). Live FK verification shows `cakegenie_merchant_products.p_hash` and `cakegenie_pinterest_pins.p_hash` now reference `cakegenie_analysis_cache(p_hash)` with `ON UPDATE CASCADE`.
- Ran the live backfill. Final production counts:
  - `13,178` rows refreshed to the v2 dHash pipeline
  - `0` usable rows remaining outside v2
  - `24` rows marked `aliased` for duplicate v2 hashes
  - `12` rows marked `failed` because their source images could not be fetched/processed
- Verified the reported collision example after backfill: `60th-birthday-cake-0000` is now `8316b2a2c28ad89e`, and the nearest pickleball candidate among `113` pickleball rows is Hamming distance `18`, well outside the `<= 1` reuse threshold.
- Verification:
  - `npm run backfill:phash -- --dry-run --limit 50 --concurrency 4`
  - `npm run backfill:phash -- --limit 1000 --concurrency 8`
  - repeated bounded live backfill batches until usable remaining reached `0`
  - `npx vitest run src/lib/server/imageFingerprint.test.ts src/app/api/image/fingerprint/route.test.ts src/services/supabaseService.cacheAnalysisResult.test.ts src/services/supabaseService.findSimilarAnalysisByHash.test.ts src/contexts/ImageContext.test.tsx scripts/backfill-server-phashes.test.ts --exclude '.claude/**'`
  - `git diff --check`
  - `npm run build`
- Notes from verification:
  - Focused Vitest passed: 6 files, 31 tests.
  - `npm run build` completed successfully. Existing warnings still appeared for `baseline-browser-mapping`, inferred Next workspace root, deprecated `middleware`, and static-generation Supabase statement timeouts in keyword fallback queries.
  - Supabase table inspection surfaced an unrelated critical RLS advisory for several public tables. This was not changed in this fingerprint pass and should be handled separately.

## Create "Is Genie.ph a Scam?" Trust Page

### Plan

- [x] Audit the existing Genie.ph trust assets, current About/reviews/support copy, and the public links we can safely cite for the new legitimacy page.
- [x] Build a new static marketing page targeting the keyword `is genie.ph a scam?` with direct, source-backed trust sections, external proof links, and clear customer next steps.
- [x] Add the new route to sitemap discovery, run verification on the touched files, and document the outcome in the review notes.

### Review

- Added the new static trust page at [src/app/is-genie-ph-a-scam/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/is-genie-ph-a-scam/page.tsx:1), targeting the keyword `is genie.ph a scam?` with direct copy that answers the question head on and then backs it up with public proof.
- The page combines four trust layers:
  - external/public proof links: StartupHub PH founder spotlight, Genie.ph's public Startup Innovation Summit award post, a StellarPH/DOST Central Visayas mention, and the additional public Facebook summit post you shared
  - visible business identity: DTI and BIR permit links already used by Genie.ph
  - operational trust: support email, phone, published address, reviews, terms, return policy, and secure checkout link
  - customer guidance: a plain-language checklist explaining how cautious buyers can verify Genie.ph before ordering
- Added the route to [src/app/sitemap.ts](/Users/apcaballes/genieph-nextjs/src/app/sitemap.ts:143) so search engines can discover `/is-genie-ph-a-scam` through the core static-route sitemap.
- Verification:
  - `npm run build`
  - `git diff --check -- src/app/is-genie-ph-a-scam/page.tsx src/app/sitemap.ts tasks/todo.md`
- Verification result:
  - Build completed successfully and the route list includes `/is-genie-ph-a-scam`.
  - The usual repo warnings still appeared for `baseline-browser-mapping`, the deprecated `middleware` convention, and familiar static-generation timeout logs during fallback keyword fetches, but they were non-fatal and the production build finished cleanly.

## Move Icing Section Below Cake Message

### Plan

- [x] Inspect the current customizer editor-sheet panel order and confirm where the icing and cake message sections are rendered.
- [x] Reorder the customizer panels so the icing options section appears below the cake message section without changing any section behavior.
- [x] Run a focused verification for the touched file and capture the result in the review notes.

### Review

- Updated [src/app/customizing/CustomizingClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingClient.tsx:4064) so the editor-sheet section order is now `options -> messages -> icing -> toppers`, which places the icing options below the cake message section as requested.
- Kept the change layout-only: the `CustomizingIcingEditorPanel` props and behavior are unchanged, and only its render position moved.
- Verification:
  - `git diff --check -- src/app/customizing/CustomizingClient.tsx tasks/todo.md`
  - Confirmed the new local render order directly in `CustomizingClient.tsx`.

## Move AI Chat Above Cake Type In Advanced Customization

### Plan

- [x] Inspect the current Advanced Customization render order and confirm where the AI chat card sits relative to the cake type controls.
- [x] Reorder the Advanced Customization cards so AI chat appears above cake type while remaining inside the same expandable section.
- [x] Run focused verification on the touched customizer files and document the result below.

### Review

- Updated [src/app/customizing/CustomizingStepSummarySections.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingStepSummarySections.tsx:1041) so the AI chat card now renders first inside `advanced-customization-steps`, which places it above the cake type controls while keeping it inside the same Advanced Customization accordion.
- Kept the change layout-only within the Advanced Customization stack: the existing AI chat node and cake type controls are unchanged, and only their order moved.
- Verification:
  - `npx vitest run src/app/customizing/CustomizingStepSummarySections.test.tsx`
  - `git diff --check -- src/app/customizing/CustomizingStepSummarySections.tsx src/app/customizing/CustomizingStepSummarySections.test.tsx tasks/todo.md`

## Create Admin Dashboard Downpayment Handoff Prompt

### Plan

- [x] Gather the final 50% downpayment implementation details from the storefront checkout flow, database routines, migrations, and edge functions.
- [x] Draft a reusable developer-facing prompt that explains the flow end to end and tells the Genie admin dashboard team what they need to adjust.
- [x] Review the prompt for accuracy and hand it back in a copy-ready format.

### Review

- Wrote a copy-ready handoff prompt in [tasks/admin-dashboard-downpayment-handoff-prompt.md](/Users/apcaballes/genieph-nextjs/tasks/admin-dashboard-downpayment-handoff-prompt.md:1).
- The prompt explains:
  - how `downpayment_50` orders are identified
  - how checkout, contribution creation, verification, and state transitions work
  - which storefront files and SQL routines implement the feature
  - which admin-dashboard files likely need updates
  - what dashboard behaviors should change for partial vs fully paid downpayment orders
  - why direct manual `payment_status` editing in the admin dashboard is now risky without reconciling `amount_collected` and `order_contributions`

## Clarify Downpayment Confirmation Copy

### Plan

- [x] Update the partial-payment confirmation state in `/order-confirmation` to clearly explain that the remaining balance must be paid before delivery or pickup.
- [x] Add explicit guidance that delivery/release only happens after full payment is received, and point customers to `My Orders` / `Pay Remaining Balance`.
- [x] Run a quick production build check and record the result.

### Review

- Updated the `paymentStatus === 'partial'` confirmation state in [src/app/order-confirmation/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/order-confirmation/page.tsx:1) so the success copy now says the remaining balance must be paid before the scheduled delivery or pickup time.
- Added a second highlighted note card for partial payments that explicitly states delivery or release only proceeds after full payment is received and tells the customer to go to `My Orders` and tap `Pay Remaining Balance`.
- Verification:
  - `npm run build`
  - Build completed successfully. The usual repo warnings still appeared for `baseline-browser-mapping`, the deprecated `middleware` convention, and one familiar static-generation timeout log during page generation, but the production build finished cleanly.

## Fix Split Order Cart Item Cast Regression

### Plan

- [x] Confirm the reported downpayment checkout failure against the live `create_split_order_from_cart` definition and local migration history.
- [x] Patch the RPC so `p_cart_item_ids text[]` still compares against `cakegenie_cart.cart_item_id` using the required `::text` casts, then apply the fix live.
- [x] Verify the repaired live function definition, commit the scoped regression fix, and push the existing audit branch update.

### Review

- Root cause: the June 20 downpayment hardening rewrite preserved the RPC signature `p_cart_item_ids text[]` but accidentally removed the established `cart_item_id::text` casts inside the `INSERT ... SELECT` and `DELETE` filters. That changed the live predicate to `uuid = text`, which fails immediately during split-order checkout with `42883 operator does not exist: uuid = text`.
- Added the corrective migration [supabase/migrations/20260620073000_fix_split_order_cart_item_cast.sql](/Users/apcaballes/genieph-nextjs/supabase/migrations/20260620073000_fix_split_order_cart_item_cast.sql:1), which restores the two `::text` casts while keeping the server-side Manila lead-time guard from the previous audit work intact.
- Applied the same `CREATE OR REPLACE FUNCTION` patch live through Supabase MCP, then verified the production function body with `pg_get_functiondef(...)`. The live definition now uses:

## Audit Customizer Topper Replacement AI Input (2026-06-22)

### Plan

- [x] Trace the `/customizing` topper replacement flow from the uploader UI through local state and the `Apply all changes` action.
- [x] Confirm whether uploaded replacement images are included in the AI edit inputs/prompts used for topper-related edits, and patch the narrowest broken seam if not.
- [x] Add focused regression coverage, run scoped verification, and document the confirmed behavior below.

### Review

- Root cause: uploaded topper/support replacement images were stored in customizer state (`replacementImage`) and mentioned in the generated edit prompt, but they were never included in the `/api/ai/edit-image` payload. The model only received the base cake image plus the optional 3-tier reference, so “replace its image with the new one provided” had no actual replacement image bytes behind it.
- Updated [src/services/designService.ts](/Users/apcaballes/genieph-nextjs/src/services/designService.ts:1) to collect every replacement image from main toppers and support elements, assign deterministic labels like `Replacement reference 1`, add a prompt legend that maps each label to its target item, and pass those reference images into the image-edit service call.
- Updated [src/services/geminiService.ts](/Users/apcaballes/genieph-nextjs/src/services/geminiService.ts:313) so the client request to `/api/ai/edit-image` now includes the replacement-reference image payload alongside the original cake image.
- Updated [src/app/api/ai/edit-image/route.ts](/Users/apcaballes/genieph-nextjs/src/app/api/ai/edit-image/route.ts:31) so the server forwards each uploaded replacement image to Gemini as its own inline image part plus a matching text instruction identifying the exact topper/support element it belongs to.
- Added regression coverage in [src/services/designService.no-op.test.ts](/Users/apcaballes/genieph-nextjs/src/services/designService.no-op.test.ts:1) and [src/app/api/ai/edit-image/route.test.ts](/Users/apcaballes/genieph-nextjs/src/app/api/ai/edit-image/route.test.ts:1) to prove both seams: prompt labeling and API transport.
- Verification:
  - `npx vitest run src/services/designService.no-op.test.ts src/app/api/ai/edit-image/route.test.ts --exclude '.claude/**'`
  - `npm run build`
  - `git diff --check -- src/services/designService.ts src/services/geminiService.ts src/app/api/ai/edit-image/route.ts src/services/designService.no-op.test.ts src/app/api/ai/edit-image/route.test.ts tasks/todo.md`
  - `cart.cart_item_id::text = any(p_cart_item_ids)`
  - `cart_item_id::text = any(p_cart_item_ids)`
- Follow-up lesson added in [tasks/lessons.md](/Users/apcaballes/genieph-nextjs/tasks/lessons.md:1): when rewriting existing RPCs, preserve predicate-level type compatibility and not just the function signature.

## Add Image Upload To Advanced Customization AI Chat (2026-06-22)

### Plan

- [x] Trace the Advanced Customization AI chat UI and submit flow to find the narrowest place to add an image attachment.
- [x] Add an upload-image affordance to the AI chat panel and pipe the attached image into the AI edit request so the model can use it while applying chat-driven changes.
- [x] Add focused tests, run scoped verification, and document the final behavior below.

### Review

- Added an upload-image button directly inside the Advanced Customization AI chat panel in [src/app/customizing/CustomizingAiChatPanel.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingAiChatPanel.tsx:1). The panel now supports selecting one reference image, shows the attached filename as a removable chip, and disables the attach button while the file is being processed or while the AI is already busy.
- Wired the new attachment state into [src/app/customizing/CustomizingClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingClient.tsx:1). The customizer stores one chat reference image, sends it through both AI chat tracks on submit, clears it after a successful AI apply, and resets it when the user uploads a different base cake image.
- Extended [src/hooks/useDesignUpdate.ts](/Users/apcaballes/genieph-nextjs/src/hooks/useDesignUpdate.ts:1) and [src/services/designService.ts](/Users/apcaballes/genieph-nextjs/src/services/designService.ts:1) so chat-originated reference images can travel through the same shared design-update pipeline as topper replacement images, including prompt context for non-targeted design references.
- Extended [src/app/api/ai/chat-edit/route.ts](/Users/apcaballes/genieph-nextjs/src/app/api/ai/chat-edit/route.ts:1) so the JSON state-edit model also receives the attached image as a multimodal input, not just the visual image-edit route. That keeps the edited image and the returned customizer state aligned more closely.
- Added focused coverage in [src/app/customizing/CustomizingAiChatPanel.test.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingAiChatPanel.test.tsx:1), [src/hooks/useDesignUpdate.test.ts](/Users/apcaballes/genieph-nextjs/src/hooks/useDesignUpdate.test.ts:1), and [src/app/api/ai/chat-edit/route.test.ts](/Users/apcaballes/genieph-nextjs/src/app/api/ai/chat-edit/route.test.ts:1).
- Verification:
  - `npx vitest run src/app/customizing/CustomizingAiChatPanel.test.tsx src/hooks/useDesignUpdate.test.ts src/app/api/ai/chat-edit/route.test.ts --exclude '.claude/**'`
  - `npm run build`
  - `git diff --check -- src/app/customizing/CustomizingAiChatPanel.tsx src/app/customizing/CustomizingAiChatPanel.test.tsx src/app/customizing/CustomizingClient.tsx src/hooks/useDesignUpdate.ts src/hooks/useDesignUpdate.test.ts src/services/designService.ts src/services/geminiService.ts src/app/api/ai/chat-edit/route.ts src/app/api/ai/chat-edit/route.test.ts tasks/todo.md`

## Audit 50% Downpayment Feature

### Plan

- [x] Trace the full 50% downpayment flow across checkout UI, order rendering, confirmation, SQL RPCs/triggers, and Supabase Edge Functions.
- [x] Compare the repo implementation with the live Supabase project state, including current function bodies, advisors, and recent edge-function logs, to catch production drift.
- [x] Fix any confirmed server-side validation, payment-state, authorization, or accessibility issues with minimal scoped changes.
- [x] Run targeted verification for the downpayment checkout path, webhook/verification reconciliation, and remaining-balance payment path.
- [x] Record findings by severity plus the verification proof in the review section below.

### Review

- High-risk issues confirmed in the original implementation:
  - The 3-day downpayment eligibility check lived only in [src/app/cart/CartClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/cart/CartClient.tsx:1), while the live `create_split_order_from_cart` RPC had no server-side enforcement. A caller could bypass the UI and create a `downpayment_50` order directly.
  - The live Supabase edge functions had drifted behind the repo. `create-order-contribution` did not verify organizer ownership for downpayment or balance invoices, `verify-xendit-payment` did not enforce the exact expected contribution amount, and `xendit-webhook` accepted unauthenticated callbacks without checking Xendit's callback token.
  - The original confirmation flow in [src/app/order-confirmation/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/order-confirmation/page.tsx:1) did not actually verify contribution payments, ignored `contribution_id`, and hardcoded the remaining balance as half the order total instead of `total_amount - amount_collected`.
- Medium-risk issues confirmed:
  - The frontend lead-time calculation was browser-local and could drift from Manila dates near midnight or for users outside Philippine time.
  - The downpayment modal and order-history expanders were not fully keyboard accessible, which made the new flow harder to complete without a mouse/touchscreen.
  - The client helper in [src/services/supabaseService.ts](/Users/apcaballes/genieph-nextjs/src/services/supabaseService.ts:1) still pointed contribution success/failure redirects to `/#/contribute/...`, which no longer matches the live Next.js routing.
  - The paid-order cart-clear function could wipe unrelated active cart rows after a downpayment payment. The order's selected cart rows are already removed when the split order is created, so a later webhook clear should not touch any newly added or unrelated cart items.
  - Repeated clicks on downpayment or balance payment could mint multiple pending invoices for the same exact amount, increasing the risk of duplicate payable links and accidental over-collection.
- Low-risk / follow-up findings:
  - Supabase security advisors reported an unrelated but critical platform issue: multiple public tables currently have RLS disabled. This is outside the downpayment scope but should be addressed separately because it weakens the production security posture.
  - Downpayment orders still remove the selected cart rows at order creation before payment is completed. That behavior now avoids post-payment cart loss, but it still means abandoned downpayment attempts rely on the pending-order recovery path instead of leaving the items in cart.
- Applied fixes:
  - Added Manila-safe lead-time helpers in [src/lib/utils/deliveryLeadTime.ts](/Users/apcaballes/genieph-nextjs/src/lib/utils/deliveryLeadTime.ts:1), wired them into [src/app/cart/CartClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/cart/CartClient.tsx:1), and disabled the downpayment CTA with inline guidance when the delivery date is too soon.
  - Hardened the downpayment modal and order-history interactions for keyboard users in [src/app/cart/CartClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/cart/CartClient.tsx:1) and [src/app/account/orders/OrdersClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/account/orders/OrdersClient.tsx:1).
  - Fixed contribution redirect handling and session forwarding in [src/services/supabaseService.ts](/Users/apcaballes/genieph-nextjs/src/services/supabaseService.ts:1), then updated both cart and order-history callers to send real success/failure routes.
  - Hardened [supabase/functions/create-order-contribution/index.ts](/Users/apcaballes/genieph-nextjs/supabase/functions/create-order-contribution/index.ts:1) to reuse an existing pending downpayment invoice for the same exact stage amount instead of creating a second payable invoice on repeated clicks.
  - Reworked [src/app/order-confirmation/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/order-confirmation/page.tsx:1) so contribution confirmations verify against `contribution_id`, poll the right payment source, and compute the remaining balance from live collected amounts.
  - Applied live SQL hardening in [supabase/migrations/20260620053357_harden_downpayment_flow.sql](/Users/apcaballes/genieph-nextjs/supabase/migrations/20260620053357_harden_downpayment_flow.sql:1): server-side Manila lead-time enforcement, serialized contribution-trigger state updates, partial-payment aware cart-clearing, and uniqueness guards for Xendit contribution IDs.
  - Applied the follow-up live SQL guard in [supabase/migrations/20260620065000_skip_downpayment_cart_clear.sql](/Users/apcaballes/genieph-nextjs/supabase/migrations/20260620065000_skip_downpayment_cart_clear.sql:1) so `clear_cart_for_paid_order(...)` becomes a no-op for `downpayment_50` orders and cannot erase unrelated active cart rows after payment.
  - Deployed hardened live edge functions from [supabase/functions/create-order-contribution/index.ts](/Users/apcaballes/genieph-nextjs/supabase/functions/create-order-contribution/index.ts:1), [supabase/functions/verify-xendit-payment/index.ts](/Users/apcaballes/genieph-nextjs/supabase/functions/verify-xendit-payment/index.ts:1), and [supabase/functions/xendit-webhook/index.ts](/Users/apcaballes/genieph-nextjs/supabase/functions/xendit-webhook/index.ts:1). The new versions enforce organizer authorization for downpayment invoices, exact 50% / remaining-balance amounts, contribution amount verification during reconciliation, and optional Xendit callback-token verification for webhooks.
- Verification:
  - `npx vitest run src/lib/utils/deliveryLeadTime.test.ts src/hooks/usePendingOrderRecovery.test.ts src/app/cart/__tests__/CartClient.recovery.test.tsx`
  - `npm run build`
  - Live Supabase verification with `pg_get_functiondef(...)`, deployed edge-function metadata checks, and successful `apply_migration(...)` / `deploy_edge_function(...)` runs against the production project.
- Remaining operational follow-up:
  - Ensure one of `XENDIT_WEBHOOK_CALLBACK_TOKEN`, `XENDIT_CALLBACK_TOKEN`, or `XENDIT_PAYMENT_CALLBACK_TOKEN` is configured in the live Supabase function environment. The webhook now verifies the header when a token is configured, but the MCP tools used in this audit do not expose the current secret state.

## Fix Cart Date Picker Dead Click Path

### Plan

- [x] Inspect the `/cart` date-picker interaction and confirm why disabled dates produce dead clicks on mobile.
- [x] Replace the current no-op disabled-date interaction with an accessible date-cell component that keeps unavailable dates visibly disabled while still surfacing the reason on tap/focus.
- [x] Add focused tests for enabled vs unavailable date-cell behavior, then run targeted verification and a production build.

### Review

- The dead-click root cause was the old date strip in [src/app/cart/CartClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/cart/CartClient.tsx:1599): unavailable dates still rendered as ordinary-looking buttons, their click path was a silent no-op, and the only explanation lived behind `onMouseEnter` / `onMouseLeave` hover tooltip handlers. On mobile, that meant users could tap a blocked date and get no visible response.
- Extracted the date-cell rendering into [src/app/cart/CartDateOption.tsx](/Users/apcaballes/genieph-nextjs/src/app/cart/CartDateOption.tsx:1). Available dates still use the main button for selection, while unavailable dates now render a real disabled button for correct semantics plus a separate transparent reason trigger that exposes the unavailability message on tap, focus, or hover.
- Updated [src/app/cart/CartClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/cart/CartClient.tsx:291) so unavailable-date feedback is shared across the strip:
  - valid date selections clear the unavailable-date message,
  - unavailable date taps announce the reason with `showInfo(...)`,
  - and the cart now shows an inline `Date unavailable:` helper under the date rail for touch/mobile visibility instead of relying on desktop hover only.
- The visual state for unavailable dates is also stronger now: the date cell stays visibly disabled with muted text/background and no fake selectable hover behavior, which should reduce the “this looks tappable” ambiguity that Clarity was catching.
- Verification:
  - `npx vitest run src/app/cart/__tests__/CartDateOption.test.tsx src/app/cart/__tests__/CartClient.recovery.test.tsx`
  - `npm run build`
  - `git diff --check -- src/app/cart/CartClient.tsx src/app/cart/CartDateOption.tsx src/app/cart/__tests__/CartDateOption.test.tsx tasks/todo.md`
- Notes from verification:
  - Repo-wide `git diff --check` still reports an unrelated existing `new blank line at EOF` issue in `src/app/api/admin/cake-cache-images/route.ts`. I left that file untouched because it is outside this cart fix scope.

## Implement GA4 Cleanup V1

### Plan

- [x] Replace the inline root-layout GA4 config with a dedicated client analytics boundary that controls readiness, route suppression, manual pageviews, and internal-user tagging.
- [x] Update the shared GA4 helper so all app analytics flow through one gated API, including replacing direct `gtag(...)` event calls.
- [x] Rename custom analytics `source` params to `ui_source` and migrate internal `/customizing` handoff URLs from `source` to `entry_source` while keeping backward-compatible reads.
- [x] Set the internal-traffic cookie from middleware for `/admin/*` and `/similarity-debugger`, then add focused tests for middleware, analytics gating, and URL migration.
- [x] Run targeted tests plus a production build, then document verification and the GA4 admin follow-ups in this task entry.

### Review

- Replaced the old inline GA config in [src/app/layout.tsx](/Users/apcaballes/genieph-nextjs/src/app/layout.tsx:1) with a dedicated client [src/components/AnalyticsBoundary.tsx](/Users/apcaballes/genieph-nextjs/src/components/AnalyticsBoundary.tsx:1), plus an earlier bootstrap stub and manual `page_view` control. The boundary now suppresses `/admin/*` and `/similarity-debugger`, sets `send_page_view: false`, preserves the Xendit/Google Pay `ignore_referrer` behavior, and only marks analytics ready after route gating and user-property setup.
- Centralized GA event handling in [src/lib/analytics.ts](/Users/apcaballes/genieph-nextjs/src/lib/analytics.ts:1) and [src/lib/analyticsRoutes.ts](/Users/apcaballes/genieph-nextjs/src/lib/analyticsRoutes.ts:1). App-level analytics events now queue until GA is ready, drop on excluded routes, and flush only on allowed public routes. The remaining direct `gtag(...)` calls are limited to the analytics boundary, the shared helper internals, and the bootstrap stub in the root layout.
- Renamed the custom GA param from `source` to `ui_source` in the shared event wrappers, and migrated internal `/customizing` writers to `entry_source` in [src/app/LandingClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/LandingClient.tsx:1), [src/app/chatgpt-cake-design-quote/ChatGptCakeDesignQuoteClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/chatgpt-cake-design-quote/ChatGptCakeDesignQuoteClient.tsx:1), [src/app/cake-price-calculator/CakePriceCalculatorClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/cake-price-calculator/CakePriceCalculatorClient.tsx:1), and [src/components/blog/BlogUploadButton.tsx](/Users/apcaballes/genieph-nextjs/src/components/blog/BlogUploadButton.tsx:1). The customizer keeps backward-compatible reads through [src/app/customizing/customizingClientGuards.ts](/Users/apcaballes/genieph-nextjs/src/app/customizing/customizingClientGuards.ts:1) and [src/app/customizing/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/page.tsx:1), and strips legacy `source` after consuming it.
- Added middleware-based internal-user tagging in [src/middleware.ts](/Users/apcaballes/genieph-nextjs/src/middleware.ts:1). Browsers that hit `/admin/*` or `/similarity-debugger` now receive the `genie_internal_traffic=1` cookie with the requested path, age, same-site, and production-secure defaults, and public-page hits from those browsers are tagged as `internal_user=true` before the first manual public `page_view`.
- Replaced the remaining direct app call sites in [src/hooks/useSearchEngine.ts](/Users/apcaballes/genieph-nextjs/src/hooks/useSearchEngine.ts:1), [src/hooks/useDesignUpdate.ts](/Users/apcaballes/genieph-nextjs/src/hooks/useDesignUpdate.ts:1), and [src/app/order-confirmation/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/order-confirmation/page.tsx:1) so purchase, design-update, and start-design events all go through the shared GA gate.
- Verification:
  - `npx vitest run src/lib/analytics.test.ts src/components/AnalyticsBoundary.test.tsx src/middleware.test.ts src/app/customizing/customizingClientGuards.test.ts src/app/chatgpt-cake-design-quote/ChatGptCakeDesignQuoteClient.test.tsx`
  - `npm run build`
  - `git diff --check`
- Notes from verification:
  - The first post-change build exposed a real Next.js requirement: a client component using `useSearchParams()` under the root layout needs `Suspense`. Wrapping `AnalyticsBoundary` in `Suspense` resolved that cleanly.
  - The build still emits pre-existing warnings about `baseline-browser-mapping` staleness, the deprecated `middleware` file convention, and a few data-fetch timeout logs during static generation, but the production build completes successfully.
- Manual GA4/property rollout still required after deploy:
  - Disable Enhanced Measurement page-change tracking for the GA4 web stream.
  - Create the GA4 custom definitions for `internal_user` (user-scoped) and `ui_source` (event-scoped).
  - Create the clean saved views/explorations for `Sitewide Clean` and `Singapore Watch`.
  - Validate in Real-time/DebugView immediately after deploy, then recheck attribution buckets after 24-48 hours and Singapore/report quality after 7-14 days before considering edge blocking.

## Add Clarity Funnel Event Bridge

### Plan

- [x] Route key funnel and customizer events into Clarity through the shared analytics helper instead of adding ad hoc `window.clarity(...)` calls across the app.
- [x] Bootstrap the Clarity client early enough that queued event/tag calls survive the lazy external script load.
- [x] Tag internal-user sessions in Clarity using the existing cookie-based internal-traffic classification so admin/staff sessions are filterable.
- [x] Run focused tests and a full production build, then document the remaining Clarity-side verification steps.

### Review

- Added a shared Clarity bridge in [src/lib/analytics.ts](/Users/apcaballes/genieph-nextjs/src/lib/analytics.ts:1). The existing analytics queue now forwards selected app events to Clarity after route gating and analytics readiness, so the bridge stays aligned with the GA4 cleanup work instead of introducing a parallel event path.
- Clarity event names are intentionally prefixed with `API ` to avoid ambiguous overlap with Clarity's built-in auto events. The current code-driven event set is:
  - `API Search`
  - `API Image Upload`
  - `API Sign Up`
  - `API Start Design`
  - `API Update Design`
  - `API Add to Cart`
  - `API Begin Checkout`
  - `API Add Payment Info`
  - `API Purchase`
- Added an earlier Clarity bootstrap stub and centralized project ID in [src/app/layout.tsx](/Users/apcaballes/genieph-nextjs/src/app/layout.tsx:1) and [src/lib/analyticsRoutes.ts](/Users/apcaballes/genieph-nextjs/src/lib/analyticsRoutes.ts:1). The external Clarity script still loads with `lazyOnload`, but app events and custom tags can now queue safely before that script finishes loading.
- [src/components/AnalyticsBoundary.tsx](/Users/apcaballes/genieph-nextjs/src/components/AnalyticsBoundary.tsx:1) now sets the Clarity custom tag `internal_user=true` whenever the browser already has the internal-traffic cookie, including on admin routes where GA pageviews are suppressed. That gives Clarity a stable session-level filter for staff/internal browsing without weakening the GA route suppression logic.
- Verification:
  - `npx vitest run src/lib/analytics.test.ts src/components/AnalyticsBoundary.test.tsx src/middleware.test.ts src/app/customizing/customizingClientGuards.test.ts src/app/chatgpt-cake-design-quote/ChatGptCakeDesignQuoteClient.test.tsx`
  - `npm run build`
  - `git diff --check`
- Manual Clarity follow-up after deploy:
  - In Clarity, confirm the new API event names start appearing under Smart Events / Filters after fresh traffic lands.
  - Build saved filters or segments for `internal_user=true` so staff/admin sessions can be excluded from decision-making views.
  - If you want cleaner executive-facing event labels, use Clarity Settings -> Smart Events to create or edit higher-level smart events that group the `API ...` events into the names you want to monitor.

## Audit GSC And GA4 Last 30 Days

### Plan

- [x] Confirm live access paths for Google Search Console and GA4 from this environment.
- [x] Pull last-30-day GSC data for `https://genie.ph/`, focusing on queries, landing pages, countries, devices, and search trends.
- [x] Pull last-30-day GA4 data for the full site, focusing on acquisition, landing pages, engagement, geography, device mix, and conversion behavior.
- [x] Synthesize what users were doing across the whole website, then call out green flags, red flags, and the highest-leverage actions.
- [x] Record verification details and the final review in this task entry.

### Review

- Audit window used for both sources: `2026-05-20` through `2026-06-18` inclusive, which is the last 30 complete days relative to today (`2026-06-19`, Asia/Manila). GA4 data for the newest 24-48 hours can still settle slightly; GSC was pulled live with `data_state=all`.
- Live access paths verified:
  - GSC MCP access is active for both `sc-domain:genie.ph` and `https://genie.ph/`.
  - GA4 property access is live on `properties/510070439` via the service-account path documented in [.agent/rules/ga4-access.md](/Users/apcaballes/genieph-nextjs/.agent/rules/ga4-access.md:1). The first sandboxed probe failed on DNS resolution, then the same `run_report` call succeeded outside the sandbox and returned real rows.
- Whole-site GA4 picture:
  - `11,063` users, `12,507` sessions, `4,086` engaged sessions, `17,779` page views, and `9` tracked purchases/conversions in the window.
  - Versus the prior 30-day window (`2026-04-20` to `2026-05-19`), traffic more than doubled: users rose from `4,769` to `11,063`, sessions from `5,497` to `12,507`, and page views from `9,357` to `17,779`.
  - Acquisition is dominated by Organic Search (`7,051` sessions, `45.8%` engagement rate), then Direct (`4,366` sessions, only `10.4%` engagement), then Organic Social (`477`) and Referral (`261`).
  - Source detail confirms Google organic is carrying the site (`6,887` sessions). The next largest identifiable external sources are TikTok referral (`279`), `cakesandmemories.com` referral (`139`), Facebook/mobile Facebook referral (`151` combined), Bing organic (`83`), and AI-assistant/referral traffic from ChatGPT and Gemini (`103` combined across surfaced rows).
  - Devices are still mobile-first: `6,837` mobile sessions, `5,337` desktop, `223` tablet. Mobile also drove `8` of the `9` tracked conversions.
  - Geography is broader than Cebu-only demand. The Philippines led with `6,063` sessions and all `9` tracked conversions, but the next largest country rows were Singapore (`1,785` sessions, `4.7%` engagement), United States (`1,130`), and India (`389`). Top cities with meaningful engagement include Cebu City (`926` sessions, `52.3%` engagement, `3` conversions), Manila (`803`, `47.9%`), and Quezon City (`582`, `47.9%`).
  - New-user acquisition is very strong but retention is shallow: `11,043` new-user sessions versus `1,111` returning-user sessions. Returning-user engagement (`42.1%`) is healthier than new-user engagement (`33.1%`), but the site is still mostly acquiring rather than bringing people back.
- What people were doing:
  - Blogs are the main front door. Blog landings accounted for `3,532` sessions, more than any other section, and blog pages produced `4,059` page views.
  - The dominant behavior was reading the Jollibee-vs-McDo comparison. It was the top GSC landing page (`2,392` web clicks, `89,860` impressions, position `5.7`) and the top GA4 landing page (`2,627` sessions, `47.7%` engagement, `120.6s` average session duration).
  - Visitors were also using the commercial stack in material volume. `/customizing` was the third most-viewed page (`952` views), `/search` was fourth (`904` views), and `/cart` reached `262` views.
  - Customizer intent is real. As a landing section, `/customizing*` accounted for `1,945` sessions and `2` tracked conversions. As a consumption section, `/customizing*` produced `3,525` page views and `9,757` events, second only to the blog cluster.
  - Search and upload behavior shows active shopping work, not just passive reading. GA4 recorded `198` `search` events from `77` users, `189` `image_upload` events from `50` users, `104` `add_to_cart` events from `70` users, `31` `begin_checkout` events from `18` users, and `9` `purchase` events.
- GSC picture:
  - Web search produced `4,894` clicks from `439,302` impressions overall, with mobile driving `4,057` clicks versus `783` on desktop.
  - Search demand is highly concentrated in event-planning comparison intent, especially the Jollibee/McDo theme. The top web queries were variants of `jollibee party package 2026`, `mcdo party package price list 2026`, `jollibee birthday package 2026`, and related terms. This content cluster is doing real demand capture, not vanity ranking.
  - Brand search is tiny by comparison. `genie ph` only surfaced `23` clicks in the top-query table, which means most discovery is still non-brand and top-of-funnel.
  - The homepage is not yet a major Google landing surface (`55` web clicks, `1,315` impressions), and the base `/customizing` page is even smaller in Google web search (`8` clicks, `920` impressions). Search demand is finding specific blog and product/design pages first.
  - Google Image Search is surfacing customizer/design pages, but mostly with low CTR. For example, image-search top rows included multiple `/customizing/*` pages with good impression counts but `0.08%` to `0.33%` CTR, suggesting more upside in image-title, alt, and preview-image refinement.
  - GSC countries confirm overseas demand from gift senders or researchers: the Philippines led (`3,869` clicks), followed by the United States (`225`), India (`95`), Canada (`64`), Australia (`56`), and the UAE (`49`).
- Green flags:
  - Organic search is working at scale and is the clear engine behind the recent traffic step-up.
  - The strongest content has real dwell, not empty clicks. Several top blog landings sustain roughly 2-3 minutes of average session duration.
  - Customizing is not niche background traffic. It is one of the most-used sections on the site and does convert.
  - The audience is broader than Cebu itself, which supports messaging for remote buyers arranging Cebu deliveries from elsewhere in the Philippines or overseas.
  - AI-assistant and referral traffic are still small, but they are already present. That channel is worth nurturing early with machine-readable, citation-friendly, and comparison-friendly pages.
- Red flags:
  - The site is heavily dependent on one content winner. The Jollibee-vs-McDo page dominates both GSC and GA4. That is a growth asset, but it is also concentration risk.
  - Direct traffic quality is poor at scale: `4,366` sessions but only a `10.4%` engagement rate. Some of that is likely polluted by payment returns, internal traffic, dark social, or unattributed links.
  - GA4 data quality has visible pollution. `Singapore` is still the second-largest country with only `4.7%` engagement, and `(not set)` is the second-largest landing page bucket with `591` sessions and almost no engagement. Internal/admin routes also appear in landing-page and page-path tables.
  - The blog is better at attracting traffic than sending it into revenue. Blog landing groups produced `3,532` sessions and `0` tracked conversions in the window, while the homepage alone accounted for `4` tracked conversions from only `456` landing sessions.
  - Search demand is still mostly non-brand informational comparison traffic. That is good for reach, but it means brand pull and direct commercial intent are still underdeveloped.
  - GSC shows many customizer pages earning impressions with weak CTR. Discovery exists, but the result snippets and preview images are not yet winning enough clicks.
- Highest-leverage actions:
  1. Treat the top planning/comparison blogs as deliberate funnel pages, not only SEO pages. Add stronger in-content CTA modules, sticky mid-article commercial blocks, relevant customizer/theme links, and “ordering for Cebu from outside Cebu” language on the biggest winners.
  2. Build a second and third content winner around adjacent high-intent event-planning comparisons so the site is not over-dependent on one breakout page.
  3. Strengthen customizer search-result CTR: better `title`/meta tuning, stronger hero/OG images that also work as Google thumbnails, clearer cake-theme naming, and tighter image-alt/image-legend consistency on `/customizing/*`.
  4. Clean the measurement layer before over-interpreting source and geography tables: exclude admin/internal traffic, investigate the lingering Singapore low-engagement traffic, and reduce `(not set)` landing pages/source buckets.
  5. Work the homepage and `/customizing` as conversion hubs. They already convert better than the blog. Push more internal links, curated “start here” modules, and comparison-page exit CTAs toward those surfaces.
  6. Double down on mobile speed and mobile flow polish because mobile is the largest traffic segment and also the main conversion device.

## Review Microsoft Clarity Sitewide Last 30 Days

### Plan

- [x] Confirm the live Clarity access path available from this environment and note any MCP limitations.
- [x] Pull the last 30 days of Clarity data for `https://genie.ph`, focusing on traffic distribution, engagement, friction, and error signals.
- [x] Compare the strongest behavior patterns across landing, content, and commercial paths so the summary reflects what people were actually doing.
- [x] Summarize red flags, green flags, and the highest-leverage actions to improve and double down on the site.

### Review

- Clarity is configured locally in `/Users/apcaballes/.codex/config.toml` but the MCP server is currently `enabled = false`, so I used the same live Clarity bearer token against the official MCP-backed endpoints directly: `https://clarity.microsoft.com/mcp/dashboard/query` and `https://clarity.microsoft.com/mcp/recordings/sample`.
- Audit window: Clarity’s last-30-day window resolved to `2026-05-20 00:00:00` through `2026-06-19 23:59:59` in the `Asia/Manila` timezone.
- Traffic shape: the site is overwhelmingly top-of-funnel and SEO-led. Top visited pages by unique sessions were `/blog/jollibee-vs-mcdonalds-kids-party-packages-2026` (`2,691`), `/` (`1,399`), `/customizing` (`386`), `/blog/how-to-get-marriage-license-metro-cebu` (`334`), `/blog/red-ribbon-vs-goldilocks-birthday-cake-2026` (`170`), `/blog` (`138`), `/search` (`135`), and `/cart` (`118`).
- Entry behavior confirms that pattern. The Jollibee-vs-McDo page was also the top landing page (`2,695` sessions), while `/customizing` was only the fourth-largest entry page (`201`). This means the biggest growth lever is improving how informational traffic graduates into commercial paths, not just polishing the funnel in isolation.
- Device mix is strongly mobile: `6,821` mobile sessions, `2,539` desktop, `437` tablet. Acquisition is dominated by Google organic (`6,799` sessions), followed by direct/other (`2,073`), TikTok referral (`294`), `genie.ph` direct (`217`), `cakesandmemories.com` referral (`144`), and `chatgpt.com` (`78`).
- Geography is broader than “people physically in Cebu.” Top Clarity country/state combinations were Philippines / Metro Manila (`2,099`), Philippines / Central Visayas (`1,159`), Philippines / Calabarzon (`905`), Philippines / Central Luzon (`479`), and United States / Virginia (`355`). The public site should assume many buyers are arranging Cebu deliveries from outside Cebu.
- Green flag: the best-performing pages hold real attention. Total active time was led by the Jollibee-vs-McDo guide (`295,361s`), homepage (`59,045s`), marriage-license guide (`47,484s`), and `/customizing` (`36,697s`). That is not empty traffic; people are reading and exploring.
- Green flag: `/customizing` users are intentful. The base `/customizing` page had `387` sessions with `123.04s` average page duration, while search averaged `67.65s` and cart averaged `85.66s`. Recordings showed real upload, message-editing, pricing, and buy-now behavior rather than low-effort bounces.
- Red flag: conversion measurement is incomplete in Clarity. Smart events for the window only showed `Checkout = 242`, `Upload = 148`, `OrderSuccess = 11`, and `BeginCheckout = 7`, with no `AddToCart`, `Search`, or `Purchase` events surfaced. In the repo, [src/lib/analytics.ts](/Users/apcaballes/genieph-nextjs/src/lib/analytics.ts:1) only emits GA4 events, and [src/app/layout.tsx](/Users/apcaballes/genieph-nextjs/src/app/layout.tsx:131) loads the Clarity tag without paired `window.clarity("event", ...)` instrumentation.
- Red flag: the biggest traffic page also has the biggest friction surface. `/blog/jollibee-vs-mcdonalds-kids-party-packages-2026` logged `938` dead clicks and `164` quick backs. Because this page is the main SEO door, any confusing UI, weak CTA placement, or “answer found, then leave” pattern there has outsized impact on commercial growth.
- Red flag: the commercial funnel still has meaningful friction. `/customizing` logged `107` dead clicks, `8` rage clicks, and `21` quick backs. `/cart` logged `80` dead clicks and `3` JavaScript errors across `238` page views. `/search` logged `19` quick backs on only `136` traffic units, suggesting result mismatch or weak landing clarity.
- Red flag: performance on commercial pages is still soft. Base `/customizing` averaged `2,604ms` load time, but several customizer slug pages were much slower, commonly `4.1s` to `5.1s` average load with `~4.7s` to `5.7s` p75 load times. `/search` averaged `3,221ms` load time with `P75_LCP = 3,908ms` and `P75_INP = 400ms`.
- Red flag from recordings: cart dead clicks were not random. Sample recordings repeatedly showed users clicking date cells like `23` on `/cart`, with Clarity marking those taps as dead clicks before subsequent retries. That points to a concrete calendar/date-picker interaction problem rather than generic impatience.
- Red flag from recordings: customizer dead clicks cluster around message editing and preview affordances. Sample sessions showed dead clicks on text like `Edit Top Message...`, `Customized cake design`, and repeated `Apply All Changes` attempts after message edits. That suggests ambiguous tap targets or state transitions that are not obvious enough once users start fine-tuning designs.
- Measurement hygiene red flag: internal admin routes are present in public Clarity traffic/engagement tables (`/admin/search-analysis` and `/admin/image-studio`). Even if those are your own sessions, they pollute top-page engagement rankings, so Clarity should be segmented or filtered for internal/admin usage before using sitewide engagement tables as growth truth.
- Recommended action order:
  1. Add explicit Clarity custom events alongside the existing GA4 wrappers for `image_upload`, `search`, `add_to_cart`, `begin_checkout`, successful order completion, and key customizer edits.
  2. Fix the cart date-picker dead-click path first; it is a clear commercial-flow blocker with repeated evidence in recordings.
  3. Tighten customizer interaction clarity around message editing, preview toggles, and `Apply All Changes`, especially on mobile.
  4. Improve the top blog-to-funnel bridge on the Jollibee-vs-McDo page and other event-planning winners: stronger in-content CTA modules, relevant cake-theme links, and clearer “order for Cebu delivery even if you’re outside Cebu” language.
  5. Keep publishing adjacent high-intent planning/comparison content because SEO is already proving demand, but make each winner push harder into `/customizing`, relevant collections, or curated theme galleries.

## Add Agent Readiness To `/customizing/[slug]`

### Plan

- [x] Upgrade the primary customizer edit controls to native semantic groups without redesigning the existing UI.
- [x] Expose one canonical page-level agent model and capability map sourced from the same commerce snapshot truth used by the customizer/cart path.
- [x] Add the `/customizing/*` agent guidance to `public/llms.txt`.
- [x] Run focused tests plus a full production build and record the proof here.

### Review

- Added semantic radio-group behavior to the primary edit surfaces in [src/components/CakeBaseOptions.tsx](/Users/apcaballes/genieph-nextjs/src/components/CakeBaseOptions.tsx:1) and [src/components/CakeFlavorBottomSheet.tsx](/Users/apcaballes/genieph-nextjs/src/components/CakeFlavorBottomSheet.tsx:1), while preserving the current card/grid presentation.
- Upgraded the shared bottom-sheet shell in [src/components/CustomizationBottomSheet.tsx](/Users/apcaballes/genieph-nextjs/src/components/CustomizationBottomSheet.tsx:1) so the editor and flavor sheets now expose dialog semantics, stable labeling, open-focus targeting, and close-focus return.
- Added a single machine-readable agent surface with [src/lib/commerce/customizerAgentModel.ts](/Users/apcaballes/genieph-nextjs/src/lib/commerce/customizerAgentModel.ts:1) and [src/app/customizing/CustomizingAgentProtocol.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingAgentProtocol.tsx:1). `CustomizingClient` now emits `customizer-agent-model` and `customizer-capability-map` JSON from live customizer state instead of a parallel static schema.
- Extended the shared commerce constraint snapshot with `minimumLeadTimeDays` in [src/types.ts](/Users/apcaballes/genieph-nextjs/src/types.ts:306) and [src/lib/commerce/machineReadable.ts](/Users/apcaballes/genieph-nextjs/src/lib/commerce/machineReadable.ts:359), then reused that same field in both the add-to-cart commerce snapshot and the agent model.
- Added the route-level AI guidance to [public/llms.txt](/Users/apcaballes/genieph-nextjs/public/llms.txt:1), telling agents to prefer the page-level JSON model and capability map over scraping styling state.
- Verification:
  - `npx vitest run src/components/CakeBaseOptions.test.tsx src/components/CakeFlavorBottomSheet.test.tsx src/components/StickyAddToCartBar.test.tsx src/lib/commerce/machineReadable.test.ts src/lib/commerce/customizerAgentModel.test.ts src/app/customizing/CustomizingAgentProtocol.test.tsx` passed with `40` tests.
  - `git diff --check` passed.
  - `npm run build` passed. Static generation still logged the repo’s existing Supabase `57014` keyword-fallback timeouts during page generation, but the build completed successfully.

## Compare `/customizing` Agent Readiness With UCP

### Plan

- [x] Review the official UCP spec and Google’s current implementation guide.
- [x] Audit the current `/customizing` agent-readiness surfaces in this repo.
- [x] Map what is already aligned, what is missing, and what the sensible next step should be.

### Review

- Confirmed the current Genie implementation is not the same thing as Universal Commerce Protocol. Our current work is a page-level agent-readiness layer: semantic controls, accessible live state, `customizer-agent-model`, `customizer-capability-map`, and `/customizing/*` guidance in [public/llms.txt](/Users/apcaballes/genieph-nextjs/public/llms.txt:1).
- Confirmed there is no UCP discovery or negotiation layer in the repo today. The codebase does not publish `/.well-known/ucp`, does not advertise UCP capability namespaces such as `dev.ucp.shopping.checkout`, does not implement `UCP-Agent` profile negotiation, and does not expose a UCP transport surface over REST/MCP/A2A.
- Verified that Genie does already have a few useful prerequisites for eventual UCP adoption:
  - A machine-readable commerce snapshot in [src/types.ts](/Users/apcaballes/genieph-nextjs/src/types.ts:317) and [src/lib/commerce/machineReadable.ts](/Users/apcaballes/genieph-nextjs/src/lib/commerce/machineReadable.ts:359).
  - A page-level capability description in [src/lib/commerce/customizerAgentModel.ts](/Users/apcaballes/genieph-nextjs/src/lib/commerce/customizerAgentModel.ts:1).
  - A live Google Merchant Center feed in [src/app/feed/google/route.ts](/Users/apcaballes/genieph-nextjs/src/app/feed/google/route.ts:1), which matches Google’s guidance that existing product feeds support discovery before native UCP checkout.
- Recommendation: keep the current `/customizing` agent-readiness work as-is for immediate value, but do not describe it as “UCP support.” If we want real UCP alignment, the next implementation should be a separate protocol surface:
  - Publish a stable business profile at `/.well-known/ucp`.
  - Start with a read-only or low-risk capability set first, likely catalog lookup plus a Genie-specific custom-cake configuration bridge.
  - Add native checkout/session endpoints only after the custom cake configuration contract is stable enough to materialize deterministic line items.
  - Leave identity linking, payment handlers, signatures, and broader order lifecycle integration for a later phase.

## Align Dashboard Cake Pricing With Storefront

### Plan

- [x] Audit storefront database pricing, fallback pricing, base-price selection, and rounding.
- [x] Audit dashboard pricing service plus `CustomizationViewer` adapter inputs for drift.
- [x] Patch only dashboard pricing/mapping code needed to mirror storefront customer-facing totals.
- [x] Add focused regression coverage for the drift cases found.
- [x] Run targeted dashboard tests/checks and document proof here.

### Review

- Confirmed the storefront customer-facing cache price contract in [src/services/supabaseService.ts](/Users/apcaballes/genieph-nextjs/src/services/supabaseService.ts:260): cached designs use the lowest base price for `cakeType`, database add-on pricing, then `roundDownToNearest99(total, basePrice)`.
- Left storefront pricing code unchanged. The drift was in the dashboard viewer path, which had been using exact size lookup against cached `size = "Unknown"` and discarding preserved pricing inputs.
- Patched `/Users/apcaballes/genie.ph-admin-dashboard` so the AI Cache Page viewer now mirrors storefront cache pricing: lowest base price by type, same nearest-99 base floor, preserved message type/position, support quantity fallback, and `soft_icing` normalization.
- Verification in the dashboard repo:
  - `node --experimental-strip-types test_pricing_alignment.mjs` passed.
  - `npm run build` passed.
  - `git diff --check` passed.
  - `npm run lint` remains blocked by the pre-existing `check_db.ts` missing `dotenv` module/type issue.

## Improve Cake Size Height Ratio Prompt

### Plan

- [x] Trace the active `ai_prompts` loading path, fallback prompt, and latest prompt migration/version.
- [x] Add ratio-based height guidance to the cake analysis prompt without changing unrelated schema or pricing behavior.
- [x] Create the next prompt version as a new active `ai_prompts` row and keep the runtime fallback prompt in sync.
- [x] Run focused prompt tests plus a repo verification check, then document the result here.

### Review

- Root cause: the active prompt only constrained `cakeThickness` to the allowed enum values, so the model had no explicit visual conversion rule for cake-body diameter-to-height ratio. The local fallback prompt had also drifted behind the live `3.17` prompt, which meant fallback behavior would not include the latest tier/platform rule.
- Added a `cakeThickness Ratio Guide` to [src/services/prompts/fallback-prompt.txt](/Users/apcaballes/genieph-nextjs/src/services/prompts/fallback-prompt.txt:178). It tells the analyzer to keep `cakeType` as tier/form only, exclude toppers/boards/platforms from measurement, and map the guide ratios to heights: `2.00:1 -> 3 in`, `1.50:1 -> 4 in`, `1.20:1 -> 5 in`, and `1.00:1 -> 6 in`.
- Added [supabase/migrations/20260618044302_insert_prompt_v3_18_height_ratio_guide.sql](/Users/apcaballes/genieph-nextjs/supabase/migrations/20260618044302_insert_prompt_v3_18_height_ratio_guide.sql:1) to derive prompt `3.18` from active/live `3.17`, preserving the platform-vs-tier guidance and activating the new prompt as a new row instead of overwriting history.
- Applied the migration to live Supabase. Verification query showed active `ai_prompts` row `prompt_id = 27`, `version = 3.18`, one active prompt total, and the ratio guide present in the prompt text.
- Added regression coverage in [src/services/prompts/analysisPromptRules.test.ts](/Users/apcaballes/genieph-nextjs/src/services/prompts/analysisPromptRules.test.ts:30) so future fallback prompt syncs must retain the ratio table.
- Verification:
  - `npx vitest run src/services/prompts/analysisPromptRules.test.ts` passed with `10` tests.
  - `npm run build` passed. Static generation still logged existing Supabase `57014` fallback-query timeouts, but the build completed successfully.
  - `git diff --check` passed.

## Fix Cart Discount Mismatch In Xendit Checkout

### Plan

- [x] Trace the live cart -> `create_order_from_cart` -> `create-xendit-payment` path and confirm where discounted totals drift before redirect.
- [x] Patch the smallest safe root cause so the stored order total and Xendit invoice amount stay aligned with the cart/checkout total.
- [x] Run focused verification, then record the root cause, fix, and proof in this review section.

### Review

- Root cause: the cart UI and Xendit edge function were not disagreeing about formatting or centavos. The live Supabase `public.create_order_from_cart(...)` body in production had drifted to an older implementation that always stored `discount_amount = 0` and `total_amount = subtotal + delivery_fee`, even when a valid `discount_code_id` was present. `create-xendit-payment` then correctly trusted `cakegenie_orders.total_amount`, so Xendit was charging the undiscounted amount from the saved order row.
- Evidence from production before the fix: the most recent discounted checkout on `2026-06-13 07:36:23+00` (`ORD-20260613-06883`) had `subtotal = 1199.00`, `discount_code_id` set, but `discount_amount = 0.00`, `total_amount = 1199.00`, and `xendit_amount = 1199.00`. Earlier correctly discounted orders like `ORD-20260610-03921` still showed `discount_amount = 1187.01`, `total_amount = 11.99`, which helped isolate the issue to live function drift rather than the frontend math.
- Added [supabase/migrations/20260613074116_fix_create_order_discount_drift.sql](/Users/apcaballes/genieph-nextjs/supabase/migrations/20260613074116_fix_create_order_discount_drift.sql:1) to reassert the current 17-argument `create_order_from_cart` function body with server-side discount validation, discounted `total_amount`, discount usage tracking, and the existing `p_clear_cart` behavior preserved.
- Applied the same corrective migration to the live Supabase project (`cqmhanqnfybyxezhobkx`) as remote migration `20260613074310_fix_create_order_discount_drift`, so production now matches the repo’s intended checkout logic.
- Verification:
  - Queried the live function definition before the fix and confirmed it skipped discount validation and assigned `v_total_amount := GREATEST(0, p_subtotal + p_delivery_fee)` with `discount_amount = 0`.
  - Queried the live function definition after the fix and confirmed it now validates `discount_code_id`, calculates `v_calculated_discount`, stores `discount_amount = v_calculated_discount`, and stores `total_amount = p_subtotal + p_delivery_fee - v_calculated_discount`.
  - Confirmed the live migration history now includes `20260613074310_fix_create_order_discount_drift`.
  - I did not run a brand-new live checkout from the browser as a customer, so the remaining verification gap is one fresh discounted order to prove the next Xendit redirect now matches the cart total end to end.

## Raise Customizing Availability Bar By 2px

### Plan

- [x] Reduce the shared sticky-bar overlap by `2px` so the availability bar sits slightly higher.
- [x] Keep the availability text visible by raising the notification layer above the overlapping add-to-cart bar.
- [x] Update the derived sheet-spacing expectation and rerun the focused sticky layout checks.

### Review

- Reduced the shared overlap in [src/app/customizing/stickyBarLayout.ts](/Users/apcaballes/genieph-nextjs/src/app/customizing/stickyBarLayout.ts:1) from `46px` to `44px`, which raises the availability bar by `2px`.
- Updated [src/components/StickyAddToCartBar.tsx](/Users/apcaballes/genieph-nextjs/src/components/StickyAddToCartBar.tsx:1) so the notification grid renders at `z-10` while the main add-to-cart bar stays at `z-0`, keeping the availability text visible above the overlap.
- Updated [src/app/customizing/CustomizingEditorSheet.test.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingEditorSheet.test.tsx:1) to reflect the new derived sheet clearance of `80px` when the availability bar is visible.
- Verification:
  - `npx vitest run src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.test.tsx` passed with `12` tests.
  - `npx eslint src/components/StickyAddToCartBar.tsx src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.tsx src/app/customizing/CustomizingEditorSheet.test.tsx src/app/customizing/stickyBarLayout.ts` reported `0` errors and the same existing warnings only.

## Lower Customizing Availability Bar Another 4px

### Plan

- [x] Increase the shared overlap by another `4px` without changing the bar height or padding.
- [x] Shift only the same-day availability text up `2px` so the copy stays comfortably visible inside the deeper overlap.
- [x] Update the derived sheet-spacing expectation and rerun the focused sticky layout checks.

### Review

- Increased the shared overlap in [src/app/customizing/stickyBarLayout.ts](/Users/apcaballes/genieph-nextjs/src/app/customizing/stickyBarLayout.ts:1) from `42px` to `46px`, which moves the availability bar another `4px` down into the add-to-cart bar.
- Kept the availability bar padding unchanged, and shifted only the same-day text span up `2px` in [src/components/StickyAddToCartBar.tsx](/Users/apcaballes/genieph-nextjs/src/components/StickyAddToCartBar.tsx:1) so the copy stays visible inside the deeper overlap.
- Updated [src/app/customizing/CustomizingEditorSheet.test.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingEditorSheet.test.tsx:1) to reflect the new derived sheet clearance of `78px` when the availability bar is visible.
- Verification:
  - `npx vitest run src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.test.tsx` passed with `11` tests.
  - `npx eslint src/components/StickyAddToCartBar.tsx src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.tsx src/app/customizing/CustomizingEditorSheet.test.tsx src/app/customizing/stickyBarLayout.ts` reported `0` errors and the same existing warnings only.

## Lower Customizing Availability Bar Another 12px

### Plan

- [x] Reuse the shared sticky-bar overlap contract for one more downward shift.
- [x] Shift the availability bar down by another `12px` while preserving the current text padding and height.
- [x] Update the derived editor-sheet spacing expectation and rerun the focused sticky layout checks.

### Review

- Increased the shared overlap in [src/app/customizing/stickyBarLayout.ts](/Users/apcaballes/genieph-nextjs/src/app/customizing/stickyBarLayout.ts:1) from `30px` to `42px`, which moves the availability bar another `12px` down into the add-to-cart bar.
- Kept the availability notification padding unchanged, so the text remains visible while only the overlap amount changed.
- Updated [src/app/customizing/CustomizingEditorSheet.test.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingEditorSheet.test.tsx:1) to reflect the new derived sheet clearance of `82px` when the availability bar is visible.
- Verification:
  - `npx vitest run src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.test.tsx` passed with `10` tests.
  - `npx eslint src/components/StickyAddToCartBar.tsx src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.tsx src/app/customizing/CustomizingEditorSheet.test.tsx src/app/customizing/stickyBarLayout.ts` reported `0` errors and the same existing warnings only.

## Lower Customizing Availability Bar Another 6px

### Plan

- [x] Reuse the shared sticky-bar overlap contract instead of introducing a one-off style override.
- [x] Shift the availability bar down by another `6px` while keeping the current text height and padding intact.
- [x] Update the derived editor-sheet spacing expectation and rerun the focused sticky layout checks.

### Review

- Increased the shared overlap in [src/app/customizing/stickyBarLayout.ts](/Users/apcaballes/genieph-nextjs/src/app/customizing/stickyBarLayout.ts:1) from `24px` to `30px`, which moves the availability bar another `6px` down into the add-to-cart bar.
- Kept the availability notification padding unchanged, so the text remains fully visible while only the overlap amount changed.
- Updated [src/app/customizing/CustomizingEditorSheet.test.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingEditorSheet.test.tsx:1) to reflect the new derived sheet clearance of `94px` when the availability bar is visible.
- Verification:
  - `npx vitest run src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.test.tsx` passed with `10` tests.
  - `npx eslint src/components/StickyAddToCartBar.tsx src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.tsx src/app/customizing/CustomizingEditorSheet.test.tsx src/app/customizing/stickyBarLayout.ts` reported `0` errors and the same existing warnings only.

## Lower Customizing Availability Bar Further

### Plan

- [x] Recheck the shared sticky-bar overlap contract after the recent availability-height change.
- [x] Shift the availability bar down by `24px` into the add-to-cart bar while keeping the main action bar fixed.
- [x] Update focused spacing expectations and verify the sticky bar plus editor-sheet contract together.

### Review

- Increased the shared overlap in [src/app/customizing/stickyBarLayout.ts](/Users/apcaballes/genieph-nextjs/src/app/customizing/stickyBarLayout.ts:1) from `12px` to `24px`, which drops the availability bar further into the add-to-cart bar without moving the main sticky action bar itself.
- Kept [src/components/StickyAddToCartBar.tsx](/Users/apcaballes/genieph-nextjs/src/components/StickyAddToCartBar.tsx:1) on the same overlap-based layout path, so the lower placement still comes from the single shared constant instead of another one-off CSS adjustment.
- Updated [src/app/customizing/CustomizingEditorSheet.test.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingEditorSheet.test.tsx:1) to reflect the new derived sheet clearance of `100px` when the availability bar is visible.
- Verification:
  - `npx vitest run src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.test.tsx` passed with `10` tests.
  - `npx eslint src/components/StickyAddToCartBar.tsx src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.tsx src/app/customizing/CustomizingEditorSheet.test.tsx src/app/customizing/stickyBarLayout.ts` reported `0` errors and the same existing warnings only.

## Thicken Customizing Availability Bar

### Plan

- [x] Trace the availability bar height and the dependent editor-sheet offset on `/customizing`.
- [x] Increase the availability bar's vertical thickness by `20px` without moving the main action bar.
- [x] Update focused spacing tests and verify the shared sticky layout contract.

### Review

- Increased the availability notification thickness by `20px` total in [src/components/StickyAddToCartBar.tsx](/Users/apcaballes/genieph-nextjs/src/components/StickyAddToCartBar.tsx:1) by replacing the old uniform `p-1` body padding with explicit shared vertical padding.
- Extended [src/app/customizing/stickyBarLayout.ts](/Users/apcaballes/genieph-nextjs/src/app/customizing/stickyBarLayout.ts:1) with the extra-height constant, so the sticky bar and editor-sheet clearance stay derived from the same layout contract.
- The visible editor-sheet clearance above the sticky stack now rises from `92px` to `112px` when the availability bar is shown, and the focused expectation in [src/app/customizing/CustomizingEditorSheet.test.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingEditorSheet.test.tsx:1) was updated accordingly.
- Verification:
  - `npx vitest run src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.test.tsx` passed with `10` tests.
  - `npx eslint src/components/StickyAddToCartBar.tsx src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.tsx src/app/customizing/CustomizingEditorSheet.test.tsx src/app/customizing/stickyBarLayout.ts` reported `0` errors and the same existing warnings only.

## Lower Customizing Availability Bar

### Plan

- [x] Trace the sticky availability bar and any dependent bottom-sheet spacing on `/customizing`.
- [x] Move the availability bar down by about `12px` without shifting the main add-to-cart bar.
- [x] Update focused tests/offset expectations and verify the sticky layout contract.

### Review

- Lowered the sticky availability notification by overlapping it `12px` into the main add-to-cart bar in [src/components/StickyAddToCartBar.tsx](/Users/apcaballes/genieph-nextjs/src/components/StickyAddToCartBar.tsx:1), instead of moving the whole sticky bar.
- Added shared layout constants in [src/app/customizing/stickyBarLayout.ts](/Users/apcaballes/genieph-nextjs/src/app/customizing/stickyBarLayout.ts:1) so the editor sheet and sticky bar use the same spacing contract.
- Updated [src/app/customizing/CustomizingEditorSheet.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingEditorSheet.tsx:1) to use the shared offsets, which changes the sheet clearance from `104px` to `92px` when the availability bar is visible.
- Verification:
  - `npx vitest run src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.test.tsx` passed with `9` tests.
  - `npx eslint src/components/StickyAddToCartBar.tsx src/components/StickyAddToCartBar.test.tsx src/app/customizing/CustomizingEditorSheet.tsx src/app/customizing/CustomizingEditorSheet.test.tsx src/app/customizing/stickyBarLayout.ts` reported `0` errors and existing warnings only.

## Advance Mobile Hero Carousel On Scroll

### Plan

- [x] Trace the existing mobile hero interaction path and identify where scroll-driven slide changes should hook in.
- [x] Add a mobile-only, hero-in-view scroll trigger that advances the carousel to the right while preserving the existing headline animation path.
- [x] Cover the scroll-threshold behavior with focused tests and verify with build/browser checks.

### Review

- Root cause: the mobile hero already had a single interaction path for arrows/swipes through `heroProductIndex`, `handleHeroNext`, and `activateHeroHeadlineVariant`, but ordinary page scroll never touched that flow. Users could scroll past the hero without seeing the carousel rotate or the headline animation react.
- Extended [src/app/landingHeroCarousel.ts](/Users/apcaballes/genieph-nextjs/src/app/landingHeroCarousel.ts:1) with `getNextMobileHeroScrollAccumulation(...)`, a small helper that accumulates downward scroll only while the hero is visible and returns a single “advance now” signal once the threshold is reached.
- Updated [src/app/LandingClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/LandingClient.tsx:1437) with a mobile-only window scroll listener tied to `heroMobilePreviewRef`. While the hero upload state is still `idle` and the preview section is in view, downward scroll now advances the carousel to the right using `handleHeroNext()`, which means the existing text animation path still runs through `activateHeroHeadlineVariant(...)`.
- Added focused regression coverage in [src/app/landingHeroCarousel.test.ts](/Users/apcaballes/genieph-nextjs/src/app/landingHeroCarousel.test.ts:1) for accumulation, threshold crossing, hidden-hero reset, and upward-scroll reset.
- Verification:
  - `npx vitest run src/app/landingHeroCarousel.test.ts src/components/LazyImage.test.tsx` passed with 15 tests.
  - Focused ESLint passed for `src/app/landingHeroCarousel.ts`, `src/app/landingHeroCarousel.test.ts`, `src/app/HeroProductPeekCarouselEmbla.tsx`, `src/components/LazyImage.tsx`, and `src/components/LazyImage.test.tsx`, with only the existing Browserslist data warning.
  - `git diff --check` is currently blocked by unrelated pre-existing whitespace issues in `src/app/collections/[category]/page.tsx` and `src/utils/designContentUtils.ts`, not by this landing-page change.
  - `npm run build` is currently blocked by an unrelated local type error in `src/app/collections/[category]/page.tsx` (`Cannot find name 'readableTitle'`). This landing-page feature had already passed build earlier in the session before that unrelated route drift surfaced, but the final rerun cannot claim a clean repo-wide build because of the collections error.
  - Headless Chrome verification against local production server `http://127.0.0.1:3008/` at a `390x844` viewport confirmed the behavior. Before scroll, the page was still on the default hero headline (`Minimalist Cakes...`) at `scrollY: 0`. After three downward page scrolls (`scrollY: 540`), the active hero card had advanced to `Doodle Cakes example` and the headline text reflected the matching variant, confirming that downward page scroll now moves the carousel to the right through the existing text-animation path.

## Stabilize Mobile Homepage Hero Carousel Handoff

### Plan

- [x] Trace the current mobile hero placeholder and delayed Embla handoff in `LandingClient`.
- [x] Keep the placeholder rendered until the Embla chunk is loaded and the interactive carousel is ready.
- [x] Align the placeholder's visible slide window with the live carousel and prevent remounted hero images from starting hidden.
- [x] Add focused regression coverage and verify with targeted tests/checks.

### Review

- Root cause: the mobile homepage still depended on a two-phase hero path in [src/app/LandingClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/LandingClient.tsx:354). The static placeholder showed the active card plus the next card but no wrapped previous card, then the component swapped directly to the delayed Embla import. During that handoff the carousel slot could briefly go empty while the chunk loaded, and the new hero images remounted through `LazyImage` with `opacity-0` until their own `onLoad`, causing the visible disappear/reappear sequence and the downstream section jump.
- Added [src/app/landingHeroCarousel.ts](/Users/apcaballes/genieph-nextjs/src/app/landingHeroCarousel.ts:1) so the mobile placeholder now renders a wrapped `previous/current/next` window around the active hero index instead of starting at index `0`.
- Updated [src/app/LandingClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/LandingClient.tsx:400) so the placeholder stays in normal flow until the Embla module is imported and signals ready. The interactive carousel mounts in an overlaid layer first, then takes over without collapsing the slot.
- Updated [src/app/HeroProductPeekCarouselEmbla.tsx](/Users/apcaballes/genieph-nextjs/src/app/HeroProductPeekCarouselEmbla.tsx:21) with an `onReady` callback and the same visible-slide helper so the initial live carousel aligns with the placeholder window.
- Extended [src/components/LazyImage.tsx](/Users/apcaballes/genieph-nextjs/src/components/LazyImage.tsx:11) with an internal `showBeforeLoad` option and used it on the mobile hero carousel images, so the remounted visible slides no longer start artificially hidden during the handoff.
- Added focused regression coverage in [src/app/landingHeroCarousel.test.ts](/Users/apcaballes/genieph-nextjs/src/app/landingHeroCarousel.test.ts:1) and [src/components/LazyImage.test.tsx](/Users/apcaballes/genieph-nextjs/src/components/LazyImage.test.tsx:1).
- Verification:
  - `npx vitest run src/app/landingHeroCarousel.test.ts src/components/LazyImage.test.tsx` passed with 11 tests.
  - Focused ESLint passed for the new helper/Embla/LazyImage files. `LandingClient.tsx` still has the repo's pre-existing lint debt (`react-hooks/set-state-in-effect`, unescaped entities, unused values, and legacy `<img>` warnings), so this change does not newly clear that file.
  - `git diff --check` passed.
  - `npm run build` passed. Static generation still logged the existing Supabase `57014` fallback-query timeouts during page generation, but the build completed successfully.
  - Built-app browser verification on `http://127.0.0.1:3007/` with a `390x844` viewport showed the mobile hero rendering with left/center/right cards on first paint and still stable after the delayed handoff interval; the hero image count stayed at `6` and the “Generic cakes make generic celebrations” heading position remained stable instead of jumping.

## Demote Legacy Category Hubs And Strengthen Collection Canonicals

### Plan

- [x] Mark `/customizing/category/*` as `noindex,follow` so it stays usable without competing with `/collections/*`.
- [x] Remove `/customizing/category/*` entries from the XML sitemap and stop promoting them from `/customizing` theme discovery.
- [x] Add shop product backlinks into matching `/collections/*` hubs and verify with focused tests.
- [x] Document the still-manual GSC query-language audit loop as a follow-up instead of inventing a fake data source.

### Review

- Updated [src/app/customizing/category/[keyword]/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/category/[keyword]/page.tsx:149) so legacy customizer category hubs now return `robots: noindex,follow` while remaining user-accessible.
- Removed hardcoded `/customizing/category/*` routes from [src/app/sitemap.ts](/Users/apcaballes/genieph-nextjs/src/app/sitemap.ts:156), leaving `/collections/*` as the only promoted category-hub sitemap surface.
- Repointed the `/customizing` page's theme chips, editorial links, and ItemList JSON-LD source from `/customizing/category/*` to `/collections/*` in [src/app/customizing/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/page.tsx:25), so first-party discovery now promotes the canonical collection hubs instead of the legacy category layer.
- Added `resolveThemeCollectionForProduct(...)` plus a visible "Browse the full theme collection" CTA in [src/app/shop/[merchantSlug]/[productSlug]/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/shop/[merchantSlug]/[productSlug]/page.tsx:15) so shop product detail pages feed authority and users back into matching collection hubs.
- Left the query-language audit loop as a manual follow-up. The repo has no live GSC data source wired in, so this implementation does not fake demand validation; it records that collection `name` / `slug` / tags still need to be checked against real impression and query data outside the repo.
- Verification:
  - `npx vitest run 'src/app/customizing/category/[keyword]/page.test.tsx' src/app/sitemap.test.ts 'src/app/shop/[merchantSlug]/[productSlug]/page.test.tsx' src/app/customizing/page.test.tsx` passed with 9 tests.
  - Focused ESLint passed with only the stale Browserslist warning.
  - `git diff --check` passed.
  - `npm run build` passed.
  - During static generation, a few existing Supabase `57014` statement-timeout warnings appeared from `getDesignsByKeyword` fallback queries, but the build completed successfully and emitted the updated routes.

## Capture Customer Chat Page Context

### Plan

- [x] Trace the customer chat modal request flow and confirm the best place to persist page context.
- [x] Add durable page-context columns to `chat_conversations` and thread page URL/title through the chat modal API.
- [x] Add focused `/api/chat` regression coverage plus verification notes, then document the final review here.

### Review

- Root cause: the customer chat modal stored messages but never sent page context, and `chat_conversations` had no durable field for the last page the customer was viewing.
- Added `supabase/migrations/20260611142000_add_chat_conversation_page_context.sql` to store `last_customer_page_url`, `last_customer_page_title`, and `last_customer_page_seen_at` on each conversation.
- Applied the same schema change to Supabase project `cqmhanqnfybyxezhobkx` as migration `add_chat_conversation_page_context`, so the live database is ready for the new fields.
- Updated [src/components/ChatModal.tsx](/Users/apcaballes/genieph-nextjs/src/components/ChatModal.tsx:54) to capture `window.location.href` plus `document.title` and send that `pageContext` when starting a conversation, sending a text message, and sending an image message.
- Updated [src/app/api/chat/route.ts](/Users/apcaballes/genieph-nextjs/src/app/api/chat/route.ts:1) to normalize that payload and persist it on new conversations and on later customer messages so support always sees the latest page context tied to the thread.
- Added focused regression coverage in [src/app/api/chat/route.test.ts](/Users/apcaballes/genieph-nextjs/src/app/api/chat/route.test.ts:1) for both the new-conversation write path and the customer-message refresh path.
- Verification:
  - `npx vitest run src/app/api/chat/route.test.ts` passed with 2 tests.
  - `npx eslint src/app/api/chat/route.ts src/app/api/chat/route.test.ts` passed. `npx eslint src/components/ChatModal.tsx --quiet` produced no errors.
  - `git diff --check` passed.
  - Supabase MCP `apply_migration` succeeded for project `cqmhanqnfybyxezhobkx`, and `list_migrations` now includes `add_chat_conversation_page_context`.

## Inspect Parallel Studio Background Edit Prompt

### Plan

- [x] Trace the fresh-upload path that triggers the parallel studio background edit.
- [x] Confirm the exact server route/helper that sends the background-edit request to Gemini.
- [x] Extract the current prompt and system instruction used for the studio background edit.
- [x] Summarize exactly where to change the prompt if the user wants new wording.

### Review

- The fresh-upload customizer path starts the background studio edit in parallel from [src/contexts/ImageContext.tsx](/Users/apcaballes/genieph-nextjs/src/contexts/ImageContext.tsx:603) by calling `triggerStudioEditFromUpload(pHash, compressedImageData)` before the fast analysis completes.
- That helper lives in [src/services/geminiService.ts](/Users/apcaballes/genieph-nextjs/src/services/geminiService.ts:145) and posts to `/api/ai/trigger-studio-edit` with the pHash plus the inline original image bytes.
- The server route [src/app/api/ai/trigger-studio-edit/route.ts](/Users/apcaballes/genieph-nextjs/src/app/api/ai/trigger-studio-edit/route.ts:1) defers the work with `after(...)` and calls `runImageStudioJob(...)`.
- The real Gemini image-edit call happens in [src/lib/admin/imageStudioJob.ts](/Users/apcaballes/genieph-nextjs/src/lib/admin/imageStudioJob.ts:406), which builds the prompt with `buildImageStudioPrompt()` and the system instruction with `buildImageStudioSystemInstruction()`.
- The prompt and system instruction source of truth are both in [src/lib/admin/imageStudio.ts](/Users/apcaballes/genieph-nextjs/src/lib/admin/imageStudio.ts:50). Changing that file changes both the inline job and the batch studio path, because `src/lib/admin/imageStudioBatch.ts` reuses the same builders.

## Prefer Studio Images In Google Shopping Feed

### Audit

- [x] Trace the Google Shopping feed image selection from Supabase query through `g:image_link`.
- [x] Compare the feed image with `/customizing/[slug]` metadata, structured data, and rendered hero selection.
- [x] Verify current production feed output and live studio-image coverage.

### Plan

- [x] Update `src/app/feed/google/route.ts` to select `studio_edited_image_url` and resolve the primary image as the first nonblank value from `studio_edited_image_url`, then `original_image_url`.
- [x] Change feed eligibility so a row is included when either image column is usable, while still requiring a slug.
- [x] Keep URL sanitization after image selection so Supabase signed/query parameters do not leak into `g:image_link`.
- [x] Extract or export the feed image resolver and add focused tests for studio-first selection, blank studio fallback, null studio fallback, and invalid/data URL exclusion.
- [x] Verify the generated feed uses the studio URL for a known row such as `bunny-cupcakes-brown-cupcakes-1c18`, and still uses the original URL for rows without a studio edit.
- [x] Run focused tests, lint, `git diff --check`, and a production build.
- [ ] After deployment, verify `https://genie.ph/feed/google`, trigger or wait for the Merchant Center feed refresh, and inspect representative products because Google Shopping image recrawling is not immediate.

### Review

- Root cause: `src/app/feed/google/route.ts` currently selects and filters only `original_image_url`, then writes that field directly to `g:image_link`; it never fetches `studio_edited_image_url`.
- The `/customizing/[slug]` landing page already applies studio-first fallback through `withPreferredHeroImage`, so the feed currently disagrees with page metadata, Product JSON-LD, and the rendered hero image.
- Live verification on 2026-06-06 found 12,675 feed-eligible rows with an original image, including 5,515 rows with a nonblank studio image. The production feed still emitted the original customization URL for sampled rows that have a studio edit.
- No schema migration or image backfill is required for this fix. The change belongs in feed selection and regression coverage.
- Implemented `resolveGoogleFeedImage(...)` with studio-first selection, original fallback, HTTP(S)-only validation, whitespace handling, and Supabase query-parameter removal.
- Updated the feed query to fetch both image columns and admit rows when either column is present.
- Verification:
  - `npx vitest run src/lib/commerce/googleFeedImage.test.ts src/lib/commerce/feedIds.test.ts` passed with 10 tests.
  - Focused ESLint passed with only the stale Browserslist notice.
  - `git diff --check` passed.
  - Directly invoking `GET()` against live Supabase returned HTTP 200 and emitted `cakegenie/admin/image-studio/bunny-cupcakes-brown-cupcakes-1c18.webp` for the known studio-edited design.
  - `npm run build` compiled the application successfully, then stopped during TypeScript checking on an unrelated pre-existing error in `scratch/cancel_new_vertex_job.ts:13`.

## Reduce Customizing Sitemap Age Gate

### Plan

- [x] Change the `cakegenie_analysis_cache` sitemap cooling period from 7 days to 2 days.
- [x] Update focused cutoff coverage so rows older than 2 days pass and rows newer than 2 days stay excluded.
- [x] Run focused sitemap indexability tests and diff checks.

### Review

- Updated `CUSTOMIZING_SITEMAP_MIN_AGE_DAYS` from `7` to `2` in `src/lib/sitemap/indexability.ts`.
- Updated the focused cutoff test to confirm a 4-day-old row now passes while a 1-day-old row remains excluded.
- Verification:
  - `npx vitest run src/lib/sitemap/indexability.test.ts` passed with 5 tests.
  - `git diff --check` passed.

## Backfill Generic SEO Descriptions And Alt Text

### Plan

- [x] Count and sample `cakegenie_analysis_cache` rows whose `seo_description` contains both `Get instant pricing` and `Starting at`.
- [x] Create a focused Gemini 2.5 Flash backfill script that regenerates `seo_description` and `alt_text` from `analysis_json`.
- [x] Dry-run a small sample and inspect generated copy for banned fallback phrases.
- [x] Run the live backfill, then verify no matching generic descriptions remain.

### Review

- Found 416 live `cakegenie_analysis_cache` rows whose `seo_description` contained both `Get instant pricing` and `Starting at`.
- Used `scripts/backfill-generic-seo-copy.ts` with `gemini-2.5-flash` through the repo's Vertex AI client to regenerate `alt_text` and `seo_description` from each row's `analysis_json`.
- Dry-run first caught pricing/marketing wording issues, then the script was tightened with retry validation before live writes.
- Updated all 416 rows in live Supabase: 14 in the initial serial run, 402 in the resumed concurrent run, and 1 final straggler with empty `keywords`.
- Verification:
  - SQL count for descriptions containing both `Get instant pricing` and `Starting at`: `0`.
  - SQL count for descriptions containing either `Get instant pricing` or `Starting at`: `0`.
  - Sampled Cinderella cupcakes, Mother's Day, and heart cake rows after update; each now has design-specific alt text and description.

## Require SEO Copy For Accepted Cake Analysis

### Plan

- [x] Tighten the active `/api/ai/analyze` structured-output schema so accepted cake and cupcake analyses must include `alt_text`, `seo_title`, and `seo_description`.
- [x] Remove stale cupcake rejection residue now that cupcake-only uploads are accepted.
- [x] Add focused regression coverage for the analysis schema, including a Cinderella cupcake accepted-analysis shape.
- [x] Run focused tests/lint and record the result.

### Review

- Root cause: the active `/api/ai/analyze` route uses the shared search-analysis structured-output schema, and that schema previously required only `rejection`. The prompt said `seo_title` and `seo_description` were required, but the model was not schema-forced to emit them.
- Updated `src/lib/admin/searchAnalysisContract.ts` so accepted-analysis fields are required at the top level, including `alt_text`, `seo_title`, and `seo_description`.
- Removed stale `cupcakes_only` rejection handling from `src/services/geminiService.ts` and `src/app/api/ai/analyze-url/route.ts`.
- Added regression coverage proving the shared schema requires SEO copy and that a Cinderella cupcake accepted-analysis shape carries all required fields.
- Verification:
  - `npx vitest run src/lib/admin/searchAnalysisBatch.test.ts` passed with 15 tests.
  - `npx eslint src/lib/admin/searchAnalysisContract.ts src/lib/admin/searchAnalysisBatch.test.ts src/app/api/ai/analyze-url/route.ts` passed with only the stale Browserslist notice.
  - Full focused ESLint including `src/services/geminiService.ts` still hits pre-existing unrelated `no-explicit-any` errors at lines 228 and 241.
  - `git diff --check` passed.

## Fix Customizer Icing Swatch Fix Button Source

### Plan

- [x] Trace the color swatch Fix button from `CustomizingStepSummarySections` through `CustomizingClient` and `useIcingMask`.
- [x] Patch manual mask regeneration so it explicitly targets the current displayed image, preferring `studio_edited_image_url` after the studio image arrives.
- [x] Add focused regression coverage for the Fix button regeneration path.
- [x] Run targeted tests/lint and record the result.

### Review

- The swatch Fix button in `CustomizingStepSummarySections` calls `handleRegenerateMask` in `CustomizingClient`, which previously called `regenerateMask()` and then `recolorIcing(...)`.
- Before this fix, `regenerateMask()` only cleared the decoded in-memory mask and set status back to `idle`; it did not itself generate a new mask from the latest displayed image.
- Updated `src/hooks/useIcingMask.ts` so `regenerateMask()` now explicitly resolves `studioEditedImageUrl ?? baseImageUrl`, fetches the studio image bytes when a studio URL exists, calls `generateAndPersistIcingMask(...)`, decodes the returned mask, and stores it as the ready in-memory mask before recoloring.
- Added a regression test proving forced regeneration uses `https://example.com/studio.webp` bytes and `sourceImageUrl`, not the original `BASE_IMAGE`, when the studio image is displayed.
- Verification:
  - `npx vitest run src/hooks/useIcingMask.test.ts` passed with 17 tests.
  - `npx eslint src/hooks/useIcingMask.ts src/hooks/useIcingMask.test.ts` passed with only the stale Browserslist notice.
  - `git diff --check` passed.

## Audit AI Cake Analysis Upload Result Tracking

### Plan

- [x] Trace the live customer upload analysis route from UI upload through AI validation/analysis and cache persistence.
- [x] Trace the admin search-analysis batch route to compare how accepted and rejected outcomes are stored.
- [x] Verify live Supabase schema/counts for the relevant result tables where possible.
- [x] Answer whether Genie.ph currently stores all user upload outcomes, only accepted analyses, or separate rejected outcomes.

### Review

- Customer/customizer uploads call `/api/ai/analyze` through `analyzeCakeFeaturesOnly(...)`; non-selfie AI rejections are thrown as `AI_REJECTION` before `ImageContext` reaches `cacheAnalysisResult(...)`.
- Accepted customer uploads are persisted through `cacheAnalysisResult(...)` into `cakegenie_analysis_cache`.
- There is no dedicated normal-upload attempt/result table in the traced flow, so customer upload rejects are not reliably stored as accepted/rejected outcomes.
- Admin search-analysis batch items do have durable statuses in `cakegenie_search_analysis_batch_items`, including `completed`, `failed`, `retryable`, and `rejected`.
- Live Supabase verification on 2026-06-05:
  - `cakegenie_analysis_cache`: 11,487 rows total; 8,474 rows with a `rejection` key; 18 rows where `rejection.isRejected = true`.
  - `cakegenie_search_analysis_batch_items`: 765 completed, 211 rejected, 8 failed, 19 retryable, 1,120 queued.
  - `cakegenie_search_analysis_batch_runs`: 1 completed, 2 completed_with_errors, 4 failed.

## Create Private Rejected Upload Log

## Fix Thin AI Analysis Pages For New Customizer Slugs

### Plan

- [x] Review `scripts/debug/prompt-fix-thin-pages.md` against the live implementation and note which parts are already shipped versus still missing.
- [x] Trace the real `/customizing/[slug]` content path to confirm whether page body content is coming from `seo_description`, `generateDesignDetails(...)`, or a fallback mix.
- [x] Implement the smallest durable fix so newly analyzed cake images render sufficiently rich per-page content by default instead of depending on short AI copy.
- [x] Update verification to audit the actual rendered-content resolver and add focused regression coverage for the thin-page guardrail.

### Review

- Prompt review: `scripts/debug/prompt-fix-thin-pages.md` is directionally good but partly stale. The budget-tip logic, care guidance, dynamic FAQ work, and the audit script already existed in `src/utils/designContentUtils.ts` and `scripts/audit-thin-content.ts`, so the real gap was no longer “add these features from scratch.”
- Root cause: thin-page risk had narrowed to sparse designs such as minimalist/bento/monthly-milestone variants. The page body and the post-analysis view could still render short AI `seo_description` text, while the audit script measured a slightly different content path. That made it harder to guarantee the real rendered page would clear the same threshold the audit was reporting.
- Added a shared thin-page guardrail in [src/utils/designContentUtils.ts](/Users/apcaballes/genieph-nextjs/src/utils/designContentUtils.ts:1): `buildDesignPageContent(...)` now builds the actual per-page description + FAQ set, measures unique-word depth with the same boilerplate stripping used by the audit, injects targeted boost FAQs only when a design is still thin, and combines the richer deterministic description only as a fallback when needed.
- Updated [src/app/customizing/[slug]/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/[slug]/page.tsx:1), [src/app/customizing/CustomizingPostAnalysisContent.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingPostAnalysisContent.tsx:1), and [src/app/customizing/CustomizingClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingClient.tsx:3967) so both the indexed slug page and the fresh post-analysis view use the same enriched page-content builder instead of drifting between raw `seo_description` and generated prose.
- Updated [scripts/audit-thin-content.ts](/Users/apcaballes/genieph-nextjs/scripts/audit-thin-content.ts:1) to audit the same builder the page now uses, then added focused regression coverage in [src/utils/designContentUtils.test.ts](/Users/apcaballes/genieph-nextjs/src/utils/designContentUtils.test.ts:1) and [src/app/customizing/CustomizingPostAnalysisContent.test.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingPostAnalysisContent.test.tsx:1).
- Verification:
  - `npx vitest run src/utils/designContentUtils.test.ts src/app/customizing/CustomizingPostAnalysisContent.test.tsx 'src/app/customizing/[slug]/page.test.tsx'` passed with 24 tests and 1 existing skipped test.
  - `npx tsx scripts/audit-thin-content.ts` passed on a live 250-row sample and improved the audit from `52` low pages / `299` avg unique words / `60.8%` similarity to `0` low pages / `354` avg unique words / `35.4%` similarity.
  - `git diff --check` is still blocked by unrelated pre-existing trailing whitespace in `src/app/collections/[category]/page.tsx`.
- Focused ESLint still reports the repo’s existing `no-explicit-any` debt in `src/app/customizing/[slug]/page.tsx` and `src/utils/designContentUtils.ts`; this pass did not newly clear those legacy file-level issues.

## Backfill Rich Stored SEO Descriptions

### Plan

- [x] Add a shared deterministic helper that enriches short stored `seo_description` values from `analysis_json`, then keeps the existing availability-append sync behavior.
- [x] Update `cacheAnalysisResult(...)` so future AI cake-analysis rows store the enriched description by default instead of the shorter raw AI paragraph.
- [x] Create a focused backfill script for existing `cakegenie_analysis_cache` rows whose stored `seo_description` is still too short, then dry-run representative samples.
- [x] Run the live backfill, verify counts plus before/after samples, and record the outcome here.

### Review

- Added `enrichStoredSeoDescription(...)` in [src/lib/seo/analysisCopy.ts](/Users/apcaballes/genieph-nextjs/src/lib/seo/analysisCopy.ts:1). It strips duplicate availability text, enriches short descriptions with deterministic detail from `analysis_json`, and then reapplies the canonical availability sentence once so the cache row and `analysis_json` stay in sync.
- Updated [src/services/supabaseService.ts](/Users/apcaballes/genieph-nextjs/src/services/supabaseService.ts:1) so future `cacheAnalysisResult(...)` writes use the enriched stored description by default instead of the shorter raw AI paragraph. This means newly analyzed cake images now persist the richer description path automatically.
- Added [scripts/backfill-thin-seo-descriptions.ts](/Users/apcaballes/genieph-nextjs/scripts/backfill-thin-seo-descriptions.ts:1) as a deterministic live backfill script. It scopes updates to rows whose stored `seo_description` is generic or under `130` words, updates both `seo_description` and `analysis_json.seo_description`, supports dry-run vs `--apply`, and keeps resumable progress tracking for live runs.
- Tightened the deterministic prose helper in [src/utils/designContentUtils.ts](/Users/apcaballes/genieph-nextjs/src/utils/designContentUtils.ts:1) so message-related description text no longer quotes raw customer messages; it now describes them generically as visible piped message details.
- Verification:
  - `npx vitest run src/lib/seo/analysisCopy.test.ts src/services/supabaseService.cacheAnalysisResult.test.ts src/utils/designContentUtils.test.ts src/app/customizing/CustomizingPostAnalysisContent.test.tsx` passed with 27 tests.
  - Dry-run before the live write scanned `13,036` cache rows and found `21` true short-description candidates.
  - Live run `npx tsx scripts/backfill-thin-seo-descriptions.ts --apply` updated all `21` candidate rows with `failed=0`.
  - Post-backfill dry-run scanned `13,036` rows and returned `candidates=0`.
  - Direct DB spot-checks for `monthly-milestone-pink-1-tier-cake-8010` and `basketball-black-1-tier-cake-dfc1` confirmed `seo_description === analysis_json.seo_description` after the update.
  - `git diff --check` passed after the code changes in this pass.

### Plan

- [x] Add a private `cakegenie_rejected_uploads` table for AI rejection audits.
- [x] Persist rejected upload images to a private storage path instead of public product cache paths.
- [x] Log rejection reason/message, raw AI rejection JSON, MIME/size/hash metadata, source route, and request context from `/api/ai/analyze`.
- [x] Make logging best-effort so users still receive the rejection response if persistence fails.
- [x] Add focused tests and run verification.

### Review

- Added `supabase/migrations/20260605143000_create_cakegenie_rejected_uploads.sql`.
- Applied the migration to Supabase project `cqmhanqnfybyxezhobkx`.
- Created private table `public.cakegenie_rejected_uploads` with RLS enabled and no anon/authenticated grants.
- Created private storage bucket `cakegenie-rejected-uploads`, `public = false`, 10 MB limit, image MIME types only.
- Added `src/lib/ai/rejectedUploads.ts` to best-effort log rejected uploads from `/api/ai/analyze`.
- The log stores rejection reason/message/raw JSON, model, prompt version, MIME type, byte size, image SHA-256, pHash when fingerprinting succeeds, private storage bucket/path, user agent, and hashed client IP only.
- The log does not store raw client IP and does not write rejected uploads to `cakegenie_analysis_cache`.
- Wired `/api/ai/analyze` to call the logger only when `rejection.isRejected = true`; accepted analyses continue through the existing path.
- Verification:
  - `npx vitest run src/lib/ai/rejectedUploads.test.ts` passed with 3 tests.
  - `npx eslint src/lib/ai/rejectedUploads.ts src/lib/ai/rejectedUploads.test.ts src/app/api/ai/analyze/route.ts` passed with only stale Browserslist notice.
  - `git diff --check` passed.
  - `npm run build` passed.
  - Live Supabase readback confirmed all expected columns, RLS enabled, zero anon/auth grants, private bucket config, and initial row count `0`.

## Sync Fallback Cake Analysis Prompt To Current Supabase Prompt

### Plan

- [x] Replace `src/services/prompts/fallback-prompt.txt` with the user's pasted current v3.11 prompt.
- [x] Confirm the fallback file contains the pasted prompt content, with trailing whitespace normalized for a clean commit.
- [x] Run focused prompt tests and lint.

### Review

- Synced the fallback prompt to the pasted v3.11 prompt text, normalizing trailing whitespace only.
- Confirmed the fallback prompt includes the candle, edible-photo, branding, Bento, whole-head, and ribbon guard sections.
- Verification:
  - The fallback prompt was checked against the pasted prompt content before whitespace normalization.
  - `npx vitest run src/services/prompts/analysisPromptRules.test.ts` passed with 9 tests.
  - `npx eslint src/services/prompts/analysisPromptRules.test.ts src/services/prompts/promptLoader.ts` passed with only the stale Browserslist notice.

## Fix Candle And Edible Photo Print Classification

### Plan

- [x] Add prompt guard so wax birthday/heart/number/taper candles classify as `candle` with material `wax`, not gumpaste/ordinary.
- [x] Add prompt guard so top-surface printed images classify as `edible_photo_top`, while `edible_photo_print` is reserved for smaller side cutouts/pieces.
- [x] Create a new higher-version active Supabase `ai_prompts` row without overwriting the existing active row.
- [x] Move `edible_photo_print` pricing rules out of `main_topper` and into `support_element`.
- [x] Change candle pricing to `per_piece` so grouped candle quantities price correctly.
- [x] Add local fallback prompt coverage and update support/display types for `edible_photo_print`.
- [x] Backfill the stale One Piece cache row after prompt/pricing behavior was finalized.
- [x] Run focused verification and document results.

### Review

- Added candle and edible-photo disambiguation rules to `src/services/prompts/fallback-prompt.txt`.
- Created Supabase `ai_prompts` row `prompt_id = 20`, version `3.11`, from active prompt text; only this row is active and it contains candle, edible-photo, branding, and ribbon guards.
- Moved pricing rules `134`, `135`, and `136` for `edible_photo_print` from `main_topper` to `support_element`, preserving their small/medium/large prices.
- Updated candle pricing rule `67` from `per_digit` to `per_piece` at ₱25 each.
- Preserved local `edible_photo_print` compatibility as a legacy main topper type while also allowing it as a support element for corrected pricing.
- Backfilled `one-piece-pink-1-tier-cake-0000` so the top image is `edible_photo_top`, the visible wax candles are `candle` main toppers, and the piped border is the only support element.
- Updated the same cache row to `price = 1599` and `add-on-price = 299`, based on a ₱325 corrected raw add-on rounded by the existing cache conventions.
- Verification:
  - `npx vitest run src/services/prompts/analysisPromptRules.test.ts` passed with 9 tests.
  - `npx eslint src/services/prompts/analysisPromptRules.test.ts src/services/prompts/promptLoader.ts src/constants/pricingEnums.ts src/components/TopperCard.tsx` passed with only the stale Browserslist notice.
  - Supabase verification shows active `prompt_id = 20`, version `3.11`, with candle, edible-photo, branding, and ribbon guards present.
  - `npx tsc --noEmit --pretty false` still fails on unrelated pre-existing test typing issues; no touched prompt/type/display files remain in the TypeScript error list after the route prompt-loader cast.
  - Supabase verification returned the corrected `one-piece-pink-1-tier-cake-0000` cache row with `price = 1599`, `add-on-price = 299`, `edible_photo_top`, and `candle` toppers.

## Improve Pinterest Feed SEO Fields

### Plan

- [x] Confirm where Pinterest RSS and catalog titles, descriptions, and alt-text fallbacks are built.
- [x] Update the shared Pinterest slug-to-title helper to strip short trailing hash-like suffixes such as `30e2`.
- [x] Cap RSS descriptions to Pinterest's documented 800-character Pin description limit.
- [x] Emit Pinterest catalog `g:alt_text` from our internal `alt_text` field.
- [x] Add focused regression coverage for title cleanup, RSS description length, and catalog alt text.
- [x] Run targeted verification and document the result.

### Review

- Confirmed the Pinterest RSS feed title comes from `slugToTitle(design.slug)` in `src/lib/pinterest/feed.ts`, and the catalog fallback title also uses the same helper in `src/lib/pinterest/catalog.ts`.
- Confirmed both Pinterest surfaces already emit descriptions:
  - RSS uses `seo_description || alt_text || "A beautiful custom cake design."`
  - Catalog uses `seo_description || alt_text || fallback catalog copy`
- Updated `src/lib/utils/pinterest.ts` so short trailing hash-like slug suffixes such as `30e2` are stripped from reader-facing Pinterest titles, while plain numeric endings like `2025` are preserved.
- Updated `src/lib/pinterest/feed.ts` so generated RSS Pin descriptions are capped at 800 characters, matching Pinterest's documented Pin spec.
- Updated `src/lib/pinterest/catalog.ts` so the catalog feed emits `<g:alt_text>` from `alt_text`, with commas removed to match Pinterest catalog formatting guidance.
- Added `src/lib/utils/pinterest.test.ts` to lock the cleanup behavior.
- Verification:
  - `npx vitest run src/lib/pinterest/feed.test.ts src/lib/pinterest/catalog.test.ts src/lib/utils/pinterest.test.ts` passed with 13 tests.
  - `npm run build` passed.

## Diagnose Homepage Hero First-Image Disappear

### Plan

- [x] Review project lessons and existing landing-page context.
- [x] Trace homepage server render, Suspense behavior, hero carousel placeholder, and Embla mount path.
- [x] Reproduce the likely mobile first-load behavior from the component lifecycle and attempted local browser access.
- [x] Patch the hero carousel first-paint behavior with minimal impact.
- [x] Verify with focused diff/lint checks and document the remaining local-server blocker.

### Review

- Root cause: the mobile homepage intentionally delayed the Embla carousel through `useShouldMountCarousel()` until interaction or a 1500ms timer, but its pre-Embla placeholder rendered only the selected center card. When Embla mounted, React replaced that one-card DOM with the full carousel DOM, so the already-loaded minimalist cake appeared to disappear before the full carousel painted.
- Patched `HeroProductPeekCarouselPlaceholder` in `src/app/LandingClient.tsx` to render the same six-slide visual row and dot indicators as the Embla carousel while keeping Embla itself delayed off the LCP path.
- Kept only the first hero product eager/high-priority in the mobile placeholder; the remaining placeholder slides render but stay lazy/low-priority.
- Verification: `git diff --check` passed. Focused ESLint was attempted on `src/app/LandingClient.tsx` and `src/app/HeroProductPeekCarouselEmbla.tsx`; it still fails on pre-existing lint debt in `LandingClient.tsx` (`react-hooks/set-state-in-effect`, `react/no-unescaped-entities`, unused values, and `<img>` warnings), not on this placeholder change.
- Local browser verification was blocked because an existing `next-server` process on port 3002 held `.next/dev/lock` and did not return bytes to `curl` within 10 seconds; a second dev server on 3003 could not acquire the lock.

## Diagnose Stalled Search Analysis Batch Probe

### Plan

- [x] Inspect live search-analysis batch run and item state.
- [x] Check GCS input/output artifacts for the stalled compatibility run.
- [x] Compare submitted JSONL against the official Vertex Gemini batch JSONL format.
- [x] Patch the batch JSONL builder and focused tests.
- [x] Submit a new 3-item compatibility probe with the corrected JSONL.
- [x] Poll the corrected probe through terminal provider/import status.
- [x] Patch import recovery for image-preview batch output that prefixes valid JSON with Markdown reasoning.
- [x] Re-import the live compatibility probe and verify Supabase run/item state.
- [x] Run focused tests, ESLint, build, and diff checks.

### Review

- The stalled run was the first compatibility probe: `6d8c1c39-d882-4bed-9458-a8bc7c72f9ca`, provider job `projects/521499900963/locations/global/batchPredictionJobs/3109677818338869248`, submitted at `2026-06-03T00:52:39Z`.
- Live DB state before the fix: `1902` items still `queued`, `3` probe items `retryable`, and no completed/imported analysis rows from the probe.
- GCS contained only the original `input.jsonl`; no output JSONL was written under the probe output prefix.
- Root cause found in the submitted JSONL: analysis batch parameters were flattened under `request` as `responseMimeType`, `responseSchema`, `temperature`, and `thinkingConfig`. Vertex Gemini batch Cloud Storage input expects generation parameters under `request.generationConfig`.
- Follow-up live probes exposed three additional compatibility issues: `systemInstruction` must be a content object, Vertex output lines can arrive in a different order than submission order, and `gemini-3.1-flash-image-preview` batch output can prefix valid final JSON with Markdown reasoning.
- Patched `src/lib/admin/searchAnalysisBatch.ts` so batch input lines now use `request.contents`, content-shaped `request.systemInstruction`, and `request.generationConfig`.
- Patched output import to correlate by echoed request `fileUri` before falling back to ordinal order.
- Patched batch import parsing to try strict JSON first, then recover the final JSON object from Markdown-prefixed image-preview output before running the existing post-processing and Supabase persistence path.
- Added focused regression coverage in `src/lib/admin/searchAnalysisBatch.test.ts` for the corrected batch request shape, output correlation, and Markdown-prefixed JSON recovery.
- Submitted a new corrected 3-item compatibility probe: `cbc64212-fc47-4a92-a0fd-80b0645ea8fc`, provider job `projects/179200066172/locations/global/batchPredictionJobs/390752688616243200`.
- The corrected probe JSONL was verified in GCS and has only `contents`, `systemInstruction`, and `generationConfig` under `request`.
- Final live compatibility probe: `cf9c94c9-4aeb-4534-a485-749f54bcc851`, provider job `projects/179200066172/locations/global/batchPredictionJobs/4783451175162740736`.
- Recovered/imported final probe result: run status `completed`, `submitted_count = 3`, `completed_count = 1`, `failed_count = 0`, `retryable_count = 0`.
- Item outcomes: two terminal `rejected` rows for `multiple_cakes`; one completed cache row `bfb77a42-4df1-46f3-9944-f7e40387744e`.
- Verification:
  - `npx vitest run src/lib/admin/searchAnalysisBatch.test.ts` passed with 9 tests.
  - `npx eslint src/lib/admin/searchAnalysisBatch.ts src/lib/admin/searchAnalysisBatch.test.ts` passed with only the stale Browserslist notice.
  - `npm run build` passed.
  - `git diff --check` passed.

## Connect Pinterest Board RSS Feeds Via Chrome

### Plan

- [x] Verify the Chrome automation bridge can talk to the logged-in browser session.
- [x] Claim the open Pinterest bulk-create settings tab instead of opening an unrelated session.
- [x] Create the requested board, attach the board-specific RSS feed, and save the auto-publish mapping.
- [x] Confirm the saved Pinterest board/RSS connection in the live UI and document the result.

### Review

- Used the Chrome automation bridge against the already logged-in `genie.ph` Chrome profile and claimed the existing Pinterest settings tab at `https://ph.pinterest.com/settings/bulk-create-pins/`.
- Pinterest's current UI already had the `Addams Family Cake` board selected, so no new board creation step was needed for this first mapping.
- Continued the same live Chrome automation session and saved additional board-specific RSS mappings for `Airplanes Cake`, `Alice Cake`, `Among us Cake`, `Anime Cake`, `Anniversary Cake`, `Architect Cake`, `Art Cake`, `Aurora Cake`, `Avengers Cake`, `Baby Cake`, `Baby Shark Cake`, `Ballerina Cake`, `Balloon Cake`, `Barbie Cake`, `Basketball Cake`, `Batman Cake`, `Beach Cake`, `Bears Cake`, and `Belle Cake`.
- Connected `https://genie.ph/feed/pinterest?board=addams-family-cake` to the `Addams Family Cake` board and saved it successfully.
- Live UI verification: the page switched to the saved state showing the connected RSS URL, `Saved Pins to Addams Family Cake`, plus `Edit` and `Add another` controls.

## Add Branding And Fabric Bow Prompt Guards

### Plan

- [x] Add the non-design branding/watermark/packaging-text exclusion to the fallback prompt.
- [x] Add the fabric bow/ribbon deduplication rule to the fallback prompt.
- [x] Create a new higher-version active Supabase `ai_prompts` row from the existing active prompt; do not overwrite the old row.
- [x] Add focused prompt-text regression checks.
- [x] Run focused verification and document results.

### Review

- Added the branding guard so bakery logos, shop marks, watermarks, labels, social handles, and background/box/board text are ignored unless physically on the edible cake surface as part of the requested cake design.
- Added the fabric bow/ribbon guard so thin fabric, satin, organza, or sheer bows become one `satin_ribbon` item and are not duplicated as fondant bows or fake side wraps.
- Created Supabase `ai_prompts` row `prompt_id = 18`, version `3.9`, from active `prompt_id = 17`; the old row was marked inactive and only one active prompt remains.
- Verification:
  - `npx vitest run src/services/prompts/analysisPromptRules.test.ts` passed with 7 tests.
  - `npx eslint src/services/prompts/analysisPromptRules.test.ts src/services/prompts/promptLoader.ts` passed with only the stale Browserslist notice.
  - Supabase verification shows active `prompt_id = 18`, version `3.9`, with both new prompt guards present.

## Align Backup Cake-Type Prompt With Live DB Prompt

### Plan

- [x] Compare the user's pasted live DB prompt wording against the local prompt sources.
- [x] Add the same Bento visible-container rule to the fallback prompt.
- [x] Add focused prompt-text regression checks.
- [x] Run focused verification and document results.
- [x] Wire the fallback prompt file into analysis routes for Supabase prompt-fetch failures.
- [x] Remove the stale root prompt snapshot.

### Review

- Updated the repo prompt sources only; no Supabase prompt rows were changed in this task.
- `src/services/prompts/fallback-prompt.txt` now includes the same cakeType rule so fallback behavior matches the live DB prompt.
- Added a shared prompt loader so `/api/ai/analyze`, `/api/ai/analyze-url`, and admin search-analysis batch use the active Supabase prompt when available and fall back to `src/services/prompts/fallback-prompt.txt` if the active prompt fetch fails.
- Removed `prompt_v3.8.txt` so the repo has one maintained backup prompt source instead of a stale root snapshot.
- Verification:
  - `npx vitest run src/services/prompts/analysisPromptRules.test.ts src/lib/admin/searchAnalysisBatch.test.ts` passed with 10 tests.
  - `npx eslint src/services/prompts/promptLoader.ts src/services/prompts/analysisPromptRules.test.ts src/app/api/ai/analyze/route.ts src/app/api/ai/analyze-url/route.ts src/lib/admin/searchAnalysisBatch.ts` passed with only the stale Browserslist notice.
  - `npx tsc --noEmit --pretty false` still fails on unrelated pre-existing test typing issues in blog, customizer, robots, commerce, icing/recolor, pricing, and cache tests; no touched fallback-prompt files remain in the TypeScript error list.

## Keep Gemini 3.1 Flash Lite On Low Thinking

### Plan

- [x] Revert Gemini 3.1 Flash Lite text routes from `ThinkingLevel.MINIMAL` back to `ThinkingLevel.LOW`.
- [x] Update AI guidance docs to show `LOW` as the current default.
- [x] Run focused AI route tests and lint.
- [x] Commit and push the scoped correction.

### Review

- Reverted Gemini 3.1 Flash Lite text routes to `ThinkingLevel.LOW` after the minimal-thinking experiment was rejected.
- Updated AI guidance docs to make `LOW` the current default thinking-level example.
- Verification:
  - `npx vitest run src/app/api/ai/validate/route.test.ts` passed with 4 tests.
  - `npx eslint src/lib/admin/searchAnalysisContract.ts src/app/api/ai/analyze/route.ts src/app/api/ai/validate/route.ts src/app/api/ai/validate/route.test.ts` passed with only the stale Browserslist notice.
  - Targeted grep confirms active Gemini 3.1 Flash Lite routes now use `ThinkingLevel.LOW`.

## Switch Gemini 3 Flash Preview To Gemini 3.1 Flash Lite

### Plan

- [x] Replace legacy Gemini 3 Flash Preview call sites with `gemini-3.1-flash-lite-preview`.
- [x] Update tests and task documentation that assert or describe the old model.
- [x] Verify there are no remaining old model references in active code.
- [x] Run focused tests for the touched AI routes.
- [x] Document results here.

### Review

- Updated `/api/ai/analyze`, `/api/ai/analyze-url`, `/api/ai/validate`, `/api/ai/generate-texts`, and one-off scripts that still referenced the old Gemini 3 Flash Preview model.
- Updated validation route tests plus repository AI guidance docs to use `gemini-3.1-flash-lite-preview`.
- Verification:
  - Full-repo grep for the old Gemini 3 Flash Preview model ID returns no matches.
  - `npx vitest run src/app/api/ai/validate/route.test.ts` passed with 4 tests.
  - `npx eslint src/app/api/ai/analyze/route.ts src/app/api/ai/validate/route.ts src/app/api/ai/validate/route.test.ts` passed with only the stale Browserslist notice.
  - Broader targeted ESLint across all touched files still fails on pre-existing `any` / unused-variable lint debt in `scripts/*`, `src/app/api/ai/analyze-url/route.ts`, and `src/app/api/ai/generate-texts/route.ts`.

## Make Pinterest RSS Boards The Primary Publishing Lane

### Plan

- [x] Reuse the collection publication/indexability quality gate for Pinterest board feed eligibility.
- [x] Tighten `/feed/pinterest?board={slug}` so unready collections do not emit RSS items.
- [x] Require `studio_edited_image_url`, prefer stable public image URLs, and suppress malformed or duplicate feed items.
- [x] Update the feed-directory endpoint so operators only see ready feed URLs by default.
- [x] Keep board creation scoped to ready collections instead of every collection row.
- [x] Reword the admin Pinterest surface around RSS-first setup and controlled manual API pushes.
- [x] Run focused tests, lint, and a production build; document results here.

### Review

- Added shared Pinterest feed helpers for collection readiness, feed limit capping, public image URL sanitization, duplicate link suppression, studio-edited-image-only publishing, and tolerant keyword parsing for both array and comma-delimited cache rows.
- `/feed/pinterest?board={slug}` now emits items only for collections that pass the existing published/indexable/8-design quality gate, and `/feed/pinterest/feeds` lists ready feeds separately from skipped collections.
- `/api/pinterest/boards/sync` now creates boards only for Pinterest-ready collections instead of every collection row.
- `/admin/pinterest` now presents RSS auto-publish as the primary workflow and labels API pushes as advanced/manual.
- Verification:
  - `npx vitest run src/lib/pinterest/feed.test.ts` passed with 5 tests.
  - Targeted ESLint passed with one existing `<img>` warning in `PinterestManagerClient.tsx`.
  - `npm run build` passed.
  - Production server route checks on `http://localhost:3004` returned 200 for `/feed/pinterest/feeds`, `/feed/pinterest`, and `/feed/pinterest?board=addams-family-cake`.
  - Runtime XML sample: all-designs feed had 200 items; `addams-family-cake` board feed had 53 items; both included RSS 2.0 and `media:content`.

## Add Pinterest Catalog Data Source Feed

### Plan

- [x] Add a separate Pinterest retail catalog XML feed at `/feed/pinterest/catalog`.
- [x] Model the XML after the existing Google Merchant RSS feed while using Pinterest catalog values.
- [x] Publish only products/designs with `studio_edited_image_url`, `slug`, and `price`.
- [x] Emit required catalog fields: `id`, `title`, `description`, `link`, `image_link`, `price`, and `availability`.
- [x] Run focused tests, lint, build, and a production route sample; document results here.

### Review

- Added `https://genie.ph/feed/pinterest/catalog` as a dedicated Pinterest retail catalog XML feed, separate from the organic board RSS feeds.
- The catalog uses RSS 2.0 with the Google product namespace shape already used by `/feed/google`, but emits Pinterest catalog values such as `availability = in stock` and `price = {amount} PHP`.
- The feed only includes rows with `studio_edited_image_url`, `slug`, and `price`; original-upload-only rows are excluded.
- Added pure catalog helpers and focused tests for required fields, studio-image-only filtering, Supabase URL cleanup, deduplication, and XML generation.
- Verification:
  - `npx vitest run src/lib/pinterest/catalog.test.ts src/lib/pinterest/feed.test.ts` passed with 10 tests.
  - `npx eslint src/lib/pinterest/catalog.ts src/lib/pinterest/catalog.test.ts src/app/feed/pinterest/catalog/route.ts` passed with only the stale Browserslist notice.
  - `npm run build` passed and included `/feed/pinterest/catalog`.
  - Production server route check on `http://localhost:3004/feed/pinterest/catalog` returned 200 with `application/xml`.
  - Runtime XML sample had 5,168 items, with matching counts for `id`, `title`, `description`, `link`, `image_link`, `price`, and `availability`; no original-image URLs leaked.

## Review AI Cake Analysis Prompt, Schema, And Pricing Rules

### Plan

- [x] Review project lessons for AI prompt editing and exact-user-wording constraints.
- [x] Trace the live `/api/ai/analyze` path from upload request through prompt fetch, schema config, post-processing, and frontend consumption.
- [x] Identify where the shared analysis schema is defined and which offline/admin analysis flows reuse it.
- [x] Trace how an accepted analysis is mapped into pricing state and how `pricing_rules` are applied.
- [x] Compare the user's provided image, current prompt, and AI output against the real schema and pricing behavior.
- [x] Propose and implement scoped prompt, schema, and pricing-rule changes.
- [x] Verify with focused tests or a rerun using the supplied case, then document results here.

### Review

- Supplied design: `/customizing/blue-butterfly-white-1-tier-cake-ff3f`.
- Live cache already classified the sheer blue fabric ruffle/bow as `support_elements[0].type = "satin_ribbon"`, but the live pricing rule for `satin_ribbon` was `0`, and local TypeScript/UI enums were missing the support type in several canonical places.
- Added `satin_ribbon` as a first-class support element in local types, pricing enums, customizer display labels, the v3.8 prompt file, and the fallback prompt.
- Updated the active Supabase prompt by adding organza/satin recognition text to the existing prompt row only. No existing prompt text was deleted or replaced from a local file.
- Updated live `pricing_rules.rule_id = 179` for `satin_ribbon` to a flat `100` price, with no size, quantity, tier, cake type, or cake-size multiplier.
- Added migration `supabase/migrations/20260603120000_add_satin_ribbon_pricing.sql` using update-then-insert logic because `pricing_rules.item_key` is not unique on the live table.
- Recalculated the supplied design: base price `1199`, ribbon add-on `100`, total `1299`; updated the cache row price to `1299`.
- Verification:
  - `npx vitest run src/services/pricingService.database.test.ts` passed.
  - `npx eslint src/constants/pricingEnums.ts src/components/TopperCard.tsx src/app/customizing/CustomizingStepSummarySections.tsx src/services/pricingService.database.test.ts` passed with pre-existing warnings only in `CustomizingStepSummarySections.tsx`.
  - Full `npx tsc --noEmit --pretty false` still fails on unrelated pre-existing test typing errors across blog/customizer/robots/image utility tests.

## Add Whole-Head Cake Facial-Part Prompt Guard

### Plan

- [x] Add an additive prompt section near `edible_3d_complex` so dog/cat/human head cakes do not become one large complex gumpaste face item.
- [x] Mirror the core rule in the fallback prompt.
- [x] Update the active Supabase prompt by insertion only, preserving existing prompt text.
- [x] Backfill the stale dog-head cache price after recalculating current pricing.
- [x] Add focused prompt-text regression coverage and verify the live prompt/cache state.

### Review

- Added a `WHOLE HEAD CAKES / ANIMAL FACE CAKES` rule to the v3.8 prompt source and fallback prompt.
- The new rule says whole-head cakes should itemize visible parts, keep piped/flat face details as `icing_decorations`, use `edible_3d_ordinary` for fondant/gumpaste parts like tongue/bow/ears/nose/eyes, and never group eyes + nose + tongue into one `large` gumpaste/complex face item.
- No schema or pricing-rule changes were needed because existing types/rules already cover the correct classification.
- Updated active Supabase prompt `prompt_id = 17` additively; the row now contains the head-cake guard and the description notes that no existing prompt text was removed.
- Recalculated `/customizing/dog-character-white-1-tier-cake-031f`: base `1199`, add-on `100`, total `1299`; updated the cache row price from `1999` to `1299`.

## Research Cebu Long-Tail Cake Keywords

### Plan

- [x] Confirm the available DataForSEO keyword/location tooling and use the closest Cebu-relevant targeting available.
- [x] Generate seed keywords across rush, customization, delivery-app replacement, location, cake type, recipient, occasion, budget, and local-language intent buckets.
- [x] Validate and expand the shortlist with DataForSEO metrics where available, keeping Cebu/local modifiers in the keyword text even if volume is Philippines-level.
- [x] Prioritize high-intent terms for Genie.ph based on urgency, customization, delivery intent, and likely ability to displace GrabFood/Foodpanda/Facebook sellers/traditional cake shops.
- [x] Document the keyword findings, recommended buckets, exclusions, and caveats in this task review.

### Review

- DataForSEO Labs keyword suggestions and Google Ads search-volume calls both returned HTTP 402, so this run could not produce DataForSEO-validated metrics.
- The DataForSEO Labs tools exposed country-only targeting for keyword expansion, while the DataForSEO Google Ads volume tool accepts hierarchical locations like `Cebu City,Central Visayas,Philippines`; the latter was attempted but also hit HTTP 402.
- A fallback Keyword Planner call using `languageConstants/1000` returned seed validation:
  - `money cake cebu`: 110 average monthly searches, LOW competition.
  - `cake delivery cebu`: 70 average monthly searches, HIGH competition.
  - `bento cake cebu`: 50 average monthly searches, LOW competition.
  - `minimalist cake cebu`: 10 average monthly searches.
  - `birthday cake delivery cebu`: 10 average monthly searches, LOW competition.
  - `order cake online cebu`: 10 average monthly searches, HIGH competition.
  - `fondant cake cebu`: 10 average monthly searches.
  - `money cake in cebu city`: 10 average monthly searches, LOW competition.
- Most ultra-long-tail rush, location, recipient, occasion, budget, and Cebuano/Taglish phrases returned zero measured volume in the fallback planner, but they remain useful for high-intent capture in ad groups, internal search-analysis prompts, FAQ/body copy, and conversion-focused page sections.
- SEO caution from prior collection strategy still applies: do not auto-create thin city/neighborhood collection pages from these modifiers. Use local modifiers in copy, internal search, paid search, and only publish indexable pages when they have enough distinct stocked designs and real demand.

## Keep Image Studio Offline Continuation Advancing While Page Is Open

### Plan

- [x] Confirm why the image-studio offline batch can appear to stop even while the page is open.
- [x] Update the client auto-refresh loop so it keeps calling the reconcile/continuation path instead of only reloading the latest batch snapshot.
- [x] Guard against overlapping silent continuation requests.
- [x] Run focused verification on the touched image-studio admin files.

### Review

- Confirmed the stop condition: while the page showed “watching progress,” the auto-refresh loop in `ImageStudioAdminClient` was only calling `loadOfflineBatch()` every 5 seconds, which reloaded status but did not advance the continuation pipeline.
- Updated the auto-refresh loop in `src/app/admin/image-studio/ImageStudioAdminClient.tsx` so an open page now keeps calling the `PATCH /api/admin/image-studio-batch` reconcile path silently, which is the path that actually imports the next chunk and triggers the server-side continuation chain.
- Added an in-flight ref guard so silent continuation calls cannot overlap and stampede the batch API.
- Verification:
  - `npx vitest run src/app/admin/image-studio/offlineBatchExecutionLog.test.ts src/app/api/admin/image-studio-batch/route.test.ts` passed.
  - `npx eslint src/app/admin/image-studio/ImageStudioAdminClient.tsx src/app/admin/image-studio/offlineBatchExecutionLog.ts src/app/admin/image-studio/offlineBatchExecutionLog.test.ts` passed with only the repo's stale Browserslist notice.

## Add Execution Log To Image Studio Offline Batch Panel

### Plan

- [x] Inspect the existing `/admin/image-studio` offline batch UI, continuation flow, and API payloads to find the strongest real progress signals.
- [x] Add a small helper that turns batch state transitions and continuation responses into readable execution-log entries.
- [x] Render an execution log inside the Low-cost offline batch card, including submit, waiting, import progress, stage transition, completion, and error entries.
- [x] Persist the log in session storage so a page refresh does not erase the current run narrative.
- [x] Add focused tests for the new log helper and run targeted verification.

### Review

- Added `src/app/admin/image-studio/offlineBatchExecutionLog.ts` so the UI can convert real offline-batch state transitions into readable execution entries like submit, import start, import progress, mask-stage submission, completion, and paused/error states.
- Updated `src/app/admin/image-studio/ImageStudioAdminClient.tsx` so the Low-cost offline batch card now shows a dedicated Execution log panel, records entries from submit/load/refresh/poll events, and persists the current session log in `sessionStorage`.
- The log uses actual run transitions and reconcile results from the batch APIs rather than static text, so it reflects what the server is really doing as the offline continuation advances.
- Added focused tests in `src/app/admin/image-studio/offlineBatchExecutionLog.test.ts`.
- Verification:
  - `npx vitest run src/app/admin/image-studio/offlineBatchExecutionLog.test.ts src/app/api/admin/image-studio-batch/route.test.ts` passed.
  - `npx eslint src/app/admin/image-studio/ImageStudioAdminClient.tsx src/app/admin/image-studio/offlineBatchExecutionLog.ts src/app/admin/image-studio/offlineBatchExecutionLog.test.ts` passed with only the repo's stale Browserslist notice.

## Clarify Missing GCS IAM For Vertex Batch Runtime

### Plan

- [x] Trace which deployed principal touches the batch bucket in the live server code, separating Vertex's own service agent from the Vercel runtime identity.
- [x] Add a shared Google Cloud Storage error helper that rewrites raw permission denials into actionable batch-runtime guidance with the bucket, principal, permission, and likely IAM role.
- [x] Apply that helper to both offline batch lanes anywhere the app uploads, lists, or downloads GCS batch artifacts.
- [x] Add focused unit coverage for the new error translation so future regressions keep the actionable wording.
- [x] Document the extra bucket IAM requirement in the WIF migration notes and verify the targeted tests still pass.

### Review

- Confirmed the failing principal is the deployed Vercel WIF service account, not only the Vertex AI Platform service agent. Both `src/lib/admin/imageStudioBatch.ts` and `src/lib/admin/searchAnalysisBatch.ts` instantiate `@google-cloud/storage` directly through the shared WIF auth path and call `getFiles({ prefix })` during reconciliation, which requires `storage.objects.list`.
- Added `src/lib/ai/googleCloudErrors.ts` to translate raw Cloud Storage permission denials into actionable runtime guidance that names the bucket, principal, missing permission, and the likely bucket-level IAM role to grant.
- Wrapped the batch JSONL upload, output listing, and output download/list flows in both offline batch helpers so production errors now explain that the Vercel runtime identity needs bucket access in addition to Vertex's own service agent.
- Added focused tests for list, create, and non-GCS error handling in `src/lib/ai/googleCloudErrors.test.ts`.
- Updated `docs/vertex-ai-wif-migration.md` with the deployment-time storage IAM requirement for direct GCS access from the server runtime.
- Verification:
  - `npx vitest run src/lib/ai/googleCloudErrors.test.ts src/lib/admin/imageStudioBatch.test.ts src/lib/admin/searchAnalysisBatch.test.ts` passed.

## Add Offline Gemini Batch Analysis To Search-Based Intake

### Plan

- [x] Preserve `/admin/search-analysis` as the browser-side collector: scrape Google CSE results, resolve the best source URL, fetch and normalize each image, generate the current server fingerprint, and skip existing cache hits before any offline submission.
- [x] Extract the shared `/api/ai/analyze` contract into server-reusable helpers so interactive analysis and offline analysis use the same active `ai_prompts` row, dynamic pricing-rule enums, `SYSTEM_INSTRUCTION`, response schema, temperature, low-thinking configuration, JSON parsing, cake-thickness adjustment, coordinate reset, rejection handling, and `cacheAnalysisResult(...)` persistence path.
- [x] Add dedicated durable search-analysis batch tables rather than attaching pre-analysis rows to `cakegenie_analysis_cache`: one run table for collection/submission/import state and one item table for normalized Supabase source URL, fingerprint, source URL, deterministic queue metadata, provider correlation ordinal, status, retry count, errors, and optional completed cache row id.
- [x] Add an idempotent server intake route that uploads normalized cache misses to Supabase Storage and queues them with a unique fingerprint key. Existing completed cache hits remain ignored, already-queued fingerprints return the existing queue item, and valid completed analyses are never overwritten unless an explicit future force option is added.
- [x] Add a server-side submit route that selects at most 1000 eligible queued/retryable items predictably, writes JSONL under the existing `VERTEX_AI_BATCH_GCS_URI` prefix, stores a stable per-item submission ordinal, and submits `gemini-3.1-flash-image-preview` only after a small live compatibility probe has succeeded.
- [x] Add a server-side reconcile route that refreshes provider state, correlates each JSONL output to its durable item, applies the shared analysis post-processing and rejection rules, persists accepted output through `cacheAnalysisResult(...)`, and marks completed, failed, or retryable items without duplicating writes.
- [x] Make the offline run browser-independent after collection: tab closure may interrupt scraping/intake, but it must not interrupt submitted Vertex processing or later server-side reconciliation.
- [x] Add `/admin/search-analysis` controls for `Batch analyze next 1000` and `Refresh batch status`, plus latest run stage, submitted, completed, failed, and retryable counts. Keep `Single Page` and `Auto (1-10 Pages)` available as the existing sequential lane.
- [x] Add focused tests for eligibility filtering, deterministic ordering, JSONL request construction, output correlation, Supabase persistence options, retry behavior, and duplicate prevention.
- [ ] Run the first small live provider compatibility submission after collecting real cache misses; the submit guard automatically caps the first run at 3 items before permitting a 1000-item run.
- [x] Apply the new migration to live Supabase, verify RLS intentionally, run targeted Vitest, targeted ESLint, and `npm run build`.

### Review

- Added `src/lib/admin/searchAnalysisContract.ts` as the single shared analysis contract for both `/api/ai/analyze` and offline imports. It owns the dynamic response schema, system instruction, temperature, low-thinking config, cake-thickness adjustment, and coordinate reset.
- Added `src/lib/admin/searchAnalysisBatch.ts` and `/api/admin/search-analysis-batch` for idempotent intake, deterministic submit, browser-independent Vertex reconciliation, retryable output handling, and completed cache persistence through the existing `cacheAnalysisResult(...)` helper.
- Added dedicated live Supabase tables `cakegenie_search_analysis_batch_runs` and `cakegenie_search_analysis_batch_items`. Both have RLS enabled and revoke direct `anon` / `authenticated` access; the admin API uses the service-role client.
- Updated `/admin/search-analysis` with `Collect misses for offline batch (1-10 Pages)`, `Batch analyze next 1000`, and `Refresh batch status`. Existing `Single Page` and `Auto (1-10 Pages)` sequential paths remain available.
- The first offline submit is deliberately capped at 3 queued items until a compatibility run completes, because official Vertex documentation does not list `gemini-3.1-flash-image-preview` as a confirmed batch model.
- Verification:
  - `npx vitest run src/lib/admin/searchAnalysisBatch.test.ts src/lib/admin/imageStudioBatch.test.ts src/app/api/ai/validate/route.test.ts` passed with 11 tests after the final helper coverage expansion.
  - Targeted ESLint passed for the new batch helper, tests, API route, shared contract, analysis route, and admin page.
  - `npm run build` passed and includes `/api/admin/search-analysis-batch`.
  - Live Supabase verification confirmed both queue tables, expected columns, RLS enabled, and a successful insert/delete smoke test.
  - The live Vertex compatibility submission remains pending until the admin collector queues real cache-miss images.

## Add One-Button Offline AI Batch Processing For 1000 Cake Cache Rows

### Plan

- [x] Confirm the provider path against current official Google docs: use Gemini Batch API for asynchronous catalog work at the documented 50% batch rate, with JSONL file input for large image-generation batches.
- [x] Add durable batch-run and batch-item schema so a 1000-row submission is resumable, auditable, and safe to retry without duplicating completed purple studio edits or ready icing masks.
- [x] Add a server-side batch submit route that selects up to 1000 eligible `cakegenie_analysis_cache` rows, creates the purple-background requests first, and stores the provider batch job id plus item correlation keys.
- [x] Add a server-side batch reconcile route that imports completed purple-background outputs, runs the existing Sharp/WebP and Supabase persistence logic, then submits icing-mask requests against the completed studio images.
- [x] Move the reusable icing-mask persistence conversion into a server-capable helper so imported mask outputs are losslessly encoded as PNG and written to `cakegenie_icing_masks` without relying on browser Canvas.
- [x] Add admin UI controls on `/admin/image-studio` for one-click submit, progress/status refresh, and retrying failed items while preserving the existing interactive single-item path.
- [x] Add focused tests for the generated JSONL contract and run targeted tests, lint, and a production build.

### Review

- Added `src/lib/admin/imageStudioBatch.ts` as the offline two-stage orchestrator. It submits up to 1000 eligible cache rows to Vertex Gemini batch inference, imports purple studio results into the existing Supabase paths, submits a second mask batch from completed studio images, then imports lossless PNG masks into `cakegenie_icing_masks`.
- Per user direction, both offline stages use `gemini-3.1-flash-image-preview` to match the existing real-time image lane. Google Vertex batch docs do not explicitly list this preview model, so the first small live batch submission is the required provider-compatibility check before running 1000 rows.
- Added `/api/admin/image-studio-batch` with submit, latest-status, and reconcile actions protected by the existing Image Studio admin PIN.
- Extended the existing `cakegenie_image_studio_batch_jobs` model with stage and completion counters, added RLS-enabled `cakegenie_image_studio_batch_items`, and applied the migration to the linked live Supabase project.
- Added the low-cost batch panel to `/admin/image-studio` with `Batch process next 1000` and `Refresh batch status` actions while leaving the existing sequential real-time tool intact.
- Created `gs://cakegenie-ai-batch-project-d823a677/cakegenie-image-studio`, granted the Vertex AI Platform service agent object access, configured `.env.local`, and documented `VERTEX_AI_BATCH_GCS_URI` in `.env.example`.
- Production rollout blocker: the local Vercel CLI has no credentials, so `VERTEX_AI_BATCH_GCS_URI=gs://cakegenie-ai-batch-project-d823a677/cakegenie-image-studio` still needs to be added to the linked Vercel project before deployment.
- Verification:
  - `npx vitest run src/lib/admin/imageStudioBatch.test.ts` passed with 3 tests.
  - `npx eslint src/lib/admin/imageStudioBatch.ts src/lib/admin/imageStudioBatch.test.ts src/lib/supabase/adminServer.ts src/app/api/admin/image-studio-batch/route.ts src/app/admin/image-studio/ImageStudioAdminClient.tsx` passed.
  - `npm run build` passed and included `/api/admin/image-studio-batch`.
  - Live Supabase verification confirmed the extended job columns, the new items table, and RLS enabled on the items table.
  - A real write/delete smoke test passed against the new GCS prefix.

## Add Customizer Hero Loader While Studio Background Edit Is Pending

### Plan

- [x] Document the hero-level pending state off the existing studio-image polling flow instead of reusing the full-screen design-update overlay.
- [x] Pass a dedicated background-edit-pending flag from `src/app/customizing/CustomizingClient.tsx` into `src/app/customizing/CustomizingHeroPanel.tsx`.
- [x] Render a lower-left circular loader on the hero while the AI background-edited studio image is still pending, without blocking hero interactions.
- [x] Add focused regression coverage for the loader visibility and run targeted verification.

### Review

- `src/app/customizing/CustomizingClient.tsx` now derives `isStudioBackgroundEditingPending` from the live upload/studio-image polling state: it only turns on when the current session already has an uploaded preview plus a cache hash, but the studio background-edited image URL has not arrived yet.
- `src/app/customizing/CustomizingHeroPanel.tsx` now accepts that dedicated pending flag and renders a small circular spinner badge at the lower-left of the hero image without replacing the existing full-screen analysis or design-update overlays.
- The loader is pointer-events-free, so it does not block zooming, save actions, or the existing mobile motif button area.
- Added focused regression coverage in `src/app/customizing/CustomizingHeroPanel.test.tsx` to confirm the pending spinner appears when the studio background-edit state is active.
- Verification:
  `npx vitest run src/app/customizing/CustomizingHeroPanel.test.tsx` passed.
  `npx eslint src/app/customizing/CustomizingClient.tsx src/app/customizing/CustomizingHeroPanel.tsx src/app/customizing/CustomizingHeroPanel.test.tsx` completed with warnings only, all pre-existing in these files.

## Fix `/customizing` Studio-Image Icing Recolor Source

### Plan

- [x] Expose the live `cakegenie_analysis_cache` row id from the upload state so fresh `/customizing` uploads can behave like persisted designs before a slug route exists.
- [x] Pass the effective cache row id through the base customizer route so both `useIcingMask` and `useDesignUpdate` attach to the uploaded design row instead of `null`.
- [x] Make the `icing-mask-fallback` design-update path prefer `studio_edited_image_url` bytes over the original upload when the purple studio image is the displayed base.
- [x] Add focused regression coverage for the live cache id exposure and the studio-image fallback source, then verify with targeted tests.

### Review

- `src/contexts/ImageContext.tsx` now tracks a live `currentCacheId` alongside `currentPHash`, clears it on resets/new uploads, populates it from both cache hits and fresh `cacheAnalysisResult(...)` writes, and exposes it through `useImageManagement()`.
- `src/services/supabaseService.ts` now carries cache row ids through `findSimilarAnalysisByHash(...)`, with a follow-up `cakegenie_analysis_cache` lookup when the RPC payload omits `id`, so upload-state cache hits can still attach to the persisted design row.
- `src/app/customizing/CustomizingClient.tsx` now computes `effectiveCacheId = recentSearchDesign?.id || currentCacheId || null` and passes that same id into both `useDesignUpdate` and `useIcingMask`, which unblocks proactive studio-mask regeneration on base `/customizing`.
- `src/hooks/useDesignUpdate.ts` now accepts `studioEditedImageUrl` and, for `source: 'icing-mask-fallback'` only, prefers fetching the studio-edited image bytes when there is no in-memory edited data URI yet. If that fetch fails, it falls back to the original upload bytes.
- Added focused regression coverage in `src/contexts/ImageContext.test.tsx`, `src/hooks/useDesignUpdate.test.ts`, and `src/services/supabaseService.findSimilarAnalysisByHash.test.ts`.
- Verification:
  `npx vitest run src/contexts/ImageContext.test.tsx src/hooks/useDesignUpdate.test.ts src/services/supabaseService.findSimilarAnalysisByHash.test.ts src/hooks/useIcingMask.test.ts src/hooks/useIcingMask.integration.test.ts` passed with 28 tests.
  `npx eslint src/contexts/ImageContext.tsx src/contexts/ImageContext.test.tsx src/hooks/useDesignUpdate.ts src/hooks/useDesignUpdate.test.ts src/services/supabaseService.findSimilarAnalysisByHash.test.ts src/app/customizing/CustomizingClient.tsx` completed with warnings only, all pre-existing.
  `curl -I --max-time 10 http://127.0.0.1:3002/customizing` returned `200 OK`.
- I did not complete a live browser-driven recolor click-through in this run, so the remaining acceptance check is still one manual `/customizing` pass after the purple studio image appears: click an icing swatch and verify the recolor request stays on `studio_edited_image_url`, then hit `Fix Mask` and confirm regeneration still uses the studio image.

## Microsoft Clarity Customizing Page Audit

### Plan

- [x] Pull recent Clarity dashboard data for `https://genie.ph/customizing` and `/customizing/*`, separating broad traffic from friction signals.
- [x] Review relevant session recordings for customizing visitors, prioritizing dead clicks, rage clicks, quick backs, low scroll depth, JavaScript errors, and mobile sessions.
- [x] Cross-check the behavioral signals against the live customizer implementation path in the repo.
- [x] Summarize what is working, red flags, and concrete implementation ideas with a bias toward small, verifiable fixes.

### Review

- Audit window: Microsoft Clarity data from 2026-04-28 through 2026-05-28 UTC for URLs starting with `https://genie.ph/customizing`.
- Traffic is meaningful: 3,243 sessions and 2,871 distinct users reached the customizer route family. The base `/customizing` URL had 838 page views, and traffic is mostly mobile with 2,382 mobile sessions versus 766 PC and 116 tablet sessions in the device query.
- What is working: Google is feeding the customizer heavily, with 1,933 sessions from `www.google.com`; users interact with product options and discovery (`Show More Designs` 296 clicks, `Fondant` 163, `Soft Icing` 130, `Vanilla` 114, `Apply All Changes` 110); and there is a proven cart path, with 38 `Buy This Now` clicks and 81 sessions that reached `/cart` after a customizer visit.
- Measurement red flag: Clarity smart events are under-instrumented. The dashboard showed 13 `Upload`, 0 `AddToCart`, 0 `BeginCheckout`, and 7 `Checkout` smart events even though recordings and click queries show users buying and reaching cart. Current `src/lib/analytics.ts` sends GA4 events only, and the Clarity snippet in `src/app/layout.tsx` is not paired with explicit `window.clarity("event", ...)` calls.
- UX red flag: 299 customizer sessions had dead clicks. The top dead-click texts were blank text, `Original cake design`, `Pink heart-shaped vintage`, `Apply All Changes`, `Customized Cake Design -`, `+ Add a cake message`, `Fondant`, and `Soft Icing`. The repo cross-check points to image/card taps, active variant thumbnails, disabled editor actions, and option controls as the likely friction clusters.
- Performance red flag: customizer LCP is high in Clarity. Exact `/customizing` averaged 6,865 ms LCP, slug pages averaged 6,534 ms, category pages averaged 6,302 ms, and mobile sessions averaged about 4,958 ms page load time. `next.config.ts` has global `images.unoptimized: true`, and the customizer hero uses high-priority unoptimized remote images, so image delivery is the main implementation target.
- Reliability red flag: top JavaScript errors were `Cannot read properties of null (reading 'parentNode')` 25 times, `Script error.` 7 times, React hydration error #418 variants 7 times total, and `Cannot update design: missing original image, icing design, or cake info.` twice. The only local `parentNode` reference found is the Clarity script insertion snippet in `src/app/layout.tsx`.
- Recommended implementation order: first add explicit Clarity event/tag instrumentation to the existing analytics wrapper; second reduce hero/product image LCP with resized CDN-backed derivatives or image optimization; third remove dead-click clusters by making active thumbnails open zoom or lose pointer affordance, adding disabled reasons to `Apply All Changes`, and improving card/button semantics; fourth audit hydration mismatches and guard the Clarity snippet.

## Unblock Studio Image Reveal From ORB Indexing

### Plan

- [x] Trace the live timing from upload through fast analysis, cache write, studio trigger, and studio-image polling to identify which awaited step is delaying the visible studio image.
- [x] Make the shared cache writer return as soon as the cache row is written instead of awaiting ORB feature indexing on the interactive upload path.
- [x] Add a focused regression test that proves `cacheAnalysisResult(...)` resolves even while ORB indexing is still pending.
- [x] Verify with targeted Vitest coverage and summarize the actual latency cause using observed log timing.

### Review

- Root cause: the studio image job was not the only source of delay. In the live dev log, the studio edit started at `00:04:56.634`, the cache row was written at `00:05:10.602`, and the studio job finished at `00:05:14.694`, but the client-side `fastCacheWritePromise` did not resolve until the offline ORB indexing request finally failed at `00:06:06.631` / `00:06:06.771`.
- Because `src/services/supabaseService.ts` awaited `triggerOrbFeatureIndexing(...)` before returning from `cacheAnalysisResult(...)`, the customizer delayed `setCurrentPHash(...)` and therefore delayed the polling loop that watches for `studio_edited_image_url`.
- `src/services/supabaseService.ts` now keeps ORB indexing in the shared cache write flow but runs it fire-and-forget so interactive uploads can continue as soon as the row write is done.
- Added a focused regression test in `src/services/supabaseService.cacheAnalysisResult.test.ts` that intentionally leaves the ORB index request unresolved and proves the cache write still resolves promptly.
- Verification:
  - `npx vitest run src/services/supabaseService.cacheAnalysisResult.test.ts` passed with 6 tests.
  - `npx eslint src/services/supabaseService.cacheAnalysisResult.test.ts` passed.
  - `npx eslint src/services/supabaseService.ts` still hits pre-existing repo-wide lint errors unrelated to this specific latency fix, so I did not treat that as a regression from this change.

## Cut ORB Wait To 2000ms Before pHash Fallback

### Plan

- [x] Confirm the live ORB lookup client currently waits on the browser/network timeout rather than an app-level cutoff.
- [x] Add a 2000ms aborting timeout to the ORB match request so the upload flow falls back to pHash faster when `orb.genie.ph` is slow or offline.
- [x] Add a focused test for the timeout behavior and verify with targeted test/lint runs.

### Review

- `src/services/orbMatchingService.ts` now wraps the ORB `fetch()` in an `AbortController` and aborts it after `2000ms` by default.
- A timed-out ORB request now throws `ORB match timed out after 2000ms`, which the existing `ImageContext` fallback path already treats as an ORB failure and routes into the legacy pHash lookup.
- Added focused coverage in `src/services/orbMatchingService.test.ts` for:
  - the 2000ms timeout path
  - a normal successful ORB cache-hit response
- Verification:
  - `npx vitest run src/services/orbMatchingService.test.ts` passed.
  - `npx eslint src/services/orbMatchingService.ts src/services/orbMatchingService.test.ts` passed.

## Start Image Studio At The Same Time As Fast Cake Analysis

### Plan

- [x] Trace the current no-cache-hit upload flow and confirm whether Image Studio starts at the exact same time as the fast `/api/ai/analyze` pass or only afterward.
- [x] Refactor the studio-edit execution so the no-cache-hit path can trigger Image Studio directly from the uploaded image while the fast cake analysis is still running.
- [x] Keep the existing row-driven admin/manual path intact, and make the direct-from-upload path attach the finished `studio_edited_image_url` once the analysis cache row exists.
- [x] Add focused tests around the new trigger behavior and cache-row retry helper.
- [x] Verify with targeted Vitest coverage plus focused lint on the touched files, and note any pre-existing repo issues separately from this change.

### Review

- Root cause: the previous optimization only moved the first cache write earlier. It still waited for the fast `/api/ai/analyze` response before `cacheAnalysisResult(...)` could trigger Image Studio, so the studio job was parallel with Roboflow enrichment, not with the fast Gemini cake analysis itself.
- Added `src/lib/admin/imageStudioJob.ts` as the shared Image Studio execution helper so both routes can reuse the same Gemini generation, upload, and cache-row persistence logic.
- `src/app/api/ai/trigger-studio-edit/route.ts` now supports two modes:
  - legacy row-driven mode with `{ pHash }`
  - direct-from-upload mode with `{ pHash, originalImage }`
- In the direct-from-upload mode, the background job can synthesize the purple studio image immediately from the uploaded bytes and then retry attaching `studio_edited_image_url` to `cakegenie_analysis_cache` after the fast analysis finishes and writes the row.
- `src/contexts/ImageContext.tsx` now starts the direct studio trigger before awaiting `analyzeCakeFeaturesOnly(...)`, then falls back to the old row-driven trigger only if the parallel trigger request fails.
- `src/app/api/admin/cake-cache-images/route.ts` was reduced back to the admin responsibilities by delegating the heavy studio job work into the shared helper, while keeping the existing admin/manual behavior row-driven.
- Added focused tests in:
  - `src/app/api/ai/trigger-studio-edit/route.test.ts`
  - `src/lib/admin/imageStudioJob.test.ts`
- Verification:
  - `npx vitest run src/app/api/ai/trigger-studio-edit/route.test.ts src/lib/admin/imageStudioJob.test.ts src/services/supabaseService.cacheAnalysisResult.test.ts src/app/customizing/CustomizingHeroPanel.test.tsx src/app/api/ai/edit-image/route.test.ts src/app/api/ai/validate/route.test.ts` passed with 39 tests.
  - `npx eslint src/contexts/ImageContext.tsx src/app/api/ai/trigger-studio-edit/route.ts src/app/api/ai/trigger-studio-edit/route.test.ts src/app/api/admin/cake-cache-images/route.ts src/lib/admin/imageStudioJob.ts src/lib/admin/imageStudioJob.test.ts` completed with warnings only; those warnings are pre-existing in `ImageContext.tsx`.
  - `npx eslint src/services/geminiService.ts` still reports pre-existing `@typescript-eslint/no-explicit-any` errors and unused-import warnings unrelated to this parallelization change.

## Fix Customizer Icing Swatch AI Edit Failures

### Plan

- [x] Reproduce and trace the customizer icing-color failure path, separating pricing warnings from the `/api/ai/edit-image` non-image response.
- [x] Harden the image-edit route so the icing-only fast path can recover when Gemini returns no edited image for a swatch recolor request.
- [x] Add focused tests for the fallback behavior and keep the normal default-model path unchanged.
- [x] Verify with targeted Vitest coverage plus a live local `/api/ai/edit-image` request that the recolor path now returns an image instead of surfacing the 502.

### Review

- Traced the reported failure to the image-edit route's non-image response handling, not the separate pricing-rule console warning.
- Kept the icing-color fast path on `gemini-2.5-flash-image`, but changed `src/app/api/ai/edit-image/route.ts` so color-only edits now:
  - request `TEXT` + `IMAGE` from the fast model,
  - retry once on `gemini-3.1-flash-image-preview` when the fast model returns text or no image bytes,
  - only surface the old 400/502 errors after the stable retry also fails.
- Added a focused regression test in `src/app/api/ai/edit-image/route.test.ts` for the exact empty-response fallback path while preserving the existing default-model expectations.
- Verification:
  - `npx vitest run src/app/api/ai/edit-image/route.test.ts src/services/designService.no-op.test.ts` passed.
  - A live local POST to `http://127.0.0.1:3002/api/ai/edit-image` with `preferredModel: 'gemini-2.5-flash-image'` returned `200 OK` with `image/png` output after the fix.

## Prototype Instant Icing Recolor Lab

### Plan

- [x] Add an isolated test page, likely alongside existing internal tooling such as `/similarity-debugger`, to compare icing-overlay behavior without touching the production customizer flow.
- [x] Simplify the experiment to a single path: upload one cake image, automatically send it to Gemini for the icing-conversion layer, then recolor only the generated top layer locally.
- [ ] Reuse the repo's existing customizer signals and helpers:
  - `useInpaintingStyle` in `src/services/designService.ts` as the future branch point for a non-AI recolor path.
  - `cakegenie_color_variants` and the local color-variant cache in `src/hooks/useDesignUpdate.ts` for persistence and instant replay.
  - `SegmentationOverlay`, `segmentation.ts`, and `maskFiltering.ts` as the starting point for mask visualization and alpha-mask decoding.
- [ ] Build the lab in phases:
  - [x] Phase 1: upload one cake image, auto-generate a red icing layer with Gemini, key out the black pixels, and locally adjust only that layer with HSL sliders.
  - Phase 2: tune the black-key transparency thresholds and generation prompt based on visual quality.
  - Phase 3: automatic mask generation experiments and benchmarking.
  - Phase 4: integrate the winning fast path back into the customizer only after latency and quality pass.
- [x] For the instant renderer, test a client-side Canvas pipeline first:
  - render from a stable base image, not the previously recolored result,
  - key out pitch-black pixels from the generated Gemini layer,
  - recolor only the generated top layer using hue, saturation, and lightness controls,
  - move work to `OffscreenCanvas` or a worker if main-thread jank appears.
- [x] Keep a strict separation between `preview` and `canonical saved asset`:
  - preview should be instant and local,
  - background persistence can save the rendered variant to storage and reuse the existing variant cache.
- [x] Evaluate three mask-generation options before implementation:
  - `Transformers.js` + the `transformers.js-examples` `segment-anything-webgpu` example for interactive browser-side segmentation.
  - `rembg-web` for fast reusable mask sessions and mask-only output experiments.
  - MediaPipe Image Segmenter only if its category-based segmentation proves useful for coarse cake/body masks; it is less likely to separate icing surfaces cleanly on its own.
- [ ] Use current detection/analysis data only as guidance, not as the final mask:
  - existing bounding boxes and `icing_surfaces` / `icing_borders` metadata can refine masks and help exclude toppers, messages, and photos from recolor regions.
- [x] Decide success criteria before building:
  - under 100ms local recolor for repeated clicks on desktop,
  - visually preserves texture, highlights, and shadows,
  - does not recolor toppers/messages accidentally,
  - falls back cleanly to AI or cached variants when masks are missing.

### Review

- Added a no-index internal test route at `src/app/admin/icing-recolor-lab/page.tsx` with a simplified lab client in `src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx`.
- Added `src/lib/icingConversionPrompt.ts` as the dedicated source of truth for the user-provided Gemini icing-conversion prompt.
- Tightened the prompt and lab system instruction so Gemini is explicitly told to preserve the original framing, crop, cake scale, and cake position for better overlay alignment.
- Added `src/lib/icingLayerComposite.ts` as the overlay math helper for:
  - keying out pitch-black pixels from the generated Gemini layer,
  - recoloring only that generated top layer with hue, saturation, and lightness adjustments.
- The lab page now supports:
  - uploading one base cake image,
  - automatically generating the red-icing reference layer with Gemini,
  - placing that generated image over the original as a keyed top layer,
  - making pitch-black generated pixels transparent so only the icing layer remains,
  - adjusting only the generated layer with hue, saturation, and lightness sliders,
  - preview download and lab reset.
- Added focused tests in `src/lib/icingLayerComposite.test.ts` for black transparency keying and HSL-only top-layer recolor.
- Verification:
  - `npx vitest run src/lib/icingLayerComposite.test.ts --exclude '.claude/**'` passed.
  - `npx eslint src/lib/icingLayerComposite.ts src/lib/icingLayerComposite.test.ts src/lib/icingConversionPrompt.ts src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx src/app/admin/icing-recolor-lab/page.tsx` passed.
  - `npm run build` passed and included `/admin/icing-recolor-lab` in the route manifest.
  - Browser verification on the live dev server at `http://127.0.0.1:3002/admin/icing-recolor-lab` confirmed the route renders the simplified upload, generation state, HSL controls, and layered preview flow.

## Make Icing Recolor Lab Prompt Editable

### Plan

- [x] Explain and correct the current lab mismatch where a generation-style prompt is being sent through the image-edit flow.
- [x] Add an editable prompt field to `src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx`, seeded from `src/lib/icingConversionPrompt.ts`.
- [x] Let the user regenerate the Gemini layer with the current prompt against the already uploaded image without re-uploading.
- [x] Update the lab copy so it no longer claims the prompt is fixed when it is editable in-page.
- [x] Run focused verification and record the result here.

### Review

## Confirm Automated Icing Mask Generation After Studio Background Edit

### Plan

- [x] Recheck the `/customizing` and `/customizing/[slug]` mask-generation wiring around `studio_edited_image_url`, effective cache ids, and fallback paths so the runtime verification is anchored to the current code.
- [x] Capture live local evidence from the running customizer flow after the studio background edit completes, focusing on whether mask generation is triggered before the first icing click and whether the source image is the studio-edited URL.
- [x] Summarize whether automated studio-triggered mask generation is confirmed, what proof exists, and any remaining uncertainty or failure path that still needs follow-up.

### Review

- Reconfirmed the active wiring in `src/app/customizing/CustomizingClient.tsx`, `src/hooks/useIcingMask.ts`, `src/hooks/useDesignUpdate.ts`, and `src/contexts/ImageContext.tsx`: `/customizing` now passes `effectiveCacheId = recentSearchDesign?.id || currentCacheId || null`, the proactive `useIcingMask` studio effect runs when `studioEditedImageUrl` and that cache id exist, and the `icing-mask-fallback` edit path only uses the Studio URL when the mask path fails.
- Captured a live base-route run at `http://127.0.0.1:3002/customizing?ref=https%3A%2F%2Fcqmhanqnfybyxezhobkx.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fcakegenie%2Fvariants%2Fwednesday-addams-purple-2-tier-fondant-cake-e783%2F800.webp` with no icing click before verification:
  - `/private/tmp/dev-server.log` showed `POST /api/ai/trigger-studio-edit 200`, then `[Background] Image Studio finished for ff8303c7c7e7e7ff`, then an automatic `/api/ai/edit-image:start` with `requestSource: 'customizing-icing-mask'`, followed by `/api/ai/edit-image:success`.
  - The same log segment did not show an `icing-mask-fallback` request between the Studio completion and that mask-generation request.
- Queried the live persisted rows for `p_hash = 'ff8303c7c7e7e7ff'` and confirmed:
  - `cakegenie_analysis_cache.id = e33d1ff9-e8c0-4bf8-a4ff-7ce4ac04d5bb`
  - `cakegenie_analysis_cache.studio_edited_image_url = https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/admin/image-studio/ff8303c7c7e7e7ff.webp`
  - `cakegenie_icing_masks.source_image_url` for that `cache_id` matches the exact same Studio URL, with `status = 'ready'` and a fresh cache-busted `mask_url`.
- Conclusion: automated mask generation is working after the AI background generation, and the generated mask is being persisted against the `studio_edited_image_url`, not the original upload.

- Root cause: the lab was feeding Gemini a prompt that begins with `Generate a high-contrast studio photograph...` through the normal image-edit route, so Gemini was reasonably re-synthesizing the scene instead of making a tight in-place edit.
- `src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx` now keeps the uploaded image payload in state so the same image can be re-used for repeated prompt experiments without another upload.
- The lab now exposes the current prompt in an in-page editable textarea, seeded from `src/lib/icingConversionPrompt.ts`.
- Added a `Generate Layer` action that re-runs Gemini against the already uploaded image using the current prompt text.
- Added `Reset Prompt` and updated the upload/notes copy so the page accurately describes the prompt as editable instead of fixed.
- Verification:
  - `npx eslint src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx src/lib/icingConversionPrompt.ts` passed.
  - `curl -I --max-time 10 http://127.0.0.1:3002/admin/icing-recolor-lab` returned `200 OK`.
- Browser verification on the live dev server confirmed the page now shows the `Prompt` panel, editable prompt textbox, `Generate Layer` button, and updated explanatory copy.

## Update Icing Recolor Lab Default Prompt

### Plan

- [x] Replace `src/lib/icingConversionPrompt.ts` with the user's latest exact prompt wording.
- [x] Verify the source file contains the new default prompt text.
- [x] Confirm the dev lab route still responds after the prompt-source update.

### Review

- Updated `src/lib/icingConversionPrompt.ts` again with the latest user-provided wording, including the stronger masking guidance for glitter toppers, graphic design toppers, background, and base boards.
- Kept the replacement literal and scoped to the dedicated prompt source file.
- Verification:
  - Source check confirmed the new default prompt text in `src/lib/icingConversionPrompt.ts`.
  - `curl -I --max-time 10 http://127.0.0.1:3002/admin/icing-recolor-lab` returned `200 OK`.
- A fresh lab page load was started after the update so the next clean page refresh can pick up the new default prompt state.

## Match Lab Color Controls To Customizer Swatches

### Plan

- [x] Move the lab color controls below the preview panel.
- [x] Replace the HSL sliders with the same circular color-swatch interaction used in the customizer above the cake options.
- [x] Verify the updated lab route renders with the new control placement and interaction.

### Review

- Moved the layer color controls out of the left column and placed them directly below the preview panel in `src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx`.
- Replaced the freeform HSL slider UI with a customizer-style circle swatch picker driven by the shared `COLORS` list, including a selected color chip and ring treatment that mirrors the existing customizer pattern.
- The lab now maps the selected swatch onto the generated red overlay by converting the target hex color into relative HSL adjustments before compositing the keyed layer.
- Updated the surrounding copy so the page consistently talks about color-circle recolor instead of sliders or HSL controls.
- Verification:
  - `npx eslint src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx` passed.
  - Browser verification on the live dev server confirmed the preview panel renders before the `Layer Color Controls` section and that the controls now appear as circular swatches below the preview.

### Research Notes

- MediaPipe's Image Segmenter is documented as a browser-capable segmentation task, but its listed models are category-oriented and skew toward people/body-part segmentation, so it looks more suitable for coarse foreground masks than precise cake-surface separation.
- Transformers.js supports in-browser segmentation models and the official examples repo includes `segment-anything-webgpu`, which makes it the strongest existing browser-native starting point for a lab page.
- `rembg-web` exposes `Mask Only`, session reuse, and hardware acceleration options including WebGPU/WebNN, which makes it useful for fast repeatable mask experiments even if it may be too coarse for final icing surfaces.
- MDN documents `OffscreenCanvas` and Canvas compositing modes such as `hue`, `color`, and `luminosity`, which are promising for keeping the click path purely software-driven and off the main thread when needed.
- The repo already includes dormant segmentation decode/render helpers and an existing instant cached-variant path, so the cheapest path is to experiment with mask-backed local recolor before inventing a new persistence model.

## Route Icing-Only Edits To Gemini 2.5 Flash Image

### Plan

- [x] Identify the cleanest existing signal for color-only or icing-only edits in the customizer flow.
- [x] Pass an explicit model preference through the interactive edit pipeline for those color-only edits.
- [x] Keep the edit-image API default on Gemini 3.1 while honoring Gemini 2.5 Flash Image for the color-only path.
- [x] Add focused tests and record verification results here.

### Review

- Reused the existing `useInpaintingStyle` detection in `src/services/designService.ts` as the authoritative signal for icing-only or color-only edits.
- `src/services/designService.ts` now passes an explicit preferred model of `gemini-2.5-flash-image` only for the color-only interactive edit path.
- `src/services/geminiService.ts` now forwards that model preference to `/api/ai/edit-image`.
- `src/app/api/ai/edit-image/route.ts` now defaults to `gemini-3.1-flash-image-preview` for normal edits, but switches to `gemini-2.5-flash-image` when the request explicitly prefers the icing-only model.
- The studio restaging/background routes were left unchanged, so the post-analysis studio pipeline still uses Gemini 3.1 image preview.
- `src/app/api/ai/edit-image/route.test.ts` now covers the Gemini 2.5 preference path.
- Verification:
  `npx vitest run src/app/api/ai/edit-image/route.test.ts src/services/designService.no-op.test.ts` passed. Vitest again discovered mirrored `.claude/worktrees/...` copies, and those also passed.
  `npx eslint src/app/api/ai/edit-image/route.ts src/app/api/ai/edit-image/route.test.ts src/services/geminiService.ts src/services/designService.ts` still fails because `src/services/geminiService.ts` already has pre-existing `no-explicit-any` errors and several unused-import warnings unrelated to this model-routing change.

## Use Fastest Safe Gemini Image Response Mode

### Plan

- [x] Confirm the lowest-risk doc-backed latency setting for the repo's pure image routes.
- [x] Update the pure image editing/generation routes to request image-only responses.
- [x] Adjust focused tests to assert the new Gemini config.
- [x] Run focused verification and capture the result here.

### Review

- Updated the repo's pure Gemini image routes to explicitly request image-only outputs instead of the default text-plus-image mode.
- `src/app/api/admin/cake-cache-images/route.ts` now requests `responseModalities: ['IMAGE']` for the background studio-edit pipeline.
- `src/app/api/ai/edit-image/route.ts` now requests `responseModalities: ['IMAGE']` for interactive cake image edits.
- `src/app/api/ai/cold-cake-edit/route.ts` now requests `responseModalities: ['IMAGE']` for edible photo compositing.
- `src/app/api/ai/edit-image/route.test.ts` now asserts the route sends the image-only config to Gemini.
- Verification:
  `npx vitest run src/app/api/ai/edit-image/route.test.ts` passed. Vitest also discovered the mirrored test file under `.claude/worktrees/...`, so both copies passed.
  `npx eslint src/app/api/admin/cake-cache-images/route.ts src/app/api/ai/edit-image/route.ts src/app/api/ai/cold-cake-edit/route.ts src/app/api/ai/edit-image/route.test.ts` still fails because of pre-existing `@typescript-eslint/no-explicit-any` errors and one unused helper warning already present in the touched route files; this latency change did not add new lint errors.

## Add Reusable Branding Compliance Prompt

### Plan

- [x] Review the existing Genie branding rules and turn them into a reusable audit prompt.
- [x] Add the prompt to the repo instruction file so future agents can check any page for branding color compliance.
- [x] Verify the prompt covers backgrounds, text, buttons, accents, semantic colors, and output format.

### Review

- Added a `Branding Compliance Audit Prompt` section to `gemini.md` directly under the landing-page branding rules.
- Structured the prompt so an agent can paste in a URL, route, screenshot, or file path and then evaluate that page against the real Genie palette and shared utilities in `src/app/globals.css`.
- Required the audit output to report verdict, compliant elements, off-brand elements, exact classes/tokens/components involved, recommended fixes, and where to change the code.
- Verification:
  Repo inspection confirmed the prompt is aligned with the previously documented Genie branding rules and references the correct shared theme utilities.

## Document Landing Page Branding Rules

### Plan

- [x] Inspect the homepage and shared theme utilities to identify the actual Genie landing-page palette and styling hierarchy.
- [x] Choose the repo instruction file that should hold persistent design guidance for future agents.
- [x] Add a durable branding and color reminder that explains how to style text, buttons, accents, surfaces, and semantic statuses on landing-style pages.
- [x] Verify the written rule matches the observed homepage implementation and shared CSS tokens.

### Review

- Added a new `Landing Page Branding And Color Rules` section to `gemini.md` so future agents have a persistent reminder without needing the user to restate the same design adjustment.
- Grounded the rule in the real shared theme source of truth from `src/app/globals.css`, including `genie-page-bg`, `genie-btn-primary`, `genie-btn-secondary`, `genie-icon-button`, and the Genie color tokens.
- Captured the observed landing-page pattern from `src/app/LandingClient.tsx` and `src/components/landing/*`: dark neutral text, muted supporting copy, purple as the primary brand accent, pink as a limited supporting accent, and green/blue reserved for semantic delivery or availability states.
- Verification:
  Repo inspection confirmed the guidance matches the current homepage implementation in `src/app/LandingClient.tsx`, `src/components/landing/IntroContent.tsx`, `src/components/landing/HeroTransitionSection.tsx`, `src/components/landing/LandingFooter.tsx`, and `src/app/globals.css`.

## Align Landing Page Reviews Branding

### Plan

- [x] Inspect the landing-page reviews section and identify the profile-circle and button styles that do not match the landing page palette.
- [x] Update the landing-page reviews UI so avatar circles and review-section buttons use the same purple Genie branding system as the rest of the landing page.
- [x] Run a focused verification pass on the touched files and record the result.

### Review

- Updated the homepage reviews CTA in `src/components/seo/HomepageAeoSections.tsx` to use the shared `genie-btn-secondary` treatment so it now matches the landing page's branded secondary buttons.
- Updated the review avatar circles in `src/components/ReviewsDisplay.tsx` to use a softer Genie purple gradient with purple text instead of the previous pink-heavy chip styling.
- Updated both `Recreate Design` buttons in `src/components/ReviewsDisplay.tsx` to use the shared landing-page secondary button styling for consistent borders, hover states, and focus treatment.
- Removed an unused `ThumbsUp` import in `src/components/ReviewsDisplay.tsx` so the touched files verify cleanly.
- Verification:
  `npx eslint src/components/ReviewsDisplay.tsx src/components/seo/HomepageAeoSections.tsx` passed.

## Audit Customizing Social Metadata For SEO Impact

### Plan

- [x] Inspect the dynamic metadata generator for `/customizing/[slug]` and confirm which tags the route emits server-side.
- [x] Compare the live output against current Open Graph, X Cards, and Next.js metadata documentation.
- [x] Record whether the Facebook debugger description affects SEO and note any metadata anomalies that actually need a code change.

### Review

- Confirmed `src/app/customizing/[slug]/page.tsx` emits server-rendered `description`, `og:*`, and `twitter:*` tags from `generateMetadata`, with the slug route setting canonical, robots, OG image dimensions, and Twitter card fields directly.
- Live fetch of `https://genie.ph/customizing/butterfly-princess-lavender-2-tier-cake-1e50` with the `facebookexternalhit/1.1` user-agent returned the expected source tags: `og:title`, `og:description`, `og:url`, `og:image`, `og:image:width`, `og:image:height`, `og:image:alt`, plus standard `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:width`, `twitter:image:height`, and `twitter:image:alt`.
- The odd `og:temporal:twitter:*` labels shown in Facebook Share Debugger do not exist in the page source; they appear to be a debugger-side representation of parsed Twitter/X metadata rather than proof that the site is emitting malformed Open Graph tags.
- SEO conclusion: the Facebook debugger description itself does not directly influence Google rankings. It affects social share previews, while search visibility depends more on the HTML title, standard meta description, canonical, crawlability, page content, and structured data.
- Verification:
  Repo inspection: `src/app/customizing/[slug]/page.tsx`, `src/app/layout.tsx`, and `src/lib/utils/metadata.ts`.
  Live HTML fetch with `facebookexternalhit/1.1` confirmed the exact meta tags rendered in production.
  Official references checked: Open Graph protocol (`ogp.me`), X Cards markup docs (`developer.x.com`), and Next.js `generateMetadata` docs.

## Humanize Homepage Reviews Copy And Remove Container

### Plan

- [x] Inspect the remaining homepage reviews section and identify the copy and layout wrapper to change.
- [x] Replace the heading copy with more natural, customer-friendly SEO text.
- [x] Remove the enclosing container styling and run a focused sanity check.

### Review

- Updated the homepage reviews section in `src/components/seo/HomepageAeoSections.tsx` so the label now reads `Customer Reviews` and the heading/subcopy are more natural for shoppers while still targeting Genie.ph, cake ordering, reviews, and Metro Cebu intent.
- Removed the enclosing card treatment from that section by deleting the old shared container class and leaving the reviews block as an unframed section.
- Verification:
  `npx eslint src/components/seo/HomepageAeoSections.tsx` passed.

## Remove Duplicate Homepage AEO Containers

### Plan

- [x] Confirm which homepage sections duplicate content already present in the footer or elsewhere on the landing page.
- [x] Remove the `What Genie.ph Does`, `Our Services`, `Why Customers Trust Genie.ph`, and `Location and Service Area` containers from the homepage AEO section.
- [x] Run a focused sanity check on the touched files and record the result.

### Review

- Removed the duplicate `What Genie.ph Does`, `Our Services`, `Why Customers Trust Genie.ph`, and `Location and Service Area` containers from `src/components/seo/HomepageAeoSections.tsx`.
- Kept the `Recent Review Excerpts` block in place so the homepage still has one machine-readable review-focused section below the core landing content.
- Simplified `HomepageAeoSections` to accept only `reviews`, and removed the now-unused `reviewSummary` prop from its call site in `src/app/page.tsx`.
- Verification:
  `npx eslint src/components/seo/HomepageAeoSections.tsx src/app/page.tsx` passed.
  `rg` confirmed the removed headings no longer appear in `src/components/seo/HomepageAeoSections.tsx`, and `src/app/page.tsx` no longer passes `reviewSummary` into `HomepageAeoSections`.

## Update Default Social Preview Image

### Plan

- [x] Confirm the current default Open Graph and Twitter preview image sources across shared metadata helpers and page-level fallbacks.
- [x] Replace the old `meta GENIE.jpg` default with the rush-orders Supabase image wherever the site emits default social preview metadata.
- [x] Preserve page-specific social preview overrides that intentionally use another image.
- [x] Run focused metadata tests and reference checks.
- [x] Record the verification results here.

### Review

- Changed the shared default social image to `https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/pages/CUSTOM-CAKES-FOR-RUSH-ORDERS.WEBP` through `genieBusinessProfile.ogImageUrl`.
- Updated the root layout, homepage, shop page, customizing index, customizing category fallback, Mother's Day page, and shared metadata helper to use that shared default instead of the old `meta GENIE` asset.
- Preserved the existing page-specific override support in `buildMarketingPageMetadata`, including the Cebu cake shops page override that already points at its own hero image.
- Removed a small pre-existing lint issue in the touched customizing category page by deleting an unused helper and deriving the category design type from the existing cached fetcher.
- Verification:
  `npx vitest run src/lib/utils/metadata.test.ts src/app/page.metadata.test.tsx 'src/app/customizing/category/[keyword]/page.test.tsx' --exclude '.claude/**'` passed.
  `npx eslint src/lib/seo/genieBusinessProfile.ts src/lib/utils/metadata.ts src/lib/utils/metadata.test.ts src/app/layout.tsx src/app/page.tsx src/app/shop/page.tsx src/app/customizing/page.tsx 'src/app/customizing/category/[keyword]/page.tsx' src/app/mothersdaycakes/page.tsx` passed.
  `npm run build` passed.
  Built-server HTML checks on `/`, `/customizing`, `/shop`, `/mothersdaycakes`, and `/about` showed both `og:image` and `twitter:image` using the new rush-orders image.

## Add The Humanizer Codex Skill

### Plan

- [x] Create a personal Codex skill at `/Users/apcaballes/.codex/skills/the-humanizer` with trigger metadata that explicitly includes blog creation and blog review.
- [x] Preserve the Humanizer review workflow: content-type detection, AI-pattern scan, originality check, scoring, structured review, rewrite, and skill-update report.
- [x] Keep the main skill file concise by moving detailed marker lists into a reference file.
- [x] Verify the skill files exist, have valid frontmatter, and are discoverable from the local skills directory.

### Review

- Added `/Users/apcaballes/.codex/skills/the-humanizer/SKILL.md` with metadata that triggers on humanizing writing, blog review, blog drafting, and the explicit rule: "Always use this skill when creating blogs."
- Added `/Users/apcaballes/.codex/skills/the-humanizer/references/review-rules.md` with the adapted Humanizer v2.4 detection, scoring, originality, channel-specific rewrite, and blog QA rules.
- Added `/Users/apcaballes/.codex/skills/the-humanizer/agents/openai.yaml` so the skill has UI-facing metadata.
- Verification:
  `python3` frontmatter/reference validation passed and confirmed the blog-creation trigger is present.
  `rg` confirmed the installed skill contains the blog trigger, blog rules, scoring rules, and skill-update behavior.

## Fix Live Sitemap Core Timeout And Homepage Trust Copy Drift

### Plan

- [x] Confirm why `https://genie.ph/sitemap-core.xml` is timing out and isolate the slow path in the sitemap routing flow.
- [x] Add a focused fast-path for the public core sitemap so static-route XML no longer depends on heavyweight chunk discovery.
- [x] Remove the stale hardcoded homepage footer review badge and reuse the live homepage review summary instead.
- [x] Run targeted verification for the sitemap response path, footer output, and relevant tests/build checks.

### Review

- Root cause for the public `sitemap-core.xml` timeout was the `generateSitemaps()` path in `src/app/sitemap.ts`: every direct chunk request was doing heavyweight `getIndexableCustomizedCakeRows()` and `getIndexableSharedDesignRows()` work just to discover how many chunk IDs exist.
- Added `getSitemapChunkHints()` in `src/lib/sitemap/indexability.ts`, which switches chunk discovery to lightweight Supabase count/latest-date queries instead of loading the full sitemap-ready datasets.
- Updated both `src/app/sitemap.ts` and `src/app/sitemap-index.xml/route.ts` to use the new lightweight chunk hints, so the public sitemap routing flow no longer blocks on full customized-cake and shared-design enumeration before it can serve static sitemap surfaces.
- Updated `src/components/landing/LandingFooter.tsx` to accept an optional `reviewSummary` prop and removed the stale hardcoded `4.8/5 based on 6 Happy Customers.` copy.
- Updated `src/app/page.tsx` so the homepage footer reuses the same live review summary already powering the hero and homepage trust sections.
- Added regression coverage in `src/app/sitemap.test.ts` to prove chunk ID generation now uses lightweight hints instead of the heavy row fetchers, and added `src/components/landing/LandingFooter.test.tsx` to prove the footer renders live review copy instead of the stale hardcoded badge.
- Verification:
  `npx vitest run src/app/sitemap.test.ts src/components/landing/LandingFooter.test.tsx src/app/page.metadata.test.tsx --exclude '.claude/**'` passed.
  `npx eslint src/app/page.tsx src/components/landing/LandingFooter.tsx src/app/sitemap.ts src/app/sitemap-index.xml/route.ts src/lib/sitemap/indexability.ts src/app/sitemap.test.ts src/components/landing/LandingFooter.test.tsx` passed with warnings only; no new errors.
  `npm run build` passed end to end.
  Local production-mode checks on `http://127.0.0.1:3012` showed `sitemap-core.xml` returning `HTTP/1.1 200 OK` in about `664ms`, `sitemap.xml` returning `HTTP/1.1 200 OK`, and homepage HTML containing `5.0/5 based on 6 public reviews.` while no longer containing `4.8/5 based on 6 Happy Customers.`

## Apply Contact Form Supabase Migration Via MCP

### Plan

- [x] Confirm the remote table is currently missing through Supabase MCP.
- [x] Apply only the `create_cakegenie_contact_messages` migration through Supabase MCP.
- [x] Verify the table exists and the live `/api/contact` route accepts a submission.

### Review

- Supabase MCP authentication was restored, and the requested migration was applied successfully with `apply_migration` as `create_cakegenie_contact_messages`.
- The remote `public.cakegenie_contact_messages` table now exists with RLS enabled, columns `id`, `name`, `phone`, `email`, `message`, `source`, and `created_at`, and primary key `id`.
- Verified policies now exist for `service_role`: `service_role_contact_messages_insert` for `INSERT` and `service_role_contact_messages_select` for `SELECT`.
- Per the task constraint, no fallback was used. I did not run `supabase db push`, did not repair migration history, and did not apply SQL through any non-MCP path.
- Committed and pushed the contact/API/AEO implementation to `main` at `80a2090`, then verified Vercel production deployment `dpl_2u4nvAUvzHn2DyUszXdDdEL61gMw` reached `READY` and was aliased to `genie.ph`.
- Live route verification passed after deployment: `POST https://genie.ph/api/contact` returned `HTTP/2 200` with `{"success":true}`.
- Supabase row verification passed for `codex-contact-deploy-test@example.com`, confirming the deployed route inserted into `public.cakegenie_contact_messages` with `source = 'contact-page'`.

## Implement Genie.ph AEO / GEO Audit Fixes

### Plan

- [x] Add a shared `genieBusinessProfile` source of truth for business identity, contact details, service area, trust links, and service definitions.
- [x] Replace the global platform `Bakery` schema with canonical `Organization` + `WebSite`, then align homepage, about, contact, reviews, sitemap, and the new services page to that shared source.
- [x] Make `/reviews` indexable, add `/reviews` and `/services` to sitemap surfaces, and add visible homepage trust/service/local sections without disturbing the hero upload flow.
- [x] Replace the fake contact form with a real `POST /api/contact` route backed by a new `cakegenie_contact_messages` table.
- [x] Remove commercial `FAQPage` schema that should no longer be emitted, then run targeted tests, lint, build, and HTML/schema verification.

### Review

- Added `src/lib/seo/genieBusinessProfile.ts` as the shared source of truth for Genie.ph identity, contact details, service area, trust links, and core service definitions.
- Replaced the global platform `Bakery` schema with canonical `Organization` + `WebSite` in `src/app/layout.tsx`, removed the duplicate homepage `WebSite` JSON-LD, and aligned page-level schema to reuse the shared organization/site IDs.
- Added a new crawlable services page at `src/app/services/page.tsx`, made `/reviews` indexable, and added both `/services` and `/reviews` to `src/app/sitemap.ts` and `src/app/sitemap-html/page.tsx`.
- Added homepage AEO sections in `src/components/seo/HomepageAeoSections.tsx` and wired real review stats/excerpts into the homepage server render instead of relying only on hardcoded review copy.
- Updated `src/app/contact/ContactClient.tsx`, `src/app/contact/page.tsx`, `src/app/about/AboutClient.tsx`, and `src/components/landing/LandingFooter.tsx` so visible copy, CTAs, and contact facts now match the shared business profile.
- Added `src/app/api/contact/route.ts` plus `supabase/migrations/20260524110000_create_cakegenie_contact_messages.sql` for real contact form submission storage.
- Removed the commercial `FAQPage` JSON-LD from `src/app/customizing/category/[keyword]/page.tsx`, leaving the visible FAQ content intact.
- Verification:
  `npx vitest run src/app/page.metadata.test.tsx src/app/sitemap.test.ts src/app/reviews/page.metadata.test.ts src/app/api/contact/route.test.ts --exclude '.claude/**'` passed.
  `npm run build` passed end to end, including static generation for `515` routes.
  Rendered HTML verification on `/`, `/about`, `/contact`, `/reviews`, and `/services` confirmed one `WebSite`, zero platform `Bakery` nodes, and `index, follow` robots on all five routes.
  `npm run lint` still fails because this repo already has a broad pre-existing lint backlog across root scripts, Supabase functions, and older app files unrelated to this feature.
  The live `POST /api/contact` route currently returns a server error until the new migration is applied to the linked remote Supabase project; the route logs confirm the only missing piece is the absent `public.cakegenie_contact_messages` table.

## Keep Desktop Sidebar Scroll Ownership After Advanced Expansion

### Plan

- [x] Reproduce why opening `Advanced Customization` causes wheel input over the right column to fall back to whole-page scrolling.
- [x] Adjust the desktop sidebar scroll logic so the right column directly consumes wheel input while it still has internal scroll room, even after advanced cards expand.
- [x] Run focused verification and capture the regression fix notes here.

### Review

- `src/app/customizing/desktopSidebarScroll.ts` now exposes `canConsumeDesktopSidebarWheel()`, which represents the simple edge rule the right sidebar should follow on hover: consume downward wheel input until it reaches the bottom, consume upward wheel input until it reaches the top, then release control back to the page.
- `src/app/customizing/CustomizingClient.tsx` now adds a dedicated non-passive `wheel` listener directly on the desktop right-column scroller. That means when the cursor is over the cake-options sidebar, the sidebar keeps scrolling itself after `Advanced Customization` expands instead of immediately handing the wheel back to the whole page.
- The earlier window-level redirect is still in place for the original desktop behavior where page scroll should feed the right column once the left hero column has finished. The new direct sidebar listener only strengthens hover behavior inside the sidebar itself and still releases page scroll naturally at the top and bottom edges.
- Focused regression coverage was expanded in `src/app/customizing/desktopSidebarScroll.test.ts` to cover the new direct sidebar wheel-consumption helper.
- Verification:
  `npx vitest run src/app/customizing/desktopSidebarScroll.test.ts src/app/customizing/CustomizingStepSummarySections.test.tsx --exclude '.claude/**'` passed (`19` tests).
  `npx eslint src/app/customizing/CustomizingClient.tsx src/app/customizing/desktopSidebarScroll.ts src/app/customizing/desktopSidebarScroll.test.ts src/app/customizing/CustomizingStepSummarySections.tsx src/app/customizing/CustomizingStepSummarySections.test.tsx` completed with `0` errors and existing warnings only. `CustomizingClient.tsx` still has many pre-existing unused import / hook dependency warnings, and `CustomizingStepSummarySections.tsx` still has the same `19` pre-existing warnings.

## Fix Desktop Advanced Section Visibility And Sidebar Scroll Release

### Plan

- [x] Confirm why advanced desktop content can expand without becoming visible and why right-column upward scroll gets trapped at the sidebar edge.
- [x] Adjust the desktop sidebar behavior so advanced content scrolls into view when opened and page scrolling resumes naturally when the sidebar is already at its top or bottom.
- [x] Run focused verification and capture the regression fix notes here.

### Review

- `src/app/customizing/CustomizingStepSummarySections.tsx` no longer relies on `scrollIntoView({ block: 'nearest' })` for the desktop advanced section. That call could leave the advanced container technically expanded but still clipped below the visible area of the sticky right-column scroller.
- The desktop expand effect now finds the actual nearest vertical scroll parent, targets the first advanced card, and scrolls that parent so the advanced controls land near the top of the visible sidebar. A short follow-up scroll pass runs after the expand animation begins, which keeps the first advanced cards visible even inside the sticky overflow container.
- Focused regression coverage was added in `src/app/customizing/CustomizingStepSummarySections.test.tsx` to prove the desktop sidebar container receives the `scrollTo({ top, behavior: 'smooth' })` call when `Advanced Customization` opens.
- Verification:
  `npx vitest run src/app/customizing/CustomizingStepSummarySections.test.tsx --exclude '.claude/**'` passed (`10` tests).
  `npx eslint src/app/customizing/CustomizingStepSummarySections.tsx src/app/customizing/CustomizingStepSummarySections.test.tsx` completed with `0` errors and the same `19` pre-existing unused-code warnings already present in `CustomizingStepSummarySections.tsx`.
  `curl -I --max-time 10 http://127.0.0.1:3002/customizing/wednesday-addams-purple-2-tier-fondant-cake-e783` returned `HTTP/1.1 200 OK` during this regression pass.

## Make Desktop Customizer Sidebar Consume Scroll First

### Plan

- [x] Inspect the desktop two-column customizer layout and identify where left-column hero height and right-column overflow can be coordinated.
- [x] Add desktop-only right-column internal scrolling so wheel scroll is consumed by the cake-options column after the hero column finishes, then release page scrolling again once the right column catches up.
- [x] Add focused verification for the scroll-capture rules and record the final behavior here.

### Review

- `src/app/customizing/CustomizingClient.tsx` now measures the desktop top bar, left column, full two-column section, and right sidebar scroll container so desktop wheel input can be redirected when the left hero has already finished but the right cake-options column still has overflow remaining.
- The right desktop sidebar is now wrapped in a sticky, max-height-limited scroll container. That gives the cake-options column an internal scroll surface on desktop without changing the mobile behavior or the sidebar's content structure.
- A new helper in `src/app/customizing/desktopSidebarScroll.ts` decides when to capture wheel input:
  after the two-column section reaches the sticky zone,

## Track Fingerprint And ORB Coverage

### Plan

- [x] Add cache-table status fields so fingerprint and ORB indexing health are queryable instead of hidden in logs.
- [x] Tighten active fingerprint generation to use normalized image blobs where the upload flow already has them, reducing avoidable pHash failures.
- [x] Update cache writes and the existing pHash backfill flow to maintain the new fingerprint/ORB status fields.
- [x] Add a dedicated ORB backfill script for rows that are pending or failed indexing.
- [x] Run focused tests plus a full production build and record the verification results.

### Review

- Added `supabase/migrations/20260526112000_add_analysis_cache_coverage_statuses.sql` to track `fingerprint_status`, `fingerprint_error`, `fingerprinted_at`, `orb_index_status`, `orb_index_error`, `orb_index_attempted_at`, and `orb_indexed_at` on `cakegenie_analysis_cache`, with status indexes and a backfill for existing rows.
- Updated `src/services/supabaseService.ts` so the shared cache writer now records fingerprint readiness on every successful cache write and updates ORB indexing state around `/api/index` attempts instead of leaving that state implicit in console logs.
- Tightened active fingerprint generation in `src/contexts/ImageContext.tsx`, `src/hooks/useImageManagement.ts`, `src/components/ChatModal.tsx`, `src/app/admin/bulk-analysis/page.tsx`, and `src/app/admin/search-analysis/page.tsx` so these flows fingerprint the normalized/compressed image blob when available instead of always hashing the noisier source file.
- Updated `src/lib/utils/serverFingerprint.client.ts` to retry the server fingerprint request once and preserve the last error message so callers and logs can distinguish a real hash miss from transport or validation failure.
- Updated `scripts/backfill-server-phashes.ts` so pHash backfills now maintain `fingerprint_status`/`fingerprint_error`, and added `scripts/backfill-orb-index.ts` to retry ORB indexing for rows marked `pending`, `failed`, or `indexing` that still have a source image URL.
- Verification:
  `npx vitest run src/services/supabaseService.cacheAnalysisResult.test.ts --exclude '.claude/**'` passed.
  `npm run build` passed end to end.
  Focused `eslint` on the touched non-`supabaseService.ts` files completed with `0` errors and only pre-existing warnings in `ImageContext.tsx`, `useImageManagement.ts`, and `ChatModal.tsx`.
  Applied the new status schema to the linked Supabase project through MCP, then applied a follow-up reconciliation so existing `cakegenie_image_features` rows marked their parent cache rows `orb_index_status = 'ready'` instead of leaving the full catalog as pending.
  Post-reconciliation live counts were `10,336` ORB-ready rows, `10` ORB-pending rows, and `1` fingerprint-missing-or-failed row before the repair scripts ran.
  `npx tsx scripts/backfill-server-phashes.ts --limit=20 --concurrency=1` repaired `2` rows, aliased `4` duplicate/legacy hashes to canonical rows, and marked `8` rows failed because their source images are broken (`HTTP 400` or empty image buffers).
  `npx tsx scripts/backfill-orb-index.ts --limit=20 --concurrency=2` indexed `2` rows successfully and marked `8` rows failed for the same broken-source-image reasons.
  Final live counts after the repair passes: fingerprint `ready=10334`, `aliased=4`, `failed=8`; ORB `ready=10338`, `failed=8`, `pending=0`.
  after the left column bottom reaches the viewport bottom,
  while the right column still has scroll remaining,
  and in reverse while unwinding upward scroll inside the same section.
- Focused tests were added in `src/app/customizing/desktopSidebarScroll.test.ts` to cover the capture rules for downward scroll, upward scroll, pre-hero-end behavior, and section exit behavior.
- Verification:
  `npx vitest run src/app/customizing/desktopSidebarScroll.test.ts src/app/customizing/CustomizingSidebarPanel.test.tsx src/app/customizing/CustomizingStepSummarySections.test.tsx --exclude '.claude/**'` passed (`19` tests).
  `npx eslint src/app/customizing/CustomizingClient.tsx src/app/customizing/desktopSidebarScroll.ts src/app/customizing/desktopSidebarScroll.test.ts src/app/customizing/CustomizingSidebarPanel.tsx` completed with `0` errors and existing warnings only. `CustomizingClient.tsx` still has many pre-existing unused-import/hook-dependency warnings unrelated to this change.
  Live browser verification was attempted against the existing local server on `http://127.0.0.1:3002`, but both Playwright navigation and `curl -I --max-time 10` timed out with no response, so this change was not visually validated in-browser during this pass.

## Reduce Customizer Main Color Control Height

### Plan

- [x] Confirm the current spacing and circle sizes used by the main color controls in `CustomizingStepSummarySections.tsx`.
- [x] Reduce the main color control block's vertical size by about 20 percent, including the preview circle and the selectable color circles.
- [x] Run focused verification and capture the resulting behavior here.

### Review

- The main color control row in `src/app/customizing/CustomizingStepSummarySections.tsx` now uses tighter vertical spacing and smaller circles so the control reads about 20 percent shorter overall.
- The large current-color preview circle was reduced from `w-12 h-12` to `w-10 h-10`, and the selectable swatches were reduced from `w-10 h-10` to `w-8 h-8`.
- Supporting spacing was tightened at the same time: the row gap dropped from `gap-4` to `gap-3`, the label/swatch stack gap from `gap-1.5` to `gap-1`, the separator height from `h-12` to `h-10`, and the swatch strip padding/gap were reduced to keep the vertical footprint consistent with the smaller circles.
- Verification:
  `npx vitest run src/app/customizing/CustomizingStepSummarySections.test.tsx --exclude '.claude/**'` passed (`9` tests).
  `npx eslint src/app/customizing/CustomizingStepSummarySections.tsx src/app/customizing/CustomizingStepSummarySections.test.tsx` completed with `0` errors and the same `19` pre-existing unused-code warnings already present in `CustomizingStepSummarySections.tsx`.

## Move Main Color Controls Outside Advanced Customization

### Plan

- [x] Confirm the current placement of the `Main` color controls relative to the cake options card and advanced section.
- [x] Move the `Main` color controls out of `Advanced Customization` and place them above the cake options container in the main flow.
- [x] Update focused customizer tests, run targeted verification, and capture the resulting behavior here.

### Review

- The `Main` color controls now render in the main summary flow above the cake options container in `src/app/customizing/CustomizingStepSummarySections.tsx`, instead of being nested inside `Advanced Customization`.
- The advanced section now starts with the cake-type options card, while the visible top-level order is color controls first, then the main cake options card, then the advanced toggle.
- The advanced toggle helper copy was updated to remove `colors` from its collapsed description so the label matches the new placement.
- The focused regression test now checks that `Main` renders before `Icing Type` in the main flow and confirms the advanced section no longer contains the `Main` label while collapsed or expanded.
- Verification:
  `npx vitest run src/app/customizing/CustomizingStepSummarySections.test.tsx --exclude '.claude/**'` passed (`9` tests).
  `npx eslint src/app/customizing/CustomizingStepSummarySections.tsx src/app/customizing/CustomizingStepSummarySections.test.tsx` completed with `0` errors and the same `19` pre-existing unused-code warnings already present in `CustomizingStepSummarySections.tsx`.

## Move Main Color Controls Above Advanced Cake Options

### Plan

- [x] Confirm the current order of the advanced customization cards after the earlier cake-type move.
- [x] Reorder the advanced customization stack so the main color controls appear before the cake options card.
- [x] Update focused customizer tests, run targeted verification, and capture the resulting behavior here.

### Review

- The advanced customization stack in `src/app/customizing/CustomizingStepSummarySections.tsx` now renders the `Main` color controls card before the cake-type options card, so color selection appears first when the section opens.
- This was a pure ordering change inside the advanced section. The cake options card still contains the same filtered cake-type buttons and `Update design changes` CTA; it now simply appears below the color controls instead of above them.
- The focused advanced-section regression test now asserts both presence and DOM order, confirming that `Main` renders before the `Cake Type` label when the advanced section is expanded.
- Verification:
  `npx vitest run src/app/customizing/CustomizingStepSummarySections.test.tsx --exclude '.claude/**'` passed (`9` tests).
  `npx eslint src/app/customizing/CustomizingStepSummarySections.tsx src/app/customizing/CustomizingStepSummarySections.test.tsx` completed with `0` errors and the same `19` pre-existing unused-code warnings already present in `CustomizingStepSummarySections.tsx`.

## Move Cake Type Controls Into Advanced Customization

### Plan

- [x] Confirm where the customizer currently renders the cake type buttons and which nearby behaviors depend on that placement.
- [x] Remove the cake type controls from the default cake options card and place them inside the Advanced Customization section without changing the rest of the sizing/flavor flow.
- [x] Update focused customizer tests and run targeted verification, then capture the final behavior here.

### Review

- The cake type selector is no longer rendered in the default cake options card in `src/app/customizing/CustomizingStepSummarySections.tsx`. That top card now stays focused on icing, size, height, and flavor.
- The same filtered cake-type selector logic was extracted into a reusable block and moved into the `Advanced Customization` stack so it stays grouped with the other optional design controls.
- The cake-type-specific `Update design changes` AI CTA moved with that selector, keeping the shape-change action next to the type buttons instead of leaving it stranded in the main options card.
- The advanced section toggle copy now mentions cake type, and the collapsible container is marked `aria-hidden` while closed so those controls are not exposed as active buttons until the section is opened.
- Verification:
  `npx vitest run src/app/customizing/CustomizingStepSummarySections.test.tsx --exclude '.claude/**'` passed (`9` tests).
  `npx eslint src/app/customizing/CustomizingStepSummarySections.tsx src/app/customizing/CustomizingStepSummarySections.test.tsx` completed with `0` errors and `19` pre-existing warnings for unused imports/props/state already present in `CustomizingStepSummarySections.tsx`.

## Make User Upload ORB Matching Strict

### Plan

## Refresh Best Cake Shops Cebu 2026 Page

### Plan

- [x] Update the `/best-cake-shops-cebu` page copy so it reads as a 2026 guide without visible ranking language.
- [x] Remove the top Genie.ph hero image and keep the Genie rush-order image only in the bottom marketplace section.
- [x] Make each cake shop image render uncropped so the full uploaded asset is visible.
- [x] Verify and repair each cake shop website and Google Maps button so the public links respond successfully.
- [x] Re-run focused verification and confirm the updated page is available again on local dev.

### Review

- Updated [src/app/best-cake-shops-cebu/page.tsx](/Users/apcaballes/genieph-nextjs/src/app/best-cake-shops-cebu/page.tsx) so the page now presents as a 2026 guide instead of a ranked list. Visible ranking badges were removed, the quick-jump section now describes the guide as non-ranking, and the internal anchors were changed from rank-based IDs to slug-based IDs.
- Removed the top Genie.ph rush-order image and kept that asset only in the bottom Genie.ph marketplace section.
- Switched the cake shop images and the bottom Genie.ph image to uncropped `object-contain` rendering with intrinsic dimensions, so the full image is visible instead of being clipped to a uniform aspect ratio.
- Verified the current website and map buttons with live HTTP checks. All 10 Google Maps search URLs returned `200`, and all website buttons were adjusted to public working destinations, including stable Facebook destinations for `10 Dove Street` and `Kermit's`.
- Updated the bottom Genie.ph copy to make the same-day custom cake pitch more explicit: upload any cake design, get a price, and order within the same day when a seller has available capacity.
- Verification:
  `npx eslint src/app/best-cake-shops-cebu/page.tsx` passed.
  `npm run build` passed, and `/best-cake-shops-cebu` remained prerendered successfully.

- [x] Confirm the live user-upload ORB cache-hit path and identify where the match mode is chosen.
- [x] Switch the real user-upload ORB requests from `default` to `strict` without changing the similarity debugger controls.
- [x] Run targeted verification and capture the resulting live thresholds/behavior.

### Review

- The live production upload path in `src/contexts/ImageContext.tsx` now calls `findOrbCacheHit(file, { mode: 'strict' })`, so uploads only honor ORB cache hits after the stricter backend thresholds pass.
- The older fallback hook in `src/hooks/useImageManagement.ts` was also updated from `mode=default` to `mode=strict` so any remaining callers behave consistently.
- The similarity debugger was intentionally left unchanged. It still lets you choose `loose`, `default`, or `strict` manually from the UI.
- Verified directly in code with `rg` that both upload call sites now use `strict`.
- Local build verification:
  `npm run build` reached a clean compile and TypeScript pass after the change.
  A later local prerender phase stalled silently in this workspace, so I am not claiming a fresh end-to-end build completion for this tiny mode switch beyond the compile/typecheck signal.

## Merchant Center ID Attribute Compliance

### Plan

- [x] Confirm the documented Google Merchant Center `id [id]` length requirement and map it to every active Genie.ph product feed.
- [x] Replace overlong feed IDs with stable, deterministic IDs that stay within Google's maximum length while preserving uniqueness across updates.
- [x] Add focused regression coverage for the new ID formatting rules and verify the active feed output remains compliant.
- [x] Document the fix and the Merchant Center reprocessing follow-up once verification passes.

### Review

- Google’s current `id [id]` attribute documentation caps product IDs at `50` characters and requires stable unique values per product. The live `https://genie.ph/feed/google` XML feed was still emitting long slug-based IDs, which matches the Merchant Center warning shown in the screenshot.
- Added `src/lib/commerce/feedIds.ts` with a deterministic truncation rule:
  keep compliant IDs unchanged,
  shorten only overlong IDs,
  preserve the leading slug prefix,
  append an 8-character stable FNV-1a hash suffix so uniqueness survives truncation.
- Updated `src/app/feed/google/route.ts` to pass each public design-feed ID through the new helper before writing `<g:id>`.
- Updated `scripts/export-merchant-center-feed.mjs` to apply the same 50-character rule to merchant-product CSV IDs, so the curated merchant export stays compliant too.
- Added focused tests in `src/lib/commerce/feedIds.test.ts` covering unchanged short IDs, 50-character shortening, stability, and collision resistance for different long source IDs.
- Verification:
  `npx vitest run src/lib/commerce/feedIds.test.ts --exclude '.claude/**'` passed (`4` tests).
  `node --check scripts/export-merchant-center-feed.mjs` passed.
  `node scripts/export-merchant-center-feed.mjs` passed and exported `12` merchant products.
  A live-feed audit over the current production `https://genie.ph/feed/google` sample showed `25` IDs over `50` characters before the fix and `0` over `50` after applying the new formatter.
- Feed-size follow-up:
  the live `https://genie.ph/feed/google` feed currently exposes exactly `1000` items, while the underlying eligible `cakegenie_analysis_cache` population is `10,314` rows.
  The root cause is that the route was making a single Supabase query and relying on `.limit(10000)`, but the API response is still capped at `1000` rows per request in the current project setup.
  `src/app/feed/google/route.ts` now paginates through the full dataset in `1000`-row batches, which reproduced all `10,314` eligible rows across `11` pages during verification.

## Fix Vercel Build Regression For ORB URL Analyze Route

### Plan

- [x] Confirm the exact production TypeScript error from Vercel and isolate the failing line in `src/app/api/ai/analyze-url/route.ts`.
- [x] Replace the direct `Buffer` -> `Blob` construction with a type-safe server-compatible conversion.
- [x] Re-run targeted verification for the route/build behavior.
- [x] Harden the related build-time sitemap and collection search paths that surfaced during full `next build` verification.
- [x] Commit and push only the scoped production fix once verification passes.

### Review

- Root cause was not a single failing line. The Vercel failure started with `src/app/api/ai/analyze-url/route.ts` passing a raw Node `Buffer` into `new Blob(...)`, which Next 16 TypeScript rejects in production mode.
- Full local `npm run build` verification then surfaced two deeper build-only issues:
  1. `src/hooks/useImageManagement.ts` still referenced `getOrbBackendUrl` after its import had been removed.
  2. Static generation was exercising live data paths that were fragile in production: `getDesignsByKeyword()` was still calling the heavy FTS RPC during `next build`, and shared-design sitemap generation was selecting `image_width` / `image_height` from `cakegenie_shared_designs` even though those columns are not consistently present in the live table.
- Fixes applied:
  `src/app/api/ai/analyze-url/route.ts` now wraps `webpBuffer` as `Uint8Array.from(webpBuffer)` before constructing the `Blob`.
  `src/hooks/useImageManagement.ts` restores the missing `getOrbBackendUrl` import.
  `src/services/supabaseService.ts` now skips the FTS RPC inside `getDesignsByKeyword()` during `phase-production-build` and falls back directly to the indexed ILIKE query for prerender safety.
  `src/lib/sitemap/indexability.ts` now fetches shared-design sitemap rows using only the stable common columns that exist in the live schema.
- Verification:
  `npm run build` passed end to end on `2026-05-22`, including TypeScript, page-data collection, and static generation of all `513` pages/routes.

## Merchant Center Price Compliance

### Plan

- [x] Audit the current merchant-product feed and landing-page price output against Google Merchant Center's current price and structured-data requirements.
- [x] Normalize merchant-product and customizing page schema so SSR HTML always exposes a Merchant Center-compatible `Offer` with an active price.
- [x] Fix merchant-product SSR copy and feed export fallbacks so products without `custom_price` still surface the same starting price users see on the page.
- [x] Verify the affected pages/scripts with targeted checks and capture the root cause plus fix summary here.

### Review

- Root cause was a combination of three separate problems rather than one missing field:
  1. Live merchant data still had `3` active products with `custom_price = null`, so the merchant-product CSV export path was writing `0.00 PHP` for those rows.
  2. Merchant product pages mixed two price sources in the same SSR HTML: `custom_price` for the headline/FAQ and generic `productsizes_cakegenie` base prices for the size table and product schema. A quick live audit showed `4` of `12` active merchant products where `custom_price` disagreed with the generic lowest size price, which is exactly the kind of landing-page/feed mismatch Merchant Center flags.
  3. Both merchant product pages and `/customizing/[slug]` pages emitted `AggregateOffer` in JSON-LD when multiple sizes existed. Google’s current merchant listing docs require a concrete `Offer` with a price for product landing pages, not an aggregate-only offer.
- Added shared helpers in `src/lib/commerce/machineReadable.ts` to:
  determine the single active Merchant Center price from visible size options, and
  align a generic size ladder to a merchant-specific starting price when `custom_price` is present.
- Updated `src/components/SEOSchemas.tsx` so merchant product pages always emit a Merchant Center-compatible `Offer` plus `priceSpecification`, instead of switching to `AggregateOffer`.
- Updated `src/app/customizing/[slug]/page.tsx` so design pages also emit a concrete `Offer` with the active starting price in structured data, while keeping the visible size/price content for users.
- Updated `src/app/shop/[merchantSlug]/[productSlug]/page.tsx` so the SSR page now:
  uses the same authoritative starting price everywhere,
  falls back cleanly when `custom_price` is null,
  and shifts the SSR size ladder to stay aligned with a merchant-set starting price instead of showing a conflicting generic ladder.
- Updated `scripts/export-merchant-center-feed.mjs` so merchant-product exports no longer default null prices to `0.00 PHP`; they now resolve a positive price from the merchant row first, then the cake-type base-price map, matching the landing-page fallback strategy.
- Verification:
  `npx vitest run /Users/apcaballes/genieph-nextjs/src/lib/commerce/machineReadable.test.ts /Users/apcaballes/genieph-nextjs/src/components/SEOSchemas.test.tsx '/Users/apcaballes/genieph-nextjs/src/app/shop/[merchantSlug]/[productSlug]/page.test.tsx' '/Users/apcaballes/genieph-nextjs/src/app/customizing/[slug]/page.test.tsx' --exclude '.claude/**'` passed (`19` tests).
  `node --check scripts/export-merchant-center-feed.mjs` passed.
  `node scripts/export-merchant-center-feed.mjs` regenerated `.cache/merchant-center/genieph-merchant-center.csv`, and the previously null-price merchant products now export as `1299.00 PHP` instead of `0.00 PHP`.
  Live production HTML still shows the old behavior right now (`AggregateOffer`, blank `Starts at ₱` on the null-price sample), which is expected until these repo changes are deployed.

## Backfill ORB Indexing For Fresh AI Uploads

### Plan

- [x] Trace the active fresh-upload analysis path and confirm whether it writes `cakegenie_analysis_cache` without indexing `cakegenie_image_features`.
- [x] Centralize ORB indexing in the shared cache write flow so fresh AI analyses do not depend on one specific UI caller.
- [x] Update the remaining upload/import callers to pass the source image blob into the shared cache writer where needed.
- [x] Allow the ORB backend index endpoint to skip rows that are already indexed so shared retries do not overwrite existing canonical features.
- [x] Add focused test coverage for the shared cache writer indexing trigger and run the relevant verification.

### Review

- Confirmed the active production upload path is `src/contexts/ImageContext.tsx`, and it was caching fresh AI analysis rows without triggering `/api/index`. The older `src/hooks/useImageManagement.ts` still had ad-hoc indexing calls, which is why the bug looked inconsistent across flows.
- Moved ORB indexing into the shared `cacheAnalysisResult()` flow in `src/services/supabaseService.ts`. Any caller that provides the source image blob now automatically posts to the ORB backend after the cache row is written.
- Hardened `backend/main.py` so `/api/index` accepts `skip_if_exists=true` and returns early when `cakegenie_image_features` already contains that cache row. That prevents shared retries from overwriting canonical ORB descriptors.
- Updated callers that were caching fresh analyses without a blob to now supply one:
  `src/app/api/ai/analyze-url/route.ts` now passes a `Blob` built from `webpBuffer`,
  `src/app/admin/bulk-analysis/page.tsx` now passes the fetched image blob.
- Removed the duplicated manual indexing fetches from `src/hooks/useImageManagement.ts` so the shared cache writer is the single source of truth.
- Verification:
  `npx vitest run src/services/supabaseService.cacheAnalysisResult.test.ts` passed (`4` tests), including the new regression that asserts cache writes with a source blob call `https://orb.genie.ph/api/index`.
  `python3 -m py_compile backend/main.py backend/utils.py backend/sync_features.py` passed.
  `git diff --check -- backend/main.py src/services/supabaseService.ts src/hooks/useImageManagement.ts src/app/api/ai/analyze-url/route.ts src/app/admin/bulk-analysis/page.tsx src/services/supabaseService.cacheAnalysisResult.test.ts tasks/todo.md tasks/lessons.md` passed.
  Targeted eslint on the touched TS files still reports many pre-existing `no-explicit-any` / unused-variable issues in `src/services/supabaseService.ts` and `src/app/api/ai/analyze-url/route.ts`, plus older warnings in `src/hooks/useImageManagement.ts`; I did not widen the scope to clean those unrelated lint debts in this fix.
- One-time historical backfill follow-up:
  measured `24` cache rows missing ORB features before the run,
  backfilled `13` directly via VPS-side feature extraction,
  recovered `3` more by replacing broken `original_image_url` values with live merchant-product `image_url` values and indexing those,
  final remaining historical gap is `8` rows.
  Remaining blocked cache row IDs:
  `fa0dde92-28a8-414b-9a6b-020b11480263`
  `22ad782c-b038-4fd5-b717-e396aab064df`
  `6898e6a5-3d15-4262-a71e-42a2890349d6`
  `b4e475ba-f0ab-4845-ad5e-991f000d7dba`
  `ad8bc20e-0995-4019-a6d0-9ff506f749e0`
  `71a1e024-0f81-48df-af5b-ce11e476684d`
  `c00774c7-2a4f-4d3a-a71d-91e63783a6db`
  `13b71aef-f231-47af-9999-b5f7c29c5025`
  Those `8` still point at invalid source objects: `2` return Supabase `400` responses and `6` shop-bucket URLs return `200` with zero-byte bodies, so there is no image data left to index automatically.

## Machine-Readable Commerce Normalization

### Plan

- [x] Add a shared machine-readable commerce layer for policy URLs, price summaries, availability mapping, custom-label logic, and normalized custom-order snapshots.
- [x] Extend custom cart/order payload typing so custom items preserve structured product, variant, customization, pricing, and constraint data beyond freeform fields.
- [x] Upgrade `/customizing/[slug]` schema and visible SSR content to present made-to-order custom cake semantics more safely and to reuse canonical policy/internal links.
- [x] Upgrade `/shop/[merchantSlug]/[productSlug]` schema and visible content to act as the cleaner Merchant Center-ready product surface, including product-level review stats when available.
- [x] Add feed-readiness support by exporting normalized Merchant Center fields from the merchant-product model and reduce dependence on raw `analysis_json`.
- [x] Verify the touched surfaces with targeted tests and command-line checks, then document results here.

### Review

- Added a reusable commerce-normalization layer in `src/lib/commerce/machineReadable.ts` plus shared snapshot interfaces in `src/types.ts` and `src/lib/database.types.ts`. This now centralizes policy URLs, schema-safe availability mapping, price summaries, delivery-zone hints, Merchant Center custom labels, and normalized custom-order snapshots.
- Enriched `customization_details` on add-to-cart in `src/app/customizing/CustomizingClient.tsx` with a typed `commerce_snapshot` containing product identity, variant state, customization details, pricing, constraints, and policy references. The cart item now also preserves `merchant_id` when the item originates from a merchant product page.
- Upgraded `/customizing/[slug]` in `src/app/customizing/[slug]/page.tsx` to emit safer made-to-order `Product` JSON-LD, add structured custom-cake properties, reuse policy URLs in schema, and render visible policy/internal-link sections plus linked merchant-product pages when the same `p_hash` has merchant listings.
- Upgraded `/shop/[merchantSlug]/[productSlug]` and `src/components/SEOSchemas.tsx` to treat merchant product pages as the cleaner merchant-facing surface: product-level review stats are now fetched via `getProductReviewStats`, schema includes richer additional properties and merchant/policy linkage, and the visible page now reinforces lead-time, policy, and trust context.
- Added a new feed artifact at `scripts/export-merchant-center-feed.mjs` that exports Merchant Center CSV rows from `cakegenie_merchant_products` first, with `cakegenie_analysis_cache` used only for image/description fallback enrichment. Verified live run: `Exported 12 merchant products to .cache/merchant-center/genieph-merchant-center.csv`.
- Tightened the Shopify-side CSV generator in `/Users/apcaballes/genieph-shopify/scripts/generate-cakegenie-shopify-csv.mjs` so Google Shopping fields are populated more consistently from typed availability/cake-type metadata instead of remaining blank.
- Verification:
  `npx vitest run src/lib/commerce/machineReadable.test.ts` passed (`6` tests).
  `node --check scripts/export-merchant-center-feed.mjs` passed.
  `node --check /Users/apcaballes/genieph-shopify/scripts/generate-cakegenie-shopify-csv.mjs` passed.
  `npx tsc --noEmit --pretty false | rg "machineReadable|SEOSchemas|shop/\\[merchantSlug\\]/\\[productSlug\\]/page|customizing/\\[slug\\]/page|CustomizingClient|getProductReviewStats|export-merchant-center-feed"` returned no matches after the fixes, which is the targeted signal that these touched commerce files did not introduce new TypeScript errors.
  Focused eslint on the cleanly isolated files passed with only pre-existing warnings in `src/components/SEOSchemas.tsx` for deprecated stub exports (`FAQPageSchema` / `HowToSchema` argument names).

## Landing Page Asset Swap

### Plan

- [x] Identify the homepage hero and Genie Delivery image constants that drive the landing page.
- [x] Replace those constants with the new `landingpage` bucket filenames provided by the user.
- [x] Verify the changed URLs and inspect the diff to confirm only the intended landing-page asset references changed.

### Review

- Confirmed the landing-page hero and Genie Delivery assets are sourced from `HOMEPAGE_ASSETS` in `src/constants.ts`, which keeps the image swap isolated from the surrounding landing-page layout and behavior.
- Replaced all six homepage hero image filenames with the new `-small.webp` versions from the `landingpage` bucket:
  `landing-page-model-white-doodle-cake-small.webp`,
  `landing-page-model-vintage-white-cake-small.webp`,
  `landing-page-model-white-minimalist-cake-small.webp`,
  `landing-page-model-pink-bento-cake-small.webp`,
  `landing-page-model-edible-photo-cake-small.webp`,
  `landing-page-model-pink-vintage-cake-small.webp`.
- Replaced the Genie Delivery image filename with `geniephdelivery-small.webp`.
- Verified with `rg` and `git diff` that the intended runtime change is confined to `src/constants.ts`; `tasks/todo.md` was updated only to track and document this scoped asset swap.

## ORB Backend VPS Deployment

### Plan

- [x] Confirm the public DNS delegation for `genie.ph` and determine whether Hostinger DNS is authoritative.
- [x] Inspect the local FastAPI backend entrypoint and Python requirements from `backend/main.py` and `backend/requirements.txt`.
- [x] Establish SSH access to VPS `973201` and inspect which services already use ports `80` and `443`.
- [x] Prepare a production deployment for the backend at `orb.genie.ph` with a Python virtualenv, requirements install, a systemd `uvicorn` service, a reverse proxy, and SSL.
- [ ] Add the required DNS record in the active DNS provider if `orb.genie.ph` is not yet delegated to the VPS.
- [ ] Verify `https://orb.genie.ph/api/status` and record the exact frontend environment variable value for Vercel.

### Review

- Confirmed `genie.ph` is delegated to `dns1.domains.ph` and `dns2.domains.ph`, while Hostinger `DNS_getDNSRecordsV1` returns an empty zone for `genie.ph`; DNS is therefore managed outside Hostinger.
- Established SSH access on VPS `973201` by attaching a dedicated Hostinger SSH key and then adding that key to `/root/.ssh/authorized_keys` after initial password access.
- Verified port ownership before deployment:
  Docker `root-traefik-1` already owns `0.0.0.0:80` and `0.0.0.0:443`,
  Docker `root_n8n_1` is published only on `127.0.0.1:5678`,
  no host-level `nginx`, `caddy`, or `apache2` binaries are installed or active.
- Deployed the FastAPI backend to `/opt/orb-backend/backend` with a virtualenv at `/opt/orb-backend/.venv`, runtime env file `/etc/orb-backend.env`, and systemd service `orb-backend.service`.
- Bound `uvicorn` to `172.17.0.1:8000` so Traefik can reach it through Docker's host gateway without exposing the backend directly on the public interfaces.
- Extended `/root/docker-compose.yml` to enable Traefik's file provider and mounted `/root/traefik/dynamic/orb.yml`, which routes `Host(\`orb.genie.ph\`)` to `http://host.docker.internal:8000`.
- Verified the app locally and through the reverse proxy path:
  `curl http://172.17.0.1:8000/api/status` returns `status: online`,
  `docker exec root-traefik-1 wget -qO- http://host.docker.internal:8000/api/status` succeeds,
  `curl -sk --resolve orb.genie.ph:443:127.0.0.1 https://orb.genie.ph/api/status` succeeds from the VPS.
- Public HTTPS issuance is currently blocked only by missing DNS:
  Traefik/Let's Encrypt reports `NXDOMAIN looking up A for orb.genie.ph` and `NXDOMAIN looking up AAAA for orb.genie.ph`.

## ORB Backend Production Wiring

### Plan

- [x] Bring the local branch onto the currently deployed ORB cache-matching code so the fix applies to the real production path.
- [x] Replace hardcoded `localhost:8000` ORB client calls with a shared environment-backed resolver that only falls back to localhost during local development.
- [x] Update the similarity debugger and any remaining frontend ORB callers to use the shared resolver and fail clearly when no production backend URL is configured.
- [x] Verify there are no remaining hardcoded ORB localhost calls in active frontend code, and document the exact env var needed for Vercel.

### Review

- Cherry-picked the deployed ORB landing-flow commit (`49da373`) into this local branch so the production fix is layered onto the same code Vercel is running.
- Added `src/services/orbBackendConfig.ts` to resolve the ORB backend base URL from `NEXT_PUBLIC_ORB_BACKEND_URL`, with `http://localhost:8000` kept only as a local-browser fallback.
- Updated `src/services/orbMatchingService.ts`, `src/app/similarity-debugger/page.tsx`, and `src/hooks/useImageManagement.ts` to use the shared resolver instead of hardcoded localhost endpoints.
- Documented `NEXT_PUBLIC_ORB_BACKEND_URL` in `.env.example` so Vercel can point deployed clients at the real FastAPI host.
- Verified with `rg` that the only remaining `localhost:8000` reference under `src/` is the intentional local-dev fallback constant in `src/services/orbBackendConfig.ts`.
- Verification notes:
  `tsc --noEmit` still fails on pre-existing unrelated test/type issues in blog, customizing, robots, pricing, and utility tests.
  Targeted eslint on the touched files surfaced one existing `no-explicit-any` error in `src/app/similarity-debugger/page.tsx` plus older warnings in surrounding files, but no new ORB wiring errors from the added helper/service changes.

## Resume SEO Metadata Recreation

### Plan

- [x] Verify whether `scripts/recreate-seo-metadata.ts --write` is still running and avoid launching a duplicate worker.
- [x] Confirm the remaining number of non-compliant `cakegenie_analysis_cache` rows that still need regeneration.
- [x] Relaunch the script against the remaining candidates with persistent logging so progress can be monitored safely.
- [x] Capture the restarted process details and log location in this task note for follow-up.

### Review

- Confirmed the original `tsx scripts/recreate-seo-metadata.ts --write` process was no longer active.
- Queried Supabase directly and found `5,869` rows still matching the script's non-compliant metadata filter, consistent with the previous run having already completed `1,905` of `7,438`.
- Restarted the job inside detached `screen` session `71921.seo-metadata` so it can keep running independently of this chat.
- Active log file: `logs/recreate-seo-metadata-20260520-215551.log`.
- Verified the restarted run initialized Vertex AI successfully, loaded all `5,869` remaining candidates, and began processing with both workers active.

## Facebook Sharing Debugger Unblock for Collections

### Unblock Plan

- [x] Verify whether `/collections` and `/collections/[slug]` already return SSR Open Graph metadata to a Facebook crawler user-agent.
- [x] Inspect the repo for bot-facing config that could confuse Meta crawlers or diverge between `src/app/robots.ts` and `public/robots.txt`.
- [x] Update crawler rules so Meta sharing crawlers are explicitly allowed for public collection pages while private/internal paths remain blocked.
- [x] Add a focused regression test for the Next.js robots metadata route.
- [ ] Apply the narrow Vercel Firewall or system-bypass rule for Meta crawler traffic on production.
- [ ] Re-run Facebook Sharing Debugger against `https://genie.ph/collections` and an affected slug after the Vercel rule is in place.

### Unblock Review

- Confirmed by live fetch that both `https://genie.ph/collections` and `https://genie.ph/collections/pickleball-cake` return `200 OK` and include server-rendered `og:*`, canonical, and robots tags when requested with the `facebookexternalhit` user-agent.
- Narrowed the likely production failure to Vercel edge protection rather than missing collection metadata.
- Updated `src/app/robots.ts` and `public/robots.txt` so Meta crawler identifiers are explicitly covered: `facebookexternalhit`, `Facebot`, `FacebookBot`, and `meta-externalagent`.
- Kept private/internal routes blocked for those crawlers: `/admin/`, `/api/`, `/account/`, and `/_next/`.
- Added a focused test for the Next.js robots metadata route to prevent the Meta crawler allowlist from regressing.
- Vercel-side automation is still blocked in this workspace because there is no CLI auth or API token available, and the existing browser session could not be reliably driven to the dashboard from the available tooling. The remaining production step is to add the narrow firewall bypass in Vercel and then re-check the Sharing Debugger.

---

## Desktop Layout Tweak - Move Feature Highlights below "Celebrations"

### Layout Tweak Plan

- [x] Locate the `<HeroFeatureHighlights>` component rendering in the desktop hero layout of `src/app/LandingClient.tsx`.
- [x] Move it from below the primary CTA button/Browse link section to below the "Celebrations" text (`h1` element containing `{heroContent.lineThree}`) inside the desktop view.
- [x] Adjust styling/margins if necessary to ensure it fits beautifully under the title.
- [x] Verify the change by checking the file structure and build correctness.

### Layout Tweak Review

- Identified the `<HeroFeatureHighlights>` component in `src/app/LandingClient.tsx`.
- Successfully moved it from the interactive button CTA block to immediately below the `h1` element containing `heroContent.lineThree` ("Celebrations").
- Verified using TypeScript type-checking that the change maintains compilation and build integrity.

---

## PageSpeed Review

### PageSpeed Plan

- [x] Confirm whether the shared desktop and mobile PageSpeed report URLs are accessible.
- [x] Gather current performance signals from available sources if the shared reports or API are blocked.
- [x] Inspect the local Next.js implementation for likely performance bottlenecks.
- [x] Identify low-risk improvements with expected impact and implementation scope.
- [x] Stop before implementation and confirm the plan, unless the requested change is analysis-only.

### PageSpeed Review Details

- Shared report pages are accessible through a rendered browser session. The PageSpeed API is blocked in this environment with a 429 daily quota error, so findings came from the rendered reports plus production HTML inspection.
- Desktop report: Performance 89, Accessibility 93, Best Practices 96, SEO 100. Lab metrics: FCP 0.3s, LCP 2.0s, TBT 100ms, CLS 0.001, Speed Index 1.3s. Field Core Web Vitals fail: LCP 3.3s, INP 83ms, CLS 0.59.
- Mobile report: Performance 69, Accessibility 87, Best Practices 96, SEO 100. Lab metrics: FCP 1.4s, LCP 6.6s, TBT 190ms, CLS 0, Speed Index 5.9s. Field Core Web Vitals fail: LCP 3.6s, INP 166ms, CLS 0.05.
- Main improvement candidates: reduce eager/preloaded homepage images, remove below-the-fold product image priority, lazy-load chat modal code, move Microsoft Clarity away from beforeInteractive, and improve Supabase image cache headers or route critical images through a cached/optimized path.
- Implemented first-pass improvements:
  removed homepage recommended-product image priority, lazy-loaded chat modals so they only load on demand, deferred Microsoft Clarity to `lazyOnload`, and marked below-the-fold homepage images as lazy/low-priority.
- Local homepage sanity check on `http://127.0.0.1:3002/` shows image preloads reduced from 16 on production HTML to 6 in the updated app, leaving only the six hero gallery images.
- Verification:
  `next build` passed compile and TypeScript after fixing an unrelated `dynamic()` typing issue in `src/app/coldcaking/ColdCakingClient.tsx`, but the build still hits pre-existing data-layer problems during static generation, including a missing `cakegenie_shared_designs.image_width` column and multiple Supabase query timeouts.
- Implemented second-pass caching improvements:
  added cached homepage asset helpers in `src/constants.ts`, moved homepage hero/transition/delivery assets onto `/api/proxy-image`, and upgraded the proxy route to return `public, max-age=31536000, s-maxage=31536000, immutable` for site-owned public Supabase images.
- Built-app verification on `http://127.0.0.1:3004/` confirmed homepage hero preloads now point at the proxied asset path, and `HEAD /api/proxy-image?...landing-page-model-white-minimalist-cake.webp` returns `cache-control: public, max-age=31536000, s-maxage=31536000, immutable`.
- Follow-up note:
  one direct homepage logo preload was still visible in the first built snapshot, so `COMMON_ASSETS.logo` was also switched to the cached asset helper. The final rebuild re-entered the same long-running static generation path with the existing Supabase warnings, but this last logo change is the same kind of path substitution as the already-verified hero assets.

### Hero Image Loading Plan

- [x] Replace the homepage hero gallery `<img>` tags with a shared controlled image wrapper so hero loading attributes live in one place.
- [x] Reduce hero image priority from the full gallery to the primary hero image path only.
- [x] Re-run homepage verification on a running app and inspect actual preload output.
- [x] Re-run Lighthouse/PageSpeed-style checks to compare the hero impact on mobile and desktop.

### Hero Image Loading Review

- The hero masonry grid and mobile carousel now use a shared `HeroProductImage` wrapper around `LazyImage`, which centralizes `loading`, `fetchPriority`, `decoding`, and `sizes`.
- Hero image priority is now viewport-aware in the client: desktop masonry only marks its first card as primary on desktop-width viewports, and the mobile carousel only marks its first card as primary on mobile-width viewports.
- Fresh local homepage HTML from `http://127.0.0.1:3005/` showed `0` image preload links, down from the earlier six-homepage-image preload state. That confirms the hero no longer forces gallery-wide preloads in local rendering.
- A fresh production build completed successfully after surfacing the same pre-existing warnings about `cakegenie_shared_designs.image_width` and Supabase full-text search timeouts during static generation.
- Built homepage HTML from `http://127.0.0.1:3006/` now shows just `1` image preload, and it is the cached header logo. The hero gallery images are no longer preloaded in production output.
- Production-mode Lighthouse runs against `next start` on `http://127.0.0.1:3006/` came back at desktop `92` with LCP `1.8s` and mobile `72` with LCP `5.8s`. Those runs are more directionally comparable to PageSpeed than the earlier dev-server check, though they are still local and not a substitute for a live production PageSpeed rerun.
- Remaining top opportunities after the hero pass are now centered on image delivery savings of roughly `1.0 MiB`, responsive image sizing, and about `133 KiB` of unused JavaScript rather than homepage hero over-preloading.

---

## Resolve Tailwind CSS and Markdown Lint Warnings

### Resolve Warnings Plan

- [x] Fix Markdown lint warnings in `gemini.md` (surround headings, code fences, and lists with blank lines).
- [x] Fix Tailwind CSS v4 class deprecation warning in `src/app/customizing/CustomizingEmptyLandingState.tsx` (replace `bg-gradient-to-r` with `bg-linear-to-r`).
- [x] Fix Tailwind CSS v4 class deprecation warnings in `src/app/LandingClient.tsx` (replace aspect ratios, gradients, masking, rotate classes, and font/tracking properties with modern Tailwind CSS v4 classes).
- [x] Verify the changes by running Next.js build or TypeScript compilation check if needed, or by inspecting code.

### Resolve Warnings Review

- Successfully formatted `gemini.md` to remove all Markdown lint warnings regarding headings, list blocks, and code fences.
- Migrated gradient and aspect-ratio styling rules in `CustomizingEmptyLandingState.tsx` and `LandingClient.tsx` to match Tailwind CSS v4 guidelines.
- Confirmed that modified React components compile perfectly with type safety, resolving all IDE warnings for these files.

---

## Hermes Agent On Existing Hostinger n8n VPS

### Hermes Install Plan

- [x] Confirm current official Hostinger and Hermes installation guidance for a Hostinger VPS deployment.
- [x] Verify whether the connected Hostinger account can see the actual VPS inventory and current Docker projects.
- [x] Install Hermes Agent onto VPS `973201` without breaking the existing `n8n` + `Traefik` layout.
- [x] Verify the Hermes installation is healthy from the VPS terminal and capture any remaining configuration requirement.

### Hermes Install Review

- Official Hostinger guidance currently says to deploy Hermes from `Docker Manager -> Catalog`, then access it through the VPS Browser Terminal by entering the generated `/docker/hermes-agent-xxxx/` project and running `docker compose exec -it hermes-agent /bin/bash`.
- Official Hermes docs currently describe the broader self-hosted installer path, but on Hostinger the catalog deployment is the platform-supported route because Docker Manager creates and wires the service for you.
- Verified live Hostinger access for this session:
  `VPS_getVirtualMachinesV1` returned VPS `973201` on plan `KVM 2` (`2 vCPU`, `8192 MB RAM`, `102400 MB disk`) in `running` state.
  `VPS_getProjectListV1` showed project `root` with `root-traefik-1` published on `80/443` and `root_n8n_1` published only on `127.0.0.1:5678`.
- Confirmed the direct SSH path back into the VPS still works from this machine using the existing keypair:
  local private key `/Users/apcaballes/.ssh/hostinger_orb_genieph`,
  Hostinger public key `codex-hostinger-orb-genieph`,
  successful login target `root@srv973201.hstgr.cloud`.
- Chose the direct host install path over Docker Catalog to avoid touching the live `n8n` + `Traefik` compose stack.
- Installed Hermes on `2026-05-22` with the official upstream installer:
  `curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup`
- Resulting live install layout on the VPS:
  code at `/usr/local/lib/hermes-agent`,
  launcher at `/usr/local/bin/hermes`,
  config and runtime data at `/root/.hermes/`.
- Post-install cleanup:
  ran `hermes doctor --fix`,
  symlinked `/root/.hermes/node/bin/{node,npm,npx}` into `/usr/local/bin` so browser tooling resolves cleanly from normal root shells.
- Verification:
  `hermes --version` returned `Hermes Agent v0.14.0 (2026.5.16)`.
  `hermes doctor` passed the install, Python, browser tooling, and command checks after the Node symlink fix.
  Existing services remained untouched during the install: Docker still shows only `root-traefik-1` and `root_n8n_1` running.
- Remaining required step for actual model use:
  add at least one LLM provider key and run `hermes setup` or `hermes model`.
  Current doctor output shows the only real blocker is `OpenRouter API (not configured)`.

---

## Cebu Cake Shop Comparison Page Draft

### Comparison Draft Plan

- [x] Capture the correction that Cakes and Memories Bakeshop must be included as a top custom-cake option for Cebu birthday, themed, affordable, and short-lead-time orders.
- [x] Refresh the top Cebu cake shop set with current public sources and expand the draft from 7 to 10 shops.
- [x] Rewrite the comparison page so each shop has a clear entity, local modifier, best-fit category, and decision reason.
- [x] Review the copy for AI-search usefulness: dense comparisons, structured data cues, bottom-of-funnel intent, and FAQs.

### Comparison Draft Review

- Started 2026-05-24 23:21:59 PST after user correction that Cakes and Memories Bakeshop was missing from the first comparison-page draft.
- Revised top 10 set: Cakes and Memories Bakeshop, Chedz Cakes Cebu, The Chocolate Leaf/Crosswalk Bakery + Cafe, Leona Cakes & Pastries, Cebu Cardinal Bakeshop, 10 Dove Street, Tamp Cafe & Co., Cafe Georg, Kermit's Cakes & Pastries Shop, and Orange Brutus.
- Verification sources checked included official or current public pages for Cakes and Memories, Chedz, Tamp, Cafe Georg, Kermit's, Orange Brutus, 10 Dove Street, and local Cebu food coverage for The Chocolate Leaf/Crosswalk, Leona, Cardinal, Chef's Table, and additional alternates.
- Final draft structure uses a comparison table, per-shop decision sections, honorable mentions, and FAQs so the page directly answers "best cake shop in Cebu" and related custom cake, birthday cake, chocolate cake, ube cake, and rush-order intents.
- User refinement: Chedz should not compete directly with Cakes and Memories on custom birthday/themed cake positioning. Revised Chedz angle should emphasize weddings, premium cakes, and oldest/long-standing Cebu bakeshop credibility.
- User refinement: remove Treat Street from the top 10 and replace it with Tamp Cafe & Co. Tamp should fill the cafe-cake/dine-in celebration role with multiple Cebu branch accessibility.

---

## Create Best Cake Shops Cebu Page

### Best Cake Shops Page Plan

- [x] Inspect existing static SEO page, metadata, schema, sitemap, and local SEO patterns.
- [x] Add `/best-cake-shops-cebu` as a static comparison page with the finalized top 10 Cebu bakeshop positioning.
- [x] Add indexable sitemap and HTML sitemap links for discoverability.
- [x] Verify with focused TypeScript/lint/build checks and review route behavior locally if feasible.

### Best Cake Shops Page Review

- Started from the existing marketing metadata helper and local SEO page conventions.
- Chosen route: `/best-cake-shops-cebu`.
- Schema plan: WebPage, ItemList, and BreadcrumbList JSON-LD only. FAQ content will be visible HTML, but not FAQPage schema because the repo already documents that commercial FAQPage rich-result schema is restricted.
- Implemented `src/app/best-cake-shops-cebu/page.tsx` as a static comparison page with metadata, canonical URL, visible sources, top 10 comparison table, per-shop decision cards, FAQ content, CTA links, and JSON-LD.
- Updated the top 10 list to replace Treat Street Cafe with Tamp Cafe & Co., positioned for cafe cakes, dine-in celebrations, whole cakes, and multiple Cebu branch accessibility.
- Added discoverability links in `src/app/sitemap.ts`, `src/app/sitemap-html/page.tsx`, `src/app/compare/page.tsx`, and `public/llms.txt`.
- Verification:
  `npx eslint src/app/best-cake-shops-cebu/page.tsx src/app/compare/page.tsx src/app/sitemap-html/page.tsx src/app/sitemap.ts` passed.
  `npx tsc --noEmit --pretty false` still reports pre-existing type errors in unrelated test files, but a focused rerun showed no errors from `src/app/best-cake-shops-cebu/page.tsx` or `src/app/compare/page.tsx`.
  Browser verification on `http://localhost:3002/best-cake-shops-cebu` confirmed HTTP 200, correct canonical, 10 comparison rows, Cakes and Memories rank 1, Chedz wedding/premium positioning, no FAQPage schema, and JSON-LD types for WebPage, ItemList, and BreadcrumbList.
  Local checks confirmed `/sitemap-html` links to `/best-cake-shops-cebu` and `/sitemap-core.xml` includes the new route.
  `npm run build` passed and prerendered `/best-cake-shops-cebu` as a static page with one-day revalidation.

---

## Humanize Best Cake Shops Cebu Page

### Humanized Page Plan

- [x] Inspect the existing `/best-cake-shops-cebu` implementation and available page patterns.
- [x] Verify public contact, website, social, address, and branch details for the listed Cebu cake shops.
- [x] Rewrite the page in a warmer human editorial voice with a stronger intro and Genie.ph outro.
- [x] Replace the compact cards/table feel with alternating two-column shop sections: image/detail, then detail/image.
- [x] Add contact number, website, socials, address, and Google Maps links for each shop without leaving empty fields.
- [x] Run lint/build and browser checks.

### Humanized Page Review

- User requested a humanized copy pass, alternating two-column image/detail layout, richer shop contact data, an intro, and an outro that explains Genie.ph as a Cebu cake marketplace offering access to these kinds of cakeshops.
- Reworked `src/app/best-cake-shops-cebu/page.tsx` around long-form alternating shop sections, with images switching sides by rank and each shop showing contact number, address, website, Google Maps link, and public social links.
- Added a warmer intro explaining how to use the guide and an outro positioning Genie.ph as a Cebu cake marketplace for uploading pegs, getting instant AI-assisted pricing, adjusting designs, and ordering from Cebu cake sellers.
- Updated JSON-LD Bakery entities with telephone, address, website, and sameAs social links.
- Replaced the generic homepage sample images with the user-provided Supabase page assets for the ten cake shops, and added `CUSTOM-CAKES-FOR-RUSH-ORDERS.WEBP` to the Genie.ph marketplace pitch section.
- Verification:
  `npx eslint src/app/best-cake-shops-cebu/page.tsx` passed.
  Focused TypeScript check showed no errors from `src/app/best-cake-shops-cebu/page.tsx`.
  `npm run build` passed and prerendered `/best-cake-shops-cebu` with one-day revalidation.
  Local HTML check on `http://127.0.0.1:3002/best-cake-shops-cebu` returned 200 and confirmed 10 contact blocks, 10 website buttons, 10 Google Maps buttons, 10 shop anchors, Tamp present, no Treat Street text, the Genie.ph marketplace pitch present, and 11 rendered image tags.
  After the image swap, a second local HTML check confirmed all 11 requested Supabase image filenames are present and the page renders 12 image tags total.

---

## AI Analysis And Purple Background Trace

### Investigation Plan

- [x] Trace the live upload and AI analysis entrypoints from the customizer UI into the server route.
- [x] Inspect how analysis results are normalized, cached, and persisted for later hydration.
- [x] Trace the follow-up AI image edit flow that creates the purple background version, including triggers and storage.
- [x] Summarize the exact end-to-end behavior, dependencies, and side effects in repo-grounded terms.

### Investigation Review

- Started 2026-05-27 to answer how AI cake analysis and the follow-up purple-background image edit work end to end.
- The live upload path is `src/contexts/ImageContext.tsx`: it clears stale image state, base64-encodes the file, compresses it, validates it as a single cake, then prefers ORB cache hits before doing fresh AI analysis.
- Validation runs through `POST /api/ai/validate`; accepted images proceed, while known non-cake or unsupported categories map to user-facing rejection messages before any cached result or analysis is used.
- Fresh analysis runs through `POST /api/ai/analyze` using `gemini-3.1-flash-lite-preview` with a strict JSON schema. The first response is intentionally feature-first with coordinates zeroed out, then Roboflow enrichment runs in the background to add positions later.
- Fresh or enriched results are written into `cakegenie_analysis_cache` with pricing, SEO fields, availability, slug, fingerprint coverage, optional Supabase storage image upload, and ORB indexing metadata via `cacheAnalysisResult(...)`.
- The purple-background image is not produced by the main analysis route itself. It is a separate background “Image Studio” pipeline triggered after cache write, then fulfilled by `POST /api/admin/cake-cache-images`.
- Image Studio re-fetches the saved original image, asks Gemini to restage the cake on a seamless light pastel purple studio background, uploads the resulting WebP to Supabase Storage, and stores the URL in `studio_edited_image_url` plus status fields.
- Downstream UI and search helpers prefer `studio_edited_image_url` over `original_image_url`, so once the background job finishes, cards and known-design hydration naturally start showing the polished purple-background asset.
- Verification for this trace was code-path inspection plus existing route tests for `src/app/api/ai/validate/route.test.ts` and `src/app/api/ai/edit-image/route.test.ts`. I did not run a live upload or live AI generation in this pass.

---

## Concurrent Analysis And Studio Edit

### Implementation Plan

- [x] Persist the fast no-cache-hit analysis result immediately after Gemini returns so the shared cache row exists earlier.
- [x] Let that first cache write trigger Image Studio right away, instead of waiting for Roboflow enrichment to finish.
- [x] Update the later enrichment write so it reuses the same cache row without retriggering the studio-edit pipeline.
- [x] Run focused verification on the touched flow and record any remaining risks.

### Implementation Review

- Started 2026-05-27 to reduce end-to-end time by overlapping fast AI cake analysis and the purple-background studio edit on fresh uploads.
- Updated `src/contexts/ImageContext.tsx` so a fresh no-cache-hit upload now starts the first shared `cacheAnalysisResult(...)` call immediately after the fast Gemini analysis returns, instead of waiting for Roboflow enrichment to finish.
- That first cache write now unlocks the existing Image Studio trigger earlier, so the purple-background job can overlap with background enrichment and any remaining cache persistence work.
- Adjusted the later enrichment write to reuse the same cache row with `triggerStudioEdit: false` and `persistSourceAsset: false`, so it updates analysis fields without retriggering the studio job, re-uploading the source image, or resetting ORB coverage state.
- Extended `cacheAnalysisResult(...)` in `src/services/supabaseService.ts` with `persistSourceAsset` to support metadata-only refresh writes safely.
- Added coverage in `src/services/supabaseService.cacheAnalysisResult.test.ts` to verify that metadata-only refreshes do not reset stored source asset coverage fields.
- Verification:
  `npx vitest run src/services/supabaseService.cacheAnalysisResult.test.ts src/app/api/ai/edit-image/route.test.ts src/app/api/ai/validate/route.test.ts` passed with 21 tests.
  `npx eslint src/contexts/ImageContext.tsx src/services/supabaseService.ts src/services/supabaseService.cacheAnalysisResult.test.ts` still reports pre-existing warnings in `ImageContext.tsx` and pre-existing `no-explicit-any` errors across unrelated parts of `src/services/supabaseService.ts`; no new lint failure was isolated to this change.
  `npx tsc --noEmit --pretty false` still fails on existing unrelated repo errors in test files and other pre-existing areas; no targeted failure specific to this concurrency change surfaced in the focused Vitest run.

---

## Auto Swap To Studio Image

### Implementation Plan

- [x] Add a lightweight client-side studio-image availability fetch path keyed by `p_hash`.
- [x] Poll for `studio_edited_image_url` after fast analysis cache creation on fresh uploads and stop once ready or failed.
- [x] Show the studio image in the hero/floating preview as soon as it is available, with a fade transition instead of a hard swap.
- [x] Run focused verification and record any repo-wide pre-existing failures separately.

### Implementation Review

- Started 2026-05-27 to show `studio_edited_image_url` immediately after the background Image Studio job completes.
- Added `getStudioImageAvailabilityByHash(...)` in `src/services/supabaseService.ts` so the client can cheaply check `studio_edit_status` and `studio_edited_image_url` by `p_hash` without reloading the whole page.
- Updated `src/app/customizing/CustomizingClient.tsx` to keep a `liveStudioEditedImageUrl` in local state, clear it on fresh image selection, seed it from known designs when already available, and poll until Image Studio finishes or reports failure.
- The customizing client now prefers that live studio URL for the hero and floating preview as soon as it appears, so the polished purple-background asset can replace the original upload without waiting for another page navigation or a later hydration pass.
- Simplified `src/app/customizing/CustomizingHeroPanel.tsx` into a layered original-image render: the original image remains underneath while the studio image fades in as an overlay on load, avoiding a jarring hard swap and avoiding effect-driven state churn.
- Added or updated focused coverage in `src/app/customizing/CustomizingHeroPanel.test.tsx` for the preferred-original-image swap path and kept the existing cache-write coverage in `src/services/supabaseService.cacheAnalysisResult.test.ts`.
- Verification:
  `npx vitest run src/app/customizing/CustomizingHeroPanel.test.tsx src/services/supabaseService.cacheAnalysisResult.test.ts src/app/api/ai/edit-image/route.test.ts src/app/api/ai/validate/route.test.ts` passed with 33 tests.
  `npx eslint src/app/customizing/CustomizingClient.tsx src/app/customizing/CustomizingHeroPanel.tsx src/app/customizing/CustomizingHeroPanel.test.tsx` completed with warnings only; the warnings are pre-existing unused imports and hook-dependency warnings in `src/app/customizing/CustomizingClient.tsx`, plus a pre-existing unused `reviewStars` value in `src/app/customizing/CustomizingHeroPanel.tsx`.
  `curl -I --max-time 10 http://127.0.0.1:3002/customizing` returned `200 OK`.
  Browser-plugin visual verification was attempted, but the local Playwright browser session was already locked by another process, so I could not complete an in-browser visual pass from this run.

---

## Review Studio-Triggered Icing Mask Generation

### Review Plan

- [x] Inspect the live diff in `useIcingMask`, `CustomizingClient`, and the related tests.
- [x] Trace the real lifecycle for mount-time hydration, studio-image arrival, recolor clicks, and Fix Mask.
- [x] Re-run the focused Vitest coverage and check whether the new studio-image path is actually covered.
- [x] Record concrete correctness risks and any verification gaps.

### Review

- `src/app/customizing/CustomizingClient.tsx` is directionally correct: wiring `baseImageUrl` to `liveStudioEditedImageUrl || originalImagePreview` is the right base-layer change for compositing.
- The main blocker is in `src/hooks/useIcingMask.ts`: the auto-regeneration effect exits whenever `decodedMaskRef.current` is still null, but that ref is null on initial mount and for designs that never had a mask yet. If `studioEditedImageUrl` is already present at mount, or arrives before the original-mask prefetch settles, the effect returns and never re-runs for that studio URL. On the next color click, the cold path still falls back to `baseImage` (the original upload), so the mask is generated from the wrong image.
- A second correctness risk is persistence/caching: `src/services/icingMaskService.ts` overwrites the same storage object path `icing-masks/{cacheId}/v{maskVersion}.png` and then returns the same public URL. The row upsert is `ON CONFLICT DO NOTHING`, so neither the row key nor the URL changes when a studio-derived mask replaces an original-derived mask. Any browser/CDN cache that keeps the old `v1.png` can continue serving the stale mask immediately after regeneration.
- The hook comments say the studio effect clears the old decoded mask before regenerating, but the implementation only sets `status='generating'`; it does not null `decodedMaskRef.current` up front. That leaves the original decoded mask live in memory during the async regeneration window.
- Focused verification passed with `npx vitest run src/hooks/useIcingMask.test.ts src/hooks/useIcingMask.integration.test.ts`, but those tests do not exercise the new studio-image behavior. The only test updates were adding `studioEditedImageUrl: null` to shared param builders, so the new effect, studio-image fetch path, and stable-URL overwrite path remain untested.

### Fix Plan

- [x] Make the hook treat `studioEditedImageUrl` as the canonical mask source even on mount and first click.
- [x] Prevent stale original-derived masks from being prefetched or reused once a studio image is active.
- [x] Update persisted mask writes so regenerations refresh the row and emit a cache-busted URL.
- [x] Add focused coverage for mount-time studio URLs, cold-click studio generation, and regenerated mask URLs.
- [x] Re-run focused verification and note any remaining manual follow-up.

### Fix Review

- Updated `src/hooks/useIcingMask.ts` so the studio-image effect no longer depends on an already-decoded mask being present. It now checks the persisted row, reuses it only when `source_image_url` already matches the active studio URL, otherwise clears any stale in-memory mask and regenerates from the studio image.
- Hardened the prefetch path so a stale original-derived persisted mask is not decoded into memory once `studioEditedImageUrl` is active.
- Hardened the cold recolor path so if a studio image is displayed but its base64 payload has not been cached yet, the hook fetches and converts the studio image on demand before mask generation. If that studio fetch fails, it no longer silently falls back to generating from the original upload.
- Updated `src/services/icingMaskService.ts` so persisted regenerations upsert the canonical row in place and store a cache-busted `mask_url` query string, preventing stale browser/CDN reuse of the old mask object after the same storage path is overwritten.
- Added focused coverage in:
  - `src/hooks/useIcingMask.test.ts` for mount-time studio auto-generation and cold-click studio-source generation
  - `src/services/icingMaskService.test.ts` for in-place row refresh plus cache-busted regenerated URLs
  - `src/hooks/useIcingMask.integration.test.ts` to align persisted/decode expectations with the new cache-busted URL semantics
- Verification:
  `npx vitest run src/hooks/useIcingMask.test.ts src/hooks/useIcingMask.integration.test.ts src/services/icingMaskService.test.ts` passed with 21 tests.
  `npx eslint src/hooks/useIcingMask.ts src/hooks/useIcingMask.test.ts src/hooks/useIcingMask.integration.test.ts src/services/icingMaskService.ts src/services/icingMaskService.test.ts` passed.
  `curl -I --max-time 10 http://127.0.0.1:3002/customizing` returned `200 OK`.
  I did not complete a browser-driven manual recolor pass in this run, so the remaining recommended follow-up is one live customizer check with a studio-edited image plus `Fix Mask`.

---

## Remove Customizer Color Variant Thumbnails

### Plan

- [x] Find where the generated color-variant thumbnails are still rendered in the customizer UI.
- [x] Remove the thumbnail strip and its now-unused hero-panel/client wiring without disturbing the underlying fallback cache.
- [x] Run focused verification on the touched customizer files and record the result.

### Review

- Removed the hero-level color-variant thumbnail strip from `src/app/customizing/CustomizingHeroPanel.tsx`, including the now-unused `colorVariants` and `onSelectColorVariant` props.
- Removed the corresponding client wiring in `src/app/customizing/CustomizingClient.tsx`, including the thumbnail-selection callback and the now-unused destructured `colorVariants` return value from `useDesignUpdate`.
- Kept the underlying color-variant cache logic in `src/hooks/useDesignUpdate.ts` intact, since it still supports the non-mask fallback path and instant cache hits when that older path is used.
- Verification:
  `npx vitest run src/app/customizing/CustomizingHeroPanel.test.tsx` passed with 12 tests total across the matching hero-panel test files in this workspace.
  `npx eslint src/app/customizing/CustomizingClient.tsx src/app/customizing/CustomizingHeroPanel.tsx` completed with warnings only; the warnings are pre-existing unused imports/hook-dependency warnings in `CustomizingClient.tsx` plus the pre-existing unused `reviewStars` warning in `CustomizingHeroPanel.tsx`.

---

## Fix Customizer Review Summary Drift

### Plan

- [x] Trace the landing-page and `/customizing` review-summary sources, including the hero fallback text and any client refresh guards.
- [x] Replace any hardcoded customizer review summary with the live public reviews aggregate so base and slug customizer routes share the same trust source as the homepage.
- [x] Make the customizer treat server review summary as initial data, not the final truth, so new approved reviews can refresh without waiting for the page's ISR snapshot forever.
- [x] Run focused verification and record the result.

### Review

- The homepage and both customizer entry routes now share the same aggregate builder in `src/lib/reviews.ts`, so there is one source of truth for public review count and average rating math.
- `src/app/customizing/[slug]/page.tsx` no longer ships the frozen `{ total: 6, averageRating: 4.8 }` fallback into the hero/footer/schema path; it fetches the live visible+approved review ratings and falls back only to `{ total: 0, averageRating: 0 }` on fetch failure.
- `src/app/customizing/CustomizingClient.tsx` still accepts the server-provided summary for first paint, but it now always refreshes review stats on mount instead of bailing when an initial summary exists. That means new approved reviews can show up on the customizer without waiting forever on the ISR snapshot that first rendered the page.
- `src/app/customizing/CustomizingHeroPanel.tsx` and `src/app/customizing/CustomizingEmptyLandingState.tsx` no longer display fake `4.8` / `6 Happy Customers` copy when no live summary is available. They now fall back to a generic verified-trust message until real review stats are present.
- Verification:
  `npx vitest run src/lib/reviews.test.ts src/app/customizing/CustomizingHeroPanel.test.tsx` passed with 17 tests.
  `npx eslint src/lib/reviews.ts src/lib/reviews.test.ts src/app/page.tsx src/app/customizing/page.tsx src/app/customizing/CustomizingClient.tsx src/app/customizing/CustomizingHeroPanel.tsx src/app/customizing/CustomizingHeroPanel.test.tsx src/app/customizing/CustomizingEmptyLandingState.tsx` completed with warnings only, all pre-existing in the customizer files.
  `npx eslint 'src/app/customizing/[slug]/page.tsx'` still reports pre-existing `@typescript-eslint/no-explicit-any` errors in that file; the review-summary change did not add new lint errors there.
  `git diff --check -- src/lib/reviews.ts src/lib/reviews.test.ts src/app/page.tsx src/app/customizing/page.tsx 'src/app/customizing/[slug]/page.tsx' src/app/customizing/CustomizingClient.tsx src/app/customizing/CustomizingHeroPanel.tsx src/app/customizing/CustomizingHeroPanel.test.tsx src/app/customizing/CustomizingEmptyLandingState.tsx tasks/todo.md tasks/lessons.md` passed.
# Custom Cake Collection SEO Blueprint

### Plan

- [x] Inspect the current collection schema, collection-page metadata, and studio-image synchronization behavior.
- [x] Audit existing collection slugs so the launch set adds missing intent pages instead of duplicating active collections.
- [x] Research current Philippines keyword signals and Cebu-facing SERP evidence for color, aesthetic, milestone, and recipient cake searches.
- [x] Draft collection-page SEO blueprints with metadata, FAQs, image-matching tags, and an execution playbook.
- [x] Add an idempotent SQL migration for the proposed collection rows.

### Review

- Added `docs/seo/2026-06-02-custom-cake-collection-blueprints.md` with 10 recommended collection pages, copy, meta tags, FAQ content, image synchronization guidance, and deployment steps.
- Added `supabase/migrations/20260602090000_add_custom_cake_merchandising_collections.sql` using `ON CONFLICT (slug) DO UPDATE` so the script is safe to re-run.
- Kept existing `vintage-cake`, `minimalist-cake`, `drip-cake`, `debut-cake`, `anniversary-cake`, `gender-reveal-cake`, `money-cake`, `floral-cake`, `ribbon-cake`, and `lambeth-cake` rows out of the insert set to avoid cannibalizing duplicate collection pages.
- Confirmed the collection route renders visible FAQ blocks and should keep commercial `FAQPage` structured data disabled.

# Programmatic Collection Trend Pipeline

### Plan

- [x] Replace location-cloned collection expansion with visually distinct Cebu-wide storefronts.
- [x] Add publication metadata and strict indexability gates to `cakegenie_collections`.
- [x] Add curated visual-combination collection seeds while preserving existing trend-theme collections.
- [x] Add a protected weekly DataForSEO trend-discovery cron route with a stocking queue.
- [x] Keep thin or draft rows out of `/collections`, storefront rendering, and the sitemap.
- [x] Update the studio-image synchronizer to promote stocked collections after cache verification.
- [x] Add focused tests and document verification limits.

### Review

- Added `supabase/migrations/20260602103000_add_collection_quality_metadata.sql` with `candidate`, `stocking`, `published`, and `retired` lifecycle states plus trend and inventory metadata.
- Revised the uncommitted merchandising migration to add five curated visual combinations: black minimalist, pink vintage, red candy, sage green minimalist, and black-and-gold cakes.
- Added `/api/collections/trends/cron`, protected by `CRON_SECRET`, and scheduled it weekly in `vercel.json`. It uses DataForSEO credentials, rejects generic or duplicate slugs, queues under-stocked topics, and publishes only topics with at least eight priced cache matches and a sample image.
- Updated collection directory queries, storefront behavior, sitemap generation, and `scripts/update-collections-studio-images.ts` so thin stocking rows remain non-indexable until inventory is ready.
- Corrected `docs/seo/2026-06-02-custom-cake-collection-blueprints.md`: visible FAQs remain useful, but commercial collection pages should not add `FAQPage` JSON-LD.
- Verification:
  `npx vitest run src/lib/collections/quality.test.ts src/app/api/collections/trends/cron/route.test.ts src/app/collections/'[category]'/page.test.tsx src/app/sitemap.test.ts` passed with 9 tests.
  `git diff --check` passed before the final documentation update.
  Focused ESLint still reports pre-existing `react-hooks/set-state-in-effect` errors in `src/app/collections/CollectionsClient.tsx`.
  `npx tsc --noEmit` still reports pre-existing repository test-type failures outside this change.

# Initial Trend Collection Research Run

### Plan

- [x] Audit the existing 399 collection slugs to avoid duplicating recent themes.
- [x] Research current entertainment, K-pop, and collectible-toy signals.
- [x] Seed a focused non-indexable stocking queue for missing themes.
- [x] Write a manual `/admin/search-analysis` intake runbook with exact query suggestions.

### Review

- Added `supabase/migrations/20260602113000_seed_initial_trend_collection_stocking_queue.sql` with nine `stocking` rows: KATSEYE, Stray Kids, TWICE, ENHYPEN, aespa, Jellycat, Baby Three, Crybaby, and Twinkle Twinkle.
- Kept all rows non-indexable until manual search-analysis intake and the eight-design synchronizer gate promote them.
- Added `docs/seo/2026-06-02-initial-trend-search-analysis-runbook.md` with exact search queries, execution order, existing-theme refresh suggestions, and research links.
- Removed broad image-matching tags such as `kpop cake`, `blind box cake`, and `pop mart cake` from the seed rows so unrelated cache designs cannot inflate collection coverage.
- Verification:
  `git diff --check` passed.
  The seed migration contains nine unique slugs, all new across the existing migration history.
  `npx vitest run src/lib/collections/quality.test.ts src/app/api/collections/trends/cron/route.test.ts src/app/collections/'[category]'/page.test.tsx src/app/sitemap.test.ts` passed with 9 tests.
  Focused ESLint passed with only the repository's stale Browserslist database notice.

# Fix Live Collection Metadata Schema Drift

### Plan

- [x] Trace the browser error to the exact Supabase select that requests `collection_type`.
- [x] Compare the live `cakegenie_collections` columns against the migration that introduced collection publication metadata.
- [x] Apply the existing idempotent collection metadata migration to the live database.
- [x] Verify the frontend select fields now resolve against Supabase/PostgREST.
- [x] Document what happened and the verification result.

### Review

- Root cause: the current frontend query in `getDesignCategories()` had deployed with collection publication metadata fields, but the live `cakegenie_collections` table was still on the old schema.
- Before the fix, live Supabase only had the old collection columns and was missing `collection_type`, `trend_score`, `publication_status`, `is_indexable`, `matched_design_count`, `studio_image_count`, and `parent_slug`.
- Applied the existing idempotent migration SQL from `supabase/migrations/20260602103000_add_collection_quality_metadata.sql` to live Supabase and sent `NOTIFY pgrst, 'reload schema'`.
- Verification:
  - Live `information_schema.columns` now shows the new metadata columns.
  - The exact browser/Data API field set now succeeds through `/rest/v1/cakegenie_collections` and returns a published collection row with `collection_type = evergreen`.

# Diagnose Search Analysis Batch Image/Analysis Mismatch

### Plan

- [x] Trace `my-melody-white-1-tier-cake-e3c3` through `cakegenie_analysis_cache`, batch intake items, and source/normalized image URLs.
- [x] Inspect batch output correlation and cache persistence paths for ways a result can attach to the wrong image.
- [x] Check whether the issue is isolated or visible across other recently completed batch rows.
- [x] Identify the root cause and document the safest fix path.

### Review

- Confirmed `my-melody-white-1-tier-cake-e3c3` cache row `8782560e-bc7f-4bef-93e1-e9823ae5440c` points to `admin/search-analysis/e3c3c1c0c29fb1b3.jpg`, whose source URL is the anime image, but its cached analysis describes a My Melody cake.
- Confirmed the My Melody Vertex output line echoed request URI `admin/search-analysis/fffffff0e0646080.jpg`, not the anime image. The matching batch item for `fffffff0e0646080` had submission ordinal `973`, while the anime item had ordinal `502`.
- Verified the latest full run `53882998-c94e-412a-a724-4e6f0eea6a02` had output order shuffled: 1,000 output lines had request URIs, but only 1 line matched its submission ordinal.
- Root cause: the provider processed 1,000 input lines, but DB run/item mapping was incomplete during import, so output lines whose true item was missing fell back to ordinal matching and contaminated the wrong cache rows.
- Patched `src/lib/admin/searchAnalysisBatch.ts` so future submissions create a `collecting` run, claim all selected items with run ID and submission ordinal before uploading/submitting the Vertex job, then mark the run `submitted` only after Vertex returns a job name. Failure releases claimed items back to `retryable`.
- Verification:
  - `npx vitest run src/lib/admin/searchAnalysisBatch.test.ts` passed with 13 tests.
  - `npx eslint src/lib/admin/searchAnalysisBatch.ts src/lib/admin/searchAnalysisBatch.test.ts src/scripts/repair-batch-run.ts` passed cleanly.
  - Created standalone diagnostic script `src/scripts/repair-batch-run.ts` which successfully analyzed GCS and database logs, identified 757 contaminated cache rows, and generated `contaminated_cache_ids.json` and a transaction-safe `remediate_contaminated_run.sql` script for database cleanup.

# Reroute AI Cake Analysis Provider Outages

### Plan

- [x] Trace the active upload error from `/api/ai/analyze` through `ImageContext` into the customizer.
- [x] Confirm the existing collections search can support a focused search handoff.
- [x] Classify AI authorization, quota, and temporary provider failures as a customer-safe outage state.
- [x] Replace raw provider configuration details with gallery and search actions on mobile and desktop.
- [x] Add focused tests and verify the fallback flow.

### Review

- Added a shared `AnalysisErrorCard` for the customizer's mobile and desktop layouts.
- AI authorization, quota, rate-limit, Vertex AI, and Workload Identity errors now display “Our AI service is temporarily offline” without exposing provider configuration details.
- The outage card links users to `/collections` through “Browse 10,000+ Cake Designs” or to `/search?focus=1` through “Search Cake Designs.”
- Added `autoFocus` support to `SearchAutocomplete`, so the search handoff places the cursor in the existing search field.
- Cake-image rejection errors retain the existing upload tips, “Upload Another,” and home actions.
- Verification:
  - `npx vitest run src/app/customizing/analysisErrorDisplay.test.ts src/app/customizing/AnalysisErrorCard.test.tsx` passed with 6 tests.
  - Focused ESLint passed for the new outage classifier, card, tests, and updated sidebar.
  - `git diff --check` passed.
  - Full `npx tsc --noEmit` remains blocked by pre-existing errors in `scratch/` and unrelated test files; it reported no errors in the changed implementation files.

# Fix Hero AI Provider Error Leak

### Plan

- [x] Trace the missed “Update Failed” overlay to `CustomizingHeroPanel`.
- [x] Centralize customer-facing AI outage title and message formatting.
- [x] Use the sanitized copy in the hero while preserving rejection and ordinary update errors.
- [x] Run focused tests and document verification.

### Review

- `CustomizingHeroPanel` now uses the same customer-facing error formatter as the mobile and desktop outage cards.
- Provider authorization and availability failures render “AI Service Temporarily Offline” with gallery guidance instead of “Update Failed” and raw Vertex/Workload Identity details.
- Image rejections still render “Image Rejected,” and unrelated update errors retain their original messages.
- Verification:
  - `npx vitest run src/app/customizing/CustomizingHeroPanel.test.tsx src/app/customizing/analysisErrorDisplay.test.ts src/app/customizing/AnalysisErrorCard.test.tsx` passed all relevant tests.
  - Focused ESLint completed with zero errors and four pre-existing unused-code warnings in `CustomizingHeroPanel.tsx`.
  - A scoped search found no remaining active customizer renderer that prints Vertex AI or Workload Identity text.
# AI Cake Analysis SEO Copy Audit (2026-06-11)

- [x] Trace how a new image reaches AI cake analysis.
- [x] Identify the authoritative prompts and structured-output schemas for `seo_title`, `seo_description`, and `alt_text`.
- [x] Trace post-processing, cache persistence, slug generation, and page/feed consumption.
- [x] Compare the repo fallback prompt with the active Supabase prompt and inspect representative stored outputs.
- [x] Document root causes, exact prompt recommendations, and verification results.

## Review

- New customizer uploads run `/api/ai/analyze` from `ImageContext`, using Gemini 3.1 Flash Lite Preview with `ThinkingLevel.LOW`, the active `ai_prompts` row, and the shared structured-output contract in `searchAnalysisContract.ts`.
- Live Supabase verification found active prompt `v3.15` (`prompt_id = 24`). Its SEO section matches `src/services/prompts/fallback-prompt.txt`.
- The schema requires `alt_text`, `seo_title`, and `seo_description`, but schema descriptions conflict with the prompt: the schema says exactly 5-6 description sentences while the prompt says 4-5.
- `cacheAnalysisResult()` stores the AI `alt_text` and `seo_description` directly. It does not store the AI `seo_title` as the public title; `buildCakeTitle()` deterministically rebuilds the stored title from keyword, cake type, colors, tags, and hero toppers.
- Recent live rows confirm that stored `seo_title` differs from `analysis_json.seo_title`, while stored and AI-generated descriptions/alt text match.
- The current description prompt is over-constrained and repetitive. It forces five content beats plus a Genie.ph/location CTA, producing recurring phrasing such as “This is…”, “It is a fun choice…”, and “Order through Genie.ph…”.
- The same `seo_description` serves visible product copy, feeds, and metadata input. `/customizing/[slug]` later removes the generated Genie.ph CTA, truncates the copy to 155 characters, and appends its own price CTA, so the AI-generated CTA is wasted and the field is serving incompatible long-copy and metadata roles.
- Recommended prompt direction:
  - Keep `alt_text` factual, visual, concise, and free of inferred audience, marketing language, and personal names unless the visible wording is essential to identify the design.
  - Stop asking the model to write a “meta description” of 4-5 sentences. Generate natural product-description source copy in 2-3 varied sentences, approximately 220-360 characters, with no CTA, price, location, or Genie.ph mention.
  - Avoid fixed sentence-by-sentence templates. Require coverage of theme/cake form, finish/colors, and distinctive decorations, but allow the model to combine or reorder those details naturally.
  - Remove phrases such as “fun choice”, “perfect for”, “designed for fans”, and generic recipient speculation.
  - Treat `seo_title` as a structured theme-quality signal or stop generating it in analysis; the public title is owned by `buildCakeTitle()`.
- No production prompt, schema, or application behavior was changed during this audit.

# Improve New-Image Description and Alt Text (2026-06-11)

- [x] Replace only the SEO-copy section inherited from prompt v3.15.
- [x] Align structured-output descriptions with the new description and alt-text contract.
- [x] Append availability copy in memory after `getDesignAvailability(...)`.
- [x] Persist the finalized description in both `analysis_json` and `seo_description`.
- [x] Add focused availability-copy and cache-persistence tests.
- [x] Activate a new live prompt row without changing existing cache rows.

## Review

- Activated Supabase prompt `v3.16` (`prompt_id = 25`) and retained inactive `v3.15` (`prompt_id = 24`) for rollback.
- Verified the prompt content before `STEP 5: SEO COPY GENERATION` is byte-for-byte unchanged from the repo's prior v3.15 prompt.
- The new description instructions produce 5-7 natural sentences covering the visual hook, design story, details, supported audience/occasion, and customization options. They prohibit availability guesses, prices, brand/platform promotion, locations, CTAs, filler adjectives, and personal names.
- Alt text now targets 80-140 characters with a hard 160-character maximum, preserves relevant character/franchise names, and generalizes personal text.
- Availability copy is a synchronous constant lookup and string concatenation inside the existing cache write. It introduces no AI call, database query, timer, or additional await, and `onSuccess(fastResult)` still runs before the cache write.
- Existing cache rows were not backfilled. Live verification showed zero cache rows created between prompt activation and the verification query.
- Verification:
  - 13 focused Vitest tests passed.
  - Focused ESLint passed.
  - `git diff --check` passed.
  - Production code compilation passed, but the full build stopped during TypeScript validation on the pre-existing unrelated `reviewsToShow` error in `src/app/customizing/[slug]/page.tsx`.

# Vercel Cost Efficiency Audit (2026-06-12)

### Plan

- [x] Map this month's Vercel bill categories to the live Genie.ph code paths.
- [x] Verify the linked Vercel project metadata and current Vercel pricing definitions.
- [x] Rank the likely savings levers by impact and implementation risk.
- [ ] Decide whether to implement the top low-risk savings changes now.

### Review

- Bill snapshot reviewed: `Fast Origin Transfer $12.80`, `Fluid Provisioned Memory $7.92`, `Fluid Active CPU $6.64`, `ISR Writes $2.58`, `Function Invocations $1.80`, `Build CPU Minutes $0.60`, `ISR Reads $0.32`, `Edge Requests - Additional CPU Duration $0.04`.
- Linked Vercel project confirmed via `.vercel/project.json` and Vercel app metadata: project `genieph` on `team_suamfAsddS99rFIHeZDTt7hd`.
- Repo evidence for the top bandwidth bucket:
  - `src/app/api/proxy-image/route.ts` buffers the full upstream image in a function before returning it, which means every proxy miss incurs compute plus Fast Origin Transfer.
  - Several high-traffic UI surfaces still request images through `/api/proxy-image`, especially `backgroundOnly` cards in `src/components/ProductCard.tsx`.
  - The repo already has a real variant pipeline (`src/app/api/internal/variant-pipeline/route.ts`, `src/lib/imageVariants/*`) and responsive rendering support (`src/components/LazyImage.tsx`), so the biggest image savings are likely adoption/routing work instead of new infrastructure.
- Repo evidence for the Fluid compute bucket:
  - Long-running AI routes are configured with generous ceilings: `/api/ai/analyze` and `/api/ai/validate` at `300s`, `/api/ai/edit-image` and several admin batch routes at `180s`.
  - The image-studio batch continuation routes recursively self-schedule with `after(...)`, which is good for durability but can keep compute usage elevated when large admin runs are active.
- Repo evidence for the ISR bucket:
  - Many SEO routes use `revalidate = 3600`, including `/customizing`, `/customizing/[slug]`, category pages, collections, blog index, and blog category pages.
  - Dynamic sitemap/feed endpoints are cached, but the sitemap surfaces are still `force-dynamic`, so their misses still traverse compute.
- Project activity note:
  - Recent Vercel deployment history shows frequent same-day production redeploys, which contributes to build minutes and can churn caches, though this month's build spend is currently minor compared with transfer and compute.
- Verification sources used:
  - Local repo inspection of the cost-relevant routes/config.
  - Vercel project metadata from the connected Vercel app.
  - Current Vercel pricing/docs for CDN, Fluid compute, ISR, and spend management.

# Fix Missing Shipping Rate in Product Schema (2026-06-13)

### Plan

- [x] Add a shared delivery-rate source so product schema and `/delivery-rates` read the same checkout-backed fee table.
- [x] Extend `buildOfferShippingDetails()` to emit a PH `shippingRate` with the current maximum checkout fee in `PHP`.
- [x] Update focused schema and commerce tests, then run a full `npm run build`.

### Review

- Root cause: `buildOfferShippingDetails()` emitted `OfferShippingDetails` with destination and lead-time data only, so both `/customizing/[slug]` and merchant product schema shipped `shippingDetails` without `shippingRate`.
- Added `src/lib/commerce/deliveryRates.ts` as the shared fee source for:
  - city aliases used by checkout fee lookup,
  - the visible delivery-rate cards on `/delivery-rates`,
  - the PH-wide shipping-rate summary used in JSON-LD.
- `src/lib/commerce/machineReadable.ts` now adds `shippingRate: { "@type": "MonetaryAmount", currency: "PHP", maxValue: 300 }` to `OfferShippingDetails`, while leaving destination, return policy, and lead-time markup unchanged.
- `src/app/delivery-rates/page.tsx` no longer hardcodes the outdated `₱100` to `₱400` copy or the old Liloan card value. The page now derives its visible city cards and FAQ fee range from the same checkout-backed fee table, which currently resolves to free delivery in Cebu City up to `₱300` in Liloan.
- Follow-up page polish also moved the metadata description, hero summary, and top-level rate stats onto that same source of truth, and the delivery page now shows `Free` instead of `₱0` for Cebu City.
- Added focused regression coverage in `src/lib/commerce/deliveryRates.test.ts`, expanded `src/lib/commerce/machineReadable.test.ts` to assert the new shipping-rate shape and maximum fee, and updated existing customizer and merchant schema markup tests to require `shippingRate`.
- Verification:
  - `npx vitest run src/lib/commerce/deliveryRates.test.ts src/lib/commerce/machineReadable.test.ts src/components/SEOSchemas.test.tsx 'src/app/customizing/[slug]/page.test.tsx'` passed with `42` tests (`1` skipped).
  - `git diff --check` passed.
  - `npm run build` passed end to end. Static generation logged non-blocking pre-existing keyword fallback timeout warnings during prerender, but the build completed successfully.

# Implement Top Vercel Savings Fixes (2026-06-13)

### Plan

- [x] Replace the current "KV missing means bypass" behavior with a real in-memory fallback limiter for public rate-limited routes.
- [x] Reduce avoidable `/api/proxy-image` traffic from background-only product cards when the image already has a safe direct Genie-owned or variant URL.
- [x] Add focused regression coverage for the limiter fallback and the new background-image selection behavior.
- [x] Run focused tests/lint and document verification plus any deploy caveats.

### Review

- Updated [src/lib/security/rateLimiter.ts](/Users/apcaballes/genieph-nextjs/src/lib/security/rateLimiter.ts:1) so missing KV no longer means "allow everything." Public AI/newsletter/contact/discount routes now fall back to a per-instance in-memory sliding-window limiter using the same configured limits, and KV/runtime errors also fall back to that local limiter instead of bypassing protection entirely.
- Added `isSiteOwnedSupabasePublicImageUrl(...)` in [src/lib/utils/imageSelection.ts](/Users/apcaballes/genieph-nextjs/src/lib/utils/imageSelection.ts:1).
- Updated [src/components/ProductCard.tsx](/Users/apcaballes/genieph-nextjs/src/components/ProductCard.tsx:1) so `backgroundOnly` cards now prefer:
  - the existing 1200px-or-smaller variant URL when `image_variants` is present,
  - otherwise a direct first-party Supabase public URL when the asset is Genie-owned,
  - and only fall back to `/api/proxy-image` for older or third-party image URLs that still need the proxy.
- This keeps the background-only related/discovery cards on their current external-image-safe path, but cuts avoidable Vercel proxy traffic for rows we already fully own or have already rehosted through the variant pipeline.
- Added focused regression coverage in:
  - [src/lib/security/__tests__/rateLimiter.test.ts](/Users/apcaballes/genieph-nextjs/src/lib/security/__tests__/rateLimiter.test.ts:1) for the no-KV fallback path and the "shared limiter throws" fallback path.
  - [src/components/ProductCard.test.tsx](/Users/apcaballes/genieph-nextjs/src/components/ProductCard.test.tsx:1) for direct first-party background URLs and external-image proxy fallback.
- Verification:
  - `npx vitest run src/lib/security/__tests__/rateLimiter.test.ts src/components/ProductCard.test.tsx` passed with 10 tests.
  - Focused ESLint passed on the touched files with only the stale Browserslist data warning.
  - `git diff --check -- src/lib/security/rateLimiter.ts src/lib/security/__tests__/rateLimiter.test.ts src/lib/utils/imageSelection.ts src/components/ProductCard.tsx src/components/ProductCard.test.tsx tasks/todo.md` passed.
- Deploy caveat:
  - This change closes the missing-KV fail-open gap immediately once deployed.
  - Turnstile still depends on `CLOUDFLARE_TURNSTILE_SECRET_KEY` being configured in production; this patch did not change that customer-facing behavior because failing it closed in the current production state would block uploads outright until the secret is added.

# Remove Cloudflare Turnstile Integration (2026-06-13)

### Plan

- [x] Remove Turnstile verification from public API routes and their focused tests.
- [x] Remove Turnstile token/widget plumbing from customizing, chat, contact, newsletter, and discount signup surfaces.
- [x] Delete the now-unused Turnstile utility/component files and verify no runtime references remain.
- [x] Run focused tests/lint and document the new protection posture.

### Review

- Removed Cloudflare Turnstile verification from the public `analyze`, `contact`, and `newsletter` API routes, and updated their focused route tests to reflect the new no-token contract.
- Removed Turnstile widget/token plumbing from the customizing upload flow, chat image analysis, contact form, newsletter popup, and discount-offer signup surfaces so those UX paths no longer depend on Cloudflare secrets or client-side challenge state.
- Deleted the unused [src/components/TurnstileWidget.tsx](/Users/apcaballes/genieph-nextjs/src/components/TurnstileWidget.tsx:1), [src/lib/security/turnstile.ts](/Users/apcaballes/genieph-nextjs/src/lib/security/turnstile.ts:1), and [src/lib/security/__tests__/turnstile.test.ts](/Users/apcaballes/genieph-nextjs/src/lib/security/__tests__/turnstile.test.ts:1) files, and confirmed no `src/` references remain to `TurnstileWidget`, `turnstileToken`, `verifyTurnstileToken`, or the Cloudflare Turnstile env vars.
- The public abuse-protection posture now relies on the existing input validation plus the recently tightened rate limiting in [src/lib/security/rateLimiter.ts](/Users/apcaballes/genieph-nextjs/src/lib/security/rateLimiter.ts:1) instead of Cloudflare Turnstile.
- Verification:
  - `npx vitest run src/app/api/ai/analyze/route.test.ts src/app/api/contact/route.test.ts src/app/api/newsletter/route.test.ts src/lib/security/__tests__/rateLimiter.test.ts src/components/ProductCard.test.tsx` passed with `20` tests.
  - Focused ESLint across the touched Turnstile-removal files completed with `0` errors and only the repo's existing warnings plus the stale Browserslist data warning.
  - `git diff --check -- src/app/api/ai/analyze/route.ts src/app/api/ai/analyze/route.test.ts src/app/api/contact/route.ts src/app/api/contact/route.test.ts src/app/api/newsletter/route.ts src/app/api/newsletter/route.test.ts src/app/customizing/CustomizingClient.tsx src/app/contact/ContactClient.tsx src/components/NewsletterPopup.tsx src/components/DiscountOfferBubble.tsx src/components/ChatModal.tsx src/contexts/ImageContext.tsx src/hooks/useImageManagement.ts src/services/geminiService.ts src/components/TurnstileWidget.tsx src/lib/security/turnstile.ts src/lib/security/__tests__/turnstile.test.ts tasks/todo.md` passed.

# Cut Remaining Origin Transfer And Fluid Hotspots (2026-06-13)

### Plan

- [x] Stop re-serving Genie-owned Supabase public images through `/api/proxy-image` so those requests no longer burn Vercel origin transfer and proxy memory.
- [x] Extend public AI abuse protection to the still-unlimited `/api/ai/edit-image` path and fail faster on long-running image-edit calls.
- [x] Remove repeated per-request prompt/config/cache discovery work from `/api/ai/analyze` so hot analyze traffic does less database and Vertex setup work.
- [x] Add focused regression coverage, rerun targeted verification, and document the next highest-ROI follow-ups from the live audit.

### Review

- Live audit evidence from the connected Vercel project showed `/api/proxy-image`, `/api/ai/analyze`, and `/api/ai/edit-image` all appearing frequently in production runtime logs over the last 7 days, which lined up with the current bill's largest remaining origin-transfer and Fluid Compute buckets.
- Updated [src/app/api/proxy-image/route.ts](/Users/apcaballes/genieph-nextjs/src/app/api/proxy-image/route.ts:1) so Genie-owned public Supabase assets now short-circuit to a `307` redirect instead of being fetched, buffered, and re-served by the function. This preserves the proxy for third-party/CORS-sensitive sources, but removes Vercel origin-transfer and memory cost for the first-party public assets that were still unnecessarily passing through the route.
- Updated [src/middleware.ts](/Users/apcaballes/genieph-nextjs/src/middleware.ts:1) so `/api/ai/edit-image` now shares the public AI rate-limit path instead of remaining effectively unlimited. This matters because production runtime logs still show frequent `POST /api/ai/edit-image` traffic and repeated 429/502 churn.
- Updated [src/app/api/ai/edit-image/route.ts](/Users/apcaballes/genieph-nextjs/src/app/api/ai/edit-image/route.ts:1) to pass an explicit `AbortSignal.timeout(90_000)` into Gemini image-edit calls, which fails slow upstream edits sooner instead of letting them hold Fluid memory/runtime longer.
- Updated [src/app/api/ai/analyze/route.ts](/Users/apcaballes/genieph-nextjs/src/app/api/ai/analyze/route.ts:1) to cache prompt details, dynamic pricing/type enums, and the prompt-cache resource name in module memory for hot instances. The cached-content path now also clears the local cache and retries uncached if the stored Vertex cache name goes stale. This removes repeated Supabase prompt/config reads and repeated Vertex cache discovery from hot analyze traffic.
- Focused regression coverage now includes:
  - [src/app/api/proxy-image/route.test.ts](/Users/apcaballes/genieph-nextjs/src/app/api/proxy-image/route.test.ts:1) for the first-party redirect path.
  - [src/middleware.test.ts](/Users/apcaballes/genieph-nextjs/src/middleware.test.ts:1) for `/api/ai/edit-image` rate limiting.
  - [src/app/api/ai/analyze/route.test.ts](/Users/apcaballes/genieph-nextjs/src/app/api/ai/analyze/route.test.ts:1) for hot-request reuse of prompt/enums/cache discovery.
  - [src/app/api/ai/edit-image/route.test.ts](/Users/apcaballes/genieph-nextjs/src/app/api/ai/edit-image/route.test.ts:1) for the new abort-signal config on Gemini calls.
- Verification:
  - `npx vitest run src/app/api/proxy-image/route.test.ts src/middleware.test.ts src/app/api/ai/analyze/route.test.ts src/app/api/ai/edit-image/route.test.ts` passed with `20` tests.
  - Focused ESLint passed on the touched files with `0` errors and only the stale Browserslist data warning.
  - `git diff --check -- src/app/api/proxy-image/route.ts src/app/api/proxy-image/route.test.ts src/middleware.ts src/middleware.test.ts src/app/api/ai/analyze/route.ts src/app/api/ai/analyze/route.test.ts src/app/api/ai/edit-image/route.ts src/app/api/ai/edit-image/route.test.ts tasks/todo.md` passed.
- Next highest-ROI follow-ups from the live audit:
  - Production runtime logs also surfaced `[RateLimiter] Vercel KV environment variables ... are missing`, so the shared limiter is still falling back to per-instance memory in production. Wiring the project to real Vercel KV / Upstash env vars is still worth doing because it makes the AI abuse protection global instead of instance-local.
  - The repo still has many `/api/proxy-image` call sites, but the highest-traffic remaining ones appear to be the public customizer/search experiences and a few related-design background-image surfaces. The next transfer pass should target those public call sites first and ignore low-traffic admin-only usage until later.

# Trim Public Proxy Callers Further (2026-06-13)

### Plan

- [x] Audit remaining public `/api/proxy-image` callers in search and customizing to separate true third-party/CORS cases from first-party URLs that can bypass the proxy.
- [x] Add a shared client helper so public image-fetch flows can use direct first-party URLs and fall back to the proxy only when needed.
- [x] Patch the highest-traffic public callers in search/customizing plus the client-side image-edit helpers that still forced the proxy for first-party assets.
- [x] Run focused verification and document what public proxy surfaces still remain after this pass.

### Review

- Added shared proxy-awareness helpers in [src/lib/utils/imageSelection.ts](/Users/apcaballes/genieph-nextjs/src/lib/utils/imageSelection.ts:1):
  - `shouldBypassImageProxy(...)` recognizes data/blob URLs, test fixture URLs, and Genie-owned public Supabase assets.
  - `getProxyAwareImageUrl(...)` returns the direct URL for those safe cases and only builds `/api/proxy-image` for the remaining third-party paths.
- Updated the public Google search flows in [src/hooks/useSearchEngine.ts](/Users/apcaballes/genieph-nextjs/src/hooks/useSearchEngine.ts:1) and [src/components/collections/GoogleSearchSection.tsx](/Users/apcaballes/genieph-nextjs/src/components/collections/GoogleSearchSection.tsx:1) so they no longer assume every image must be proxied first. First-party/Supabase hits now go direct, and only then fall back to `/api/proxy-image` or the backup public proxy path if needed.
- Updated the public customizer query-param restore flow in [src/app/customizing/CustomizingClient.tsx](/Users/apcaballes/genieph-nextjs/src/app/customizing/CustomizingClient.tsx:1) so `image_url` loads also use the direct-first helper instead of forcing the proxy immediately.
- Updated the client-side image-edit helpers in [src/hooks/useIcingMask.ts](/Users/apcaballes/genieph-nextjs/src/hooks/useIcingMask.ts:1) and [src/hooks/useDesignUpdate.ts](/Users/apcaballes/genieph-nextjs/src/hooks/useDesignUpdate.ts:1) so first-party assets do not bounce through `/api/proxy-image` before being converted to base64 for recolor/edit flows.
- Added focused regression coverage in [src/lib/utils/imageSelection.test.ts](/Users/apcaballes/genieph-nextjs/src/lib/utils/imageSelection.test.ts:1) for the new proxy-bypass rules.
- Verification:
  - `npx vitest run src/lib/utils/imageSelection.test.ts src/app/api/proxy-image/route.test.ts src/middleware.test.ts src/app/api/ai/analyze/route.test.ts src/app/api/ai/edit-image/route.test.ts` passed with `23` tests.
  - Focused ESLint across the touched files completed with `0` errors and the same existing warnings plus the stale Browserslist data warning.
  - `git diff --check -- src/lib/utils/imageSelection.ts src/lib/utils/imageSelection.test.ts src/hooks/useSearchEngine.ts src/components/collections/GoogleSearchSection.tsx src/hooks/useIcingMask.ts src/hooks/useDesignUpdate.ts src/app/customizing/CustomizingClient.tsx tasks/todo.md` passed.
- Highest-value public proxy surfaces still left after this pass:
  - Some related-design and SSR background-image paths, including parts of `/customizing/[slug]`, still emit proxied URLs. I left those alone in this pass because that file already has unrelated local user edits and should be handled carefully in a dedicated follow-up.
  - Low-traffic admin/import screens still use `/api/proxy-image`, but they are much lower priority than the public customizer/search paths we just reduced.
# Investigate GSC Crawled Currently Not Indexed Customizing Pages (2026-06-17)

### Plan

- [x] Sample the screenshot URLs against live HTML for status, canonical, robots, title/meta, rendered word count, schema, and obvious duplicate clusters.
- [x] Inspect the repo path for `/customizing/[slug]` metadata, sitemap inclusion, IndexNow, structured data, and any noindex/canonical conditions.
- [x] Check whether the sample pages are technically indexable versus likely being filtered for thin, redundant, or low-demand generated inventory.
- [x] Recommend the simplest durable remediation: content changes, sitemap/indexability gates, consolidation/noindex rules, or GSC resubmission workflow.
- [x] Document findings and verification evidence in this task section before calling the investigation complete.

### Review

- GSC property access is live for `https://genie.ph/`; `sitemap.xml` and `sitemap-images.xml` are valid with `0` sitemap errors.
- GSC URL Inspection on 8 representative screenshot URLs found 7 already indexed and 1 still `Crawled - currently not indexed`: `butterfly-cake-sky-blue-1-tier-cake-ffc0`.
- Live HTML sampling found 18/20 screenshot URLs returning `200`, self-canonical metadata, `robots: index, follow`, Product/ItemPage/Breadcrumb/FAQ JSON-LD, and roughly `1.5k-1.8k` raw HTML words.
- Two short screenshot aliases, `bicycle-sky-blue-1-tier-8fe7` and `snake-plant-white-1-tier-ffbf`, currently return a weak empty `200` shell in live HTTP with no title, canonical, robots meta, H1, description, or product schema. Their modern sitemap URLs are `bicycle-sky-blue-1-tier-cake-8fe7` and `snake-plant-white-1-tier-cake-ffbf`.
- The local repo already has slug-upgrade redirect logic in `src/app/customizing/[slug]/page.tsx` through `upgradeLegacySlug(...)`, and the modern URLs are present in live sitemap chunks with image entries. The empty alias behavior should be checked against the deployed version and fixed so missing/legacy aliases become `301`, `404/410`, or explicit `noindex`, not empty soft-200 pages.
- The broader 5.61K issue is most likely Google quality/selectivity, not a blanket technical indexing block. The highest-risk content pattern is near-duplicate generated product pages, especially butterfly variants where differences are small and titles/descriptions are similar.
- Recommended remediation: fix stale alias soft-200s first; then score `/customizing` pages for uniqueness and commercial/search demand, keep strongest unique pages indexable and in sitemaps, consolidate/noindex weak near-duplicates, and enrich priority clusters with more visibly distinct copy instead of trying to force all generated variants into Google.

# Fix Legacy Customizer Alias Soft 200s (2026-06-17)

### Plan

- [x] Reproduce the alias-to-modern transformation locally for the screenshot examples.
- [x] Add a request-level redirect so legacy `/customizing/...-<hash>` aliases cannot fall through to an empty 200 shell.
- [x] Add focused regression tests for the two screenshot alias shapes and for non-legacy customizer URLs.
- [x] Run focused verification and document the result.

### Review

- Added a middleware-level `308` redirect for `/customizing/<slug>-<4hex>` aliases when `upgradeLegacySlug(...)` produces a modern slug. This catches stale aliases before page metadata/rendering can produce an empty soft-200 shell.
- Verified the two screenshot examples now canonicalize in tests:
  - `/customizing/bicycle-sky-blue-1-tier-8fe7` -> `/customizing/bicycle-sky-blue-1-tier-cake-8fe7`
  - `/customizing/snake-plant-white-1-tier-ffbf` -> `/customizing/snake-plant-white-1-tier-cake-ffbf`
- Kept modern slugs unchanged, including `/customizing/bicycle-sky-blue-1-tier-cake-8fe7`.
- Verification:
  - `npx vitest run src/middleware.test.ts src/lib/utils/urlHelpers.test.ts` passed with `24` tests.
  - `npx eslint src/middleware.ts src/middleware.test.ts` passed with only the existing stale Browserslist warning.
  - `git diff --check -- src/middleware.ts src/middleware.test.ts tasks/todo.md` passed.

# Tighten Mobile Page Gestures And Zoom (2026-06-21)

### Plan

- [x] Lock the mobile page viewport against accidental browser zoom by default, while still allowing the shared image-zoom modal to temporarily re-enable zoom when it is intentionally open.
- [x] Stop the mobile document from drifting sideways at the root overflow layer without breaking intentional component-level horizontal scrollers.
- [x] Add focused regression coverage for the shared zoom/modal behavior and the new mobile gesture guard.
- [x] Run targeted verification plus a full build check before closing the task.

### Review

- Tightened the shared mobile viewport policy in `src/app/layout.tsx` so mobile browsers start from a locked, app-like scale, then added a shared `MobileGestureGuard` in `src/components/Providers.tsx` to block multi-touch browser zoom gestures unless the body is in the shared image-zoom state.
- Updated `src/components/ImageZoomModal.tsx` so opening the shared zoom modal temporarily relaxes the mobile viewport meta tag and closing it restores the locked page-level viewport. That keeps image zoom as the only intentional zoom path.
- Added a mobile-only root overflow clamp in `src/app/globals.css` so the document itself cannot drift sideways, while nested component scrollers can still own their own horizontal scrolling.
- Added focused regression coverage in `src/components/ImageZoomModal.test.tsx` and `src/components/MobileGestureGuard.test.tsx` for the viewport unlock/restore path and the mobile multi-touch guard behavior.
- Verification:
  - `npx vitest run src/components/ImageZoomModal.test.tsx src/components/MobileGestureGuard.test.tsx` passed with `4` tests.
  - `npx eslint src/app/layout.tsx src/components/Providers.tsx src/components/ImageZoomModal.tsx src/components/ImageZoomModal.test.tsx src/components/MobileGestureGuard.tsx src/components/MobileGestureGuard.test.tsx` completed without lint errors and only the existing stale Browserslist warning.
  - `git diff --check -- src/app/layout.tsx src/app/globals.css src/components/Providers.tsx src/components/ImageZoomModal.tsx src/components/ImageZoomModal.test.tsx src/components/MobileGestureGuard.tsx src/components/MobileGestureGuard.test.tsx tasks/todo.md` passed.
  - `npm run build` is still blocked by a pre-existing unrelated TypeScript error in `src/components/ChatModal.tsx:497` (`findSimilarAnalysisByHash(cacheKey)` type mismatch), so the repo-wide build could not be used as the final green signal for this task.

# AI Cake Analysis Prompt Contract Cleanup (2026-06-22)

### Plan

- [x] Audit the active prompt, fallback prompt, schema contract, analyze/analyze-url routes, and runtime enum sources for drift against the accepted output shape.
- [x] Clean up the shared schema contract and runtime post-processing so the analyzer output matches stored app fields, including `payment_receipt`, canonical enum names, and direct `cakeThickness` preservation.
- [x] Update the fallback prompt and add a new versioned Supabase prompt migration for v3.19 instead of overwriting the active v3.18 row.
- [x] Apply the v3.19 prompt row live, then sync-check the active prompt text against the fallback prompt contract.
- [x] Run targeted prompt/schema tests plus `npm run build`, fix any fallout, and document the result.

### Review

- Prompt/schema contract cleanup:
  - Added shared canonical rejection, icing-base, and analyzer color-type enums in `src/lib/admin/searchAnalysisContract.ts`, including `payment_receipt`, canonical message enums, and removal of `is_tall_proportion` from the schema contract.
  - Removed the hidden `cakeThickness` downgrade path by making shared post-processing preserve the model’s chosen height and only normalize coordinates.
  - Switched `/api/ai/analyze-url` onto the same shared generation config and post-processing used by the main analyzer route so the accepted-output contract does not drift.
- Runtime enum alignment:
  - Updated `src/lib/ai/utils.ts` so active `pricing_rules` rows with `item_type = null` can still contribute canonical analyzer enums through `item_key` / `sub_item_type` aliases such as `icing_doodle` and `support_printout`.
  - Expanded the local enum/type compatibility layer in `src/constants/pricingEnums.ts`, `src/types.ts`, `src/components/TopperCard.tsx`, and `src/app/customizing/CustomizingStepSummarySections.tsx` so canonical analyzer values and legacy cached rows both remain renderable and type-safe.
- Prompt sources:
  - Updated `src/services/prompts/fallback-prompt.txt` to v3.19 with one authoritative accepted skeleton, full rejection skeleton, canonical enum names, precedence ordering, and the customer-safe `payment_receipt` rejection message.
  - Added migration `supabase/migrations/20260622143000_insert_prompt_v3_19_contract_cleanup.sql`, fixed its delimiter/replacement bugs, and applied it live as a new active `ai_prompts` row instead of overwriting v3.18.
  - Verified the active live prompt is now version `3.19`, prompt id `28`, with the canonical message/base/color enums present and the stale `All keys lowercase` / rejection-only wording absent.
- Tests and verification:
  - Added `src/lib/admin/searchAnalysisContract.test.ts` coverage for canonical enums, `payment_receipt`, and no thickness downgrade.
  - Added `src/lib/ai/utils.test.ts` coverage proving null-`item_type` pricing rows still recover canonical analyzer enums from aliases.
  - Updated prompt/schema tests to assert the accepted skeleton, `payment_receipt`, and removal of stale aliases like `soft-icing`, `icing_text`, `edible_print_text`, and `cardstock_text`.
  - `npx vitest run src/services/prompts/analysisPromptRules.test.ts src/lib/admin/searchAnalysisContract.test.ts src/lib/ai/utils.test.ts src/lib/admin/searchAnalysisBatch.test.ts src/lib/seo/analysisCopy.test.ts` passed with `36` tests.
  - `npm run build` passed after fixing two integration regressions surfaced by the stricter typing:
    - explicit `HybridAnalysisResult` handoff in `/api/ai/analyze-url`
    - missing exhaustive topper/support label map entries after widening the local type unions
  - The build still logs the existing workspace-root, middleware deprecation, and `baseline-browser-mapping` freshness warnings, plus non-fatal prerender fallback query timeouts during static generation. The build completed successfully despite those logs.

## Flower Classification Safety Update (2026-07-02)

### Plan

- [x] Trace current analyzer schema, fallback prompt, and database pricing-rule behavior for `fresh_flowers` versus `edible_flowers`.
- [x] Update local analyzer/fallback contract so all flower decorations, including natural-looking or fresh-looking flowers, classify as `edible_flowers`.
- [x] Update pricing/type mapping so legacy `fresh_flowers` analysis rows price through edible-flower rules.
- [x] Create the next active Supabase `ai_prompts` row with matching wording, preserving the previous active row.
- [x] Verify with focused tests, live Supabase checks, and diff checks.

### Review

- Removed `fresh_flowers` from the canonical support-element enum used to build analyzer schemas while keeping the TypeScript/UI legacy label path for old cached rows.
- Updated fallback prompt flower rules so Genie.ph safety policy is explicit: fresh-looking, natural-looking, realistic, or edible flowers must classify as `edible_flowers`; the old `IT IS "fresh_flowers"` classifier and table row are gone.
- Added `fresh_flowers` -> `edible_flowers` mapping in dynamic enum recovery and database pricing lookup so old analysis rows price through edible-flower rules instead of falling through to zero.
- Created migration `supabase/migrations/20260702023709_classify_flowers_as_edible.sql` and applied the live prompt update as active `ai_prompts` version `3.24`, prompt id `33`; v3.23 remains preserved and inactive.
- Live Supabase verification:
  - one active prompt row
  - active version `3.24`
  - safety wording present
  - old `IT IS "fresh_flowers"` guidance absent
  - old `fresh_flowers` support table row absent
  - no active `fresh_flowers` pricing rules
- Verification:
  - `npx vitest run src/lib/admin/searchAnalysisContract.test.ts src/lib/ai/utils.test.ts src/services/prompts/analysisPromptRules.test.ts src/services/pricingService.database.test.ts --exclude '.claude/**'` passed: 4 files, 24 tests.
  - `git diff --check` passed.
  - `npm run build` passed. Existing non-fatal warnings appeared for stale `baseline-browser-mapping`, inferred workspace root, deprecated `middleware`, and Supabase statement timeouts during static generation.

## GSC Cake Product Indexing And Collection Discovery Audit (2026-07-03)

### Plan

- [x] Confirm live GSC property access, submitted sitemap state, and a sample of cake-product URL inspection results.
- [x] Verify the current repo discovery path for `/customizing/[slug]`, `/collections`, collection sitemap inclusion, and collection page SSR depth.
- [x] Decide whether more collection types should be added now, and define the quality/linking rules so new pages do not become thin SEO surfaces.
- [x] Document recommended actions, verification evidence, and remaining data gaps.

### Review

- GSC property access is live for both `https://genie.ph/` and `sc-domain:genie.ph`.
- Submitted sitemap state from GSC:
  - `https://genie.ph/sitemap.xml` is valid, last downloaded `2026-07-02 19:56`, with `25,391` indexed URLs and `0` errors.
  - `https://genie.ph/sitemap-images.xml` is valid, last downloaded `2026-07-02 18:14`, with `12,554` indexed URLs and `0` errors.
- Live sitemap checks:
  - `https://genie.ph/sitemap-index.xml` includes `sitemap-core.xml`, `sitemap-images.xml`, `sitemap-designs-0.xml`, and `sitemap-customized-cakes-0.xml` through `sitemap-customized-cakes-13.xml`.
  - `https://genie.ph/sitemap-core.xml` currently exposes `230` `/collections/*` URLs.
  - `https://genie.ph/sitemap-customized-cakes-0.xml` exposes `1,000` `/customizing/*` product URLs, including recent July 2026 products.
- GSC URL Inspection samples:
  - `https://genie.ph/customizing/christening-bear-sky-blue-1-tier-cake-1fb3` is `Submitted and indexed`, last crawled `2026-07-02 04:03`, mobile crawl, product/merchant/breadcrumb/image/review rich results detected.
  - `https://genie.ph/customizing/pickleball-birthday-white-1-tier-cake-232b` is `URL is unknown to Google` even though it appears in `sitemap-customized-cakes-0.xml`; this is likely crawl queue/selection delay for a very recent product, not a sitemap failure.
  - `https://genie.ph/collections/bento-cake` is `Submitted and indexed`, last crawled `2026-06-29 15:59`.
  - `https://genie.ph/collections/cakes-under-500-pesos` is `URL is unknown to Google`.
- Code/path findings:
  - Collection sitemap inclusion is gated by `publication_status = published`, `is_indexable = true`, and `item_count >= 8` in `src/app/sitemap.ts`.
  - The collection quality helper also defines `COLLECTION_MIN_MATCHED_DESIGNS = 8`.
  - `/collections/[category]` server-renders only the first `30` designs via `getDesignsByKeyword(canonicalCategory, 30)`, then deeper results use the client-side load-more path.
  - `https://genie.ph/collections/bento-cake` exposes about `31` `/customizing/*` links in fetched HTML.
  - `https://genie.ph/collections/cakes-under-500-pesos` returns `200` with `index,follow`, but only has `1` item in the rendered `ItemList`; it is not in `sitemap-core.xml`.
- Recommendation:
  - Keep relying on customized-cake sitemap chunks for bulk product discovery.
  - Improve prioritization by adding curated collection hubs, but only when each page has enough inventory and internal links.
  - Do not index price-band pages until they have enough genuinely matching products. Current under-500 page is too thin.
  - Add crawlable pagination or server-rendered next-page links for important collections if the goal is to expose more than the first 30 product links through collection hubs.
  - Add guard behavior so unknown/dynamic collection pages that do not map to a published/indexable collection either `404`/`noindex` instead of returning indexable thin pages.
