# Requirements Document

> **REVISION (slug-key for SEO).** As of the customizing-pdp-seo-fixes work,
> the Variant_Path storage key changed from the Cache_Row `p_hash` to the
> design **slug** — `variants/{slug}/{width}.webp` — so the rendered hero image
> URL carries keyword signal for Google Images. When a row has no usable slug,
> the pipeline falls back to `p_hash` (preserving the original behaviour for
> those rows). All "`{p_hash}`" references in Req 2.1, Req 9, and Req 12 below
> should be read as "the design slug, or `p_hash` when the slug is absent."
> Determinism (Req 12) still holds: the key is a pure function of
> `(slug-or-p_hash, width)`. Existing rows were migrated to slug paths via
> `scripts/repath-variants-to-slug.ts`; the old `p_hash` objects are orphaned
> and removed by `scripts/cleanup-orphan-variant-objects.ts`.

## Introduction

The Genie.ph Next.js cake marketplace renders user-uploaded cake images at their full original resolution (typically 2-4 MB at 2000+px wide) on customizing PDPs, search, collections, and merchant product pages. Because `next.config.ts` sets `images: { unoptimized: true }`, these full-size files are downloaded by every device — including phones that display the image at ~400px wide. Field LCP averages 6.5s on `/customizing/[slug]` and 6.9s on `/customizing`, well above the Core Web Vitals "poor" threshold of 4000 ms.

This feature introduces an image variant pipeline that generates multiple pre-sized WebP variants for every cake design image using `sharp` at upload time, stores them as separate Supabase storage objects, records their URLs in the analysis cache row, and renders them via `<img srcset>` / `next/image` `sizes`. A one-time backfill script generates variants for the existing ~8000 cake design rows. The pipeline prefers the studio-edited image (`studio_edited_image_url`) when present and falls back to `original_image_url` otherwise, so the variant set always matches what the user actually sees on the PDP. Foreign original URLs (Pinterest, Instagram CDNs from legacy imports) are re-hosted under our own bucket during backfill so every PDP serves its LCP image from the Supabase CDN. External image-optimization services and Vercel/Next image optimization are explicitly out of scope due to cost constraints.

## Glossary

- **Original_Image**: The user-uploaded cake design image stored in the `cakegenie` Supabase bucket as referenced by `cakegenie_analysis_cache.original_image_url`.
- **Studio_Edited_Image**: The post-edit rendition of a cake design referenced by `cakegenie_analysis_cache.studio_edited_image_url`. When present and non-empty, it supersedes the Original_Image as the source of truth for rendering and variant generation.
- **Source_Image**: The URL the Variant_Pipeline uses as its input for a given Cache_Row. Equal to `studio_edited_image_url` when that column is non-null and non-empty (after trimming whitespace), otherwise equal to `original_image_url`. The Source_Image MUST be re-evaluated each time the Variant_Pipeline runs for a Cache_Row.
- **Variant**: A pre-resized WebP rendition of the Source_Image at a fixed target width.
- **Variant_Set**: The collection of all variants generated for a single Source_Image (one set per Cache_Row).
- **Variant_Pipeline**: The server-side `sharp`-based process that reads the Source_Image, produces a Variant_Set, uploads each Variant to Supabase storage, and records URLs on the Cache_Row.
- **Backfill_Job**: A one-time Node.js script that runs the Variant_Pipeline against existing rows in `cakegenie_analysis_cache` that lack a Variant_Set.
- **PDP**: Product Detail Page — `/customizing/[slug]` and `/shop/[merchant]/[product]`.
- **Cache_Row**: A single record in the `cakegenie_analysis_cache` table identified by `p_hash`.
- **Variant_Manifest**: The JSON value stored on `Cache_Row` describing the Variant_Set (widths, URLs, byte sizes, format, source).
- **LCP**: Largest Contentful Paint, measured against Web Vitals thresholds (good: ≤2500 ms, poor: >4000 ms).
- **Storage_Bucket**: The `cakegenie` public Supabase storage bucket at `cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/...`.
- **Variant_Path**: The storage object key for a Variant within Storage_Bucket, derived deterministically from the Cache_Row identity and target width. Per the slug-key revision, the identity component is the design **slug** (`variants/{slug}/{width}.webp`), falling back to `p_hash` when the slug is absent.
- **Pretty_Printer**: The function that produces the `srcset` string from a Variant_Manifest.
- **Variant_Parser**: The function that reads a Variant_Manifest from a Cache_Row and returns a typed structure for rendering.
- **Foreign_Original_Url**: A value of `original_image_url` whose URL host is not `cqmhanqnfybyxezhobkx.supabase.co` (e.g. `i.pinimg.com`, Instagram CDNs, manual import URLs).

