# CRO Audit — Landing Page & Customizing PDP

**Site:** Genie.ph (custom cake marketplace, Cebu)
**Pages audited:**
- Landing: `src/app/page.tsx` + `src/app/LandingClient.tsx` (URL: `/`)
- Customizing PDP: `src/app/customizing/page.tsx` + `src/app/customizing/CustomizingClient.tsx` (URL: `/customizing`)

**Method:** Static code audit using the `cro` skill at `.agent/skills/cro/SKILL.md`. Findings come from reading source. No live browser testing was run, so render/perf/mobile-actual checks are out of scope.

**Audit framework (in priority order):**
1. Value proposition clarity
2. Headline effectiveness
3. CTA placement, copy, hierarchy
4. Visual hierarchy / scannability
5. Trust signals & social proof
6. Objection handling
7. Friction points

---

## Executive Summary

Both pages already do many things right: instant pricing as the wedge, rotating headline showing variety, review aggregate, sticky bottom CTA on customizing, "Verified" badge, visible delivery promise, and a simple upload-first hero. The biggest CRO gaps are in this order:

1. **Mixed primary CTA copy** — landing uses 4 different primary CTA labels in 4 places ("Upload Your Design - Get Instant Pricing", "Browse from 10,000+ cake designs", "Try the demo", "Upload design - Check same-day availability"). One canonical primary CTA wins.
2. **Customizing's primary purchase CTA says "Buy This Now"** while toasts and disabled states say "add to cart" → inconsistent mental model. Pick one verb (recommend "Add to Cart" since it routes to `/cart`, not checkout).
3. **No visible delivery date / cutoff timer near the buy button** on customizing. The cutoff banner exists but the price area doesn't say "Get it by [today, 7pm]" beside the price — the single biggest e‑commerce conversion lever.
4. **Trust density near CTA is thin on customizing.** No reviews/rating shown next to the cake or the sticky bar. The 4.8★ summary lives only in the empty-state hero and the footer.
5. **Hero "typing" animation on landing** rotates 7 cake-type words inside the H1, which is clever but reduces readability for the first 3-5 seconds and likely hurts the 5-second clarity test.
6. **Friction on customizing**: errors are toast-only (`showError`) — they disappear, leaving the user stuck without a recovery path beside "Upload Another"; the page also routes to `/cart` (not `/checkout`) on add-to-cart, so the buy-button copy "Buy This Now" sets the wrong expectation.
7. **Discount UX**: a `DiscountOfferBubble` floats next to the sticky price, then a second "DISCOUNT APPLIED" pill renders above the price after click. Two competing discount signals = anchoring confusion.

Each finding below is tagged **Quick Win** (ship today), **High-Impact Change** (worth the effort), or **Test Idea** (worth A/B testing).

---

## 1. Landing Page — Findings

### 1.1 Value proposition clarity

**Current state**
- H1 (desktop) is a typing animation cycling through 7 phrases: "Custom Cakes", "Minimalist Cakes", "Vintage Cakes", "Floral Cakes", "Photo Cakes", "Bento Cakes", "Doodle Cakes" + "For Today's Celebrations"
  → `src/components/landing/landingHeroContent.ts:18-31`, rendered at `LandingClient.tsx:1609`
- Eyebrow above H1: "Best Online Cake Delivery for Rush Orders in Cebu"
- 3-icon strip below CTA: **Any Cake Image · Instant AI Pricing · Same-day Delivery** (`LandingClient.tsx:494-518`)
- IntroContent (further down): "Upload a design, see your price in 10 seconds, and get it delivered today across Metro Cebu. No DMs. No back-and-forth. No surprises." — this is your strongest value prop sentence and it lives below the fold.

**Issues**
- The 5-second test is degraded: the cycling H1 means a first-time visitor sees something like "Vintage Cakes For Today's Celebrations" — pretty, but the *what + why* (instant pricing, same-day delivery, no DMs) only appears in the eyebrow (small caps) and the icon strip (also small).
- The strongest line — "No DMs. No back-and-forth. No surprises." — is in `IntroContent.tsx:14-16`, well past the hero.

