# E-commerce SEO Report: /customizing/kuromi-light-purple-1-tier-cake-e3c3

**Target**: `https://genie.ph/customizing/kuromi-light-purple-1-tier-cake-e3c3`
**Mode**: `/seo ecommerce <url>` — Product Page Audit + Schema Validation + UCP probe
**Cost**: $0 (no DataForSEO calls)
**Run date**: 2026-05 baseline (artifacts under `artifacts/seo-ecommerce/`)

---

## Overall Score: **84 / 100**

Strong page. Ships 6 JSON-LD graphs, single H1, 1,237-word body, complete OG/Twitter, well-structured internal links. Two leaks bleed CTR and rich-result eligibility.

| Category | Weight | Score | Notes |
|---|---|---|---|
| Schema completeness | 25% | **22 / 25** | Product valid; 0 critical/0 high. Missing `aggregateRating`/`review`, `deliveryTime`, `applicableCountry`. |
| Title & meta | 15% | **11 / 15** | Title 64 chars (5 over). Meta truncated mid-sentence with `…`. |
| Image optimization | 20% | **17 / 20** | 0 missing alt, 0 generic alt, WebP everywhere. Hero is missing explicit width/height in HTML attrs (set in JSON-LD only). |
| Content quality | 20% | **18 / 20** | 1,237 words, specs section, FAQs, related products. No on-page reviews. |
| Internal linking | 10% | **10 / 10** | Breadcrumb + 6 related Kuromi designs + tag search links. Excellent. |
| Technical | 10% | **6 / 10** | ISR=3600 ✓, canonical ✓, robots ✓. UCP profile not declared (forward-looking opportunity, not a defect). |

---

## Product Page SEO

### Title Tag — 64 chars (4 chars over the SKILL.md target of 60)
```
Kuromi Cake - 1002 Cake Design with Price | Php 1,299 | Genie.ph
```
- ✓ Primary keyword (`Kuromi Cake Design`)
- ✓ Brand (`Genie.ph`)
- ✓ Price signal (`Php 1,299`)
- ✗ **64 chars — risks truncation in mobile SERPs (~580 px).** The trailing `| Genie.ph` is appended by the root layout's `metadata.title` template, so this is structural. The literal `1002` looks like an accidental ID leaking from `seo_title`.

### Meta Description — 151 chars
```
Celebrate with a charming 1-tier Kuromi cake, adorned with a smooth purple soft-icing base. This delightful... | Price starts at ₱1,299. Customize now!
```
- ✓ Length under 155
- ✓ Includes price + CTA (`Customize now!`)
- ✗ **Truncated mid-sentence with `...` followed by another sentence.** Reads as broken to users in a SERP. The `optimizeMetaDescription` truncation is hitting a word boundary too early because `resolveRichDescription` is producing a long unique paragraph and the script is cutting before the next sentence finishes. The result is a visible ellipsis right where users decide to click.

### Heading Structure
- ✓ Single H1: `Kuromi Cake - 1002 Cake Design`
- ✓ 12 H2s, 8 H3s — strong outline (`Icing Colors`, `Cake Toppers`, `Available Sizes & Prices`, `About This Kuromi Cake`, `Frequently Asked Questions`, etc.)
- ✗ **`- 1002` in the H1.** Same ID-leak as the title. Almost certainly an artifact of `seo_title` having a row identifier baked in.

### Product Images — 32 images on the page, 100% alt coverage
- ✓ 0 images missing alt
- ✓ 0 generic alt (`Custom cake design`) — the rich `generateRichAltText` upgrade has clearly shipped
- ✓ Hero alt is descriptive: `A purple 1-tier cake themed around Kuromi, featuring a Kuromi character, a pink banner, pu[runcated]`
- ✓ WebP format
- ✗ **Hero `<img>` has no `width`/`height` HTML attributes.** Width/height live in JSON-LD ImageObject (1536×1463), but the visible `<img>` ships `w=None h=None`. This costs you CLS budget and is the most common cause of "Image dimensions" failures in Search Console.

### Internal Linking
- ✓ Breadcrumb: Home → Cake Designs → product
- ✓ 6 related Kuromi designs cross-linked with descriptive anchors (`Kuromi 9th`, `Kuromi Sanrio`, `Kuromi Birthday`, etc.)
- ✓ Tag-based discovery links (`/search?q=kuromi`, `?q=fondant`, `?q=birthday`)
- ✓ Anchor to `/reviews` showing `4.9★ based on 9 Happy Customers`

