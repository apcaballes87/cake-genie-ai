# Genie.ph — Project Review

**Date:** 2026-06-06
**Repo:** `/Users/apcaballes/genieph-nextjs` (`e08694f`, one uncommitted change)
**Stack:** Next.js 16.0.7 (App Router) · React 19.2 · TypeScript 5.9 · Tailwind 4 · Supabase (Postgres + Edge Functions + Storage + Auth) · Vertex AI / Gemini 3 · Roboflow Florence-2 · Xendit · DataForSEO · Vercel

> **TL;DR:** Genie.ph is a **production-grade AI-powered custom-cake marketplace for Cebu, Philippines**. Users upload any cake photo, the AI extracts structured features (cake type, colors, toppers, layout), returns an editable design + instant price quote, and routes the order to partner bakeshops. The site is also a heavy **SEO/GEO** play (programmatic landing pages, schema, IndexNow, Pinterest/GMC feeds). It works. It's complex. And like any real codebase that's been under pressure for two years, it has both serious strengths and a list of paper cuts.

---

## 1. What the project actually is

Genie.ph is **two products wearing one domain**:

1. **B2C marketplace** (`/`, `/customizing`, `/shop`, `/cart`, `/contribute`) — end users design and order custom cakes.
2. **B2B SEO/GEO surface** (30+ programmatic landing pages: `/bento-cake-cebu`, `/best-cake-shops-cebu`, `/cake-delivery-cebu`, `/cake-price-calculator`, `/chatgpt-cake-design-quote`, `/compare/[slug]`, `/coldcaking`, etc.) — a Cebu-focused content moat for AI Overviews, ChatGPT, Perplexity, Bing, Google.

The two are tied together by the **analysis cache** — every cake image analyzed by the AI gets a public slug like `/customizing/wedding-3-tier-floral-cake-abc12`, which doubles as a long-tail SEO landing page.

**Business model:** marketplace commission on each paid order, plus a "ColdCaking" B2B sub-product for corporate edible-print gifts, plus creator-network promo codes.

---

## 2. Page-by-page map (grouped)

> Conventions: pages default to Server Components; auth and admin pages are mostly noindex; SEO pages use `revalidate = 3600` (1 h ISR) unless noted. `revalidate` values are pulled from the actual code.

### 2.1 Marketing & SEO landing pages (the GEO surface)

| Route | What it does | SEO | Cache |
|---|---|---|---|
| `/` | Hero masonry + recommended products + AEO FAQ blocks + reviews + blog previews. Suspense-streamed. LCP preloads 6 hero images. | indexed | ISR 1 h |
| `/bento-cake-cebu`, `/cake-delivery-cebu`, `/cake-delivery-cebu-city`, `/birthday-cake-delivery-cebu-city` | Thin wrappers around a shared `CEBU_LANDING_PAGES` data file → `LocalSeoLandingPage` component. Programmatic local SEO. | indexed | ISR 1 h |
| `/best-cake-shops-cebu` | Editorial top-10 list of partner bakeshops (10 Dove Street, Café Georg, Cakes and Memories, etc.) with images. | indexed | ISR 24 h |
| `/kids-party-cakes-cebu`, `/mothersdaycakes` | Themed landings with filtered product grids (keyword-based product match). | indexed | ISR 1 h |
| `/chatgpt-cake-design-quote` | Quote-builder page targeting "ChatGPT cake design" search intent. `WebPage` + `BreadcrumbList` + `FAQPage` JSON-LD. | indexed | static |
| `/cake-price-calculator` | Interactive AI price calculator. `SoftwareApplication` JSON-LD. | indexed | static |
| `/coldcaking` | **Separate B2B sub-product** for corporate edible-photo cakes. | indexed | ISR 1 h |
| `/compare/[slug]` | 7 hardcoded competitor comparison pages (vs Goldilocks, Red Ribbon, Contis, Caramia, etc.). | indexed | static |
| `/collections`, `/collections/[category]` | Curated themed galleries (e.g. `pickleball-cake`, trending). `item_count ≥ 8` to be indexable. | indexed | ISR 1 h |
| `/blog`, `/blog/[slug]`, `/blog/category/[tag]` | Blog index/detail/category. 8 hardcoded tag chips. `BlogPostingSchema` + embedded product showcases. | indexed | ISR 1 h |
| `/about`, `/contact`, `/services`, `/faq`, `/how-to-order`, `/payment-options`, `/delivery-rates`, `/terms`, `/privacy`, `/privacy/data-deletion`, `/return-policy` | Standard support pages, all canonical, all with appropriate schema. | indexed | static |
| `/creators` | Creator/influencer sign-up form (server action). Auto-generates promo code from social handle. | indexed | static |
| `/reviews` | Curated public reviews, 20 most recent. | indexed | static |
| `/suppliers` | Static Metro Cebu party-supplier directory with `LocalBusiness` ItemList schema. | indexed | static |
| `/sitemap-html` | Human-readable HTML sitemap (500 most recent designs + all collections). | indexed | ISR 24 h |
| `/robots.ts`, `/sitemap.ts`, `/sitemap-index.xml`, `/sitemap-images.xml` | Next.js-native SEO infrastructure. Disallows admin/auth/cart, **explicitly allows GPTBot, ChatGPT-User, ClaudeBot, Google-Extended, PerplexityBot, OAI-SearchBot, Bytespider, facebookexternalhit** — that's the GEO strategy. | n/a | force-dynamic |