## Requirements

### Requirement 1: Variant size set and format

**User Story:** As a site visitor on a phone, I want the page to download an image sized for my device, so that the cake design appears within the LCP budget without wasting bandwidth.

#### Acceptance Criteria

1. THE Variant_Pipeline SHALL produce variants at exactly the following target widths in pixels: 400, 800, and 1200.
2. THE Variant_Pipeline SHALL encode every Variant as WebP with quality 80 and `effort=4`.
3. WHEN the Original_Image width is less than a target width, THE Variant_Pipeline SHALL skip that target width and SHALL NOT upscale the Original_Image.
4. THE Variant_Pipeline SHALL produce at least one Variant for every Original_Image with width greater than or equal to 400 pixels.
5. IF the Original_Image width is less than 400 pixels, THEN THE Variant_Pipeline SHALL produce a single Variant at the Original_Image width and SHALL record this in the Variant_Manifest.
6. THE Variant_Pipeline SHALL preserve the aspect ratio of the Original_Image for every Variant.
7. THE Variant_Pipeline SHALL strip EXIF metadata from every Variant.
8. FOR ALL Variants, the encoded byte size SHALL be less than or equal to the byte size of the Original_Image.

### Requirement 2: Storage layout and naming convention

**User Story:** As a developer, I want a deterministic storage path for every variant, so that variants are addressable without a database lookup and the backfill job is idempotent.

#### Acceptance Criteria

1. THE Variant_Pipeline SHALL store every Variant in the `cakegenie` Storage_Bucket under the path `variants/{key}/{width}.webp`, where `{key}` is the Cache_Row design `slug` (or the `p_hash` when the slug is null/empty) and `{width}` is the integer target width.
2. THE Variant_Pipeline SHALL upload Variants with `cacheControl: "public, max-age=31536000, immutable"`.
3. THE Variant_Pipeline SHALL upload Variants with `contentType: "image/webp"`.
4. WHEN a Variant already exists at the target Variant_Path, THE Variant_Pipeline SHALL overwrite the existing object (`upsert: true`).
5. THE Variant_Pipeline SHALL NOT delete or modify the Original_Image at `cakegenie_analysis_cache.original_image_url`.

### Requirement 3: Database schema for variant URLs

**User Story:** As a renderer on the PDP, I want to read the variant URLs and widths from the cache row in a single query, so that the page can build a `srcset` without extra round trips.

#### Acceptance Criteria

1. THE Variant_Pipeline SHALL add a column named `image_variants` of type `jsonb` to the `cakegenie_analysis_cache` table.
2. THE `image_variants` column SHALL be nullable and SHALL default to NULL.
3. THE Variant_Pipeline SHALL write the Variant_Manifest into `image_variants` as a JSON object with the shape `{ "format": "webp", "source": <"studio_edited_image_url" | "original_image_url">, "variants": [{ "width": <int>, "url": <string>, "bytes": <int> }, ...] }`.
4. THE Variant_Pipeline SHALL write the `variants` array sorted by `width` in ascending order.
5. WHEN the Variant_Pipeline writes `image_variants`, THE Variant_Pipeline SHALL update `cakegenie_analysis_cache.image_width` and `cakegenie_analysis_cache.image_height` with the Source_Image dimensions read from `sharp` metadata, overwriting any existing values on the Cache_Row.
6. THE Variant_Parser SHALL return an empty Variant_Set when `image_variants` is NULL or its `variants` array is empty.

### Requirement 4: Upload pipeline integration and latency budget

**User Story:** As a customer uploading a cake design, I want my analysis result to appear quickly, so that I am not blocked waiting on image processing.

#### Acceptance Criteria

1. WHEN a new cake image is uploaded and analyzed, THE Variant_Pipeline SHALL run asynchronously after the Cache_Row is written and SHALL NOT block the analysis response returned to the user.
2. THE Variant_Pipeline SHALL update the existing Cache_Row identified by `p_hash` once variant generation completes.
3. THE upload-time analysis API response SHALL NOT depend on the presence of `image_variants` in the response payload.
4. WHEN the Variant_Pipeline completes for an upload, THE total wall-clock time from analysis API response to `image_variants` being non-NULL on the Cache_Row SHALL be less than or equal to 30 seconds at the 95th percentile measured over a rolling 7-day window.
5. WHILE the Variant_Pipeline is running for a given Cache_Row, THE Variant_Pipeline SHALL NOT start a second concurrent run for the same `p_hash`.