### Content Quality — 1,237 words
- ✓ Specs table (`Available Sizes & Prices` H2)
- ✓ 3-question FAQ section
- ✓ "About This Kuromi Cake" prose section
- ✗ **No on-page UGC reviews.** The site shows `4.9★ based on 9 Happy Customers` as a footer-ish element, but no per-design review block.

---

## Schema Validation (`schema_ecommerce_validate.py`)

**Validator verdict**: `ok: true` — 0 critical, 0 high, 3 medium, 1 info.

### Detected JSON-LD graphs (6)
| @type | Notes |
|---|---|
| Organization | Site-level |
| WebSite | Site-level |
| **Product** | Validated below |
| ItemPage | Includes `primaryImageOfPage` ✓ |
| BreadcrumbList | 3-item path ✓ |
| DefinedTermSet | Custom commerce facts (`lead_time`, `return_policy`, `delivery_rates`) — bonus |

### Product fields present
- ✓ `name`, `description`, `image`, `brand`, `category`
- ✓ `offers.price=1299`, `priceCurrency=PHP`, `availability=PreOrder`
- ✓ `sku=e7c3fbff6440c0e6`, `mpn=e7c3fbff6440c0e6` (same value — see below)
- ✓ `offers.priceValidUntil`, `priceSpecification`
- ✓ `offers.shippingDetails` (OfferShippingDetails)
- ✓ `offers.hasMerchantReturnPolicy` (with `merchantReturnDays`, `returnFees`, `returnPolicyCategory`, `returnPolicyCountry`, `url`)
- ✓ `additionalProperty`, `subjectOf`

### Findings (all medium/info — none block rich results)
1. **[Medium] return-policy-applicableCountry** — `MerchantReturnPolicy` is missing `applicableCountry`. You have `returnPolicyCountry` set, but Google's current spec wants both for some panels. Easy add: `applicableCountry: 'PH'`.
2. **[Medium] shipping-deliveryTime** — `OfferShippingDetails` is missing `deliveryTime`. You ship via `OfferShippingDetails` with `doesNotShip` + `shippingDestination`, but no `deliveryTime` (handlingTime + transitTime). For made-to-order cakes this matters because Google Shopping sorts by ETA.
3. **[Medium] missing-member-program** — No `MemberProgram` declared. Skip unless you launch a loyalty tier.
4. **[Info] no-product-group** — Consider `ProductGroup` for size variants. Worth doing — your `prices` array is exactly what `ProductGroup` is designed for.

### Findings the validator did *not* flag but I noticed
- ✗ **`sku` and `mpn` are identical** (both `e7c3fbff6440c0e6` = the design's `p_hash`). Google accepts this, but it dilutes the signal. Use `mpn` for the design-side identifier and keep `sku` for the merchant listing if/when one exists for this design.
- ✗ **No `aggregateRating` or `review`** — biggest miss. The page literally tells the user "4.9★ based on 9 Happy Customers" via a link to `/reviews`. If those 9 reviews map to this design (or even to Genie.ph as a whole), exposing them as `aggregateRating` unlocks star-rating rich results in the SERP. From your audit doc this page sits at position 8.6 with 0.45% CTR — stars at that position typically pull CTR to 1.5–3%.

---

## UCP — Universal Commerce Protocol

```json
{
  "site": "https://genie.ph",
  "discovery_url": "https://genie.ph/.well-known/ucp",
  "profile_present": false,
  "status_code": 404,
  "summary": "no-ucp-profile (forward-looking opportunity)"
}
```

UCP adoption is early. Not a defect. Worth declaring once Google Merchant Center feed is live and you have a checkout endpoint to expose. Not on the critical path.

---

## Top Recommendations (ranked by ROI)

### 1. **[Critical] Add `aggregateRating` to Product JSON-LD**
Your DB already has the data (`getProductReviewStats` is called in `/shop/[merchantSlug]/[productSlug]/page.tsx`). The `/customizing/[slug]` route doesn't pull it. If per-design ratings are sparse, fall back to a site-level `aggregateRating` (4.9 / 9 reviews from `/reviews`) on every Product schema.
**Effort**: 30 minutes. **Impact**: rich snippet stars, projected CTR +200–400% on positions 5–10.

### 2. **[Critical] Fix the "1002" leak in title and H1**
Both `title` and `h1` show `Kuromi Cake - 1002 Cake Design`. The `1002` is an internal ID. Audit `seo_title` row data and strip trailing `- \d+` patterns in the title builder.
**Effort**: ~1 hour (DB cleanup or single sanitization regex in `generateMetadata`). **Impact**: cleaner SERP snippet, eliminates the broken-looking number.

### 3. **[Critical] Fix the truncated meta description**
`optimizeMetaDescription` is producing `...delightful... | Price starts at ₱1,299. Customize now!` — two ellipses in one snippet. Two paths:
- a) Make `truncateToWordBoundary` strip a trailing `…` before appending the price suffix.
- b) Lower the truncate budget so the unique sentence ends at a real period, not mid-clause.
**Effort**: 15 minutes. **Impact**: higher SERP read-through, +CTR.

