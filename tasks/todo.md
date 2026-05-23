# Tasks

## Make User Upload ORB Matching Strict

### Plan

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
