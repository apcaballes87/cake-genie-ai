# Requirements Document

## Introduction

The `/customizing/[slug]` route renders ~8,000+ Product Detail Pages (PDPs) for AI-generated custom cake designs on Genie.ph. Two e-commerce SEO audits (`artifacts/seo-ecommerce/run1-kuromi-report.md`, `artifacts/seo-ecommerce/run2-comparison-report.md`) identified six template-level deficiencies in the rendered metadata and JSON-LD plus one data-only contamination of cached SEO titles. This feature delivers all seven fixes so that every page on the route emits Google-compliant Product schema (with rich-result-eligible aggregateRating, complete shippingDetails.deliveryTime, and complete merchantReturnPolicy.applicableCountry), publishes a clean meta title and meta description suitable for SERP rendering, and stops surfacing leaked internal IDs in stored `seo_title` rows.

The fixes land in three places:

- `src/app/customizing/[slug]/page.tsx` — the `generateMetadata` function, the `optimizeMetaDescription` and `truncateToWordBoundary` helpers, and the `DesignSchema` component (Product / ItemPage / BreadcrumbList / DefinedTermSet emitter).
- `src/lib/commerce/machineReadable.ts` — the shared schema builders `buildOfferShippingDetails`, `buildMerchantReturnPolicy`, `getMerchantListingActivePrice`, `mapDesignAvailabilityToSchema` and friends.
- A one-time SQL/Supabase migration against `cakegenie_analysis_cache.seo_title`.

Each requirement is independently verifiable by re-running the audit pipeline (`fetch_page.py` → `parse_html.py` → `schema_ecommerce_validate.py`).

## Glossary