### 2.2 Core product

| Route | What it does | SEO |
|---|---|---|
| `/customizing` | **The heart.** Upload a cake design (or pick from popular), AI analyzes, user customizes, gets instant price. Server: featured grid + theme chip nav + JSON-LD. Client: multi-step flow (Hero/Photos/Options/Messages/IcingEditor/Toppers/Sidebar/Instructions/AiChat). Accepts `?image_url=` from Chrome extension, Shopify CSE, or Instagram handoff. | indexed | ISR 1 h |
| `/customizing/[slug]` | Canonical surface for any analyzed cake. SSR-only `<SSRCakeDetails>` block hidden via inline script (CLS fix). Strong Product + ItemPage + BreadcrumbList schema. Old slug → `permanentRedirect` to canonical. | indexed | ISR 1 h |
| `/customizing/category/[keyword]` | Category gallery. `generateStaticParams` pre-renders top 30. Curated FAQs per category. | indexed | ISR 1 h |
| `/designs/[slug]` | **Legacy route** — immediately `permanentRedirect`s to `/customizing/[slug]`. Code below the redirect is dead. Cleanup candidate. | canonicalized to `/customizing/[slug]` | ISR 1 h |
| `/shop`, `/shop/[merchantSlug]`, `/shop/[merchantSlug]/[productSlug]` | Bakeshop directory → bakeshop profile → product page. The product page reuses the same `CustomizingClient` shell with a product preset. | indexed | ISR 1 h |
| `/feed/google`, `/feed/pinterest`, `/feed/pinterest/catalog`, `/feed/pinterest/feeds` | Google Merchant Center XML feed (cake type/thickness custom dimensions) and Pinterest RSS + Catalog feeds. | n/a (data feeds) | ISR 6 h |
| `/cart` | Cart UI, client-side state. `buildNoIndexPageMetadata`. | noindex |
| `/order-confirmation` | Post-checkout, polls Xendit every 5 s, fires `gtag` `purchase` once. | noindex |
| `/contribute/[orderId]` | "Split the bill with friends" page. (No `/contribute` index — only `[orderId]`.) | indexed |
| `/search` | Search results. FTS via `/api/search`. | noindex |
| `/saved` | User's saved cakes (catalog products + custom designs). | noindex |

### 2.3 Account (auth-gated, noindex)

`/account` (dashboard), `/account/orders`, `/account/addresses`, `/account/merchants/reviews` (merchant-side review management).

### 2.4 Admin (PIN-gated, all `'use client'`, all client-side hardcoded PIN `231323` or `ADMIN_IMAGE_STUDIO_PIN`)

`/admin/bulk-analysis` (CSV → AI analysis pipeline), `/admin/icing-recolor-lab`, `/admin/image-studio` (cache review + pastel-purple cyclorama edits), `/admin/pinterest` (OAuth + board sync), `/admin/search-analysis` (Google CSE → AI batch). **No `/admin` index page** — visiting `/admin` directly 404s.

### 2.5 Auth

`/login` (email + OAuth), `/signup` (email magic link), `/signup/check-email`, `/forgot-password`, `/auth/callback` (OAuth), `/auth/set-password` (post-verification).

### 2.6 Debug

`/similarity-debugger` (internal, calls the ORB backend). No auth at the route level — relies on backend-side check.

---

## 3. How it all fits together

### 3.1 Request lifecycle for a user designing a cake