### Requirement 5: Failure handling and fallback rendering

**User Story:** As a site visitor, I want the cake image to always render, so that a transient pipeline failure does not break the page.

#### Acceptance Criteria

1. IF the Variant_Pipeline fails for a Cache_Row, THEN THE Variant_Pipeline SHALL leave `image_variants` as NULL and SHALL log the error with the `p_hash` and the failing stage.
2. WHEN `image_variants` is NULL on a Cache_Row, THE PDP SHALL render the `original_image_url` as the `src` of the `<img>` element with no `srcset`.
3. WHEN any individual Variant upload fails but at least one Variant succeeded, THE Variant_Pipeline SHALL write `image_variants` containing only the successful Variants.
4. WHEN the Variant_Pipeline runs for a Cache_Row whose `original_image_url` is NULL or empty, THE Variant_Pipeline SHALL skip the row, leave `image_variants` as NULL, and log a warning.
5. IF an Original_Image cannot be decoded by `sharp`, THEN THE Variant_Pipeline SHALL leave `image_variants` as NULL, log the decode error with the `p_hash`, and SHALL NOT retry the row in the same run.
6. WHEN the Effective_Source_Url used for variant generation is fetched from a hostname other than the project Supabase storage host (`cqmhanqnfybyxezhobkx.supabase.co`), THE Variant_Pipeline SHALL upload the Variants to the project Supabase storage bucket as usual AND additionally SHALL update the corresponding source URL column on the Cache_Row to the public URL of the largest Variant produced. The column updated SHALL be `studio_edited_image_url` when the Effective_Source_Url was derived from `studio_edited_image_url`, and `original_image_url` otherwise. The PDP fallback chain reads whichever URL is currently in the column, so this rewrite is safe.

### Requirement 6: PDP rendering with srcset

**User Story:** As a site visitor on a phone, I want the LCP image to be the smallest variant my viewport needs, so that LCP on `/customizing/[slug]` falls below 2500 ms.

#### Acceptance Criteria

1. THE PDP SHALL render the LCP cake image using `next/image` with `srcset` derived from the Variant_Manifest.
2. THE Pretty_Printer SHALL produce a `srcset` string of the form `"<url1> <width1>w, <url2> <width2>w, ..."` listing every Variant in the Variant_Manifest in ascending width order.
3. THE PDP SHALL set the `sizes` attribute on the LCP image to `"(max-width: 640px) 92vw, (max-width: 1024px) 60vw, 800px"`.
4. THE PDP SHALL set `priority={true}` and `fetchPriority="high"` on the LCP image element.
5. THE PDP SHALL set the `src` attribute to the largest Variant URL in the Variant_Manifest when `image_variants` is non-empty.
6. WHEN `image_variants` is non-empty, THE PDP SHALL NOT include the `original_image_url` in the rendered `srcset` for the LCP element.
7. THE following pages SHALL render variant URLs via `srcset` when `image_variants` is non-empty: `/customizing/[slug]`, `/customizing` (analyzed result state), `/shop/[merchant]/[product]`, `/collections/*`, and `/search`.

### Requirement 7: Backfill job behavior

**User Story:** As an operator, I want a one-time script to generate variants for the existing 8000 cake rows, so that the LCP improvement applies to inventory created before this feature shipped.

#### Acceptance Criteria

1. THE Backfill_Job SHALL select rows from `cakegenie_analysis_cache` where the Effective_Source_Url (defined as `studio_edited_image_url ?? original_image_url`) is non-NULL and non-empty, and `image_variants` is NULL.
2. THE Backfill_Job SHALL process selected rows in batches of 25 rows.
3. WHEN a row is processed successfully, THE Backfill_Job SHALL set `image_variants` on the Cache_Row using the same format defined in Requirement 3.
4. WHEN the Backfill_Job is re-run, THE Backfill_Job SHALL skip Cache_Rows whose `image_variants` is already non-NULL.
5. THE Backfill_Job SHALL emit a progress log line every 25 rows containing the count processed, count succeeded, count failed, and elapsed seconds.
6. THE Backfill_Job SHALL pause for 1000 milliseconds between batches.
7. IF a single row in a batch fails, THEN THE Backfill_Job SHALL continue processing the remaining rows in the batch and SHALL record the failed `p_hash` in a failures log file.
8. THE Backfill_Job SHALL exit with status code 0 when all selected rows have been processed, regardless of per-row failures.
9. THE Backfill_Job SHALL accept a `--limit` argument that caps the number of rows processed in a single run.
10. THE Backfill_Job SHALL accept a `--dry-run` argument that performs all reads and `sharp` work but skips Supabase storage writes and database updates.
11. THE Backfill_Job SHALL select the source image for each row using the same `effective_source_url = studio_edited_image_url ?? original_image_url` rule as the upload-time pipeline, and SHALL apply the third-party rehosting rule from Requirement 5.6 when the selected source resides outside the project Supabase storage host.