- **PDP**: Product Detail Page — a single rendered URL on the `/customizing/[slug]` route.
- **DesignSchema**: The React component in `src/app/customizing/[slug]/page.tsx` that emits four `<script type="application/ld+json">` blocks (Product, ItemPage, BreadcrumbList, DefinedTermSet) for a single PDP.
- **Schema_Builder**: The collective set of pure functions in `src/lib/commerce/machineReadable.ts` (`buildOfferShippingDetails`, `buildMerchantReturnPolicy`, `getMerchantListingActivePrice`, `mapDesignAvailabilityToSchema`, etc.).
- **Metadata_Builder**: The `generateMetadata` async function and its helpers (`optimizeMetaDescription`, `truncateToWordBoundary`) in `src/app/customizing/[slug]/page.tsx`.
- **Site_Review_Summary**: The `{ total, averageRating }` object already loaded server-side in the PDP route from `cakegenie_reviews` (with a `{ total: 6, averageRating: 4.8 }` constant fallback when the query fails).
- **Per_Design_Review_Stats**: A future per-design `{ total, averageRating }` object analogous to `productReviewStats` in the `/shop/[merchantSlug]/[productSlug]` route. Not present today on `/customizing/[slug]`; this spec only specifies the fallback contract for when it later becomes available.
- **AggregateRating_Block**: A Schema.org `AggregateRating` JSON object embedded inside the `Product` graph emitted by `DesignSchema`, containing at minimum `@type: 'AggregateRating'`, `ratingValue`, and `reviewCount`.
- **OfferShippingDetails**: The Schema.org `OfferShippingDetails` JSON object returned by `buildOfferShippingDetails`, embedded under `Product.offers.shippingDetails`.
- **ShippingDeliveryTime**: A Schema.org `ShippingDeliveryTime` JSON object embedded inside `OfferShippingDetails.deliveryTime`, comprising a `handlingTime` and a `transitTime`.
- **HandlingTime**: A Schema.org `QuantitativeValue` representing the time between order placement and dispatch, expressed in days (`unitCode: 'DAY'`).
- **TransitTime**: A Schema.org `QuantitativeValue` representing the time between dispatch and delivery, expressed in days (`unitCode: 'DAY'`).
- **MerchantReturnPolicy**: The Schema.org `MerchantReturnPolicy` JSON object returned by `buildMerchantReturnPolicy`, embedded under `Product.offers.hasMerchantReturnPolicy`.
- **PH_Country_Code**: A single, exported TypeScript constant in `src/lib/commerce/machineReadable.ts` whose value is the literal string `'PH'` (uppercase, exactly two ASCII characters, no surrounding whitespace), used by both `MerchantReturnPolicy.returnPolicyCountry` and `MerchantReturnPolicy.applicableCountry`.
- **Lead_Time_Constants**: A single, exported TypeScript object in `src/lib/commerce/machineReadable.ts` (e.g., `CUSTOM_CAKE_LEAD_TIME`) defining `handlingTimeMinDays`, `handlingTimeMaxDays`, `transitTimeMinDays`, `transitTimeMaxDays` as non-negative integers between 0 and 30 inclusive.
- **MPN**: Manufacturer Part Number — the design fingerprint, today populated as `design.p_hash || design.slug`.
- **SKU**: Stock Keeping Unit — a unique per-listing identifier; this spec separates it from MPN.
- **Merchant_Listing**: A row in `cakegenie_merchant_products` linked to a design by `p_hash`. Returned by `getLinkedMerchantProductsByHash`.
- **MetaDescription**: The `description` string returned by `generateMetadata` and rendered as `<meta name="description">`. Length is measured in Unicode code points.
- **Title_Suffix**: The literal string ` | Genie.ph` (length 11 code points including the leading space and pipe) appended by the root layout `metadata.title` template.
- **Title_Budget**: An integer constant equal to `60 - len(Title_Suffix) = 49`. The maximum length, in Unicode code points, of the in-route title string before the root layout template appends Title_Suffix.
- **Price_Segment**: The literal substring ` | Php X,XXX` (with `,` thousand separators per the `en-US` locale) appended to the title when `design.price` is a positive finite number not exceeding 9,999,999.
- **SEO_Title_Cache**: The `seo_title` column (`TEXT`) of the `cakegenie_analysis_cache` table in the Supabase Postgres database.
- **ID_Leak_Substring**: The contiguous substring matching the regular expression `\s-\s\d{2,}\s*$` — a space-hyphen-space prefix, followed by two or more digits, optional trailing whitespace, anchored to end-of-string. Only the trailing occurrence (if any) per row is matched; mid-string occurrences of the pattern are NEVER touched. Only the matched substring is removed.
- **Backup_Store**: Either a new column `seo_title_backup_pre_id_leak_fix TEXT` added to `cakegenie_analysis_cache` for the migration, or a dedicated table `cakegenie_analysis_cache_seo_title_backup(row_id TEXT, seo_title_before TEXT, backed_up_at TIMESTAMPTZ)`. Retained for at least 30 days post-apply.
- **Audit_Pipeline**: The three-script sequence `fetch_page.py` → `parse_html.py` → `schema_ecommerce_validate.py` under `.agent/skills/scripts/`, invoked with the `--json` flag on the validator. The validator returns `{ok: bool, findings: [{severity, rule, message}], summary: {critical, high, medium, info}}`.
- **Schema_Validator**: The `schema_ecommerce_validate.py` script. Reports `ok: true|false` plus a `findings` array keyed by check ID such as `return-policy-applicableCountry` and `shipping-deliveryTime`.
- **Reference_PDP_Set**: The fixed set of three slugs used to discharge the validation contract — `kuromi-light-purple-1-tier-cake-e3c3`, `custom-cake-white-1-tier-cake-383c`, and `pink-minimalist-light-pink-bento-cake-f707` — chosen to span (a) a slug with high search impressions, (b) a slug with previously generic alt text, and (c) a slug from a different size class (Bento).
- **Pre_Feature_Baseline**: The set of Schema_Validator finding IDs returned for each Reference_PDP_Set URL on the most recent commit prior to merging this feature.
- **ISR_Window**: The duration `revalidate = 3600` seconds defined on the `/customizing/[slug]` route. After a data change, the next request after this window triggers a fresh server render that is cached for the next ISR_Window.