```
User pastes/uploads image
  ↓
/customizing (server component, RSC)
  ↓ fetches in parallel:
  - getPopularDesigns(12)        → cakegenie_analysis_cache (Supabase)
  - cakegenie_reviews (aggregate)
  ↓ renders <CustomizingClient> with all panels
  ↓
User clicks "Customize"
  ↓
ImageContext.useImageManagement()
  ↓
  POST /api/proxy-image  (CORS bypass, allowlisted hosts)
  ↓
  POST /api/image/fingerprint  (sharp, pHash)
  ↓
  POST /api/ai/validate         (gemini-3.1-flash-lite-preview, is it a cake?)
  ↓ if valid
  POST /api/ai/analyze          (full Gemini analysis, 300s max)
  ↓
  POST /api/roboflow/detect     (Florence-2, bbox overlay data)
  ↓
  orbMatchingService.findOrbCacheHit  (Python FastAPI backend)
  ↓ if miss
  cacheAnalysisResult() → cakegenie_analysis_cache
  ↓ triggers (Supabase DB webhook on INSERT/UPDATE):
  → /api/internal/variant-pipeline  (HMAC-verified, sharp variants)
  → eventually: /api/ai/trigger-studio-edit  (gemini-3.1-flash-image-preview, pastel cyclorama)
  ↓
CustomizationContext holds design state across all panels
usePricing() reads cakegenie_base_prices + pricing_rules for live price
  ↓
User clicks "Add to Cart"
CartContext → cakegenie_cart  (Supabase, anon OR user_id keyed)
  ↓
/cart
  ↓ checkout
POST /api/signup-discount or GET /api/pinterest/sync etc.
  ↓
create-xendit-payment (Supabase Edge Function)
  → Xendit invoice
  ↓ user pays
xendit-webhook → verify-xendit-payment → create_order_from_cart() RPC
  → cakegenie_orders + cakegenie_order_items
  → merchant_payouts row
  ↓
/order-confirmation polls getPaymentStatus, fires gtag.purchase once
  ↓
merchant dashboard sees order
```

### 3.2 The five-tier SEO flywheel

1. **AI generates a cake** → `cakegenie_analysis_cache` row with a unique slug.
2. **Page exists** at `/customizing/[slug]`, indexed, with strong Product + ItemPage schema.
3. **IndexNow notifies** Bing/Yandex/etc. via `/api/indexnow`.
4. **Pinterest + Google feeds** auto-pull from `cakegenie_collections` + `cakegenie_merchant_products`.
5. **DataForSEO cron** (`/api/collections/trends/cron`) weekly pulls Google Keyword Ideas, finds trending designs, auto-creates new collections. This is the loop.

### 3.3 The 5 contexts and what they hold

| Context | Lines | Holds |
|---|---|---|
| `ImageContext` | ~1150 | Upload → analyze → edit → persist pipeline (the spine) |
| `CartContext` | ~782 | Cart items, debounced localStorage, batched saves |
| `CustomizationContext` | ~911 | Design state machine (toppers, messages, icing, three-tier reconstruction) |
| `AuthContext` | — | `user`, `session`, `loading`, signIn/Up/Out, anon defer on `/` |
| `SavedItemsContext` | — | `cakegenie_saved_items` (products + custom designs) |
| `NavigationContext` | — | SPA `PageType` state (legacy SPA navigation shell) |
| `GoogleMapsLoaderContext` | — | Single shared Google Maps Places script |

All four "is it used?" suspicions checked out — they're all wired into `Providers.tsx`.

---

## 4. Backend & Database

### 4.1 The shape

**There is no traditional backend.** Genie.ph is a **BaaS architecture**:

- **Supabase Postgres** — every table, every row, every transaction. ~62 migrations. RLS everywhere except a few service-role-only tables.
- **Supabase Auth** — email/password, magic link, OAuth (Google), anonymous sessions.
- **Supabase Storage** — `cakegenie` (main bucket, public) and `cakegenie-rejected-uploads` (private, audit log).
- **Supabase Edge Functions** (Deno) — 14 functions, but 2 are empty stubs (`bux-webhook`, `create-bux-payment`) and 1 is a connectivity check. The real ones: payment creation, payment verification, webhook, sitemap, share-design, validate-discount-code, image conversion.
- **Next.js API routes** (Vercel serverless) — the AI gateway, the cron jobs, the internal HMAC-verified variant pipeline.
- **A separate Python FastAPI service** (`backend/main.py`, 476 lines) — the ORB (Oriented FAST and Rotated BRIEF) crop-resistant image-matcher. Runs separately, talks to Supabase.
- **Vercel** — hosts the Next.js app + the cron jobs.

### 4.2 Core tables (in order of "if this breaks, you have a bad day")

