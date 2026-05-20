# Tasks

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