## Requirements

### Requirement 1: Aggregate Rating Exposure in Product JSON-LD

**User Story:** As a Genie.ph shopper scanning Google search results, I want to see star ratings on cake design listings, so that I can identify trustworthy options at a glance and click through with confidence.

#### Acceptance Criteria

1. WHEN `DesignSchema` renders a PDP AND Per_Design_Review_Stats are available with `total` as an integer ≥ 1 AND `averageRating` as a finite number in the inclusive range [1.00, 5.00], THE DesignSchema SHALL embed an AggregateRating_Block under `Product.aggregateRating` whose `ratingValue` equals the per-design `averageRating` and whose `reviewCount` equals the per-design `total`.
2. WHEN `DesignSchema` renders a PDP AND Per_Design_Review_Stats are NOT available (the value is null, undefined, or has `total < 1` or `averageRating < 1`) AND Site_Review_Summary has `total` as an integer ≥ 1 AND `averageRating` as a finite number in the inclusive range [1.00, 5.00] AND the Site_Review_Summary values were NOT produced by the constant fallback `{ total: 6, averageRating: 4.8 }`, THE DesignSchema SHALL embed an AggregateRating_Block under `Product.aggregateRating` whose `ratingValue` equals the Site_Review_Summary `averageRating` and whose `reviewCount` equals the Site_Review_Summary `total`.
3. WHERE both Per_Design_Review_Stats and Site_Review_Summary qualify under criteria 1 and 2, THE DesignSchema SHALL populate the AggregateRating_Block exclusively from Per_Design_Review_Stats and SHALL NOT merge any field from Site_Review_Summary into the same AggregateRating_Block.
4. IF neither Per_Design_Review_Stats nor Site_Review_Summary qualifies under criteria 1 and 2, THEN THE DesignSchema SHALL emit a Product graph whose serialized JSON contains no `aggregateRating` key at any depth.
5. THE DesignSchema SHALL set `AggregateRating_Block.bestRating` to the JSON number `5` and `AggregateRating_Block.worstRating` to the JSON number `1` (numeric types, not strings).
6. THE DesignSchema SHALL set `AggregateRating_Block.@type` to the exact, case-sensitive string `'AggregateRating'`.
7. THE DesignSchema SHALL serialize `AggregateRating_Block.ratingValue` as a JSON number with at most two digits after the decimal point and SHALL NOT serialize it as a string.
8. THE DesignSchema SHALL serialize `AggregateRating_Block.reviewCount` as a JSON integer ≥ 1 and SHALL NOT serialize it as a string. WHEN the resolved review count is 0, THE DesignSchema SHALL omit the AggregateRating_Block entirely (per criterion 4).
9. IF the Site_Review_Summary value supplied to `DesignSchema` was produced by the existing constant fallback `{ total: 6, averageRating: 4.8 }` (because the upstream `cakegenie_reviews` query failed or returned zero rows), THEN THE DesignSchema SHALL treat Site_Review_Summary as not qualifying under criterion 2 and SHALL NOT use those constant values to populate the AggregateRating_Block.

### Requirement 2: Offer Shipping Delivery Time

**User Story:** As a Google Shopping crawler indexing Genie.ph product pages, I want every Offer to declare a complete delivery window, so that I can sort, filter, and surface the listings against competitors that publish ETAs.

#### Acceptance Criteria