| Table | Holds | Size implication |
|---|---|---|
| `cakegenie_analysis_cache` | The single most important table. One row per analyzed cake image. Holds `p_hash`, `slug`, `original_image_url`, `studio_edited_image_url`, `cached_edited_image_url`, `analysis_json`, `color_variants`, `icing_design`, `toppers`, `rejection`, `image_variants`, `orb_status`, `coverage_status`, `has_orb_index`, `fingerprint_pipeline`. Drives every SEO landing page, the customizing flow, the similarity search. | Big, hot. Drives everything. |
| `cakegenie_image_features` | The ORB/pHash feature store. One row per `cache_id`, with `global_phash`, `tile_phash[]`, `orb_descriptors` (serialized keypoints). Populated by the Python service. | Big JSONB blobs. |
| `cakegenie_collections` | Curated cake collections. Trending/SEO. ~400 themed slugs seeded. Columns: `name`, `slug`, `description`, `hits`, `tags`, `item_count`, `sample_image`. | Public read, no RLS. |
| `cakegenie_merchants` | Bakeshop partners. ~10+ in the `best-cake-shops-cebu` page. | Standard. |
| `cakegenie_merchant_products` | Catalog items. Many reference a `p_hash` to reuse AI analysis. | Standard. |
| `cakegenie_orders` + `cakegenie_order_items` | Real orders. Orders have `is_split_order` (split-bill), `delivery_latitude/longitude` (added 2025-12-03), `split_share_url`, `organizer_user_id`. | Critical. |
| `cakegenie_cart` | Cart. Keyed by `user_id` OR guest `session_id`. | Standard. |
| `cakegenie_reviews` | 1–5 star reviews, with `is_approved`/`is_visible` flag, `merchant_response`, photos[]. Trigger auto-updates merchant `rating`/`review_count`. | Standard. |
| `cakegenie_saved_items` | User wishlist — products + custom designs. 4 per-user RLS policies. | Standard. |
| `cakegenie_shared_designs` | Public share-link rows + split-bill organizer records. | Standard. |
| `cakegenie_newsletter_subscribers`, `discount_codes`, `discount_code_usage` | Email list + promo codes. Codes can be public, user-specific, new-user-only, creator-attributed. | Standard. |
| `xendit_payments`, `bill_contributions`, `order_contributions`, `merchant_payouts` | The payment web. Note: `bill_contributions` (old) and `order_contributions` (new) both exist; some code paths still use the old one. | Risk. |
| `cakegenie_icing_masks` | Red-icing / black-everything-else PNG masks for instant client-side HSL recolors. Versioned. | Cached, public. |
| `cakegenie_search_analytics` | Search-term tracking → drives trending logic. | Analytics. |
| `chat_conversations`, `chat_messages` | Customer-support chat. Auth or guest via `session_id`. RPCs enforce access. | Standard. |
| `creators` | Influencer/creator partner applications. CHECK at least one social handle. | Public insert. |
| `client_errors` | Frontend JS error capture (complement to Clarity). RLS: anonymous insert allowed. | Append-only. |
| `cakegenie_contact_messages` | Contact form submissions. Service-role only. | Standard. |
| `cakegenie_pinterest_tokens`, `cakegenie_pinterest_pins` | Pinterest OAuth creds + per-design pin dedup. | Service-role only. |
| `cakegenie_rejected_uploads` | **Private audit log** of AI-rejected uploads. Migration comment: "Do not expose in public product, feed, sitemap, or cache surfaces." Service-role only. | Audit. |
| `merchant_staff` | Merchant↔user join. `role` (`owner`/`admin`/`staff`), `permissions JSONB`. | RLS. |
| `ai_prompts` | Versioned AI prompts. Loaded by `promptLoader.ts` with `ai_prompts` table → `fallback-prompt.txt` fallback chain. | Active. |

### 4.3 RPCs (the business logic at the database level)

- `create_order_from_cart(...)` — atomic cart-to-order, server-side discount re-validation, records `discount_code_usage`, increments `times_used`. **This is the right place for it.**
- `create_split_order_from_cart(...)` — same plus split fields.
- `handle_order_contribution_update()` — trigger that auto-confirms the parent order when fully funded.
- `find_candidates_by_tile_hash(...)` — consumed by the Python ORB service.
- `cakegenie_claim_variant_row(...)` — single-flight claim so only one worker processes a row.
- `update_merchant_rating_on_review()` — trigger to recompute merchant aggregates.
- `can_access_conversation` / `send_customer_message` / `get_or_create_conversation` — chat RPCs.
- `repoint_cakegenie_user_references(p_old, p_new)` — re-points FKs after a user re-registers.

### 4.4 The Python ORB service (`backend/`)

A separate FastAPI app that handles **crop-resistant image similarity matching** (when a user uploads a cropped version of a cake, ORB feature matching can still find the original). Endpoints:

- `POST /api/match` — main matcher, accepts FormData, three modes (`default`/`strict`/`loose`).
- `GET /api/health` — health check.
- Likely `/similarity-debugger` UI in the Next.js app talks to it.