**Recommendations**
- **Quick Win:** Make the eyebrow line bigger and bolder, or convert it to the actual hero subheadline. Keep the cycling H1 but lock the visible subheadline so the *what + why* is always readable.
- **Test Idea:** A/B test a static H1 vs. the typing animation. Hypothesis: static "Custom Cakes for Today's Celebrations" + a sub-line "Upload any design. See the price in 10 seconds. Delivered today in Cebu." converts higher because it passes the 5-second test on first paint.
- **High-Impact Change:** Move the "No DMs. No back-and-forth. No surprises." line into the hero block (under H1 or under the CTA microcopy). It's the differentiator vs. Instagram/Facebook home bakers.

### 1.2 Primary CTA — copy, count, hierarchy

**Current state — primary CTAs on landing, in DOM order:**

| # | Location | Label (verbatim) | File:Line |
|---|---|---|---|
| 1 | Hero (mobile) | "Upload Your Design - Get Instant Pricing" | `LandingClient.tsx:642` |
| 2 | Hero secondary text link | "Don't have a photo? Browse from 10,000+ cake designs" | `LandingClient.tsx:649` |
| 3 | Interactive customizer demo CTA | (passed via `onTryItClick`) | `LandingClient.tsx:1916` |
| 4 | Same-day delivery section | "Upload design - Check same-day availability" | `LandingClient.tsx:2009` |
| 5 | Mobile bottom nav (sticky) | upload action | `LandingClient.tsx:2044` |