1. THE Schema_Builder SHALL expose a single, exported Lead_Time_Constants object from `src/lib/commerce/machineReadable.ts` whose four numeric properties (`handlingTimeMinDays`, `handlingTimeMaxDays`, `transitTimeMinDays`, `transitTimeMaxDays`) are non-negative integers in the inclusive range [0, 30].
2. THE Schema_Builder SHALL initialize Lead_Time_Constants with `handlingTimeMinDays = 1`, `handlingTimeMaxDays = 3`, `transitTimeMinDays = 0`, and `transitTimeMaxDays = 1`.
3. THE Schema_Builder SHALL ensure `handlingTimeMinDays ≤ handlingTimeMaxDays` AND `transitTimeMinDays ≤ transitTimeMaxDays` for the values defined in Lead_Time_Constants.
4. WHEN `buildOfferShippingDetails` is invoked, THE Schema_Builder SHALL return an object that includes a `deliveryTime` property AND THE entire invocation SHALL complete within 50 milliseconds on a single CPU core under typical Node.js runtime conditions.
5. THE Schema_Builder SHALL set `OfferShippingDetails.deliveryTime.@type` to the exact, case-sensitive string `'ShippingDeliveryTime'`.
6. THE Schema_Builder SHALL set `OfferShippingDetails.deliveryTime.handlingTime` to an object with `@type` equal to the exact string `'QuantitativeValue'`, `unitCode` equal to the exact string `'DAY'`, `minValue` equal to the JSON number `Lead_Time_Constants.handlingTimeMinDays`, and `maxValue` equal to the JSON number `Lead_Time_Constants.handlingTimeMaxDays`.
7. THE Schema_Builder SHALL set `OfferShippingDetails.deliveryTime.transitTime` to an object with `@type` equal to the exact string `'QuantitativeValue'`, `unitCode` equal to the exact string `'DAY'`, `minValue` equal to the JSON number `Lead_Time_Constants.transitTimeMinDays`, and `maxValue` equal to the JSON number `Lead_Time_Constants.transitTimeMaxDays`.
8. THE Schema_Builder SHALL return an OfferShippingDetails object whose pre-existing fields (`shippingDestination`, `doesNotShip`) carry identical values and JSON types as in the pre-change implementation for the same input.
9. IF Lead_Time_Constants is configured with a value that violates criteria 1 or 3 at module initialization, THEN THE Schema_Builder SHALL throw a runtime error during module load such that subsequent imports of `buildOfferShippingDetails` fail, and THE error message SHALL identify the offending property name.
10. WHEN the Audit_Pipeline runs Schema_Validator against any PDP from Reference_PDP_Set rendered after this requirement is implemented, THE Schema_Validator findings array SHALL contain zero entries whose `rule` field equals the exact string `shipping-deliveryTime`.

### Requirement 3: Merchant Return Policy Applicable Country

**User Story:** As a Schema.org-compliant Product validator (Google Rich Results Test, schema.org playground), I want every MerchantReturnPolicy to declare its applicable country, so that I can fully validate the policy without warnings.

#### Acceptance Criteria

1. THE Schema_Builder SHALL export from `src/lib/commerce/machineReadable.ts` a single, immutable constant named `PH_Country_Code` whose value is the literal string `'PH'` (uppercase, exactly two ASCII characters, no surrounding whitespace).
2. WHEN `buildMerchantReturnPolicy` is invoked with any valid input, THE Schema_Builder SHALL return an object whose `applicableCountry` property is exactly equal to `PH_Country_Code`, of JSON type string (not array, not null, not undefined).
3. WHEN `buildMerchantReturnPolicy` is invoked with any valid input, THE Schema_Builder SHALL return an object whose `returnPolicyCountry` property is exactly equal to `PH_Country_Code` AND is referentially identical (`===` in TypeScript) to the value assigned to `applicableCountry`.
4. WHEN `buildMerchantReturnPolicy` is invoked, THE Schema_Builder SHALL return an object that retains every field present in the pre-change implementation (`returnPolicyCategory`, `merchantReturnDays`, `returnFees`, `url`) with values identical to the pre-change behavior for the same input.
5. IF any field in the set (`returnPolicyCategory`, `merchantReturnDays`, `returnFees`, `url`) was previously omitted for a given input, THEN THE Schema_Builder SHALL continue to omit that field for the same input, AND no field other than `applicableCountry` SHALL be newly added or newly removed.
6. WHEN the Audit_Pipeline runs Schema_Validator against any PDP from Reference_PDP_Set whose emitted MerchantReturnPolicy includes both `applicableCountry` and `returnPolicyCountry` set to `'PH'`, THE Schema_Validator findings array SHALL contain zero entries whose `rule` field equals the exact string `return-policy-applicableCountry`.
7. IF the Audit_Pipeline runs Schema_Validator against a PDP whose emitted MerchantReturnPolicy is missing `applicableCountry` OR has `applicableCountry` set to a value other than `'PH'`, THEN THE Schema_Validator SHALL emit exactly one finding with `rule` equal to the exact string `return-policy-applicableCountry`.