It's deployed separately. Looks like it lives on `orb.genie.ph` per the env var comment. CORS is wide open (`*`).

### 4.5 The payment flow

Xendit is the only real payment provider (Bux was abandoned, both the service file and the edge function are 0 bytes). Flow:

1. User confirms cart → `create-xendit-payment` (Supabase Edge Function, service-role) calls `Xendit /v2/invoices`, writes `xendit_payments` row.
2. User pays at the Xendit-hosted invoice URL.
3. `xendit-webhook` (public, no HMAC ⚠️) receives the callback, matches the invoice, re-verifies the amount, sets `payment_status='paid', order_status='confirmed'`.
4. For split orders, each contribution creates its own Xendit invoice; trigger rolls up `amount_collected` and auto-confirms when fully funded.

### 4.6 External services wired up

| Service | Purpose |
|---|---|
| **Supabase** | Core backend |
| **Google Vertex AI (Gemini 3)** | All AI. `gemini-3.1-flash-lite-preview` (analyze, validate, generate-texts), `gemini-3.1-flash-image-preview` (edit, cold-cake), `gemini-2.5-flash` (chat-edit). WIF auth in prod. |
| **Roboflow Florence-2** | Object detection (cake topper, character, flower, text, decoration, toy, candle, sprinkles) → bbox overlay data for the UI |
| **DataForSEO Labs** | Weekly cron pulls Google Keyword Ideas, drives trending collections |
| **Google Maps Places** | Address autocomplete in checkout |
| **Xendit** | Payments (GCash, Maya, ShopeePay, Visa/MC, BPI, BDO, Palawan) |
| **n8n** | Server-side event webhook → workflows (Shopify push, etc.) |
| **IndexNow** | Instant URL submission to Bing/Yandex/etc. |
| **Pinterest API v5** | Pin pushing (10/day cap, 10s sleep between pins) |
| **Microsoft Clarity** | Session replay (hardcoded project ID `te894qldzn`) |
| **Google Analytics 4** | Pageviews + `purchase` event (hardcoded `G-C28QNPRWFK`) |
| **Shopify (via n8n)** | Push curated products to a Shopify storefront |
| **Exa** | Listed in `.env.example` but **never referenced** in code. Reserved. |
| **GCS (`@google-cloud/storage`)** | Vertex AI batch JSONL inputs/outputs |

---

## 5. Green flags — what's done well

1. **Strict RSC / CSR discipline.** Pages default to server components; data fetching is server-side and streamed; client components are isolated to interactivity. This is exactly the Next.js App Router pattern.
2. **ISR + Suspense is leveraged properly.** Homepage is 1 h ISR with a Suspense boundary so the LCP hero paints while data streams in. The LCP optimization (preloading 6 hero images) shows serious perf work.
3. **Single Supabase migration discipline.** 62 incremental migrations, well-named, no destructive drops. `create_order_from_cart` and `find_candidates_by_tile_hash` as RPCs (not client logic) is the right call.
4. **The AI prompt registry is well-designed.** `ai_prompts` table → `fallback-prompt.txt` chain. Versioning is enforced.
5. **The discount-code middleware is elegant.** Single-segment URL → Supabase check → 307 redirect. RLS-protected, 5 min revalidate, no service-role key in middleware.
6. **WIF + Vertex AI instead of static API keys.** `vercel.json` + `GOOGLE_CREDENTIALS_JSON` env var, no JSON key in the repo for production.
7. **Schema markup is everywhere.** Organization, WebSite, LocalBusiness, Product, ItemPage, CollectionPage, FAQPage, BreadcrumbList, SoftwareApplication, BlogPosting. The SEO foundation is solid.
8. **The GEO bot allow-list is intentional.** GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, OAI-SearchBot, Bytespider — explicitly allowed. `robots.txt` is a marketing asset here.
9. **The merchant isolation pattern.** `merchant_staff` table + `private.get_user_merchant_role()` SECURITY DEFINER function + per-merchant RLS is the textbook B2B marketplace setup.
10. **HMAC-verified webhooks for the variant pipeline.** Constant-time `timingSafeEqual` comparison. This is the only route with proper webhook auth — set the bar.
11. **Tests are real.** ~110 test files, several hundred lines of `fast-check` property tests, 462-line `cacheAnalysisResult` test. Healthy.
12. **Schema.org Product on `/customizing/[slug]` with `license`/`copyrightHolder`.** Most teams forget; you didn't.
13. **The split-the-bill feature is thoughtful.** `order_contributions` + trigger to auto-confirm. Real product thinking, not a checkbox.
14. **The "tripwires" in the rejected-uploads migration comment** ("Do not expose in public product, feed, sitemap, or cache surfaces") — the team is thinking about defense in depth.
15. **`dangerouslySetInnerHTML` for JSON-LD is mostly escaped** (`replace(/</g, '\\u003c')`). Several sites use the same `stringifyLd` helper.

