# Implementation Plan: Cake Image Variant Pipeline

## Overview

Eight-phase rollout of the variant pipeline. Phase 1 lays the database and library scaffold. Phase 2 implements the pure `src/lib/imageVariants/*` modules so they are unit-testable without I/O. Phase 3 covers the six fast-check correctness properties. Phase 4 wires the Supabase DB Webhook to the Vercel Node serverless route at `src/app/api/internal/variant-pipeline/route.ts`. Phase 5 verifies the upload-path integration (no app code changes — `cacheAnalysisResult` already INSERTs/UPDATEs the row). Phase 6 changes PDP and listing-page rendering to consume `srcset` from the manifest. Phase 7 runs the backfill CLI: dry-run first, then a gated production run. Phase 8 is async monitoring (coverage view, field LCP).

Foundation → library → properties → trigger + webhook + render (must ship together) → backfill → monitor. Phase 4 and Phase 6 must be in the same release because the webhook starts producing manifests and the renderer must know what to do with them.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "2.6"] },
    { "id": 3, "tasks": ["2.7", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3", "6.1"] },
    { "id": 5, "tasks": ["4.4", "4.5", "4.6", "5.1", "6.2", "6.3"] },
    { "id": 6, "tasks": ["6.4", "6.5", "6.6", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 8, "tasks": ["7.5", "8.1", "8.2"] }
  ]
}
```

Critical path: 1.1 → 2.1 → 2.7 → 4.3 → 6.1 → 7.5. Phase 8 (monitoring) is decoupled from code and runs async after deploy.

---

## Tasks

### Phase 1 — Foundation (DB migration, types, dependency moves)

- [x] 1. Foundation
  - [x] 1.1 Create `image_variants` migration and coverage view
    - **Description:** Add the `image_variants jsonb` column plus `image_variants_status`, `image_variants_attempted_at`, `image_variants_indexed_at`, `image_variants_indexed_source`, `image_variants_error` columns to `cakegenie_analysis_cache`. Add the CHECK constraint on status, the partial index on `(image_variants IS NULL AND effective source non-empty)`, and the `cakegenie_image_variants_coverage` view.
    - **Files touched:** `supabase/migrations/20260601000000_add_image_variants_to_analysis_cache.sql`, `supabase/migrations/20260601000000_add_image_variants_to_analysis_cache.runbook.md`
    - **Acceptance criteria:**
      - Migration applies cleanly on a fresh local Supabase via `supabase db reset`.
      - `\d cakegenie_analysis_cache` shows all 6 new columns; status default is NULL; image_variants default is NULL.
      - `SELECT * FROM cakegenie_image_variants_coverage` returns one row with four counts.
      - Runbook documents rollback DDL (drop view → drop columns).
    - **Requirements covered:** Req 3.1, 3.2, 13.1

  - [x] 1.2 Move `sharp` to dependencies and verify Vercel bundle
    - **Description:** Move `sharp` from `devDependencies` to `dependencies` in `package.json`. The webhook route runs in the Vercel Node runtime and needs sharp at request time, not just at build time. Add `vercel.json` `functions` config raising `maxDuration` to 60 s for the variant route.
    - **Files touched:** `package.json`, `package-lock.json` (or equivalent), `vercel.json`
    - **Acceptance criteria:**
      - `sharp` appears under `dependencies` only.
      - `npm install` succeeds without warnings about peer deps.
      - `vercel.json` has `"functions": { "src/app/api/internal/variant-pipeline/route.ts": { "maxDuration": 60 } }`.
      - Local Vercel dev (`vercel dev`) or `next build` reports the variant function bundle size; document size is < 250 MB Vercel limit (sharp adds ~30 MB).
    - **Requirements covered:** Req 4.4 (latency budget runs on Node runtime)

  - [x] 1.3 Add `SUPABASE_WEBHOOK_SECRET` to environment configuration
    - **Description:** Document and provision the HMAC shared secret used to authenticate Supabase DB Webhook callbacks. Add to `.env.local.example`, deployment env (Vercel project), and the README operations section.
    - **Files touched:** `.env.local.example`, `README.md` (or `.kiro/specs/cake-image-variant-pipeline/runbook.md` if README is hands-off)
    - **Acceptance criteria:**
      - `.env.local.example` lists `SUPABASE_WEBHOOK_SECRET=<32-byte-hex>` with comment pointing at the route.
      - Vercel project env (Production + Preview) has the secret set; document the rotation procedure (deferred for v1, single static value).
    - **Requirements covered:** Req 4.1, 4.5 (webhook auth precondition)

---

### Phase 2 — Variant pipeline library (`src/lib/imageVariants/`)

All modules in this phase are pure / I/O-isolated, so they can be unit-tested without a network or database.

- [x] 2. Variant pipeline library
  - [x] 2.1 Implement `types.ts` (Variant, VariantManifest, GenerateResult, RunForRowInput/Result, SourceColumn, SelectedSource)
    - **Description:** Define the TypeScript types that all other modules import. Single source of truth for the manifest shape. Match the shape in design §"TypeScript types" exactly.
    - **Files touched:** `src/lib/imageVariants/types.ts`
    - **Acceptance criteria:**
      - `tsc --noEmit` passes.
      - `Variant`, `VariantManifest`, `VariantFormat`, `GenerateResult`, `SourceColumn`, `SelectedSource`, `RunForRowInput`, `RunForRowResult` are all exported.
      - `VariantManifest.source` is the union `'studio_edited_image_url' | 'original_image_url'`.
      - `VariantManifest.variants` is `Variant[]` (no Set, must allow ordering).
    - **Requirements covered:** Req 3.3, 3.4, 14.3, 14.4

  - [x] 2.2 Implement `storage.ts`: `variantPath`, `publicVariantUrl`, `uploadVariant`
    - **Description:** Pure path builder + thin Supabase storage wrapper. `variantPath(pHash, width)` returns `variants/{p_hash}/{width}.webp` exactly. `uploadVariant` calls `client.storage.from('cakegenie').upload(path, buf, { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable', upsert: true })`. `publicVariantUrl` builds the public URL deterministically from `pHash` and `width` (no DB lookup, no signed URL).
    - **Files touched:** `src/lib/imageVariants/storage.ts`
    - **Acceptance criteria:**
      - `variantPath('abc', 800) === 'variants/abc/800.webp'` (literal).
      - `publicVariantUrl(client, 'abc', 800)` equals `https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/variants/abc/800.webp`.
      - `uploadVariant` passes `cacheControl: 'public, max-age=31536000, immutable'`, `contentType: 'image/webp'`, `upsert: true`.
      - No timestamps or random tokens in returned URL.
    - **Requirements covered:** Req 2.1, 2.2, 2.3, 2.4, 9.1, 9.4, 12.1, 12.2

  - [x] 2.3 Implement `manifest.ts`: `parseManifest`, `serializeManifest`
    - **Description:** Parser/serializer for the JSONB column. `parseManifest(unknown)` returns `VariantManifest | null` (null on any malformed input). `serializeManifest(m)` returns the plain object that goes into the JSONB column. Sort the `variants` array ascending by width on serialize. Treat a missing `source` field as `"original_image_url"` (backwards compat for older manifests).
    - **Files touched:** `src/lib/imageVariants/manifest.ts`
    - **Acceptance criteria:**
      - `parseManifest(null) === null`, `parseManifest(undefined) === null`, `parseManifest({})` rejects (returns null).
      - `parseManifest({ format: 'webp', variants: [...] })` (no `source`) defaults source to `'original_image_url'`.
      - `serializeManifest` always emits `variants` sorted ascending by `width`.
      - Round-trip on a hand-crafted fixture in unit test.
    - **Requirements covered:** Req 3.3, 3.4, 3.6, 11.1, 11.2, 14.4

  - [x] 2.4 Implement `manifest.ts`: `buildSrcSet`, `pickFallbackSrc`
    - **Description:** `buildSrcSet(m)` returns `"<url> <w>w, <url> <w>w, ..."` in ascending width order. `pickFallbackSrc(m, maxWidth = 1200)` returns the largest variant whose `width <= maxWidth`, or the smallest available when none fit. Both are pure.
    - **Files touched:** `src/lib/imageVariants/manifest.ts`
    - **Acceptance criteria:**
      - `buildSrcSet({ variants: [{w:400}, {w:1200}, {w:800}] })` (after sort) emits widths in 400, 800, 1200 order.
      - `pickFallbackSrc(m, 1200)` returns 1200 when present; returns 800 when only 400/800 exist.
      - When manifest is empty, both return safe fallbacks (`""` for srcset, `null` for fallback src).
    - **Requirements covered:** Req 6.2, 6.5, 11.4

  - [x] 2.5 Implement `manifest.ts` / `runForRow.ts`: `selectEffectiveSource` and `PROJECT_SUPABASE_HOST` constant
    - **Description:** `selectEffectiveSource({ studio_edited_image_url, original_image_url })` returns `{ url, column: 'studio_edited_image_url' }` when the studio value is non-null and non-whitespace, otherwise `{ url, column: 'original_image_url' }` when original is non-empty, otherwise `null`. Export `PROJECT_SUPABASE_HOST = 'cqmhanqnfybyxezhobkx.supabase.co'`. Both helpers must be reused by the webhook worker and the backfill — single code path.
    - **Files touched:** `src/lib/imageVariants/runForRow.ts` (or `manifest.ts`, per design — colocate with the helpers that use it)
    - **Acceptance criteria:**
      - `selectEffectiveSource({ studio: '  ', original: 'X' })` returns `{ url: 'X', column: 'original_image_url' }` (whitespace-only studio is treated as empty).
      - `selectEffectiveSource({ studio: null, original: null })` returns `null`.
      - `PROJECT_SUPABASE_HOST` is exported as a string literal.
    - **Requirements covered:** Req 14.1, 14.3, 5.4, 15.1

  - [x] 2.6 Implement `generate.ts`: `generateVariants(buffer)` using sharp
    - **Description:** Pure pipeline: takes a `Buffer`, returns `{ manifest, source, encoded, warnings }`. Decodes once via `sharp(buf)`, calls `.metadata()` for source dimensions (with EXIF rotation honored), then for each target width in `[400, 800, 1200]` that is `<= source.width`, resizes with `withoutEnlargement: true` and encodes to WebP at `quality: 80, effort: 4`. Strips EXIF (sharp default with no `withMetadata`). Skips upscaling (Req 1.3). Produces single native-width variant when source < 400 px (Req 1.5). No I/O at all in this module.
    - **Files touched:** `src/lib/imageVariants/generate.ts`
    - **Acceptance criteria:**
      - For a 3000 px wide test fixture, returns 3 encoded buffers at 400/800/1200.
      - For a 1000 px wide fixture, returns 2 encoded buffers at 400/800 (no 1200).
      - For a 300 px wide fixture, returns 1 encoded buffer at 300 (the source width).
      - Every encoded buffer has `bytes <= original.bytes`.
      - `manifest.format === 'webp'`.
      - `manifest.variants` is sorted ascending by width.
      - `source.width` and `source.height` reflect post-EXIF-rotation dimensions.
      - When sharp metadata returns zero/negative/missing dimensions, returns `warnings` and signals decode failure (caller treats as `'failed'`, Req 5.5, 16.3).
    - **Requirements covered:** Req 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 8.3, 16.1, 16.4, 5.5

  - [x] 2.7 Implement `runForRow.ts`: `runVariantPipelineForRow` glue
    - **Description:** Ties generate + storage + manifest + DB updates into one function used by both the webhook and the backfill. Accepts an injected `SupabaseClient`. Steps: select effective source → fetch source bytes (handle non-Supabase host per Req 15) → `generateVariants` → `uploadVariant` per width (sequential) → build `VariantManifest` from successful uploads → return result. Sets `manifest.source` to `selected.column`. When `selected.url` host is not `PROJECT_SUPABASE_HOST`, sets `result.rehostedTo` to the largest-variant public URL so the caller can issue the rehost UPDATE (Req 15.2). On `--dry-run`, runs fetch + sharp but skips uploads and DB writes.
    - **Files touched:** `src/lib/imageVariants/runForRow.ts`
    - **Acceptance criteria:**
      - Returns `{ status: 'ok' | 'partial' | 'skipped' | 'failed', manifest, source, selected, rehostedTo?, errors }`.
      - When source is null/empty for both columns, returns `{ status: 'skipped' }` and never throws (Req 5.4).
      - When source fetch returns non-2xx, returns `{ status: 'failed', errors: [{ stage: 'fetch_original', ... }] }` (Req 15.3).
      - When ≥1 upload succeeds and ≥1 fails, returns `{ status: 'partial' }` with manifest containing only successes (Req 5.3).
      - `manifest.source` always equals `selected.column`.
      - When `selected.url` host is not `PROJECT_SUPABASE_HOST`, `result.rehostedTo` is the public URL of the largest variant.
      - Verify: `vitest --run src/lib/imageVariants/__tests__/runForRow.test.ts` passes against a mocked SupabaseClient.
    - **Requirements covered:** Req 1.9, 1.10, 5.3, 5.4, 5.5, 5.6, 14.1, 14.3, 15.1, 15.2, 15.3, 16.1, 16.2

---

### Phase 3 — Property tests (fast-check)

Each property maps to one or two acceptance criteria. Tests live next to the modules they cover.

- [x] 3. Property-based tests
  - [x]* 3.1 Property test: manifest serialize/parse round-trip
    - **Description:** Property 1. For any valid `VariantManifest m`, `parseManifest(serializeManifest(parseManifest(serializeManifest(m))))` is structurally equal to `parseManifest(serializeManifest(m))`. Use `fc.record({ width: fc.integer({min:1,max:8192}), url: fc.webUrl(), bytes: fc.integer({min:1}) })` and post-condition sort by width.
    - **Files touched:** `src/lib/imageVariants/__tests__/manifest.property.test.ts`
    - **Acceptance criteria:**
      - **Property 1: Manifest serialize/parse round-trip**
      - **Validates: Requirements 11.3**
      - `vitest --run` passes; fast-check runs ≥ 100 cases by default.

  - [x]* 3.2 Property test: srcset widths strictly ascending
    - **Description:** Property 2. For any valid `VariantManifest m`, the widths emitted by `buildSrcSet(m)` appear in strictly ascending order regardless of input order.
    - **Files touched:** `src/lib/imageVariants/__tests__/manifest.property.test.ts`
    - **Acceptance criteria:**
      - **Property 2: Srcset widths strictly ascending**
      - **Validates: Requirements 6.2, 11.4**

  - [x]* 3.3 Property test: variant URL determinism
    - **Description:** Property 3. For any `(p_hash, width)` pair, `variantPath(p_hash, width)` returns a byte-identical string across invocations and contains no random / time / run-scoped segment. Cross-check that two invocations 100 ms apart produce identical strings.
    - **Files touched:** `src/lib/imageVariants/__tests__/storage.property.test.ts`
    - **Acceptance criteria:**
      - **Property 3: Variant URL determinism**
      - **Validates: Requirements 12.1, 12.2**

  - [x]* 3.4 Property test: fallback selection respects width bound
    - **Description:** Property 4. For any `VariantManifest m` containing at least one variant whose `width ≤ 1200`, `pickFallbackSrc(m, 1200)` returns a variant whose `width ≤ 1200`.
    - **Files touched:** `src/lib/imageVariants/__tests__/manifest.property.test.ts`
    - **Acceptance criteria:**
      - **Property 4: Fallback selection respects width bound**
      - **Validates: Requirements 6.5**

  - [x]* 3.5 Property test: no upscaling
    - **Description:** Property 5. For any synthetic source-image `Buffer` of width `W` (use sharp to generate solid-color test images at `fc.integer({min:50,max:4000})`), the produced `Variant_Set` from `generateVariants` contains no variant with `width > W`.
    - **Files touched:** `src/lib/imageVariants/__tests__/generate.property.test.ts`
    - **Acceptance criteria:**
      - **Property 5: No upscaling**
      - **Validates: Requirements 1.3**
      - Test uses sharp itself to create valid input buffers (e.g. `sharp({ create: { width: W, height: ... } }).webp().toBuffer()`).

  - [x]* 3.6 Property test: per-variant byte budget
    - **Description:** Property 6. For any synthetic source image, every produced variant satisfies `variant.bytes ≤ original.bytes`. Generate input buffers via sharp at varying widths and complexity (solid, gradient, noise) so the property is exercised across different input entropies.
    - **Files touched:** `src/lib/imageVariants/__tests__/generate.property.test.ts`
    - **Acceptance criteria:**
      - **Property 6: Per-variant byte budget**
      - **Validates: Requirements 1.8**

---

### Phase 4 — Webhook endpoint and DB Webhook config

- [ ] 4. Webhook endpoint and DB Webhook
  - [x] 4.1 Implement HMAC verification middleware
    - **Description:** Helper that reads `x-supabase-webhook-secret` header (or computes HMAC-SHA256 of the raw body keyed with `SUPABASE_WEBHOOK_SECRET`, matching whichever auth mode the Supabase webhook is configured for) and returns 401 when invalid. Constant-time comparison.
    - **Files touched:** `src/app/api/internal/variant-pipeline/auth.ts`
    - **Acceptance criteria:**
      - Returns 401 when the header is missing.
      - Returns 401 when the header value does not match `SUPABASE_WEBHOOK_SECRET`.
      - Returns 200 (delegates) when valid.
      - Unit test: invalid signature → 401; valid signature → handler invoked.
    - **Requirements covered:** Req 4.1, 4.5

  - [x] 4.2 Implement single-flight claim SQL helper
    - **Description:** Helper that runs the conditional UPDATE claim defined in design §"Single-flight concurrency control": claim when status is NULL / failed / partial / skipped, OR when status is 'ready' but `image_variants_indexed_source IS DISTINCT FROM` the new effective source, AND the prior `image_variants_attempted_at` is older than 5 minutes (or NULL). Returns `rowsAffected` so the caller can decide to proceed or short-circuit.
    - **Files touched:** `src/lib/imageVariants/runForRow.ts` (extend) or `src/lib/imageVariants/claim.ts`
    - **Acceptance criteria:**
      - Returns 1 when row is fresh / failed / source-changed.
      - Returns 0 when row is currently `'running'` and not stale.
      - Returns 1 when row is `'running'` but `attempted_at` is older than 5 minutes.
      - Returns 1 when status is `'ready'` and the indexed source no longer equals the current effective source (Req 9.3).
      - Returns 0 when status is `'ready'` and indexed source matches (worker's own UPDATE does not re-fire).
      - Unit test against a local Supabase confirms each branch.
    - **Requirements covered:** Req 4.5, 9.3

  - [x] 4.3 Implement webhook route `POST /api/internal/variant-pipeline`
    - **Description:** Vercel Node-runtime route handler. Verifies HMAC (4.1), reads `p_hash` from the payload, runs the single-flight claim (4.2), calls `runVariantPipelineForRow`, applies the resulting DB UPDATE (`image_variants`, `image_variants_status`, `image_variants_indexed_source`, `image_variants_indexed_at`, `image_width`, `image_height`) and the rehost UPDATE when `result.rehostedTo` is set, then returns 200. On worker exception, sets `image_variants_status='failed'` and the error message, returns 500 so Supabase can retry. Use service-role Supabase client server-side.
    - **Files touched:** `src/app/api/internal/variant-pipeline/route.ts`
    - **Acceptance criteria:**
      - Manual `curl -X POST -H "x-supabase-webhook-secret: $SECRET" -d '{"p_hash":"<known>"}' http://localhost:3002/api/internal/variant-pipeline` returns 200 within 30 s.
      - After the call, `cakegenie_analysis_cache.image_variants` for that p_hash is non-NULL and `image_variants_status='ready'`.
      - `image_width` and `image_height` are overwritten with sharp metadata values.
      - `image_variants_indexed_source` equals the URL processed.
      - When called twice concurrently for the same p_hash, only one worker proceeds (claim guard) — verify via two parallel curls and DB row state.
      - Invalid signature returns 401 (verify with curl missing the header).
    - **Requirements covered:** Req 3.3, 3.4, 3.5, 4.1, 4.2, 4.5, 5.1, 5.3, 5.4, 5.5, 5.6, 9.2, 9.3, 14.2, 16.1, 16.2

  - [ ] 4.4 Configure Supabase Database Webhook on `cakegenie_analysis_cache`
    - **Description:** In the Supabase dashboard (or via SQL using `supabase_functions.http_request`), create a webhook on the `cakegenie_analysis_cache` table firing on INSERT and UPDATE. Target URL: `<vercel-prod-url>/api/internal/variant-pipeline`. Custom header: `x-supabase-webhook-secret: <SUPABASE_WEBHOOK_SECRET>`. Document the configuration in the runbook.
    - **Files touched:** `.kiro/specs/cake-image-variant-pipeline/runbook.md` (configuration steps), no source code changes
    - **Acceptance criteria:**
      - Webhook visible in Supabase dashboard under Database → Webhooks.
      - Inserting a test row into `cakegenie_analysis_cache` with a known image URL produces a non-NULL `image_variants` value within 30 s (Req 4.4).
      - Updating `studio_edited_image_url` on a row with `image_variants_status='ready'` causes the worker to re-run and overwrite the manifest (verify `image_variants_indexed_source` changes and HEAD on `variants/{p_hash}/1200.webp` shows a newer `last-modified`).
      - **⚠ Requires user approval:** This task touches production Supabase config. Pause for explicit operator confirmation before enabling on prod.
    - **Requirements covered:** Req 4.1, 4.2, 4.4, 9.3, 14.2

  - [x]* 4.5 Webhook auth integration test
    - **Description:** Vitest test that boots the route handler (via Next.js test harness or direct import), POSTs with a valid HMAC and an invalid HMAC, and asserts 200 vs 401.
    - **Files touched:** `src/app/api/internal/variant-pipeline/__tests__/route.test.ts`
    - **Acceptance criteria:**
      - Invalid signature returns 401.
      - Missing header returns 401.
      - Valid signature returns 200 and triggers `runVariantPipelineForRow` (mocked).
      - _Requirements: Req 4.1, 4.5_

  - [ ]* 4.6 Manual end-to-end webhook smoke test
    - **Description:** Manual verification step. After deploying 4.3 and 4.4 to a preview/staging deploy, upload one cake image through the UI and watch the row.
    - **Acceptance criteria:**
      - Within 30 s of the analysis API responding, `image_variants` is non-NULL on the new row.
      - HEAD on each of `variants/{p_hash}/{400,800,1200}.webp` returns 200 with `cache-control: public, max-age=31536000, immutable` and `content-type: image/webp` (Req 2.2, 2.3).
      - `image_width` / `image_height` match the source.
      - _Requirements: Req 2.2, 2.3, 4.4_

---

### Phase 5 — Upload-path wiring verification

- [ ] 5. Upload-path verification (no app code changes)
  - [ ]* 5.1 Verify `cacheAnalysisResult` triggers the webhook on INSERT
    - **Description:** No source change here — the design relies on the existing INSERT/UPDATE on `cakegenie_analysis_cache` to fire the DB webhook. Verify the existing client and server callers of `cacheAnalysisResult` produce a webhook event by inspecting Supabase webhook delivery logs and the resulting cache row.
    - **Files touched:** none (verification only). Add a note in `.kiro/specs/cake-image-variant-pipeline/runbook.md` recording the verified call sites.
    - **Acceptance criteria:**
      - Browser-initiated upload (anon client) ends with the webhook firing — confirmed in Supabase webhook delivery log.
      - Server-initiated upload (service-role client) ends with the webhook firing — same confirmation.
      - Both paths converge on the same row update; only one webhook delivery is needed because the row is upserted once.
      - _Requirements: Req 4.1, 4.2_

---

### Phase 6 — PDP and listing-page rendering

Phase 4 and Phase 6 ship in the **same release**: the webhook starts producing manifests and the renderer must consume them. Until both are deployed, manifests exist but PDPs ignore them — which is correct fallback behavior, not a bug. The point is to avoid the mirror failure: renderers that look for srcset before manifests exist, leading to 404s.

- [ ] 6. PDP + listing rendering
  - [ ] 6.1 Extend `<LazyImage>` with `variants` prop and `<picture>` wrapper
    - **Description:** Add `variants?: VariantManifest | null` and `fallbackSrc?: string` props. When `variants` is non-empty, wrap the rendered `<Image>` in `<picture>` with a `<source type="image/webp" srcSet={buildSrcSet(variants)} sizes={sizes} />`. Compute `src` via `pickFallbackSrc(variants, 1200) ?? fallbackSrc ?? src`. When `variants` is null/empty, render exactly as today.
    - **Files touched:** `src/components/LazyImage.tsx`
    - **Acceptance criteria:**
      - Existing call sites compile without changes (the new prop is optional).
      - When `variants` is provided, the rendered DOM has `<picture><source srcset="..." sizes="..."><img src="..." ...></picture>`.
      - When `variants` is null, no `<picture>` wrapper is rendered (DOM identical to before).
      - Vitest snapshot or DOM assertion for both branches.
    - **Requirements covered:** Req 6.1, 6.6, 5.2, 10.2

  - [ ] 6.2 Wire `<ProductCard>` to forward `image_variants`
    - **Description:** Add `imageVariants?: VariantManifest | null` to `<ProductCard>` props, pass into `<LazyImage variants={…}>`. Set `sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 256px"` for cards.
    - **Files touched:** `src/components/ProductCard.tsx`
    - **Acceptance criteria:**
      - Cards rendered with non-null variants emit a `<source srcset>` containing all three widths.
      - Cards rendered with null variants render the original URL only.
    - **Requirements covered:** Req 6.7

  - [ ] 6.3 Update `customizing/[slug]/page.tsx` hero rendering and preload
    - **Description:** Parse `design.image_variants` via `parseManifest`, compute `heroSrc` via `pickFallbackSrc(manifest, 1200) ?? design.original_image_url`, and emit a `<link rel="preload" as="image" href={heroSrc} imageSrcSet={buildSrcSet(manifest)} imageSizes="(max-width: 640px) 92vw, (max-width: 1024px) 60vw, 800px" />` in the head. Render `<LazyImage src={heroSrc} variants={manifest} priority fetchPriority="high" sizes="..." />`. Extend the existing `<noscript><img>` fallback with `srcset`/`sizes`.
    - **Files touched:** `src/app/customizing/[slug]/page.tsx`
    - **Acceptance criteria:**
      - The slug page hero `<img>` has the expected `sizes` attribute.
      - `<link rel="preload">` includes `imagesrcset` and `imagesizes` when manifest is non-empty.
      - When manifest is null, hero falls back to `original_image_url` with no srcset (Req 5.2).
      - `priority` and `fetchPriority="high"` are set on the hero element (Req 6.4).
      - `src` equals the largest variant URL when manifest is non-empty (Req 6.5).
    - **Requirements covered:** Req 6.1, 6.3, 6.4, 6.5, 6.6, 5.2

  - [ ] 6.4 Update `customizing/page.tsx` (analyzed result state) to forward variants
    - **Description:** Pass `image_variants` from each result row into `<ProductCard>` and the analyzed-result hero `<LazyImage>`. Hero sizes match the slug page.
    - **Files touched:** `src/app/customizing/page.tsx` (and `LandingClient.tsx` if the analyzed state lives there)
    - **Acceptance criteria:**
      - DOM inspection on `/customizing` after analysis shows `<picture><source srcset>` for the result image.
      - Listing thumbs render variants when present.
    - **Requirements covered:** Req 6.7

  - [ ] 6.5 Update `shop/[merchantSlug]/[productSlug]/page.tsx`, `collections/[category]/page.tsx`, `search/SearchingClient.tsx`
    - **Description:** Each page already runs a Supabase select for cake rows. Add `image_variants` to the column list and forward into `<ProductCard>`. No new components; just the column passthrough.
    - **Files touched:** `src/app/shop/[merchantSlug]/[productSlug]/page.tsx`, `src/app/collections/[category]/page.tsx`, `src/app/search/SearchingClient.tsx`, `src/services/supabaseService.ts` (select column lists)
    - **Acceptance criteria:**
      - All four pages select `image_variants` in their existing queries.
      - `<ProductCard>` calls receive `imageVariants` when the row has a non-NULL manifest.
      - Existing tests still pass (no breaking renames).
    - **Requirements covered:** Req 6.7

  - [ ]* 6.6 Manual visual regression at 3 viewports
    - **Description:** Use Chrome DevTools MCP to capture `/customizing/<known-slug>` at 390 / 768 / 1440 px viewports, before and after the change. Confirm visible image is identical and Network panel shows the smallest variant downloaded at 390 px and 1200 at 1440 px.
    - **Acceptance criteria:**
      - At 390 px viewport, the LCP image network response is the 400 px variant URL.
      - At 768 px viewport, the LCP image is the 800 px variant.
      - At 1440 px viewport, the LCP image is the 1200 px variant.
      - Visible image content is pixel-similar to pre-change baseline.
      - _Requirements: Req 13.4_

---

### Phase 7 — Backfill CLI and production run

- [ ] 7. Backfill
  - [ ] 7.1 Implement `scripts/backfill-image-variants.ts` CLI
    - **Description:** Node CLI run via `tsx`. Args: `--limit=<n>`, `--dry-run`, `--batch-size=<n>` (default 25), `--from-id=<uuid>`. Selects rows where effective source is non-empty AND `image_variants IS NULL`, ORDER BY created_at DESC, LIMIT batch OFFSET. For each row, calls `runVariantPipelineForRow` with the service-role client. Logs progress every batch. Sleeps 1000 ms between batches. Per-row failures append to `./logs/variant-backfill-failures-<isoDate>.ndjson`. Exit code 0 regardless of per-row failures. Reuses the same `selectEffectiveSource` and rehost helpers as the webhook.
    - **Files touched:** `scripts/backfill-image-variants.ts`
    - **Acceptance criteria:**
      - `tsx scripts/backfill-image-variants.ts --dry-run --limit=10` runs end-to-end, prints what would be uploaded per row, makes no DB writes and no storage uploads.
      - `--limit=<n>` caps row count.
      - Progress log emitted every batch with `{ processed, ok, failed, elapsed_s }`.
      - Per-batch sleep of 1000 ms verified by elapsed time.
      - Failures append one line per failure to the failures NDJSON file.
      - Final exit code is 0.
      - Re-running skips rows where `image_variants` is already non-NULL (verified by SELECT count before and after).
    - **Requirements covered:** Req 7.1, 7.2, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11

  - [ ]* 7.2 Backfill dry-run smoke test on prod (limit 10)
    - **Description:** Run `tsx scripts/backfill-image-variants.ts --dry-run --limit=10` against the production Supabase project (read-only because of `--dry-run`).
    - **Acceptance criteria:**
      - Run completes without error.
      - Output shows 10 rows processed, no DB writes, no storage writes.
      - At least one of the 10 rows has a non-Supabase host (Pinterest / Instagram) in the dry-run log to exercise the rehost code path; if none do, manually craft a query to find one and re-run with `--from-id=<that-row>`.
      - _Requirements: Req 7.10, 15.1_

  - [ ]* 7.3 Backfill validation run (limit 100, real writes)
    - **Description:** Run `tsx scripts/backfill-image-variants.ts --limit=100` against prod with the service-role key.
    - **Acceptance criteria:**
      - 100 rows processed with ≥ 95 successes.
      - Spot-check 10 rows: HEAD on each `variants/{p_hash}/{400,800,1200}.webp` returns 200 with correct `cache-control` and `content-type`.
      - For the rows whose source was a Pinterest / Instagram URL, verify `original_image_url` (or `studio_edited_image_url`) was rewritten to the largest-variant Supabase URL on the same UPDATE that wrote `image_variants` (Req 5.6, 15.2).
      - For all 100 rows, `image_width` and `image_height` are now populated from sharp metadata (Req 16.1, 16.2).
      - `cakegenie_image_variants_coverage.covered_rows` increased by ~100.
      - **⚠ Requires user approval:** Production data write. Pause for explicit operator confirmation.
      - _Requirements: Req 7.1, 7.3, 5.6, 15.2, 16.1, 16.2_

  - [ ]* 7.4 Backfill full production run
    - **Description:** Run `tsx scripts/backfill-image-variants.ts` with no `--limit` (or in chunks of 1000/day per the rollout plan) against prod.
    - **Acceptance criteria:**
      - All eligible rows have non-NULL `image_variants` or `image_variants_status='failed'`.
      - `cakegenie_image_variants_coverage.covered_rows / eligible_rows >= 0.90` (Req 13.1).
      - Failures NDJSON contains < 5% of rows.
      - **⚠ Requires user approval:** Long-running production write. Pause for explicit operator confirmation. Estimated ~2.5 h.
      - _Requirements: Req 7.1, 7.2, 7.6, 7.8, 13.1_

  - [ ] 7.5 Checkpoint — Ensure all tests pass before production rollout
    - Ensure all unit and property tests pass: `npm test -- --run`.
    - Ensure the webhook smoke test (4.6), the dry-run (7.2), and the validation run (7.3) all completed cleanly.
    - Ask the user before proceeding to 7.4 (full production run) and Phase 8 monitoring.

---

### Phase 8 — Rollout monitoring (no code changes)

- [ ]* 8. Monitoring
  - [ ]* 8.1 Daily check on `cakegenie_image_variants_coverage` view
    - **Description:** Manual SQL query (or scheduled job) to track coverage daily for ~14 days post-deploy.
    - **Acceptance criteria:**
      - `SELECT * FROM cakegenie_image_variants_coverage` returns increasing `covered_rows` until ≥ 90% of `eligible_rows`.
      - `failed_rows` is < 5% and stable (not growing).
      - When ratio crosses 0.90, declare "fully backfilled" (Req 13.1).
      - _Requirements: Req 13.1_

  - [ ]* 8.2 Field LCP measurement on `/customizing/[slug]` and `/customizing`
    - **Description:** After the rollout is fully backfilled, monitor CrUX / Vercel Speed Insights p75 LCP over a rolling 28-day window. Also run a manual DevTools check on Moto G Power emulation with Slow 4G throttling.
    - **Acceptance criteria:**
      - p75 field LCP on `/customizing/[slug]` ≤ 2500 ms over 28 days (Req 13.2).
      - p75 field LCP on `/customizing` ≤ 2500 ms over 28 days (Req 13.3).
      - Moto G Power + Slow 4G emulation: LCP element on `/customizing/[slug]` downloads a variant ≤ 800 px wide (Req 13.4).
      - _Requirements: Req 13.2, 13.3, 13.4_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP, but the property tests (3.1–3.6) and the validation runs (4.5, 4.6, 7.2, 7.3) are strongly recommended before the production backfill.
- Tasks flagged **⚠ Requires user approval** (4.4, 7.3, 7.4) touch production config or production data and must pause for an explicit operator OK before running.
- Phase 4 and Phase 6 must ship in the same release. Until both deploy, the manifest-producing webhook and the manifest-consuming renderer are out of phase, but fallback rendering keeps PDPs working in either direction.
- Phase 7 can only start after Phase 4 and Phase 6 are merged and verified on staging.
- Phase 8 is async and requires no code work; it monitors the success criteria from Req 13.
- Every property test cites the specific requirement it validates so a failure points directly at the regression.
- Rollback uses the tiered plan in design §"Rollback" — first nuke `image_variants` to NULL (instant fallback), then disable the webhook, drop the column only as last resort.