### Requirement 4: Differentiate SKU from MPN in Product Offer

**User Story:** As a Google Merchant Center importer reading Genie.ph Product structured data, I want SKU and MPN to carry distinct semantic values, so that I can deduplicate and identify listings correctly when the design is offered by multiple merchants.

#### Acceptance Criteria

1. WHEN `design.p_hash` is a non-empty string, THE DesignSchema SHALL set `Product.mpn` and `Product.offers.mpn` to the value of `design.p_hash`.
2. IF `design.p_hash` is null, undefined, or an empty string, THEN THE DesignSchema SHALL set `Product.mpn` and `Product.offers.mpn` to `design.slug`.
3. WHEN `getLinkedMerchantProductsByHash` returns a non-empty array of Merchant_Listing rows, THE DesignSchema SHALL deterministically select the Merchant_Listing whose `product_id` is lexicographically smallest (sorted as a UTF-16 code-unit string ascending) AND SHALL set `Product.sku` and `Product.offers.sku` to the `product_id` of that selected Merchant_Listing.
4. WHEN `getLinkedMerchantProductsByHash` returns an empty array, THE DesignSchema SHALL set `Product.sku` and `Product.offers.sku` to `design.slug`.
5. WHEN both `Product.sku` and `Product.mpn` resolve under the rules above to non-empty strings AND the two values would otherwise be equal, THE DesignSchema SHALL replace the resolved `Product.sku` (and `Product.offers.sku`) with the concatenation `design.slug + ':design'` so that SKU and MPN are no longer equal.
6. THE DesignSchema SHALL emit identical SKU and MPN values across re-renders of the same PDP whenever `design.slug`, `design.p_hash`, and the set of returned Merchant_Listing `product_id` values are identical, regardless of the underlying database query result ordering.
7. THE DesignSchema SHALL ensure `Product.mpn === Product.offers.mpn` AND `Product.sku === Product.offers.sku` for every emitted PDP.

### Requirement 5: Meta Description Without Mid-Sentence Ellipsis

**User Story:** As a Google search user reading a Genie.ph SERP snippet, I want the meta description to read as a complete thought, so that I trust the listing instead of dismissing it as broken.

#### Acceptance Criteria