---

## 6. Red flags — what's wrong

### 6.1 Security (urgent)

1. **`xendit-webhook` has no HMAC verification.** The Edge Function receives a public POST with no signature check. Any attacker who knows a valid `external_id` (Xendit invoice IDs are sequential and partially guessable) can spoof a payment confirmation. **Add `X-Callback-Token` verification immediately.** [Source: `supabase/functions/xendit-webhook/index.ts`]
2. **Most public API routes have no auth or rate limit.** `/api/ai/analyze`, `/api/contact`, `/api/newsletter`, `/api/signup-discount`, `/api/chat/*`, `/api/proxy-image`, `/api/indexnow`, `/api/roboflow/detect`, `/api/image/fingerprint`, `/api/search`, `/api/collections/trends/cron` — anyone can hit these. The AI analyze endpoint will burn Vertex AI credits on demand; the newsletter endpoint can be hit to create fake `discount_codes` rows; the contact form is an open spam relay. **Add a basic rate limit + reCAPTCHA + per-IP throttling.** Severity: **HIGH**.
3. **Past secret-leak commits exist.** `30ffaee` and `91ad0c7` are titled "Remove sensitive files from tracking" — confirm every key mentioned in those commits has been rotated. Severity: **HIGH** (one-time, but verify).
4. **PEM key file `scratch/clean_key.pem` lives on disk near the repo.** Currently gitignored, but a footgun. Severity: **MEDIUM**.
5. **No CORS restriction on the Python ORB backend** (`allow_origins=["*"]`). It's behind the same domain in prod, but worth tightening. Severity: **LOW**.

### 6.2 Data & state

6. **`supabaseService.ts` is a 4,481-line god module with 93+ exports.** Imported into 8+ client components, single biggest client-bundle contributor. **Split into `services/cache/`, `services/cart/`, `services/orders/`, `services/merchants/`, `services/blog/`, etc.** Severity: **MEDIUM**.
7. **`useAnonymousAuth` silently signs in every visitor on every non-`/` page.** Every browser session creates a real Supabase auth row. Tens of thousands of useless auth rows per day. **Tie to a real action** (Save, Add to cart). Severity: **MEDIUM**.
8. **Two parallel "split bill" tables exist: `bill_contributions` (old) and `order_contributions` (new).** The Xendit webhook still matches the old one first, then the new one. **Pick one and migrate.** Severity: **MEDIUM**.
9. **`xendit_payments` and `payments` both exist.** Some code paths still read from the older `payments` table. Consolidate. Severity: **MEDIUM**.
10. **`/designs/[slug]` is dead code that just redirects to `/customizing/[slug]`.** The 100+ lines below the redirect are unreachable. Delete. Severity: **LOW**.

### 6.3 Performance & UX

11. **`src/app/customizing/CustomizingClient.tsx.orig` (3,663 lines) is tracked in git.** Dead code, source of confusion. `git rm` and add `*.orig` to `.gitignore`. Severity: **LOW**.
12. **`images.unoptimized: true`** in `next.config.ts:19`. Comment says it's because Supabase's free tier has a 100-image transform quota. **This is a real Lighthouse hit.** Consider Cloudinary/Imgix for transformations, or just resize the originals to webp on upload. Severity: **MEDIUM**.
13. **`lodash-es` is pulled into the bundle for one `debounce` import** in `CartContext.tsx`. 70 KB for one function. Replace with `lodash.debounce` (4 KB) or write inline. Severity: **LOW**.
14. **`node-fetch` + `@types/node-fetch` are dead weight** — Node 20 has native `fetch`. Severity: **LOW**.
15. **`react-hot-toast` is bypassed in 5+ files** that import it directly instead of using the existing `lib/utils/toast.ts` wrapper. Inconsistent UX. Severity: **LOW**.
16. **`mitata` benchmark file is in `vitest`'s default test path** but excluded from `tsconfig.json` typecheck. Will run on `npm test`. Severity: **LOW**.

### 6.4 Documentation & process