**Issues**
- 4 different primary-CTA labels for the same action (upload). The brain treats them as 4 different actions.
- "Browse from 10,000+ cake designs" is a strong number but it competes with the upload CTA visually.
- No CTA appears in the desktop top nav (would need to confirm in nav component, but I didn't see one referenced in the hero file).

**Recommendations**
- **Quick Win:** Standardize the primary-CTA label to one phrase, e.g. **"Upload Your Cake Design"** (or "Get Instant Pricing"). Use it in hero, demo section, delivery section, and mobile nav.
- **Quick Win:** Make "Browse 10,000+ designs" a clear *secondary* CTA (smaller button or pill, not the main visual weight). Today the link is text-only `text-purple-600 font-bold` — it reads as a link, not a CTA, which is correct, but the count is buried in lighter copy. Surface "10,000+ designs" as a credibility stat in the hero subhead too.
- **Test Idea:** Add a sticky upload button to the desktop top nav. Hypothesis: returning visitors and scroll-down readers re-encounter friction; persistent CTA recovers them.

### 1.3 Trust signals & social proof

**Current state**
- Aggregate rating chip in hero: "4.8 ★★★★★ based on N Happy Customers | Verified ✓" linked to `/reviews` (`LandingClient.tsx:467-481`)
- Footer: same chip + DTI Registered + Backed by Stellar + Secure Checkout (`LandingFooter.tsx:74-110`)
- IntroContent: "✨ See your cake priced in 10 seconds … 🤝 Trusted local bakers"

**Issues**
- No customer testimonial with a face/photo above the fold. "4.8 ★★★★★" is good but generic — competitors show the same.
- No order count or "X cakes delivered this month" — strong urgency/momentum signal that's missing.
- No baker logo wall or "Featured in [press]" strip.

**Recommendations**
- **High-Impact Change:** Add 1-2 short testimonial cards directly under the hero CTA (specific, attributed, with photo). The CRO skill calls this out under "Trust Signals" → place near the CTA.
- **Quick Win:** Add a momentum stat near the rating, e.g. "1,200+ cakes delivered in Cebu this month" (only if true and supportable). Numbers in the hero work harder than star ratings alone.
- **Test Idea:** Add baker logos / partner-bakery thumbnails ("Powered by 50+ vetted Cebu bakers"). Reinforces the marketplace promise and addresses "is this real food or AI slop?" objection.

### 1.4 Objection handling

**Current state**
- IntroContent addresses "trust" implicitly ("vetted Cebu baker, not a grocery shelf") and "transparency" ("What you see is what you pay")
- No visible FAQ on landing
- Return policy / quality guarantee is in footer only

**Issues — common cake-buyer objections not addressed in hero/above the fold:**
- "Will it actually look like the photo I upload?"
- "What if it arrives damaged?"
- "Is this actually delivered same-day or is it a marketing claim?"
- "How does pricing work — is the AI accurate?"

**Recommendations**
- **High-Impact Change:** Add a "How It Works" 3-step strip (Upload → Customize → Delivered) between hero and IntroContent. Right now there's an Interactive Customizer Demo at `LandingClient.tsx:1878`, which is good for the "customize" step but doesn't show the full ordering arc.
- **Quick Win:** Add 2-3 FAQ items inline (collapsible) before the footer: "What if my cake doesn't match the design?", "What's covered if it's damaged in delivery?", "How accurate is the AI price?". You already generate dynamic FAQs on the customizing PDP via `generateDynamicFAQ` — reuse the pattern.

### 1.5 Friction points

**Current state**
- Newsletter popup `<NewsletterPopup />` renders globally (`page.tsx:194`)
- Hero CTA opens an `ImageUploader` dynamic modal — good (no page jump)
- Mobile bottom nav adds persistent upload affordance — good

**Issues**
- The newsletter popup competes with the primary upload CTA. Timing/triggering not visible from this audit but worth verifying it doesn't fire before the user has had a chance to upload.

**Recommendations**
- **Quick Win:** Confirm the newsletter popup is gated by either scroll depth, time on page, or exit intent — and that it doesn't fire on first paint. If it does, that's a measurable conversion drag.
- **Test Idea:** Suppress the popup for any user who has clicked the upload CTA in the same session.

---

## 2. Customizing PDP — Findings

This is your money page. It has more surface area to optimize.

### 2.1 Page state machine

The page has at least 4 distinct states the user can be in (visible from `CustomizingClient.tsx`):

| State | Trigger | Sticky bar shows? |
|---|---|---|
| **Empty / landing** | First visit, no image | No (no `finalPrice`) |
| **Analyzing** | After upload | Yes, "Analyzing..." with shield+lock copy |
| **Result / customize** | AI returns | Yes, price + "Buy This Now" |
| **Error** | AI rejection | Sidebar shows error card; sticky bar shows "Analysis Error" |

The sticky bar at `StickyAddToCartBar.tsx:198` covers all four — good.

### 2.2 Value proposition (above the fold, before upload)

**Current state — empty state copy** (`CustomizingEmptyLandingState.tsx`)
- Eyebrow: "Best Online Cake Delivery for Rush Orders in Cebu"
- H2: "Custom Cakes / For Today's / Celebrations" (gradient on "Celebrations")
- Trust line: "4.8 ★★★★★ based on 6 Happy Customers. | Verified ✓"
- Bottom row: "Any Cake Image · Instant Pricing · Same-day Delivery"
- Upload widget on the left, copy on the right

**Issues**
- The H2 is identical to the landing H1 wording. A user landing here directly (e.g. from Shopify CSE handoff via `?image_url=`) sees the same headline, but the *page intent* is different — they're here to customize, not to be sold the brand. The headline should be more action-oriented at this point.
- "based on 6 Happy Customers" is hardcoded as fallback (`CustomizingEmptyLandingState.tsx:54`). If the database returns 0 reviews this still renders "6", which is misleading. This needs to be the live count, not a placeholder, and 6 is honestly a low number to display — better as "Trusted by 1,000+ orders" if available.
- Upload widget is on the left, copy on the right (desktop). Western reading pattern is left→right, so the value prop sells *after* the user has already seen the upload. That's actually fine (the upload is the action) but mobile stacks the upload above the copy, which means the user must scroll past it to see the H2.

**Recommendations**
- **Quick Win:** Replace the headline with action-led copy. E.g. "Upload your design. See your price in 10 seconds." This matches the page intent.
- **Quick Win:** Stop hardcoding "6 Happy Customers" as the fallback. Either show the live count (already passed in `reviewSummary`) or hide the count entirely until you have a stronger number. Or replace with something stable like "Trusted by Cebu bakers."
- **Test Idea:** Test left-aligned upload (current) vs. centered single-column hero on desktop. The current 5-7 split is a decision to defend, not assume.

### 2.3 H1 / SEO heading hygiene

**Current state**
- `CustomizingClient.tsx:3280` renders `<h1 class="sr-only">{pageDisplayTitle}</h1>` when no visible heading exists — good for SEO
- `CustomizingPageMetaSections.tsx:83` renders a visible H1 once a product loads
- `customizing/[slug]/page.tsx:701` renders a visible H1 for product slugs

**Issues**
- The visible H1 on the customizing PDP after analysis is `truncate whitespace-nowrap` — it cuts off long titles. The product title is the strongest semantic signal for both users and search; truncating it on mobile is a CRO/SEO loss.

**Recommendation**
- **Quick Win:** Remove `truncate whitespace-nowrap` from `CustomizingPageMetaSections.tsx:83` or replace with a `line-clamp-2`. Truncating the cake name with an ellipsis on first paint is a small but real trust hit.

### 2.4 Primary CTA — the sticky "Buy This Now" bar

**Current state** (`StickyAddToCartBar.tsx`)
- Button label: **"Buy This Now"** with shopping bag icon (`StickyAddToCartBar.tsx:267`)
- On click → `onAddToCartClick` → `onAddToCart` in `CustomizingClient.tsx:981`, which calls `addToCartWithBackgroundUpload` and then **`router.push('/cart')`** (line 1134)
- Toast on success: **"Added to cart!"** (line 1133)
- Disabled tooltip when blocked: "Wait for analysis to finish before buying" / "Price is still calculating" / "Resolve the pricing issue before buying" / "Upload or select a cake design first" / "Adding this cake to your cart"

**Issues**
- Button says "Buy This Now" → user expects *checkout/payment*. But the route goes to `/cart`. This is a classic expectation mismatch and likely costs add-to-cart→checkout conversions.
- Disabled tooltip is verbose; on mobile it renders below as a separate paragraph (`mt-2 text-center text-[10px] sm:hidden`, line 280) — good fallback, but the messages mix tenses ("Wait for analysis", "Price is still calculating", "Resolve the pricing issue").
- The button is `whitespace-nowrap` and gets compacted to icon-only when the row is < 280px (`isCompact` flag). At icon-only the user sees just a shopping bag icon with no label, near a price and a share icon — recognition risk.

**Recommendations**
- **Quick Win:** Rename the button to **"Add to Cart"** since that's what it does. Save "Buy Now" / "Checkout Now" for a future direct-to-checkout flow.
- **Quick Win:** Normalize disabled-state copy — all in present tense, all imperative or all descriptive: "Waiting for analysis…", "Calculating price…", "Fix pricing issue", "Choose a cake first", "Adding…".
- **Test Idea:** When `isCompact` (icon-only on small phones), keep the bag icon + a tiny label ("Add" or "₱X →"). Hypothesis: icon-only loses some users.
- **Test Idea (high impact):** Add a delivery promise next to the price: "₱2,499 · **Delivered today by 7pm**". The availability ribbon is on top of the bar but separated from the price — pairing them increases conversion in nearly every commerce A/B test.

### 2.5 Price display & transparency

**Current state**
- Sticky bar shows: `₱{price}` + size sub-label like `8" Round 4" Height` + optional `+ Edible Photo` (`StickyAddToCartBar.tsx:135-167`)
- "Final Price" sub-label when size info is missing (line 156)
- Price guarantee badge during analyzing state ("Price Guaranteed", line 124)
- DiscountOfferBubble appears when `price !== null` and not analyzing/loading/erroring; on apply, a "DISCOUNT APPLIED" pill renders above the strikethrough price

**Issues**
- Two competing discount affordances: the floating bubble (pre-apply) and the pill (post-apply). The transition is animated but visually busy in a small footprint.
- "Price Guaranteed" badge appears during *analyzing* but disappears once the price is shown — actually you want this *after* analysis, when the user is deciding to buy. Currently it's a loading-state reassurance and then it's gone.
- Strikethrough + new price (line 148-150) shows the discount but doesn't quantify it ("Save ₱500" or "20% off"). The CRO literature is consistent here: the discount needs an absolute or percent number near it.

**Recommendations**
- **Quick Win:** Persist a small "Price Guaranteed" or "No surprise fees" line under the price in the *result* state, not just the analyzing state.
- **Quick Win:** Add the savings amount next to the strikethrough: `₱2,499 ₱1,999 (save ₱500)`.
- **Test Idea:** Test removing the floating `DiscountOfferBubble` entirely vs. embedding the discount as a static pill. Hypothesis: a floating element near the primary CTA distracts from the CTA itself.

### 2.6 Trust signals on the PDP

**Current state**
- 4.8 ★ rating + "based on N Happy Customers" + Verified ✓ — only on the empty state (`CustomizingEmptyLandingState.tsx:42-66`) and in the footer
- "Price Guaranteed" with shield icon — only during analyzing
- Availability ribbon (Rush / Same-day / Standard) — top of sticky bar
- Browse by Theme nav with 10 category links — bottom of `customizing/page.tsx:115`

**Issues — what's missing on the PDP after analysis:**
- No rating chip near the cake or near the buy button
- No "what others ordered" / "X people bought this design" social proof
- No baker name, baker rating, or baker badge on the design (I see `merchant?.merchant_id` is plumbed through to cart, but no visible baker brand on the PDP)
- No money-back / re-bake guarantee copy near the buy button
- No security badge (Maya/GCash/Xendit logos near the price)

**Recommendations**
- **High-Impact Change:** Add a 1-line trust strip directly above or beside the sticky bar price: "★ 4.8 (N reviews) · Money-back guarantee · Maya · GCash · COD". The CRO skill explicitly calls out trust signals "near CTAs and after benefit claims" — your sticky CTA is the most-viewed surface and it has zero trust density.
- **High-Impact Change:** Surface the baker. Even a small "Made by [Baker Name] · ★4.9" near the cake image dramatically reduces "is this real?" anxiety on a marketplace.
- **Test Idea:** Add a subtle "X people viewing this design" / "Y orders today" if you can support it from real data. Strong urgency lever.

### 2.7 Objection handling — FAQ

**Current state**
- `CustomizingPostAnalysisContent.tsx:18-22` generates dynamic FAQs via `generateDynamicFAQ(...)` and renders them in a `<details>` accordion. **Good.**
- First FAQ is `open` by default (line 113) — also good.
- "About this Cake" section + Design Specifications table render above the FAQ — good for both SEO and confidence.

**Issues**
- These sections render *below* the customization options, which means a user has to scroll past the buy bar's worth of UI to reach them. Most users will never see them.

**Recommendations**
- **Quick Win:** Keep the long-form sections where they are for SEO, but lift 2-3 of the most critical FAQs into a collapsible row directly under the price/size area — "Will it match my photo?", "Refund policy", "Delivery cutoff". Surface the answers where the buy decision is being made.

### 2.8 Friction points

**Errors are toast-only**

`CustomizingClient.tsx:1625, 1686, 1796, 1957, 2061, 2213, 2228` and others all do `showError(...)` with copy like "Failed to load product", "Image link expired. Please try again.", "Failed to load saved design.", "Could not load design: ...".

**Issues**
- Toasts are transient. If a user looks away, they miss the recovery path. The sidebar `analysisError` panel does have "Upload Another" / "Go Back Home" buttons (`CustomizingSidebarPanel.tsx:73-83`), which is the right pattern, but only for the analysis error path. Network/load errors leave the user on a half-broken page with no clear next step.

**Recommendations**
- **High-Impact Change:** Convert non-recoverable errors (image load failed, expired link, network failure) into the same persistent error card pattern as the analysis error. The toast is fine as a notification, but the page itself should also reflect the error state so the user has a button to click.

**Save design requires login**

`CustomizingClient.tsx:2319` — clicking save when not authenticated triggers `showInfo('Please log in to save designs')` and `router.push('/login?redirect=/customizing')`.

**Issue:** This is a hard navigation away from the work-in-progress customization. The user loses context. The redirect URL doesn't include a draft state hash.

**Recommendation**
- **High-Impact Change:** Save the draft to localStorage *before* redirecting to login, and restore it on return. Or, better, allow anonymous save (you already use anonymous auth — `user?.is_anonymous` is checked) by treating the design as an in-session draft and only requiring auth at checkout.

### 2.9 Mobile considerations

**Current state**
- Sidebar `hidden md:flex` (`CustomizingSidebarPanel.tsx:30`) — desktop-only
- Sticky add-to-cart bar — bottom-fixed both viewports (`StickyAddToCartBar.tsx:198`)
- Editor sheet (`CustomizingEditorSheet.tsx`) — slides up on mobile for editing

**Issues**
- The compact mode at <280px shows only icons. On the smallest phones (older iPhone SE, low-end Android), the user may see a sticky bar with `🛍️ ↗ 💬` and a price — and have to *guess* which is the buy button.

**Recommendation**
- **Quick Win:** Even in compact mode, force a 1-2 char label on the primary button (e.g. "ADD" or "→"). Lose share/chat first if space-constrained.

---

## Prioritized Action List

### Quick Wins — ship in a single sprint

1. **Customizing — rename "Buy This Now" → "Add to Cart"** (`StickyAddToCartBar.tsx:271`). Matches actual destination (`/cart`). Eliminates expectation mismatch.
2. **Customizing — remove `truncate whitespace-nowrap` from H1** (`CustomizingPageMetaSections.tsx:83`).
3. **Customizing — fix hardcoded "6 Happy Customers" fallback** (`CustomizingEmptyLandingState.tsx:54`). Either show live count or hide.
4. **Landing — standardize the upload CTA label** in the 4 locations to one canonical phrase.
5. **Landing — verify newsletter popup timing** doesn't compete with first-paint upload CTA.
6. **Customizing — normalize disabled-state copy** in the sticky bar (`StickyAddToCartBar.tsx:71-83`).
7. **Customizing — add savings amount** to the discount strikethrough display.
8. **Customizing — persist "Price Guaranteed" badge** into the result state, not just analyzing.

### High-Impact Changes — bigger but worth it

9. **Customizing — trust strip near the buy button**: rating, money-back, payment logos. Single highest-leverage change.
10. **Customizing — show the baker** on the PDP near the cake image.
11. **Customizing — add delivery promise next to price**: "₱X · Delivered today by 7pm".
12. **Customizing — persistent error states** for non-analysis errors (image expired, network, load failures), not just toasts.
13. **Customizing — anonymous draft save** so login redirect doesn't lose work.
14. **Landing — testimonial(s) above the fold** with photo + name.
15. **Landing — "How It Works" 3-step strip** between hero and IntroContent.

### Test Ideas — A/B test, don't assume

16. Static H1 vs. typing animation on landing (5-second clarity test).
17. Single-CTA hero (only upload) vs. dual-CTA (upload + browse) on landing.
18. Sticky upload button in desktop top nav.
19. Compact-mode label on sticky bar's primary button.
20. Floating discount bubble on vs. off.
21. "X orders today" / "X people viewing" social proof on customizing.
22. Trust strip vertical position (above price vs. below price vs. inline with price).

---

## Out of scope / next round

These need either live testing or analytics that I can't do from a static audit:

- Mobile rendering verification (would need Chrome DevTools MCP to run on the deployed site)
- Lighthouse / Core Web Vitals CRO impact (LCP, INP, CLS)
- Heatmap / scroll-depth data to validate which sections actually get seen
- Form-completion rates for the upload flow itself (drop-off between landing → upload modal opened → file selected → analysis complete)
- Login redirect impact data — how many users abandon when sent to `/login` from the save action
- Newsletter popup timing/trigger config — confirm in `NewsletterPopup` component before changing

If you want, I can:
- Open the live site with Chrome DevTools MCP and run the same audit on the rendered pages
- Wire the Quick Win changes directly (1-8 above) and verify with a build
- Convert this report into a Kiro spec under `.kiro/specs/cro-improvements/`

---

*Source: `.agent/skills/cro/SKILL.md` (installed from [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills)). Content rephrased from skill docs and source files for compliance.*