1. WHEN `optimizeMetaDescription` produces the truncated unique description text via `truncateToWordBoundary`, THE Metadata_Builder SHALL repeatedly remove every trailing occurrence of the character `.` (U+002E), the character `…` (U+2026), and any whitespace characters (spaces, tabs, newlines) adjacent to or between those characters from the end of the truncated text, continuing until the last code point of the text is neither `.` nor `…` nor whitespace, before appending the price-and-CTA suffix.
2. THE Metadata_Builder SHALL ensure the final MetaDescription returned by `optimizeMetaDescription` does NOT contain the substring `... |` AND does NOT contain the substring `… |` AND does NOT contain the substring `.. |`.
3. THE Metadata_Builder SHALL ensure the final MetaDescription returned by `optimizeMetaDescription` ends with the literal `Customize now!` and immediately precedes that literal with a non-whitespace, non-`.`, non-`…` code point followed by ` | Price starts at ₱`.
4. THE Metadata_Builder SHALL ensure the total length of the MetaDescription returned by `optimizeMetaDescription`, measured in Unicode code points (where `₱` U+20B1 counts as 1), is greater than or equal to the length of the suffix ` | Price starts at ₱X,XXX. Customize now!` and less than or equal to 155.
5. WHEN the unique description text fits within the available character budget (defined as 155 minus the code-point length of the suffix ` | Price starts at ₱X,XXX. Customize now!`) AND already ends in one or more `.` or `…` characters, THE Metadata_Builder SHALL apply the same iterative trailing-punctuation strip from criterion 1, then re-append exactly one `.` (U+002E) only if the original unique text terminated with a `.` (and not with `…`), and SHALL NOT introduce any `…` character or any sequence of two or more `.` characters into the final MetaDescription.
6. IF the unique description text becomes empty or contains only whitespace after the iterative strip in criterion 1, THEN THE Metadata_Builder SHALL omit the unique-description segment and the leading ` | ` separator from the final MetaDescription, returning a MetaDescription that begins with `Price starts at ₱` and ends with `Customize now!`.
7. WHEN the Audit_Pipeline parses a PDP rendered after this change, THE parsed `meta_description` SHALL NOT match the regular expression `(\.{2,}|…)\s*\|\s*Price starts at`.

### Requirement 6: Title Length Within Budget

**User Story:** As a mobile Google search user, I want the page title to render in full without `…` truncation, so that I can read the cake design name and price before tapping.

#### Acceptance Criteria

1. THE Metadata_Builder SHALL define Title_Budget as the integer `49` (equal to `60` minus the code-point length `11` of Title_Suffix `' | Genie.ph'`).
2. WHEN `generateMetadata` constructs the in-route title from `design.seo_title`, THE Metadata_Builder SHALL NOT include the substring ` with Price` (case-insensitive match) anywhere in the generated title.
3. WHEN `generateMetadata` constructs the in-route title from `design.keywords` because `design.seo_title` is the empty string OR contains only whitespace, THE Metadata_Builder SHALL NOT include the substring ` with Price` (case-insensitive) anywhere in the generated title.
4. WHEN `design.price` is a finite number strictly greater than 0 and less than or equal to 9,999,999, THE Metadata_Builder SHALL append the Price_Segment in the exact format ` | Php X,XXX` where `X,XXX` is the rounded integer price formatted with `,` thousand separators per the `en-US` locale.
5. IF `design.price` is null, undefined, NaN, non-finite, less than or equal to 0, or greater than 9,999,999, THEN THE Metadata_Builder SHALL omit the Price_Segment entirely from the title.
6. THE Metadata_Builder SHALL ensure the final in-route title contains the substring `Cake Design` (case-insensitive match) so that image-search matching for queries like `{theme} cake design` is preserved.
7. IF the constructed in-route title length (in code points) exceeds Title_Budget AND the title contains a leading product-name segment before the first occurrence of ` Cake Design` (case-insensitive), THEN THE Metadata_Builder SHALL truncate that leading product-name segment at the nearest preceding space character so that the total in-route title length is less than or equal to Title_Budget.
8. IF after applying criterion 7 the in-route title still exceeds Title_Budget, THEN THE Metadata_Builder SHALL emit the title at the shortest length achievable by repeated word-boundary truncation, even if the total exceeds Title_Budget by up to 4 code points (i.e., final length ≤ 53), AND SHALL log exactly one `console.warn` invocation per such PDP whose argument string includes the offending `design.slug` value.
9. WHEN the Audit_Pipeline parses a PDP whose `design.seo_title` length is less than or equal to (Title_Budget − Price_Segment length − ` Cake Design` length [12 code points]), THE parsed page `title` length SHALL be less than or equal to 60 code points.

### Requirement 7: One-Time Removal of ID Leak from Cached SEO Titles

**User Story:** As a Genie.ph SEO operator, I want all stored `seo_title` values to be free of leaked internal numeric IDs, so that no PDP renders an `H1` or `<title>` containing patterns like ` - 1002`.

