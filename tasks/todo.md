# Tasks

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
