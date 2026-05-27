# E-commerce SEO — Run 2 vs Run 1 Comparison

| URL | Slug type |
|---|---|
| **Run 1** | `https://genie.ph/customizing/kuromi-light-purple-1-tier-cake-e3c3` (rich `seo_title`) |
| **Run 2** | `https://genie.ph/customizing/custom-cake-white-1-tier-cake-383c` (generic-alt slug from your audit doc) |

## Verdict: **6 of 7 leaks are systemic. 1 is data-only.**

That changes the spec strategy: we should **fix at the template level** (schema + metadata builders in `src/app/customizing/[slug]/page.tsx` and `src/lib/commerce/machineReadable.ts`) and run a one-time data sweep for the `seo_title` ID-leak only.

---

## Side-by-side findings

| Check | Run 1 (Kuromi) | Run 2 (CustomWhite) | Verdict |
|---|---|---|---|
| Schema validator: `ok` | ✓ true | ✓ true | OK on both |
| 6 JSON-LD graphs | ✓ | ✓ | Template-level emission ✓ |
| Single H1 | ✓ | ✓ | OK |
| Image alt coverage | 100% | 100% | Fixed sitewide ✓ |
| Generic alt count | 0 | 0 | "Custom cake design" issue from audit doc is fixed |
| Hero `<img>` w/h | ✓ | ✓ | I corrected my Run 1 finding — dimensions are present, just rendered via `LazyImage`'s `fill` mode |
| **`aggregateRating` in Product** | ✗ | ✗ | **SYSTEMIC** — never emitted |
| **`shippingDetails.deliveryTime`** | ✗ | ✗ | **SYSTEMIC** — `buildOfferShippingDetails` never sets it |
| **`returnPolicy.applicableCountry`** | ✗ | ✗ | **SYSTEMIC** — `buildMerchantReturnPolicy` never sets it |
| **`sku === mpn`** (both = p_hash) | ✓ | ✓ | **SYSTEMIC** — schema builder uses same value for both |
| **Meta description ends with `...`** | truncated | truncated | **SYSTEMIC** — `optimizeMetaDescription` truncates mid-sentence |
| **Title has `- NNN` ID-leak** | ✓ (`- 1002`) | ✗ | **DATA-ONLY** — only slugs whose `seo_title` row has a trailing `- N` |
| **H1 has `- NNN` ID-leak** | ✓ (`- 1002`) | ✗ | Same — DATA-ONLY |
| Title length | 64 (over) | 52 (good) | DATA-influenced (depends on `seo_title` length) |

### Notable confirmation
Both meta descriptions end in `...` followed by ` | Price starts at ₱X,XXX. Customize now!`. This is **deterministic** — `optimizeMetaDescription` truncates whatever `resolveRichDescription` produces, then appends the price suffix without checking if the truncated text already ends in an ellipsis.

---

## Updated action plan

### Template-level fixes (one PR, all 8k+ pages benefit)
1. **`aggregateRating` fallback in `DesignSchema`** — pull `genieBusinessProfile`-style site-level rating (4.9 / 9 reviews) when per-design stats aren't available.
2. **`buildOfferShippingDetails`** — add `deliveryTime: { handlingTime, transitTime }`.
3. **`buildMerchantReturnPolicy`** — add `applicableCountry: 'PH'`.
4. **`optimizeMetaDescription`** — strip trailing `...`/`…` before appending the price suffix; bias the truncation budget to land on a sentence boundary.
5. **`generateMetadata` title builder** — drop "with Price" or trim by 4–10 chars to keep titles under 60.
6. **Differentiate `sku` from `mpn`** — keep `mpn = p_hash`, use `slug` (or merchant_listing.product_id when linked) as `sku`.

### Data-only fix (one-time sweep)
7. **Strip `- \d+` from rows in `cakegenie_analysis_cache.seo_title`**. From the audit doc, "1002" is just one example; could be any 2–4 digit ID. SQL one-liner + a redeploy/revalidate.

### Skip / forward-looking
- `MemberProgram` (medium finding) — no loyalty program; ignore.
- `ProductGroup` for size variants (info finding) — defer; nice-to-have.
- UCP profile — defer until GMC feed is live.

---

## Artifacts

- `artifacts/seo-ecommerce/run2-customwhite.html`
- `artifacts/seo-ecommerce/run2-customwhite-parsed.json`
- `artifacts/seo-ecommerce/run2-customwhite-product-jsonld.json`
- `artifacts/seo-ecommerce/_compare.py` (re-runnable)