#### Acceptance Criteria

1. THE one-time migration SHALL provide a preview mode that, when invoked, returns (a) the integer count of rows in `cakegenie_analysis_cache` whose `seo_title` contains the ID_Leak_Substring AND (b) for each such row, the `slug` (or row identifier), the current `seo_title`, and the proposed post-strip `seo_title` — WITHOUT writing to any row.
2. THE one-time migration SHALL provide an apply mode that updates every row in `cakegenie_analysis_cache` whose `seo_title` matches the ID_Leak_Substring pattern (i.e. has a trailing ` - NNNN` where NNNN is 2+ digits) by removing only the matched substring (and any trailing whitespace) from the `seo_title` value, preserving every other character. Worked examples THE migration SHALL satisfy:
   - `Kuromi Cake - 1002` → `Kuromi Cake` (trailing match at end-of-string stripped)
   - `Kuromi Cake - 1002 Cake Design` → unchanged (digit run is NOT at end-of-string; mid-string occurrences are never matched)
   - `Strawberry Cake - 47` → `Strawberry Cake` (47 has 2+ digits and is at end-of-string)
   - `Strawberry Cake - 5` → unchanged (single digit, below the 2-digit threshold)
   - `Sample - 12 something - 99` → `Sample - 12 something` (only the trailing ` - 99` is at end-of-string; mid-string ` - 12` is preserved)
3. WHEN the one-time migration is invoked in apply mode a second time on the same dataset, THE migration SHALL update zero additional rows, AND a follow-up preview mode invocation SHALL return a count of zero.
4. THE one-time migration SHALL execute its apply mode inside a single SQL transaction that includes both the row UPDATEs and the Backup_Store writes, such that any failure rolls back all changes atomically.
5. THE one-time migration SHALL write the original `seo_title` value of every row it modifies to Backup_Store before that row's UPDATE statement executes, recording at minimum the row identifier, the prior `seo_title` value, and a `backed_up_at` timestamp. Backup_Store entries SHALL be retained for at least 30 days after apply.
6. WHEN the one-time migration completes in apply mode AND ISR_Window has elapsed AND at least one HTTP GET has reached the Next.js server for each affected slug after that elapse, THE rendered HTML of every affected PDP SHALL contain neither a `<title>` nor an `<h1>` whose text matches the regular expression ` - \d{2,}( |$|<)`.
7. THE one-time migration SHALL NOT alter any row in `cakegenie_analysis_cache` whose `seo_title` does NOT contain the ID_Leak_Substring, AND SHALL NOT alter any column other than `seo_title` (and the Backup_Store column if used).
8. THE one-time migration SHALL require an explicit confirmation flag (such as `--confirm` or `apply: true`) to enter apply mode; in the absence of that flag, THE migration SHALL execute preview mode by default. THE migration SHALL NOT enter apply mode based on environment variables alone.
9. THE one-time migration SHALL provide a restore operation that, given a Backup_Store entry, writes the `seo_title_before` value back to the corresponding row in `cakegenie_analysis_cache`, AND the restore operation SHALL be invocable per-row OR for all rows backed up in a single migration apply.

### Requirement 8: Validation Contract via Audit Pipeline

**User Story:** As a Genie.ph engineer reviewing this feature before merge, I want a single repeatable command sequence that proves every other requirement, so that I can sign off without ambiguity.

#### Acceptance Criteria

