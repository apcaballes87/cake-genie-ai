# Tasks

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