### Requirement 8: Storage cost ceiling

**User Story:** As the site owner, I want a predictable storage budget per cake, so that I can forecast cumulative cost for the existing 8k rows and future uploads.

#### Acceptance Criteria

1. THE Variant_Pipeline SHALL produce a Variant_Set whose total encoded byte size is less than or equal to 250 KB per Cake_Row at the 95th percentile across a rolling 7-day sample.
2. WHEN a Variant_Set total exceeds 250 KB for an individual Cake_Row, THE Variant_Pipeline SHALL log a warning containing the `p_hash` and the total byte size.
3. THE Variant_Pipeline SHALL produce at most 3 Variants per Cake_Row.

### Requirement 9: Cache invalidation and immutability

**User Story:** As a CDN consumer, I want variant URLs to be safely cached forever, so that browsers and edge caches do not re-fetch them.

#### Acceptance Criteria

1. THE Variant_Path SHALL be a deterministic function of the Cache_Row storage key (design `slug`, or `p_hash` when the slug is absent) and the target width only.
2. WHEN the Original_Image for a Cache_Row is replaced, THE Variant_Pipeline SHALL overwrite the existing Variant objects at the same Variant_Path values.
3. WHEN the Effective_Source_Url for a Cache_Row changes — including when `studio_edited_image_url` is set or updated for a row whose variants were previously generated from `original_image_url` — THE Variant_Pipeline SHALL re-run and overwrite all Variants at the same Variant_Path values.
4. THE Variant_Pipeline SHALL set `cacheControl: "public, max-age=31536000, immutable"` on every uploaded Variant.
5. THE Variant_Manifest SHALL NOT include cache-busting query strings on Variant URLs.

### Requirement 10: Browser support

**User Story:** As a developer, I want to target only modern browsers, so that the variant pipeline does not need to emit fallback formats.

#### Acceptance Criteria

1. THE Variant_Pipeline SHALL emit only WebP variants and SHALL NOT emit JPEG, PNG, or AVIF variants.
2. THE PDP SHALL render variant URLs without a `<picture>` element fallback.

### Requirement 11: Variant manifest serialization round-trip

**User Story:** As a developer, I want the manifest written to the database to round-trip through the parser unchanged, so that rendering is reliable and serialization bugs are caught early.

#### Acceptance Criteria

1. THE Variant_Pipeline SHALL serialize the Variant_Manifest as JSON before writing it to `image_variants`.
2. THE Variant_Parser SHALL read `image_variants` and return a typed Variant_Set with `{ format, variants: [{ width, url, bytes }] }`.
3. FOR ALL valid Variant_Manifests, parsing then serializing then parsing SHALL produce a Variant_Set equivalent to the first parse result (round-trip property).
4. FOR ALL valid Variant_Manifests, the Pretty_Printer applied to the parsed Variant_Set SHALL produce a `srcset` string in which the widths appear in strictly ascending order.

### Requirement 12: Variant URL determinism

**User Story:** As a developer, I want variant URL generation to be deterministic, so that I can predict and assert URLs in tests and the backfill remains idempotent.

#### Acceptance Criteria

1. FOR ALL Cache_Rows with the same storage key (design `slug`, or `p_hash` when absent) and the same target width, THE Variant_Pipeline SHALL produce the same Variant URL string on every invocation.
2. THE Variant_Pipeline SHALL NOT include timestamps, random tokens, or run identifiers in the Variant URL.

### Requirement 13: Acceptance criteria for LCP improvement

**User Story:** As the site owner, I want measurable LCP success metrics tied to the rollout, so that I can confirm the feature delivered the intended improvement.

#### Acceptance Criteria