1. WHEN the Audit_Pipeline (`fetch_page.py` → `parse_html.py` → `schema_ecommerce_validate.py --json`) is executed against every URL in Reference_PDP_Set after this feature is shipped, THE Schema_Validator SHALL report `ok: true` for every URL.
2. WHEN the Audit_Pipeline is executed against every URL in Reference_PDP_Set, THE Schema_Validator findings array for every URL SHALL contain zero entries whose `rule` field equals `return-policy-applicableCountry` AND zero entries whose `rule` field equals `shipping-deliveryTime`.
3. WHEN the Audit_Pipeline is executed against any URL in Reference_PDP_Set whose Site_Review_Summary `total` is an integer ≥ 1 AND was NOT produced by the constant fallback, THE parsed snapshot Product graph SHALL contain an `aggregateRating` block whose `ratingValue` is a JSON number in the inclusive range [1.00, 5.00] AND whose `reviewCount` is a JSON integer ≥ 1 AND whose `reviewCount` equals the source `total`.
4. WHEN the Audit_Pipeline is executed against `https://genie.ph/customizing/kuromi-light-purple-1-tier-cake-e3c3` AFTER Requirement 7 apply mode has run AND ISR_Window has elapsed AND at least one HTTP request has reached the server post-elapse, THE parsed snapshot `title` field SHALL NOT contain the substring ` - 1002` AND THE first element of the parsed snapshot `h1` array SHALL NOT contain the substring ` - 1002`.
5. WHEN the Audit_Pipeline is executed against every URL in Reference_PDP_Set, THE parsed snapshot `meta_description` for every URL SHALL NOT match the regular expression `(\.{2,}|…)\s*\|\s*Price starts at`.
6. THE Reference_PDP_Set SHALL contain at minimum the three URLs `https://genie.ph/customizing/kuromi-light-purple-1-tier-cake-e3c3`, `https://genie.ph/customizing/custom-cake-white-1-tier-cake-383c`, and `https://genie.ph/customizing/pink-minimalist-light-pink-bento-cake-f707`.
7. IF Schema_Validator returns a non-zero process exit code OR `ok: false` for any URL in Reference_PDP_Set, THEN THE feature SHALL be considered NOT acceptable for merge regardless of the contents of the findings array.

### Requirement 9: Backwards Compatibility and Quality Constraints

**User Story:** As a Genie.ph release engineer, I want the new code to fit cleanly into the existing build, ISR, and test infrastructure, so that shipping the SEO fixes does not introduce regressions or destabilize CI.

#### Acceptance Criteria

1. THE DesignSchema SHALL apply the existing JSON-LD sanitizer that replaces every occurrence of the substring `</script` with `<\/script` on the serialized text of every JSON-LD block emitted by the component.
2. WHEN every `<script type="application/ld+json">` block emitted by DesignSchema for any PDP rendered after this feature is shipped is read and passed to `JSON.parse`, THE call SHALL return without throwing.
3. THE PDP route SHALL retain `export const revalidate = 3600` (seconds) so that the existing ISR_Window is unchanged.
4. WHEN `next build` is invoked on the merged feature branch, THE TypeScript compiler under `strict: true` SHALL emit a number of errors in changed files (`src/app/customizing/[slug]/page.tsx`, `src/lib/commerce/machineReadable.ts`, and any new files) equal to zero, AND THE total project-wide error count SHALL NOT exceed the Pre_Feature_Baseline error count.
5. WHEN `vitest --run` is invoked on the merged feature branch, THE existing test file `src/lib/commerce/machineReadable.test.ts` SHALL pass without any of its existing assertions being modified, removed, or marked `skip`/`only`.
6. WHEN `vitest --run` is invoked on the merged feature branch, THE Schema_Builder SHALL be covered by at least one new passing test case for each of the following behaviors: (a) `OfferShippingDetails.deliveryTime` shape per Requirement 2, (b) `MerchantReturnPolicy.applicableCountry` per Requirement 3, and (c) SKU/MPN distinct-value resolution per Requirement 4.
7. IF the Schema_Validator findings array for any URL in Reference_PDP_Set after this feature is shipped contains a `rule` value that does NOT appear in the Pre_Feature_Baseline findings for the same URL, THEN the feature SHALL be considered NOT acceptable for merge.
8. WHEN `next build` and `npx eslint .` are invoked on the merged feature branch, THE process exit code SHALL be zero for both commands AND THE ESLint warning count SHALL NOT exceed the Pre_Feature_Baseline ESLint warning count for the same files.
