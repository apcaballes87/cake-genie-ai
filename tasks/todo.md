# Tasks

## Desktop Layout Tweak - Move Feature Highlights below "Celebrations"

### Plan
- [x] Locate the `<HeroFeatureHighlights>` component rendering in the desktop hero layout of `src/app/LandingClient.tsx`.
- [x] Move it from below the primary CTA button/Browse link section to below the "Celebrations" text (`h1` element containing `{heroContent.lineThree}`) inside the desktop view.
- [x] Adjust styling/margins if necessary to ensure it fits beautifully under the title.
- [x] Verify the change by checking the file structure and build correctness.

### Review
- Identified the `<HeroFeatureHighlights>` component in `src/app/LandingClient.tsx`.
- Successfully moved it from the interactive button CTA block to immediately below the `h1` element containing `heroContent.lineThree` ("Celebrations").
- Verified using TypeScript type-checking that the change maintains compilation and build integrity.

---

## PageSpeed Review

### Plan
- [x] Confirm whether the shared desktop and mobile PageSpeed report URLs are accessible.
- [x] Gather current performance signals from available sources if the shared reports or API are blocked.
- [x] Inspect the local Next.js implementation for likely performance bottlenecks.
- [x] Identify low-risk improvements with expected impact and implementation scope.
- [x] Stop before implementation and confirm the plan, unless the requested change is analysis-only.

### Review
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