1. WHEN at least 90% of `cakegenie_analysis_cache` rows that have a non-empty `original_image_url` also have a non-NULL `image_variants` value, THE rollout SHALL be considered "fully backfilled".
2. AFTER the rollout is fully backfilled, THE 75th-percentile field LCP for `/customizing/[slug]` measured over a rolling 28-day window SHALL be less than or equal to 2500 milliseconds.
3. AFTER the rollout is fully backfilled, THE 75th-percentile field LCP for `/customizing` measured over a rolling 28-day window SHALL be less than or equal to 2500 milliseconds.
4. AFTER the rollout is fully backfilled, THE LCP element on `/customizing/[slug]` measured by Chrome DevTools on a Moto G Power emulation profile with "Slow 4G" throttling SHALL download a Variant whose width is less than or equal to 800 pixels.

### Requirement 14: Source image selection rule

**User Story:** As a site visitor, I want the variants I see to match the canonical product image (studio-edited when available), so that the LCP image and the actual product image are visually identical.

#### Acceptance Criteria

1. THE Variant_Pipeline SHALL select the source image for a Cache_Row using the following precedence: WHEN `studio_edited_image_url` is non-NULL, non-empty, and points to a value that is not whitespace-only, THE Variant_Pipeline SHALL use `studio_edited_image_url` as the source. OTHERWISE, THE Variant_Pipeline SHALL use `original_image_url` as the source.
2. WHEN `studio_edited_image_url` becomes non-NULL on an existing Cache_Row that already has `image_variants`, THE Variant_Pipeline SHALL re-run for that Cache_Row and overwrite the existing Variant objects at the same Variant_Path values (Req 9.2 already covers the overwrite mechanics).
3. THE Variant_Manifest SHALL record which source field was used in a new field `source` with value `"studio_edited_image_url"` or `"original_image_url"`. The manifest shape becomes `{ "format": "webp", "source": <"studio_edited_image_url" | "original_image_url">, "variants": [...] }`.
4. THE Variant_Parser SHALL accept manifests without the `source` field (older manifests written before this requirement) by treating a missing `source` as `"original_image_url"`.

### Requirement 15: Non-Supabase source re-hosting

**User Story:** As a site visitor, I want the PDP to load images from a single fast CDN, so that LCP does not depend on the speed of a third-party image host.

#### Acceptance Criteria

1. WHEN the Source_Image URL hostname is not `cqmhanqnfybyxezhobkx.supabase.co`, THE Variant_Pipeline SHALL fetch the image, generate the Variant_Set as defined in Requirement 1, and upload all variants to the `cakegenie` Storage_Bucket using the Variant_Path defined in Requirement 2.
2. WHEN the Source_Image hostname is not `cqmhanqnfybyxezhobkx.supabase.co` and the fetch succeeds, THE Variant_Pipeline SHALL update the Cache_Row to set `original_image_url` to the public URL of the largest Variant produced (the 1200 px width when present, otherwise the largest available width).
3. IF the Variant_Pipeline cannot fetch a non-Supabase Source_Image because the third-party host returns a non-2xx status or the request times out (per Req 5.1's 60 s budget), THEN THE Variant_Pipeline SHALL leave `image_variants` as NULL, set `image_variants_status` to `'failed'`, and log an error containing the source hostname. The Cache_Row's `original_image_url` SHALL remain unchanged.

### Requirement 16: Dimension re-measurement during backfill

**User Story:** As a developer, I want `image_width` and `image_height` to reflect the actual decoded dimensions of the Source_Image, so that the PDP renders correct intrinsic sizing and prevents CLS from stale dimensions.

#### Acceptance Criteria

1. WHEN the Variant_Pipeline produces a Variant_Set for a Cache_Row, THE Variant_Pipeline SHALL update `cakegenie_analysis_cache.image_width` and `cakegenie_analysis_cache.image_height` with the decoded width and height of the Source_Image as reported by `sharp.metadata()`.
2. THE update under criterion 1 SHALL overwrite any prior non-NULL values in `image_width` and `image_height`.
3. IF the decoded dimensions returned by `sharp.metadata()` are zero, negative, or missing, THEN THE Variant_Pipeline SHALL leave `image_width` and `image_height` unchanged and SHALL log a warning containing the `p_hash` and the raw metadata payload.
4. WHEN the Variant_Pipeline rotates the image to honor EXIF orientation before decoding pixel data, THE recorded `image_width` and `image_height` SHALL reflect the post-rotation dimensions, not the on-disk dimensions.