### 4. **[High] Add `width` and `height` to the visible hero `<img>`**
JSON-LD has 1536×1463 — pass those through to the `<img>` element via `LazyImage` props. Eliminates CLS and unblocks "Image must have dimensions" warnings in some image-search panels.
**Effort**: 15 minutes. **Impact**: image-search eligibility, CLS improvement.

### 5. **[High] Add `deliveryTime` to `OfferShippingDetails`**
Made-to-order cakes have a real handling+transit window. Set `handlingTime: 1–3 days`, `transitTime: 0–1 day`. Critical for Google Shopping eligibility once the GMC feed goes live.
**Effort**: 20 minutes (one-time edit in `buildOfferShippingDetails`). **Impact**: Shopping eligibility, panel trust.

### 6. **[Medium] Add `applicableCountry: 'PH'` to MerchantReturnPolicy**
Single-field add in `buildMerchantReturnPolicy`.
**Effort**: 5 minutes. **Impact**: closes a validator finding.

### 7. **[Medium] Trim title length to ≤60 chars**
Currently 64. The biggest character sink is `Cake Design with Price`. Drop `with Price` (price is in the description CTA already) and you land at ~52 chars.
**Effort**: 10 minutes (string template change in `generateMetadata`). **Impact**: prevents mobile SERP truncation.

### 8. **[Low] Use `ProductGroup` to expose size variants**
The `prices[]` array (4-in, 5-in, 6-in, etc.) is exactly the shape `ProductGroup` wants. Wrap the Product in a ProductGroup with `variesBy: ['size']`. Helps Google show size-specific price variants.
**Effort**: 1–2 hours. **Impact**: better Shopping panel rendering.

### 9. **[Forward-looking] UCP profile**
Skip until GMC feed is live and you have a stable `dev.ucp.shopping.checkout` endpoint URL.

---

## What I deliberately did *not* flag

- "8k+ similar pages" / canonical duplication risk — your `downgradeCakeSlug` + `upgradeLegacySlug` pipeline already 301s legacy slugs; not a defect of *this* page.
- Hreflang missing — site is PH-only, English; not needed.
- `loading=lazy` on the hero — actually correct; you also have `loading="eager"` + `fetchPriority="high"` on the SSR hero `<img>` in `SSRCakeDetails`. Both are present in different DOM positions; LCP signal is strong.

---

## Artifacts

| File | Purpose |
|---|---|
| `artifacts/seo-ecommerce/run1-kuromi.html` | Raw fetched HTML (one-time snapshot) |
| `artifacts/seo-ecommerce/run1-kuromi-parsed.json` | Structured SEO snapshot (parse_html.py) |
| `artifacts/seo-ecommerce/run1-kuromi-product-jsonld.json` | Extracted Product graph (input to validator) |
| `artifacts/seo-ecommerce/_summarize.py` | Re-runnable summary script |

Want me to:
- (a) Run **Run 2** on a generic-alt slug to see if these issues are systemic? (still free)
- (b) Open a spec / tasks list to actually implement recommendations 1–6? (your `<implicit-rules>` would prefer this)
- (c) Spend on **Run 3** (DataForSEO Merchant API for "kuromi cake design") for competitor pricing? (paid; cost-checked first)