17. **`README.md` is the create-next-app default** and says the dev server is on `localhost:3000` while `package.json` hardcodes port `3002`. Misleading on first open. Severity: **MEDIUM**.
18. **`ARCHITECTURE.md` is dated.** Says "Next.js 14+", pre-dates Image Studio, ORB backend, watermark pipeline, multi-tier color rules. Severity: **MEDIUM**.
19. **Three copies of the humanizer guidance** (`the-humanizer.md` root, `.agent/rules/`, `.agent/skills/`). Pick one. Severity: **MEDIUM**.
20. **`gemini.md` and `AI_CONTEXT.md` duplicate the same SDK config table.** Pick one. Severity: **MEDIUM**.
21. **8 different AI workspace directories** (`.agent/`, `.claude/`, `.kilo/`, `.kiro/`, `.opencode/`, `.qwen/`, `.playwright-mcp/`, plus `.cursorrules`). Drift risk when one tool's rules contradict another's. Severity: **MEDIUM**.
22. **400+ lines of AI prompt logic inline in `designService.ts`.** Should live in `services/prompts/*.txt` so non-engineers can review. Severity: **MEDIUM**.
23. **Dead code in `geminiService.ts`**: `promptCache` constant and `PROMPT_CACHE_DURATION` are commented as "Still used? Maybe optional" but are never referenced. Delete. Severity: **LOW**.
24. **`tasks/todo.md` is 2,101 lines and tracked.** Move to personal notes. Severity: **LOW**.

### 6.5 Git hygiene

25. **~30 MB of one-off screenshots/logs/html still tracked** (`.playwright-mcp/*.png`, `base-page-*.png`, `best-cake-shops-cebu-*.png`, `audit-result.txt`, `dev_server.log`, `test.html`). One-shot `git rm --cached` + `git gc --aggressive --prune=now`. Severity: **MEDIUM**.
26. **Root-level `scratch.js` uses the service-role key fallback pattern**, tracked. Should not be in the repo. Severity: **MEDIUM**.
27. **`patch_*.js`, `test-*.ts`, `test-cse.js`** at repo root — one-off debugging scripts. Move to `scripts/` or delete. Severity: **LOW**.
28. **Uncommitted watermark feature** in `src/lib/admin/imageStudioJob.ts` + 3 untracked scripts. Commit or stash. Severity: **LOW**.
29. **`vercel-gcp-credentials.json` is committed** — it's WIF metadata, not a secret, but leaks GCP project IDs. Delete and document the JSON shape in `docs/vertex-ai-wif-migration.md`. Severity: **LOW**.

---

## 7. Pros & Cons — the short version

### Pros

- **Two real revenue paths in one product**: B2C marketplace + B2B SEO/GEO content + a separate ColdCaking B2B surface + creator-network promo codes. Most projects are one-product-and-done.
- **The AI loop is the moat.** Every analyzed image becomes a permanent SEO asset. Competitors without the analysis cache can't easily replicate the long-tail traffic.
- **Genuinely modern stack.** Next.js 16 + React 19 + RSC + Supabase + Vertex AI 3 + WIF. No legacy framework debt.
- **GEO is a real strategy, not a buzzword.** `robots.txt` explicitly opens to GPTBot / ClaudeBot / PerplexityBot. IndexNow instant-submission. Pinterest + GMC feeds. Schema markup everywhere.
- **The merchant dashboard is real** — staff roles, payouts, isolation, dashboard stats. This is what a real marketplace needs.
- **Quality-of-life features** that customers actually use: split-the-bill, saved designs, share links with OG cards, blog embeds with product showcases.
- **The dev workflow is set up well** despite the sprawl: branch-per-feature, `tasks/lessons.md`, regression-prevention rules, multiple AI tool configs.

### Cons

- **The codebase is in "pressure-grown" mode**: 4,481-line god module, 1,611-line god hook, parallel "split bill" tables, two payment tables, dead `*.orig` files, abandoned 242 KB n8n export.
- **Public AI endpoints are an open door for abuse** and Vertex AI credit burn.
- **The Xendit webhook is the single most dangerous security gap** — no signature verification, no auth.
- **Anonymously auto-signing in every visitor** generates auth-row pollution and skews MAU metrics.
- **Documentation is fragmented and out of date** (3 copies of the humanizer, 2 copies of the Gemini config, 2 KB README that lies about the port).
- **The `.gitignore` rules were retrofitted** — the bloat is in git history and needs a one-shot `git rm --cached` sweep.
- **No tests for the AI analyze flow end-to-end** — only unit tests for individual services. One bad prompt change can ship undetected.

---

## 8. Suggestions — what to do next, in priority order

### 🔴 This week (security, before anything else)

1. **Add `X-Callback-Token` verification to `xendit-webhook`.** This is the single most important change in the entire audit. See [Xendit docs](https://developers.xendit.co/api-reference/#callbacks). 10 lines of code, massive risk reduction.
2. **Add a basic rate limiter** to `/api/ai/*`, `/api/newsletter`, `/api/contact`, `/api/signup-discount`. Even Vercel's built-in Edge Middleware rate limit is enough to stop the obvious abuse. A Cloudflare turnstile on the contact/newsletter forms is also 30 minutes of work.
3. **Rotate any keys that were ever committed to git history** (commits `30ffaee`, `91ad0c7`). Use `git log -p --diff-filter=D -- .env` to confirm what was leaked. Then rotate in Supabase, Vercel, Xendit, Google Cloud.
4. **Move `scratch/clean_key.pem` to `~/.ssh/` or a password manager.** Today.

### 🟡 This month (data integrity + maintenance)

5. **Pick one split-bill table** (`bill_contributions` OR `order_contributions`) and migrate. Add a `cakegenie_deprecated_bill_contributions` view for read compatibility during transition. Update the Xendit webhook match path.
6. **Consolidate the payment tables** (`xendit_payments` vs `payments`). The same.
7. **Split `supabaseService.ts`** into 5–6 domain files. Start with the biggest ones: `services/cache/`, `services/cart/`, `services/orders/`, `services/merchants/`. Update imports. This is a one-time refactor that pays back forever in client bundle size.
8. **Tie `useAnonymousAuth` to a real action.** "Save this design" or "Add to cart" is a natural trigger. Don't create an auth row on first paint.
9. **One-shot `git rm --cached` of all the bloat** (`.playwright-mcp/`, all root `*.png` that aren't in `public/`, `audit-result.txt`, `dev_server.log`, `test.html`, `CustomizingClient.tsx.orig`, `scratch.js`, root `test-*.ts`/`patch-*.js`). Then `git gc --aggressive --prune=now`. Optional force-push after team heads-up.
10. **Delete the dead `/designs/[slug]` redirect body** and the `*.orig` files. ~3,700 lines of code go away.

### 🟢 This quarter (product + DX)

11. **Refresh `README.md` and `ARCHITECTURE.md`.** Real description, real port (`3002`), real `npm run dev` instructions, link to `AI_CONTEXT.md` and `docs/vertex-ai-wif-migration.md`. ARCHITECTURE should mention Image Studio, ORB backend, watermark pipeline, multi-tier color rules.
12. **Consolidate AI guidance to one location.** `AI_CONTEXT.md` for SDK rules, `.agent/skills/humanizer/SKILL.md` for humanizer, `docs/agent-guidelines/branding.md` for content rules. Update `.cursorrules`. Delete `gemini.md`, `the-humanizer.md`, `antigravity.md` (or move to archive).
13. **Move AI prompt content to `.txt` files** under `services/prompts/`. The 3 `*_SYSTEM_INSTRUCTION` constants in `designService.ts` and the `validationPrompt` in `lib/ai/prompts.ts` should be editable by content folks, not buried in TS.
14. **Add an end-to-end smoke test for the AI analyze flow.** A "golden image" + expected pHash + expected cake type. This catches prompt regressions that unit tests miss.
15. **Add coverage thresholds to `vitest.config.ts`.** Even `50%` is enough to flag regressions.
16. **Restrict Python ORB CORS** to your production domain only.

### 💡 Nice to have (moat-builders)

17. **Add an A/B test harness for AI prompts.** The `ai_prompts` table already has versioning; expose a "winner" flag and route 10% of new uploads to challengers. This is the difference between "we shipped a new prompt" and "we shipped a *better* prompt."
18. **Build a public API for the merchant catalog** (`/api/merchants/[slug]/products.json`). The Chrome extension already has a handoff path; formalize it. This is how Shopify & Etsy ecosystems grow.
19. **Add a /changelog or /status page** so merchants and creators can see platform updates. Cheap to build, high-trust payoff.
20. **Add PostHog or OpenReplay** in addition to Clarity. Clarity doesn't capture mobile-network or iOS Safari quirks well. PostHog's session replay does.

---

## 9. The one-paragraph elevator pitch

> Genie.ph is a serious, real, working product. The architecture is sound, the AI loop is genuinely a moat, and the SEO/GEO surface is one of the more thoughtful implementations in the Philippine startup space. The biggest risks are concentrated in the **payment webhook auth gap**, the **open public API endpoints**, and the **god-module service file** that's now slowing every release. Fix those three in the next 30 days and you have a clean foundation to scale. The rest is paper-cut cleanup.

---

*Reviewed by Mavis on 2026-06-06. Sources cross-checked against `src/`, `supabase/`, `backend/`, `next.config.ts`, `package.json`, and 62 Supabase migrations. All file paths are repo-relative. Severity ratings are my judgment, calibrated for a small agency team — adjust for your context.*
