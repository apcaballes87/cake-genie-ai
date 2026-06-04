# Tasks

## Add Branding And Fabric Bow Prompt Guards

### Plan

- [x] Add the non-design branding/watermark/packaging-text exclusion to the fallback prompt.
- [x] Add the fabric bow/ribbon deduplication rule to the fallback prompt.
- [x] Create a new higher-version active Supabase `ai_prompts` row from the existing active prompt; do not overwrite the old row.
- [x] Add focused prompt-text regression checks.
- [x] Run focused verification and document results.

### Review

- Added the branding guard so bakery logos, shop marks, watermarks, labels, social handles, and background/box/board text are ignored unless physically on the edible cake surface as part of the requested cake design.
- Added the fabric bow/ribbon guard so thin fabric, satin, organza, or sheer bows become one `satin_ribbon` item and are not duplicated as fondant bows or fake side wraps.
- Created Supabase `ai_prompts` row `prompt_id = 18`, version `3.9`, from active `prompt_id = 17`; the old row was marked inactive and only one active prompt remains.
- Verification:
  - `npx vitest run src/services/prompts/analysisPromptRules.test.ts` passed with 7 tests.
  - `npx eslint src/services/prompts/analysisPromptRules.test.ts src/services/prompts/promptLoader.ts` passed with only the stale Browserslist notice.
  - Supabase verification shows active `prompt_id = 18`, version `3.9`, with both new prompt guards present.

## Align Backup Cake-Type Prompt With Live DB Prompt

### Plan

- [x] Compare the user's pasted live DB prompt wording against the local prompt sources.
- [x] Add the same Bento visible-container rule to the fallback prompt.
- [x] Add focused prompt-text regression checks.
- [x] Run focused verification and document results.
- [x] Wire the fallback prompt file into analysis routes for Supabase prompt-fetch failures.
- [x] Remove the stale root prompt snapshot.

### Review

- Updated the repo prompt sources only; no Supabase prompt rows were changed in this task.
- `src/services/prompts/fallback-prompt.txt` now includes the same cakeType rule so fallback behavior matches the live DB prompt.
- Added a shared prompt loader so `/api/ai/analyze`, `/api/ai/analyze-url`, and admin search-analysis batch use the active Supabase prompt when available and fall back to `src/services/prompts/fallback-prompt.txt` if the active prompt fetch fails.
- Removed `prompt_v3.8.txt` so the repo has one maintained backup prompt source instead of a stale root snapshot.
- Verification:
  - `npx vitest run src/services/prompts/analysisPromptRules.test.ts src/lib/admin/searchAnalysisBatch.test.ts` passed with 10 tests.
  - `npx eslint src/services/prompts/promptLoader.ts src/services/prompts/analysisPromptRules.test.ts src/app/api/ai/analyze/route.ts src/app/api/ai/analyze-url/route.ts src/lib/admin/searchAnalysisBatch.ts` passed with only the stale Browserslist notice.
  - `npx tsc --noEmit --pretty false` still fails on unrelated pre-existing test typing issues in blog, customizer, robots, commerce, icing/recolor, pricing, and cache tests; no touched fallback-prompt files remain in the TypeScript error list.

## Keep Gemini 3.1 Flash Lite On Low Thinking

### Plan

- [x] Revert Gemini 3.1 Flash Lite text routes from `ThinkingLevel.MINIMAL` back to `ThinkingLevel.LOW`.
- [x] Update AI guidance docs to show `LOW` as the current default.
- [x] Run focused AI route tests and lint.
- [x] Commit and push the scoped correction.

### Review

- Reverted Gemini 3.1 Flash Lite text routes to `ThinkingLevel.LOW` after the minimal-thinking experiment was rejected.
- Updated AI guidance docs to make `LOW` the current default thinking-level example.
- Verification:
  - `npx vitest run src/app/api/ai/validate/route.test.ts` passed with 4 tests.
  - `npx eslint src/lib/admin/searchAnalysisContract.ts src/app/api/ai/analyze/route.ts src/app/api/ai/validate/route.ts src/app/api/ai/validate/route.test.ts` passed with only the stale Browserslist notice.
  - Targeted grep confirms active Gemini 3.1 Flash Lite routes now use `ThinkingLevel.LOW`.

## Switch Gemini 3 Flash Preview To Gemini 3.1 Flash Lite

### Plan

- [x] Replace legacy Gemini 3 Flash Preview call sites with `gemini-3.1-flash-lite-preview`.
- [x] Update tests and task documentation that assert or describe the old model.
- [x] Verify there are no remaining old model references in active code.
- [x] Run focused tests for the touched AI routes.
- [x] Document results here.

### Review

- Updated `/api/ai/analyze`, `/api/ai/analyze-url`, `/api/ai/validate`, `/api/ai/generate-texts`, and one-off scripts that still referenced the old Gemini 3 Flash Preview model.
- Updated validation route tests plus repository AI guidance docs to use `gemini-3.1-flash-lite-preview`.
- Verification:
  - Full-repo grep for the old Gemini 3 Flash Preview model ID returns no matches.
  - `npx vitest run src/app/api/ai/validate/route.test.ts` passed with 4 tests.
  - `npx eslint src/app/api/ai/analyze/route.ts src/app/api/ai/validate/route.ts src/app/api/ai/validate/route.test.ts` passed with only the stale Browserslist notice.
  - Broader targeted ESLint across all touched files still fails on pre-existing `any` / unused-variable lint debt in `scripts/*`, `src/app/api/ai/analyze-url/route.ts`, and `src/app/api/ai/generate-texts/route.ts`.

## Make Pinterest RSS Boards The Primary Publishing Lane

### Plan

- [x] Reuse the collection publication/indexability quality gate for Pinterest board feed eligibility.
- [x] Tighten `/feed/pinterest?board={slug}` so unready collections do not emit RSS items.
- [x] Require `studio_edited_image_url`, prefer stable public image URLs, and suppress malformed or duplicate feed items.
- [x] Update the feed-directory endpoint so operators only see ready feed URLs by default.
- [x] Keep board creation scoped to ready collections instead of every collection row.
- [x] Reword the admin Pinterest surface around RSS-first setup and controlled manual API pushes.
- [x] Run focused tests, lint, and a production build; document results here.

### Review

- Added shared Pinterest feed helpers for collection readiness, feed limit capping, public image URL sanitization, duplicate link suppression, studio-edited-image-only publishing, and tolerant keyword parsing for both array and comma-delimited cache rows.
- `/feed/pinterest?board={slug}` now emits items only for collections that pass the existing published/indexable/8-design quality gate, and `/feed/pinterest/feeds` lists ready feeds separately from skipped collections.
- `/api/pinterest/boards/sync` now creates boards only for Pinterest-ready collections instead of every collection row.
- `/admin/pinterest` now presents RSS auto-publish as the primary workflow and labels API pushes as advanced/manual.
- Verification:
  - `npx vitest run src/lib/pinterest/feed.test.ts` passed with 5 tests.
  - Targeted ESLint passed with one existing `<img>` warning in `PinterestManagerClient.tsx`.
  - `npm run build` passed.
  - Production server route checks on `http://localhost:3004` returned 200 for `/feed/pinterest/feeds`, `/feed/pinterest`, and `/feed/pinterest?board=addams-family-cake`.
  - Runtime XML sample: all-designs feed had 200 items; `addams-family-cake` board feed had 53 items; both included RSS 2.0 and `media:content`.

## Review AI Cake Analysis Prompt, Schema, And Pricing Rules

### Plan

- [x] Review project lessons for AI prompt editing and exact-user-wording constraints.
- [x] Trace the live `/api/ai/analyze` path from upload request through prompt fetch, schema config, post-processing, and frontend consumption.
- [x] Identify where the shared analysis schema is defined and which offline/admin analysis flows reuse it.
- [x] Trace how an accepted analysis is mapped into pricing state and how `pricing_rules` are applied.
- [x] Compare the user's provided image, current prompt, and AI output against the real schema and pricing behavior.
- [x] Propose and implement scoped prompt, schema, and pricing-rule changes.
- [x] Verify with focused tests or a rerun using the supplied case, then document results here.

### Review

- Supplied design: `/customizing/blue-butterfly-white-1-tier-cake-ff3f`.
- Live cache already classified the sheer blue fabric ruffle/bow as `support_elements[0].type = "satin_ribbon"`, but the live pricing rule for `satin_ribbon` was `0`, and local TypeScript/UI enums were missing the support type in several canonical places.
- Added `satin_ribbon` as a first-class support element in local types, pricing enums, customizer display labels, the v3.8 prompt file, and the fallback prompt.
- Updated the active Supabase prompt by adding organza/satin recognition text to the existing prompt row only. No existing prompt text was deleted or replaced from a local file.
- Updated live `pricing_rules.rule_id = 179` for `satin_ribbon` to a flat `100` price, with no size, quantity, tier, cake type, or cake-size multiplier.
- Added migration `supabase/migrations/20260603120000_add_satin_ribbon_pricing.sql` using update-then-insert logic because `pricing_rules.item_key` is not unique on the live table.
- Recalculated the supplied design: base price `1199`, ribbon add-on `100`, total `1299`; updated the cache row price to `1299`.
- Verification:
  - `npx vitest run src/services/pricingService.database.test.ts` passed.
  - `npx eslint src/constants/pricingEnums.ts src/components/TopperCard.tsx src/app/customizing/CustomizingStepSummarySections.tsx src/services/pricingService.database.test.ts` passed with pre-existing warnings only in `CustomizingStepSummarySections.tsx`.
  - Full `npx tsc --noEmit --pretty false` still fails on unrelated pre-existing test typing errors across blog/customizer/robots/image utility tests.

## Add Whole-Head Cake Facial-Part Prompt Guard

### Plan

- [x] Add an additive prompt section near `edible_3d_complex` so dog/cat/human head cakes do not become one large complex gumpaste face item.
- [x] Mirror the core rule in the fallback prompt.
- [x] Update the active Supabase prompt by insertion only, preserving existing prompt text.
- [x] Backfill the stale dog-head cache price after recalculating current pricing.
- [x] Add focused prompt-text regression coverage and verify the live prompt/cache state.

### Review

- Added a `WHOLE HEAD CAKES / ANIMAL FACE CAKES` rule to the v3.8 prompt source and fallback prompt.
- The new rule says whole-head cakes should itemize visible parts, keep piped/flat face details as `icing_decorations`, use `edible_3d_ordinary` for fondant/gumpaste parts like tongue/bow/ears/nose/eyes, and never group eyes + nose + tongue into one `large` gumpaste/complex face item.
- No schema or pricing-rule changes were needed because existing types/rules already cover the correct classification.
- Updated active Supabase prompt `prompt_id = 17` additively; the row now contains the head-cake guard and the description notes that no existing prompt text was removed.
- Recalculated `/customizing/dog-character-white-1-tier-cake-031f`: base `1199`, add-on `100`, total `1299`; updated the cache row price from `1999` to `1299`.

## Research Cebu Long-Tail Cake Keywords

### Plan

- [x] Confirm the available DataForSEO keyword/location tooling and use the closest Cebu-relevant targeting available.
- [x] Generate seed keywords across rush, customization, delivery-app replacement, location, cake type, recipient, occasion, budget, and local-language intent buckets.
- [x] Validate and expand the shortlist with DataForSEO metrics where available, keeping Cebu/local modifiers in the keyword text even if volume is Philippines-level.
- [x] Prioritize high-intent terms for Genie.ph based on urgency, customization, delivery intent, and likely ability to displace GrabFood/Foodpanda/Facebook sellers/traditional cake shops.
- [x] Document the keyword findings, recommended buckets, exclusions, and caveats in this task review.

### Review

- DataForSEO Labs keyword suggestions and Google Ads search-volume calls both returned HTTP 402, so this run could not produce DataForSEO-validated metrics.
- The DataForSEO Labs tools exposed country-only targeting for keyword expansion, while the DataForSEO Google Ads volume tool accepts hierarchical locations like `Cebu City,Central Visayas,Philippines`; the latter was attempted but also hit HTTP 402.
- A fallback Keyword Planner call using `languageConstants/1000` returned seed validation:
  - `money cake cebu`: 110 average monthly searches, LOW competition.
  - `cake delivery cebu`: 70 average monthly searches, HIGH competition.
  - `bento cake cebu`: 50 average monthly searches, LOW competition.
  - `minimalist cake cebu`: 10 average monthly searches.
  - `birthday cake delivery cebu`: 10 average monthly searches, LOW competition.
  - `order cake online cebu`: 10 average monthly searches, HIGH competition.
  - `fondant cake cebu`: 10 average monthly searches.
  - `money cake in cebu city`: 10 average monthly searches, LOW competition.
- Most ultra-long-tail rush, location, recipient, occasion, budget, and Cebuano/Taglish phrases returned zero measured volume in the fallback planner, but they remain useful for high-intent capture in ad groups, internal search-analysis prompts, FAQ/body copy, and conversion-focused page sections.
- SEO caution from prior collection strategy still applies: do not auto-create thin city/neighborhood collection pages from these modifiers. Use local modifiers in copy, internal search, paid search, and only publish indexable pages when they have enough distinct stocked designs and real demand.

## Keep Image Studio Offline Continuation Advancing While Page Is Open

### Plan

- [x] Confirm why the image-studio offline batch can appear to stop even while the page is open.
- [x] Update the client auto-refresh loop so it keeps calling the reconcile/continuation path instead of only reloading the latest batch snapshot.
- [x] Guard against overlapping silent continuation requests.
- [x] Run focused verification on the touched image-studio admin files.

### Review

- Confirmed the stop condition: while the page showed “watching progress,” the auto-refresh loop in `ImageStudioAdminClient` was only calling `loadOfflineBatch()` every 5 seconds, which reloaded status but did not advance the continuation pipeline.
- Updated the auto-refresh loop in `src/app/admin/image-studio/ImageStudioAdminClient.tsx` so an open page now keeps calling the `PATCH /api/admin/image-studio-batch` reconcile path silently, which is the path that actually imports the next chunk and triggers the server-side continuation chain.
- Added an in-flight ref guard so silent continuation calls cannot overlap and stampede the batch API.
- Verification:
  - `npx vitest run src/app/admin/image-studio/offlineBatchExecutionLog.test.ts src/app/api/admin/image-studio-batch/route.test.ts` passed.
  - `npx eslint src/app/admin/image-studio/ImageStudioAdminClient.tsx src/app/admin/image-studio/offlineBatchExecutionLog.ts src/app/admin/image-studio/offlineBatchExecutionLog.test.ts` passed with only the repo's stale Browserslist notice.

## Add Execution Log To Image Studio Offline Batch Panel

### Plan

- [x] Inspect the existing `/admin/image-studio` offline batch UI, continuation flow, and API payloads to find the strongest real progress signals.
- [x] Add a small helper that turns batch state transitions and continuation responses into readable execution-log entries.
- [x] Render an execution log inside the Low-cost offline batch card, including submit, waiting, import progress, stage transition, completion, and error entries.
- [x] Persist the log in session storage so a page refresh does not erase the current run narrative.
- [x] Add focused tests for the new log helper and run targeted verification.

### Review

- Added `src/app/admin/image-studio/offlineBatchExecutionLog.ts` so the UI can convert real offline-batch state transitions into readable execution entries like submit, import start, import progress, mask-stage submission, completion, and paused/error states.
- Updated `src/app/admin/image-studio/ImageStudioAdminClient.tsx` so the Low-cost offline batch card now shows a dedicated Execution log panel, records entries from submit/load/refresh/poll events, and persists the current session log in `sessionStorage`.
- The log uses actual run transitions and reconcile results from the batch APIs rather than static text, so it reflects what the server is really doing as the offline continuation advances.
- Added focused tests in `src/app/admin/image-studio/offlineBatchExecutionLog.test.ts`.
- Verification:
  - `npx vitest run src/app/admin/image-studio/offlineBatchExecutionLog.test.ts src/app/api/admin/image-studio-batch/route.test.ts` passed.
  - `npx eslint src/app/admin/image-studio/ImageStudioAdminClient.tsx src/app/admin/image-studio/offlineBatchExecutionLog.ts src/app/admin/image-studio/offlineBatchExecutionLog.test.ts` passed with only the repo's stale Browserslist notice.

## Clarify Missing GCS IAM For Vertex Batch Runtime

### Plan

- [x] Trace which deployed principal touches the batch bucket in the live server code, separating Vertex's own service agent from the Vercel runtime identity.
- [x] Add a shared Google Cloud Storage error helper that rewrites raw permission denials into actionable batch-runtime guidance with the bucket, principal, permission, and likely IAM role.
- [x] Apply that helper to both offline batch lanes anywhere the app uploads, lists, or downloads GCS batch artifacts.
- [x] Add focused unit coverage for the new error translation so future regressions keep the actionable wording.
- [x] Document the extra bucket IAM requirement in the WIF migration notes and verify the targeted tests still pass.

### Review

- Confirmed the failing principal is the deployed Vercel WIF service account, not only the Vertex AI Platform service agent. Both `src/lib/admin/imageStudioBatch.ts` and `src/lib/admin/searchAnalysisBatch.ts` instantiate `@google-cloud/storage` directly through the shared WIF auth path and call `getFiles({ prefix })` during reconciliation, which requires `storage.objects.list`.
- Added `src/lib/ai/googleCloudErrors.ts` to translate raw Cloud Storage permission denials into actionable runtime guidance that names the bucket, principal, missing permission, and the likely bucket-level IAM role to grant.
- Wrapped the batch JSONL upload, output listing, and output download/list flows in both offline batch helpers so production errors now explain that the Vercel runtime identity needs bucket access in addition to Vertex's own service agent.
- Added focused tests for list, create, and non-GCS error handling in `src/lib/ai/googleCloudErrors.test.ts`.
- Updated `docs/vertex-ai-wif-migration.md` with the deployment-time storage IAM requirement for direct GCS access from the server runtime.
- Verification:
  - `npx vitest run src/lib/ai/googleCloudErrors.test.ts src/lib/admin/imageStudioBatch.test.ts src/lib/admin/searchAnalysisBatch.test.ts` passed.

## Add Offline Gemini Batch Analysis To Search-Based Intake

### Plan

- [x] Preserve `/admin/search-analysis` as the browser-side collector: scrape Google CSE results, resolve the best source URL, fetch and normalize each image, generate the current server fingerprint, and skip existing cache hits before any offline submission.
- [x] Extract the shared `/api/ai/analyze` contract into server-reusable helpers so interactive analysis and offline analysis use the same active `ai_prompts` row, dynamic pricing-rule enums, `SYSTEM_INSTRUCTION`, response schema, temperature, low-thinking configuration, JSON parsing, cake-thickness adjustment, coordinate reset, rejection handling, and `cacheAnalysisResult(...)` persistence path.
- [x] Add dedicated durable search-analysis batch tables rather than attaching pre-analysis rows to `cakegenie_analysis_cache`: one run table for collection/submission/import state and one item table for normalized Supabase source URL, fingerprint, source URL, deterministic queue metadata, provider correlation ordinal, status, retry count, errors, and optional completed cache row id.
- [x] Add an idempotent server intake route that uploads normalized cache misses to Supabase Storage and queues them with a unique fingerprint key. Existing completed cache hits remain ignored, already-queued fingerprints return the existing queue item, and valid completed analyses are never overwritten unless an explicit future force option is added.
- [x] Add a server-side submit route that selects at most 1000 eligible queued/retryable items predictably, writes JSONL under the existing `VERTEX_AI_BATCH_GCS_URI` prefix, stores a stable per-item submission ordinal, and submits `gemini-3.1-flash-image-preview` only after a small live compatibility probe has succeeded.
- [x] Add a server-side reconcile route that refreshes provider state, correlates each JSONL output to its durable item, applies the shared analysis post-processing and rejection rules, persists accepted output through `cacheAnalysisResult(...)`, and marks completed, failed, or retryable items without duplicating writes.
- [x] Make the offline run browser-independent after collection: tab closure may interrupt scraping/intake, but it must not interrupt submitted Vertex processing or later server-side reconciliation.
- [x] Add `/admin/search-analysis` controls for `Batch analyze next 1000` and `Refresh batch status`, plus latest run stage, submitted, completed, failed, and retryable counts. Keep `Single Page` and `Auto (1-10 Pages)` available as the existing sequential lane.
- [x] Add focused tests for eligibility filtering, deterministic ordering, JSONL request construction, output correlation, Supabase persistence options, retry behavior, and duplicate prevention.
- [ ] Run the first small live provider compatibility submission after collecting real cache misses; the submit guard automatically caps the first run at 3 items before permitting a 1000-item run.
- [x] Apply the new migration to live Supabase, verify RLS intentionally, run targeted Vitest, targeted ESLint, and `npm run build`.

### Review

- Added `src/lib/admin/searchAnalysisContract.ts` as the single shared analysis contract for both `/api/ai/analyze` and offline imports. It owns the dynamic response schema, system instruction, temperature, low-thinking config, cake-thickness adjustment, and coordinate reset.
- Added `src/lib/admin/searchAnalysisBatch.ts` and `/api/admin/search-analysis-batch` for idempotent intake, deterministic submit, browser-independent Vertex reconciliation, retryable output handling, and completed cache persistence through the existing `cacheAnalysisResult(...)` helper.
- Added dedicated live Supabase tables `cakegenie_search_analysis_batch_runs` and `cakegenie_search_analysis_batch_items`. Both have RLS enabled and revoke direct `anon` / `authenticated` access; the admin API uses the service-role client.
- Updated `/admin/search-analysis` with `Collect misses for offline batch (1-10 Pages)`, `Batch analyze next 1000`, and `Refresh batch status`. Existing `Single Page` and `Auto (1-10 Pages)` sequential paths remain available.
- The first offline submit is deliberately capped at 3 queued items until a compatibility run completes, because official Vertex documentation does not list `gemini-3.1-flash-image-preview` as a confirmed batch model.
- Verification:
  - `npx vitest run src/lib/admin/searchAnalysisBatch.test.ts src/lib/admin/imageStudioBatch.test.ts src/app/api/ai/validate/route.test.ts` passed with 11 tests after the final helper coverage expansion.
  - Targeted ESLint passed for the new batch helper, tests, API route, shared contract, analysis route, and admin page.
  - `npm run build` passed and includes `/api/admin/search-analysis-batch`.
  - Live Supabase verification confirmed both queue tables, expected columns, RLS enabled, and a successful insert/delete smoke test.
  - The live Vertex compatibility submission remains pending until the admin collector queues real cache-miss images.

## Add One-Button Offline AI Batch Processing For 1000 Cake Cache Rows

### Plan

- [x] Confirm the provider path against current official Google docs: use Gemini Batch API for asynchronous catalog work at the documented 50% batch rate, with JSONL file input for large image-generation batches.
- [x] Add durable batch-run and batch-item schema so a 1000-row submission is resumable, auditable, and safe to retry without duplicating completed purple studio edits or ready icing masks.
- [x] Add a server-side batch submit route that selects up to 1000 eligible `cakegenie_analysis_cache` rows, creates the purple-background requests first, and stores the provider batch job id plus item correlation keys.
- [x] Add a server-side batch reconcile route that imports completed purple-background outputs, runs the existing Sharp/WebP and Supabase persistence logic, then submits icing-mask requests against the completed studio images.
- [x] Move the reusable icing-mask persistence conversion into a server-capable helper so imported mask outputs are losslessly encoded as PNG and written to `cakegenie_icing_masks` without relying on browser Canvas.
- [x] Add admin UI controls on `/admin/image-studio` for one-click submit, progress/status refresh, and retrying failed items while preserving the existing interactive single-item path.
- [x] Add focused tests for the generated JSONL contract and run targeted tests, lint, and a production build.

### Review

- Added `src/lib/admin/imageStudioBatch.ts` as the offline two-stage orchestrator. It submits up to 1000 eligible cache rows to Vertex Gemini batch inference, imports purple studio results into the existing Supabase paths, submits a second mask batch from completed studio images, then imports lossless PNG masks into `cakegenie_icing_masks`.
- Per user direction, both offline stages use `gemini-3.1-flash-image-preview` to match the existing real-time image lane. Google Vertex batch docs do not explicitly list this preview model, so the first small live batch submission is the required provider-compatibility check before running 1000 rows.
- Added `/api/admin/image-studio-batch` with submit, latest-status, and reconcile actions protected by the existing Image Studio admin PIN.
- Extended the existing `cakegenie_image_studio_batch_jobs` model with stage and completion counters, added RLS-enabled `cakegenie_image_studio_batch_items`, and applied the migration to the linked live Supabase project.
- Added the low-cost batch panel to `/admin/image-studio` with `Batch process next 1000` and `Refresh batch status` actions while leaving the existing sequential real-time tool intact.
- Created `gs://cakegenie-ai-batch-project-d823a677/cakegenie-image-studio`, granted the Vertex AI Platform service agent object access, configured `.env.local`, and documented `VERTEX_AI_BATCH_GCS_URI` in `.env.example`.
- Production rollout blocker: the local Vercel CLI has no credentials, so `VERTEX_AI_BATCH_GCS_URI=gs://cakegenie-ai-batch-project-d823a677/cakegenie-image-studio` still needs to be added to the linked Vercel project before deployment.
- Verification:
  - `npx vitest run src/lib/admin/imageStudioBatch.test.ts` passed with 3 tests.
  - `npx eslint src/lib/admin/imageStudioBatch.ts src/lib/admin/imageStudioBatch.test.ts src/lib/supabase/adminServer.ts src/app/api/admin/image-studio-batch/route.ts src/app/admin/image-studio/ImageStudioAdminClient.tsx` passed.
  - `npm run build` passed and included `/api/admin/image-studio-batch`.
  - Live Supabase verification confirmed the extended job columns, the new items table, and RLS enabled on the items table.
  - A real write/delete smoke test passed against the new GCS prefix.

## Add Customizer Hero Loader While Studio Background Edit Is Pending

### Plan

- [x] Document the hero-level pending state off the existing studio-image polling flow instead of reusing the full-screen design-update overlay.
- [x] Pass a dedicated background-edit-pending flag from `src/app/customizing/CustomizingClient.tsx` into `src/app/customizing/CustomizingHeroPanel.tsx`.
- [x] Render a lower-left circular loader on the hero while the AI background-edited studio image is still pending, without blocking hero interactions.
- [x] Add focused regression coverage for the loader visibility and run targeted verification.

### Review

- `src/app/customizing/CustomizingClient.tsx` now derives `isStudioBackgroundEditingPending` from the live upload/studio-image polling state: it only turns on when the current session already has an uploaded preview plus a cache hash, but the studio background-edited image URL has not arrived yet.
- `src/app/customizing/CustomizingHeroPanel.tsx` now accepts that dedicated pending flag and renders a small circular spinner badge at the lower-left of the hero image without replacing the existing full-screen analysis or design-update overlays.
- The loader is pointer-events-free, so it does not block zooming, save actions, or the existing mobile motif button area.
- Added focused regression coverage in `src/app/customizing/CustomizingHeroPanel.test.tsx` to confirm the pending spinner appears when the studio background-edit state is active.
- Verification:
  `npx vitest run src/app/customizing/CustomizingHeroPanel.test.tsx` passed.
  `npx eslint src/app/customizing/CustomizingClient.tsx src/app/customizing/CustomizingHeroPanel.tsx src/app/customizing/CustomizingHeroPanel.test.tsx` completed with warnings only, all pre-existing in these files.

## Fix `/customizing` Studio-Image Icing Recolor Source

### Plan

- [x] Expose the live `cakegenie_analysis_cache` row id from the upload state so fresh `/customizing` uploads can behave like persisted designs before a slug route exists.
- [x] Pass the effective cache row id through the base customizer route so both `useIcingMask` and `useDesignUpdate` attach to the uploaded design row instead of `null`.
- [x] Make the `icing-mask-fallback` design-update path prefer `studio_edited_image_url` bytes over the original upload when the purple studio image is the displayed base.
- [x] Add focused regression coverage for the live cache id exposure and the studio-image fallback source, then verify with targeted tests.

### Review

- `src/contexts/ImageContext.tsx` now tracks a live `currentCacheId` alongside `currentPHash`, clears it on resets/new uploads, populates it from both cache hits and fresh `cacheAnalysisResult(...)` writes, and exposes it through `useImageManagement()`.
- `src/services/supabaseService.ts` now carries cache row ids through `findSimilarAnalysisByHash(...)`, with a follow-up `cakegenie_analysis_cache` lookup when the RPC payload omits `id`, so upload-state cache hits can still attach to the persisted design row.
- `src/app/customizing/CustomizingClient.tsx` now computes `effectiveCacheId = recentSearchDesign?.id || currentCacheId || null` and passes that same id into both `useDesignUpdate` and `useIcingMask`, which unblocks proactive studio-mask regeneration on base `/customizing`.
- `src/hooks/useDesignUpdate.ts` now accepts `studioEditedImageUrl` and, for `source: 'icing-mask-fallback'` only, prefers fetching the studio-edited image bytes when there is no in-memory edited data URI yet. If that fetch fails, it falls back to the original upload bytes.
- Added focused regression coverage in `src/contexts/ImageContext.test.tsx`, `src/hooks/useDesignUpdate.test.ts`, and `src/services/supabaseService.findSimilarAnalysisByHash.test.ts`.
- Verification:
  `npx vitest run src/contexts/ImageContext.test.tsx src/hooks/useDesignUpdate.test.ts src/services/supabaseService.findSimilarAnalysisByHash.test.ts src/hooks/useIcingMask.test.ts src/hooks/useIcingMask.integration.test.ts` passed with 28 tests.
  `npx eslint src/contexts/ImageContext.tsx src/contexts/ImageContext.test.tsx src/hooks/useDesignUpdate.ts src/hooks/useDesignUpdate.test.ts src/services/supabaseService.findSimilarAnalysisByHash.test.ts src/app/customizing/CustomizingClient.tsx` completed with warnings only, all pre-existing.
  `curl -I --max-time 10 http://127.0.0.1:3002/customizing` returned `200 OK`.
- I did not complete a live browser-driven recolor click-through in this run, so the remaining acceptance check is still one manual `/customizing` pass after the purple studio image appears: click an icing swatch and verify the recolor request stays on `studio_edited_image_url`, then hit `Fix Mask` and confirm regeneration still uses the studio image.

## Microsoft Clarity Customizing Page Audit

### Plan

- [x] Pull recent Clarity dashboard data for `https://genie.ph/customizing` and `/customizing/*`, separating broad traffic from friction signals.
- [x] Review relevant session recordings for customizing visitors, prioritizing dead clicks, rage clicks, quick backs, low scroll depth, JavaScript errors, and mobile sessions.
- [x] Cross-check the behavioral signals against the live customizer implementation path in the repo.
- [x] Summarize what is working, red flags, and concrete implementation ideas with a bias toward small, verifiable fixes.

### Review

- Audit window: Microsoft Clarity data from 2026-04-28 through 2026-05-28 UTC for URLs starting with `https://genie.ph/customizing`.
- Traffic is meaningful: 3,243 sessions and 2,871 distinct users reached the customizer route family. The base `/customizing` URL had 838 page views, and traffic is mostly mobile with 2,382 mobile sessions versus 766 PC and 116 tablet sessions in the device query.
- What is working: Google is feeding the customizer heavily, with 1,933 sessions from `www.google.com`; users interact with product options and discovery (`Show More Designs` 296 clicks, `Fondant` 163, `Soft Icing` 130, `Vanilla` 114, `Apply All Changes` 110); and there is a proven cart path, with 38 `Buy This Now` clicks and 81 sessions that reached `/cart` after a customizer visit.
- Measurement red flag: Clarity smart events are under-instrumented. The dashboard showed 13 `Upload`, 0 `AddToCart`, 0 `BeginCheckout`, and 7 `Checkout` smart events even though recordings and click queries show users buying and reaching cart. Current `src/lib/analytics.ts` sends GA4 events only, and the Clarity snippet in `src/app/layout.tsx` is not paired with explicit `window.clarity("event", ...)` calls.
- UX red flag: 299 customizer sessions had dead clicks. The top dead-click texts were blank text, `Original cake design`, `Pink heart-shaped vintage`, `Apply All Changes`, `Customized Cake Design -`, `+ Add a cake message`, `Fondant`, and `Soft Icing`. The repo cross-check points to image/card taps, active variant thumbnails, disabled editor actions, and option controls as the likely friction clusters.
- Performance red flag: customizer LCP is high in Clarity. Exact `/customizing` averaged 6,865 ms LCP, slug pages averaged 6,534 ms, category pages averaged 6,302 ms, and mobile sessions averaged about 4,958 ms page load time. `next.config.ts` has global `images.unoptimized: true`, and the customizer hero uses high-priority unoptimized remote images, so image delivery is the main implementation target.
- Reliability red flag: top JavaScript errors were `Cannot read properties of null (reading 'parentNode')` 25 times, `Script error.` 7 times, React hydration error #418 variants 7 times total, and `Cannot update design: missing original image, icing design, or cake info.` twice. The only local `parentNode` reference found is the Clarity script insertion snippet in `src/app/layout.tsx`.
- Recommended implementation order: first add explicit Clarity event/tag instrumentation to the existing analytics wrapper; second reduce hero/product image LCP with resized CDN-backed derivatives or image optimization; third remove dead-click clusters by making active thumbnails open zoom or lose pointer affordance, adding disabled reasons to `Apply All Changes`, and improving card/button semantics; fourth audit hydration mismatches and guard the Clarity snippet.

## Unblock Studio Image Reveal From ORB Indexing

### Plan

- [x] Trace the live timing from upload through fast analysis, cache write, studio trigger, and studio-image polling to identify which awaited step is delaying the visible studio image.
- [x] Make the shared cache writer return as soon as the cache row is written instead of awaiting ORB feature indexing on the interactive upload path.
- [x] Add a focused regression test that proves `cacheAnalysisResult(...)` resolves even while ORB indexing is still pending.
- [x] Verify with targeted Vitest coverage and summarize the actual latency cause using observed log timing.

### Review

- Root cause: the studio image job was not the only source of delay. In the live dev log, the studio edit started at `00:04:56.634`, the cache row was written at `00:05:10.602`, and the studio job finished at `00:05:14.694`, but the client-side `fastCacheWritePromise` did not resolve until the offline ORB indexing request finally failed at `00:06:06.631` / `00:06:06.771`.
- Because `src/services/supabaseService.ts` awaited `triggerOrbFeatureIndexing(...)` before returning from `cacheAnalysisResult(...)`, the customizer delayed `setCurrentPHash(...)` and therefore delayed the polling loop that watches for `studio_edited_image_url`.
- `src/services/supabaseService.ts` now keeps ORB indexing in the shared cache write flow but runs it fire-and-forget so interactive uploads can continue as soon as the row write is done.
- Added a focused regression test in `src/services/supabaseService.cacheAnalysisResult.test.ts` that intentionally leaves the ORB index request unresolved and proves the cache write still resolves promptly.
- Verification:
  - `npx vitest run src/services/supabaseService.cacheAnalysisResult.test.ts` passed with 6 tests.
  - `npx eslint src/services/supabaseService.cacheAnalysisResult.test.ts` passed.
  - `npx eslint src/services/supabaseService.ts` still hits pre-existing repo-wide lint errors unrelated to this specific latency fix, so I did not treat that as a regression from this change.

## Cut ORB Wait To 2000ms Before pHash Fallback

### Plan

- [x] Confirm the live ORB lookup client currently waits on the browser/network timeout rather than an app-level cutoff.
- [x] Add a 2000ms aborting timeout to the ORB match request so the upload flow falls back to pHash faster when `orb.genie.ph` is slow or offline.
- [x] Add a focused test for the timeout behavior and verify with targeted test/lint runs.

### Review

- `src/services/orbMatchingService.ts` now wraps the ORB `fetch()` in an `AbortController` and aborts it after `2000ms` by default.
- A timed-out ORB request now throws `ORB match timed out after 2000ms`, which the existing `ImageContext` fallback path already treats as an ORB failure and routes into the legacy pHash lookup.
- Added focused coverage in `src/services/orbMatchingService.test.ts` for:
  - the 2000ms timeout path
  - a normal successful ORB cache-hit response
- Verification:
  - `npx vitest run src/services/orbMatchingService.test.ts` passed.
  - `npx eslint src/services/orbMatchingService.ts src/services/orbMatchingService.test.ts` passed.

## Start Image Studio At The Same Time As Fast Cake Analysis

### Plan

- [x] Trace the current no-cache-hit upload flow and confirm whether Image Studio starts at the exact same time as the fast `/api/ai/analyze` pass or only afterward.
- [x] Refactor the studio-edit execution so the no-cache-hit path can trigger Image Studio directly from the uploaded image while the fast cake analysis is still running.
- [x] Keep the existing row-driven admin/manual path intact, and make the direct-from-upload path attach the finished `studio_edited_image_url` once the analysis cache row exists.
- [x] Add focused tests around the new trigger behavior and cache-row retry helper.
- [x] Verify with targeted Vitest coverage plus focused lint on the touched files, and note any pre-existing repo issues separately from this change.

### Review

- Root cause: the previous optimization only moved the first cache write earlier. It still waited for the fast `/api/ai/analyze` response before `cacheAnalysisResult(...)` could trigger Image Studio, so the studio job was parallel with Roboflow enrichment, not with the fast Gemini cake analysis itself.
- Added `src/lib/admin/imageStudioJob.ts` as the shared Image Studio execution helper so both routes can reuse the same Gemini generation, upload, and cache-row persistence logic.
- `src/app/api/ai/trigger-studio-edit/route.ts` now supports two modes:
  - legacy row-driven mode with `{ pHash }`
  - direct-from-upload mode with `{ pHash, originalImage }`
- In the direct-from-upload mode, the background job can synthesize the purple studio image immediately from the uploaded bytes and then retry attaching `studio_edited_image_url` to `cakegenie_analysis_cache` after the fast analysis finishes and writes the row.
- `src/contexts/ImageContext.tsx` now starts the direct studio trigger before awaiting `analyzeCakeFeaturesOnly(...)`, then falls back to the old row-driven trigger only if the parallel trigger request fails.
- `src/app/api/admin/cake-cache-images/route.ts` was reduced back to the admin responsibilities by delegating the heavy studio job work into the shared helper, while keeping the existing admin/manual behavior row-driven.
- Added focused tests in:
  - `src/app/api/ai/trigger-studio-edit/route.test.ts`
  - `src/lib/admin/imageStudioJob.test.ts`
- Verification:
  - `npx vitest run src/app/api/ai/trigger-studio-edit/route.test.ts src/lib/admin/imageStudioJob.test.ts src/services/supabaseService.cacheAnalysisResult.test.ts src/app/customizing/CustomizingHeroPanel.test.tsx src/app/api/ai/edit-image/route.test.ts src/app/api/ai/validate/route.test.ts` passed with 39 tests.
  - `npx eslint src/contexts/ImageContext.tsx src/app/api/ai/trigger-studio-edit/route.ts src/app/api/ai/trigger-studio-edit/route.test.ts src/app/api/admin/cake-cache-images/route.ts src/lib/admin/imageStudioJob.ts src/lib/admin/imageStudioJob.test.ts` completed with warnings only; those warnings are pre-existing in `ImageContext.tsx`.
  - `npx eslint src/services/geminiService.ts` still reports pre-existing `@typescript-eslint/no-explicit-any` errors and unused-import warnings unrelated to this parallelization change.

## Fix Customizer Icing Swatch AI Edit Failures

### Plan

- [x] Reproduce and trace the customizer icing-color failure path, separating pricing warnings from the `/api/ai/edit-image` non-image response.
- [x] Harden the image-edit route so the icing-only fast path can recover when Gemini returns no edited image for a swatch recolor request.
- [x] Add focused tests for the fallback behavior and keep the normal default-model path unchanged.
- [x] Verify with targeted Vitest coverage plus a live local `/api/ai/edit-image` request that the recolor path now returns an image instead of surfacing the 502.

### Review

- Traced the reported failure to the image-edit route's non-image response handling, not the separate pricing-rule console warning.
- Kept the icing-color fast path on `gemini-2.5-flash-image`, but changed `src/app/api/ai/edit-image/route.ts` so color-only edits now:
  - request `TEXT` + `IMAGE` from the fast model,
  - retry once on `gemini-3.1-flash-image-preview` when the fast model returns text or no image bytes,
  - only surface the old 400/502 errors after the stable retry also fails.
- Added a focused regression test in `src/app/api/ai/edit-image/route.test.ts` for the exact empty-response fallback path while preserving the existing default-model expectations.
- Verification:
  - `npx vitest run src/app/api/ai/edit-image/route.test.ts src/services/designService.no-op.test.ts` passed.
  - A live local POST to `http://127.0.0.1:3002/api/ai/edit-image` with `preferredModel: 'gemini-2.5-flash-image'` returned `200 OK` with `image/png` output after the fix.

## Prototype Instant Icing Recolor Lab

### Plan

- [x] Add an isolated test page, likely alongside existing internal tooling such as `/similarity-debugger`, to compare icing-overlay behavior without touching the production customizer flow.
- [x] Simplify the experiment to a single path: upload one cake image, automatically send it to Gemini for the icing-conversion layer, then recolor only the generated top layer locally.
- [ ] Reuse the repo's existing customizer signals and helpers:
  - `useInpaintingStyle` in `src/services/designService.ts` as the future branch point for a non-AI recolor path.
  - `cakegenie_color_variants` and the local color-variant cache in `src/hooks/useDesignUpdate.ts` for persistence and instant replay.
  - `SegmentationOverlay`, `segmentation.ts`, and `maskFiltering.ts` as the starting point for mask visualization and alpha-mask decoding.
- [ ] Build the lab in phases:
  - [x] Phase 1: upload one cake image, auto-generate a red icing layer with Gemini, key out the black pixels, and locally adjust only that layer with HSL sliders.
  - Phase 2: tune the black-key transparency thresholds and generation prompt based on visual quality.
  - Phase 3: automatic mask generation experiments and benchmarking.
  - Phase 4: integrate the winning fast path back into the customizer only after latency and quality pass.
- [x] For the instant renderer, test a client-side Canvas pipeline first:
  - render from a stable base image, not the previously recolored result,
  - key out pitch-black pixels from the generated Gemini layer,
  - recolor only the generated top layer using hue, saturation, and lightness controls,
  - move work to `OffscreenCanvas` or a worker if main-thread jank appears.
- [x] Keep a strict separation between `preview` and `canonical saved asset`:
  - preview should be instant and local,
  - background persistence can save the rendered variant to storage and reuse the existing variant cache.
- [x] Evaluate three mask-generation options before implementation:
  - `Transformers.js` + the `transformers.js-examples` `segment-anything-webgpu` example for interactive browser-side segmentation.
  - `rembg-web` for fast reusable mask sessions and mask-only output experiments.
  - MediaPipe Image Segmenter only if its category-based segmentation proves useful for coarse cake/body masks; it is less likely to separate icing surfaces cleanly on its own.
- [ ] Use current detection/analysis data only as guidance, not as the final mask:
  - existing bounding boxes and `icing_surfaces` / `icing_borders` metadata can refine masks and help exclude toppers, messages, and photos from recolor regions.
- [x] Decide success criteria before building:
  - under 100ms local recolor for repeated clicks on desktop,
  - visually preserves texture, highlights, and shadows,
  - does not recolor toppers/messages accidentally,
  - falls back cleanly to AI or cached variants when masks are missing.

### Review

- Added a no-index internal test route at `src/app/admin/icing-recolor-lab/page.tsx` with a simplified lab client in `src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx`.
- Added `src/lib/icingConversionPrompt.ts` as the dedicated source of truth for the user-provided Gemini icing-conversion prompt.
- Tightened the prompt and lab system instruction so Gemini is explicitly told to preserve the original framing, crop, cake scale, and cake position for better overlay alignment.
- Added `src/lib/icingLayerComposite.ts` as the overlay math helper for:
  - keying out pitch-black pixels from the generated Gemini layer,
  - recoloring only that generated top layer with hue, saturation, and lightness adjustments.
- The lab page now supports:
  - uploading one base cake image,
  - automatically generating the red-icing reference layer with Gemini,
  - placing that generated image over the original as a keyed top layer,
  - making pitch-black generated pixels transparent so only the icing layer remains,
  - adjusting only the generated layer with hue, saturation, and lightness sliders,
  - preview download and lab reset.
- Added focused tests in `src/lib/icingLayerComposite.test.ts` for black transparency keying and HSL-only top-layer recolor.
- Verification:
  - `npx vitest run src/lib/icingLayerComposite.test.ts --exclude '.claude/**'` passed.
  - `npx eslint src/lib/icingLayerComposite.ts src/lib/icingLayerComposite.test.ts src/lib/icingConversionPrompt.ts src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx src/app/admin/icing-recolor-lab/page.tsx` passed.
  - `npm run build` passed and included `/admin/icing-recolor-lab` in the route manifest.
  - Browser verification on the live dev server at `http://127.0.0.1:3002/admin/icing-recolor-lab` confirmed the route renders the simplified upload, generation state, HSL controls, and layered preview flow.

## Make Icing Recolor Lab Prompt Editable

### Plan

- [x] Explain and correct the current lab mismatch where a generation-style prompt is being sent through the image-edit flow.
- [x] Add an editable prompt field to `src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx`, seeded from `src/lib/icingConversionPrompt.ts`.
- [x] Let the user regenerate the Gemini layer with the current prompt against the already uploaded image without re-uploading.
- [x] Update the lab copy so it no longer claims the prompt is fixed when it is editable in-page.
- [x] Run focused verification and record the result here.

### Review

## Confirm Automated Icing Mask Generation After Studio Background Edit

### Plan

- [x] Recheck the `/customizing` and `/customizing/[slug]` mask-generation wiring around `studio_edited_image_url`, effective cache ids, and fallback paths so the runtime verification is anchored to the current code.
- [x] Capture live local evidence from the running customizer flow after the studio background edit completes, focusing on whether mask generation is triggered before the first icing click and whether the source image is the studio-edited URL.
- [x] Summarize whether automated studio-triggered mask generation is confirmed, what proof exists, and any remaining uncertainty or failure path that still needs follow-up.

### Review

- Reconfirmed the active wiring in `src/app/customizing/CustomizingClient.tsx`, `src/hooks/useIcingMask.ts`, `src/hooks/useDesignUpdate.ts`, and `src/contexts/ImageContext.tsx`: `/customizing` now passes `effectiveCacheId = recentSearchDesign?.id || currentCacheId || null`, the proactive `useIcingMask` studio effect runs when `studioEditedImageUrl` and that cache id exist, and the `icing-mask-fallback` edit path only uses the Studio URL when the mask path fails.
- Captured a live base-route run at `http://127.0.0.1:3002/customizing?ref=https%3A%2F%2Fcqmhanqnfybyxezhobkx.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fcakegenie%2Fvariants%2Fwednesday-addams-purple-2-tier-fondant-cake-e783%2F800.webp` with no icing click before verification:
  - `/private/tmp/dev-server.log` showed `POST /api/ai/trigger-studio-edit 200`, then `[Background] Image Studio finished for ff8303c7c7e7e7ff`, then an automatic `/api/ai/edit-image:start` with `requestSource: 'customizing-icing-mask'`, followed by `/api/ai/edit-image:success`.
  - The same log segment did not show an `icing-mask-fallback` request between the Studio completion and that mask-generation request.
- Queried the live persisted rows for `p_hash = 'ff8303c7c7e7e7ff'` and confirmed:
  - `cakegenie_analysis_cache.id = e33d1ff9-e8c0-4bf8-a4ff-7ce4ac04d5bb`
  - `cakegenie_analysis_cache.studio_edited_image_url = https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/admin/image-studio/ff8303c7c7e7e7ff.webp`
  - `cakegenie_icing_masks.source_image_url` for that `cache_id` matches the exact same Studio URL, with `status = 'ready'` and a fresh cache-busted `mask_url`.
- Conclusion: automated mask generation is working after the AI background generation, and the generated mask is being persisted against the `studio_edited_image_url`, not the original upload.

- Root cause: the lab was feeding Gemini a prompt that begins with `Generate a high-contrast studio photograph...` through the normal image-edit route, so Gemini was reasonably re-synthesizing the scene instead of making a tight in-place edit.
- `src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx` now keeps the uploaded image payload in state so the same image can be re-used for repeated prompt experiments without another upload.
- The lab now exposes the current prompt in an in-page editable textarea, seeded from `src/lib/icingConversionPrompt.ts`.
- Added a `Generate Layer` action that re-runs Gemini against the already uploaded image using the current prompt text.
- Added `Reset Prompt` and updated the upload/notes copy so the page accurately describes the prompt as editable instead of fixed.
- Verification:
  - `npx eslint src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx src/lib/icingConversionPrompt.ts` passed.
  - `curl -I --max-time 10 http://127.0.0.1:3002/admin/icing-recolor-lab` returned `200 OK`.
- Browser verification on the live dev server confirmed the page now shows the `Prompt` panel, editable prompt textbox, `Generate Layer` button, and updated explanatory copy.

## Update Icing Recolor Lab Default Prompt

### Plan

- [x] Replace `src/lib/icingConversionPrompt.ts` with the user's latest exact prompt wording.
- [x] Verify the source file contains the new default prompt text.
- [x] Confirm the dev lab route still responds after the prompt-source update.

### Review

- Updated `src/lib/icingConversionPrompt.ts` again with the latest user-provided wording, including the stronger masking guidance for glitter toppers, graphic design toppers, background, and base boards.
- Kept the replacement literal and scoped to the dedicated prompt source file.
- Verification:
  - Source check confirmed the new default prompt text in `src/lib/icingConversionPrompt.ts`.
  - `curl -I --max-time 10 http://127.0.0.1:3002/admin/icing-recolor-lab` returned `200 OK`.
- A fresh lab page load was started after the update so the next clean page refresh can pick up the new default prompt state.

## Match Lab Color Controls To Customizer Swatches

### Plan

- [x] Move the lab color controls below the preview panel.
- [x] Replace the HSL sliders with the same circular color-swatch interaction used in the customizer above the cake options.
- [x] Verify the updated lab route renders with the new control placement and interaction.

### Review

- Moved the layer color controls out of the left column and placed them directly below the preview panel in `src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx`.
- Replaced the freeform HSL slider UI with a customizer-style circle swatch picker driven by the shared `COLORS` list, including a selected color chip and ring treatment that mirrors the existing customizer pattern.
- The lab now maps the selected swatch onto the generated red overlay by converting the target hex color into relative HSL adjustments before compositing the keyed layer.
- Updated the surrounding copy so the page consistently talks about color-circle recolor instead of sliders or HSL controls.
- Verification:
  - `npx eslint src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx` passed.
  - Browser verification on the live dev server confirmed the preview panel renders before the `Layer Color Controls` section and that the controls now appear as circular swatches below the preview.

### Research Notes

- MediaPipe's Image Segmenter is documented as a browser-capable segmentation task, but its listed models are category-oriented and skew toward people/body-part segmentation, so it looks more suitable for coarse foreground masks than precise cake-surface separation.
- Transformers.js supports in-browser segmentation models and the official examples repo includes `segment-anything-webgpu`, which makes it the strongest existing browser-native starting point for a lab page.
- `rembg-web` exposes `Mask Only`, session reuse, and hardware acceleration options including WebGPU/WebNN, which makes it useful for fast repeatable mask experiments even if it may be too coarse for final icing surfaces.
- MDN documents `OffscreenCanvas` and Canvas compositing modes such as `hue`, `color`, and `luminosity`, which are promising for keeping the click path purely software-driven and off the main thread when needed.
- The repo already includes dormant segmentation decode/render helpers and an existing instant cached-variant path, so the cheapest path is to experiment with mask-backed local recolor before inventing a new persistence model.

## Route Icing-Only Edits To Gemini 2.5 Flash Image

### Plan

- [x] Identify the cleanest existing signal for color-only or icing-only edits in the customizer flow.
- [x] Pass an explicit model preference through the interactive edit pipeline for those color-only edits.
- [x] Keep the edit-image API default on Gemini 3.1 while honoring Gemini 2.5 Flash Image for the color-only path.
- [x] Add focused tests and record verification results here.

### Review

- Reused the existing `useInpaintingStyle` detection in `src/services/designService.ts` as the authoritative signal for icing-only or color-only edits.
- `src/services/designService.ts` now passes an explicit preferred model of `gemini-2.5-flash-image` only for the color-only interactive edit path.
- `src/services/geminiService.ts` now forwards that model preference to `/api/ai/edit-image`.
- `src/app/api/ai/edit-image/route.ts` now defaults to `gemini-3.1-flash-image-preview` for normal edits, but switches to `gemini-2.5-flash-image` when the request explicitly prefers the icing-only model.
- The studio restaging/background routes were left unchanged, so the post-analysis studio pipeline still uses Gemini 3.1 image preview.
- `src/app/api/ai/edit-image/route.test.ts` now covers the Gemini 2.5 preference path.
- Verification:
  `npx vitest run src/app/api/ai/edit-image/route.test.ts src/services/designService.no-op.test.ts` passed. Vitest again discovered mirrored `.claude/worktrees/...` copies, and those also passed.
  `npx eslint src/app/api/ai/edit-image/route.ts src/app/api/ai/edit-image/route.test.ts src/services/geminiService.ts src/services/designService.ts` still fails because `src/services/geminiService.ts` already has pre-existing `no-explicit-any` errors and several unused-import warnings unrelated to this model-routing change.

## Use Fastest Safe Gemini Image Response Mode

### Plan

- [x] Confirm the lowest-risk doc-backed latency setting for the repo's pure image routes.
- [x] Update the pure image editing/generation routes to request image-only responses.
- [x] Adjust focused tests to assert the new Gemini config.
- [x] Run focused verification and capture the result here.

### Review

- Updated the repo's pure Gemini image routes to explicitly request image-only outputs instead of the default text-plus-image mode.
- `src/app/api/admin/cake-cache-images/route.ts` now requests `responseModalities: ['IMAGE']` for the background studio-edit pipeline.
- `src/app/api/ai/edit-image/route.ts` now requests `responseModalities: ['IMAGE']` for interactive cake image edits.
- `src/app/api/ai/cold-cake-edit/route.ts` now requests `responseModalities: ['IMAGE']` for edible photo compositing.
- `src/app/api/ai/edit-image/route.test.ts` now asserts the route sends the image-only config to Gemini.
- Verification:
  `npx vitest run src/app/api/ai/edit-image/route.test.ts` passed. Vitest also discovered the mirrored test file under `.claude/worktrees/...`, so both copies passed.
  `npx eslint src/app/api/admin/cake-cache-images/route.ts src/app/api/ai/edit-image/route.ts src/app/api/ai/cold-cake-edit/route.ts src/app/api/ai/edit-image/route.test.ts` still fails because of pre-existing `@typescript-eslint/no-explicit-any` errors and one unused helper warning already present in the touched route files; this latency change did not add new lint errors.

## Add Reusable Branding Compliance Prompt

### Plan

- [x] Review the existing Genie branding rules and turn them into a reusable audit prompt.
- [x] Add the prompt to the repo instruction file so future agents can check any page for branding color compliance.
- [x] Verify the prompt covers backgrounds, text, buttons, accents, semantic colors, and output format.

### Review

- Added a `Branding Compliance Audit Prompt` section to `gemini.md` directly under the landing-page branding rules.
- Structured the prompt so an agent can paste in a URL, route, screenshot, or file path and then evaluate that page against the real Genie palette and shared utilities in `src/app/globals.css`.
- Required the audit output to report verdict, compliant elements, off-brand elements, exact classes/tokens/components involved, recommended fixes, and where to change the code.
- Verification:
  Repo inspection confirmed the prompt is aligned with the previously documented Genie branding rules and references the correct shared theme utilities.

## Document Landing Page Branding Rules

### Plan

- [x] Inspect the homepage and shared theme utilities to identify the actual Genie landing-page palette and styling hierarchy.
- [x] Choose the repo instruction file that should hold persistent design guidance for future agents.
- [x] Add a durable branding and color reminder that explains how to style text, buttons, accents, surfaces, and semantic statuses on landing-style pages.
- [x] Verify the written rule matches the observed homepage implementation and shared CSS tokens.

### Review

- Added a new `Landing Page Branding And Color Rules` section to `gemini.md` so future agents have a persistent reminder without needing the user to restate the same design adjustment.
- Grounded the rule in the real shared theme source of truth from `src/app/globals.css`, including `genie-page-bg`, `genie-btn-primary`, `genie-btn-secondary`, `genie-icon-button`, and the Genie color tokens.
- Captured the observed landing-page pattern from `src/app/LandingClient.tsx` and `src/components/landing/*`: dark neutral text, muted supporting copy, purple as the primary brand accent, pink as a limited supporting accent, and green/blue reserved for semantic delivery or availability states.
- Verification:
  Repo inspection confirmed the guidance matches the current homepage implementation in `src/app/LandingClient.tsx`, `src/components/landing/IntroContent.tsx`, `src/components/landing/HeroTransitionSection.tsx`, `src/components/landing/LandingFooter.tsx`, and `src/app/globals.css`.

## Align Landing Page Reviews Branding

### Plan

- [x] Inspect the landing-page reviews section and identify the profile-circle and button styles that do not match the landing page palette.
- [x] Update the landing-page reviews UI so avatar circles and review-section buttons use the same purple Genie branding system as the rest of the landing page.
- [x] Run a focused verification pass on the touched files and record the result.

### Review

- Updated the homepage reviews CTA in `src/components/seo/HomepageAeoSections.tsx` to use the shared `genie-btn-secondary` treatment so it now matches the landing page's branded secondary buttons.
- Updated the review avatar circles in `src/components/ReviewsDisplay.tsx` to use a softer Genie purple gradient with purple text instead of the previous pink-heavy chip styling.
- Updated both `Recreate Design` buttons in `src/components/ReviewsDisplay.tsx` to use the shared landing-page secondary button styling for consistent borders, hover states, and focus treatment.
- Removed an unused `ThumbsUp` import in `src/components/ReviewsDisplay.tsx` so the touched files verify cleanly.
- Verification:
  `npx eslint src/components/ReviewsDisplay.tsx src/components/seo/HomepageAeoSections.tsx` passed.

## Audit Customizing Social Metadata For SEO Impact

### Plan

- [x] Inspect the dynamic metadata generator for `/customizing/[slug]` and confirm which tags the route emits server-side.
- [x] Compare the live output against current Open Graph, X Cards, and Next.js metadata documentation.
- [x] Record whether the Facebook debugger description affects SEO and note any metadata anomalies that actually need a code change.

### Review

- Confirmed `src/app/customizing/[slug]/page.tsx` emits server-rendered `description`, `og:*`, and `twitter:*` tags from `generateMetadata`, with the slug route setting canonical, robots, OG image dimensions, and Twitter card fields directly.
- Live fetch of `https://genie.ph/customizing/butterfly-princess-lavender-2-tier-cake-1e50` with the `facebookexternalhit/1.1` user-agent returned the expected source tags: `og:title`, `og:description`, `og:url`, `og:image`, `og:image:width`, `og:image:height`, `og:image:alt`, plus standard `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:width`, `twitter:image:height`, and `twitter:image:alt`.
- The odd `og:temporal:twitter:*` labels shown in Facebook Share Debugger do not exist in the page source; they appear to be a debugger-side representation of parsed Twitter/X metadata rather than proof that the site is emitting malformed Open Graph tags.
- SEO conclusion: the Facebook debugger description itself does not directly influence Google rankings. It affects social share previews, while search visibility depends more on the HTML title, standard meta description, canonical, crawlability, page content, and structured data.
- Verification:
  Repo inspection: `src/app/customizing/[slug]/page.tsx`, `src/app/layout.tsx`, and `src/lib/utils/metadata.ts`.
  Live HTML fetch with `facebookexternalhit/1.1` confirmed the exact meta tags rendered in production.
  Official references checked: Open Graph protocol (`ogp.me`), X Cards markup docs (`developer.x.com`), and Next.js `generateMetadata` docs.

## Humanize Homepage Reviews Copy And Remove Container

### Plan

- [x] Inspect the remaining homepage reviews section and identify the copy and layout wrapper to change.
- [x] Replace the heading copy with more natural, customer-friendly SEO text.
- [x] Remove the enclosing container styling and run a focused sanity check.

### Review

- Updated the homepage reviews section in `src/components/seo/HomepageAeoSections.tsx` so the label now reads `Customer Reviews` and the heading/subcopy are more natural for shoppers while still targeting Genie.ph, cake ordering, reviews, and Metro Cebu intent.
- Removed the enclosing card treatment from that section by deleting the old shared container class and leaving the reviews block as an unframed section.
- Verification:
  `npx eslint src/components/seo/HomepageAeoSections.tsx` passed.

## Remove Duplicate Homepage AEO Containers

### Plan

- [x] Confirm which homepage sections duplicate content already present in the footer or elsewhere on the landing page.
- [x] Remove the `What Genie.ph Does`, `Our Services`, `Why Customers Trust Genie.ph`, and `Location and Service Area` containers from the homepage AEO section.
- [x] Run a focused sanity check on the touched files and record the result.

### Review

- Removed the duplicate `What Genie.ph Does`, `Our Services`, `Why Customers Trust Genie.ph`, and `Location and Service Area` containers from `src/components/seo/HomepageAeoSections.tsx`.
- Kept the `Recent Review Excerpts` block in place so the homepage still has one machine-readable review-focused section below the core landing content.
- Simplified `HomepageAeoSections` to accept only `reviews`, and removed the now-unused `reviewSummary` prop from its call site in `src/app/page.tsx`.
- Verification:
  `npx eslint src/components/seo/HomepageAeoSections.tsx src/app/page.tsx` passed.
  `rg` confirmed the removed headings no longer appear in `src/components/seo/HomepageAeoSections.tsx`, and `src/app/page.tsx` no longer passes `reviewSummary` into `HomepageAeoSections`.

## Update Default Social Preview Image

### Plan

- [x] Confirm the current default Open Graph and Twitter preview image sources across shared metadata helpers and page-level fallbacks.
- [x] Replace the old `meta GENIE.jpg` default with the rush-orders Supabase image wherever the site emits default social preview metadata.
- [x] Preserve page-specific social preview overrides that intentionally use another image.
- [x] Run focused metadata tests and reference checks.
- [x] Record the verification results here.

### Review

- Changed the shared default social image to `https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/pages/CUSTOM-CAKES-FOR-RUSH-ORDERS.WEBP` through `genieBusinessProfile.ogImageUrl`.
- Updated the root layout, homepage, shop page, customizing index, customizing category fallback, Mother's Day page, and shared metadata helper to use that shared default instead of the old `meta GENIE` asset.
- Preserved the existing page-specific override support in `buildMarketingPageMetadata`, including the Cebu cake shops page override that already points at its own hero image.
- Removed a small pre-existing lint issue in the touched customizing category page by deleting an unused helper and deriving the category design type from the existing cached fetcher.
- Verification:
  `npx vitest run src/lib/utils/metadata.test.ts src/app/page.metadata.test.tsx 'src/app/customizing/category/[keyword]/page.test.tsx' --exclude '.claude/**'` passed.
  `npx eslint src/lib/seo/genieBusinessProfile.ts src/lib/utils/metadata.ts src/lib/utils/metadata.test.ts src/app/layout.tsx src/app/page.tsx src/app/shop/page.tsx src/app/customizing/page.tsx 'src/app/customizing/category/[keyword]/page.tsx' src/app/mothersdaycakes/page.tsx` passed.
  `npm run build` passed.
  Built-server HTML checks on `/`, `/customizing`, `/shop`, `/mothersdaycakes`, and `/about` showed both `og:image` and `twitter:image` using the new rush-orders image.

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

## Track Fingerprint And ORB Coverage

### Plan

- [x] Add cache-table status fields so fingerprint and ORB indexing health are queryable instead of hidden in logs.
- [x] Tighten active fingerprint generation to use normalized image blobs where the upload flow already has them, reducing avoidable pHash failures.
- [x] Update cache writes and the existing pHash backfill flow to maintain the new fingerprint/ORB status fields.
- [x] Add a dedicated ORB backfill script for rows that are pending or failed indexing.
- [x] Run focused tests plus a full production build and record the verification results.

### Review

- Added `supabase/migrations/20260526112000_add_analysis_cache_coverage_statuses.sql` to track `fingerprint_status`, `fingerprint_error`, `fingerprinted_at`, `orb_index_status`, `orb_index_error`, `orb_index_attempted_at`, and `orb_indexed_at` on `cakegenie_analysis_cache`, with status indexes and a backfill for existing rows.
- Updated `src/services/supabaseService.ts` so the shared cache writer now records fingerprint readiness on every successful cache write and updates ORB indexing state around `/api/index` attempts instead of leaving that state implicit in console logs.
- Tightened active fingerprint generation in `src/contexts/ImageContext.tsx`, `src/hooks/useImageManagement.ts`, `src/components/ChatModal.tsx`, `src/app/admin/bulk-analysis/page.tsx`, and `src/app/admin/search-analysis/page.tsx` so these flows fingerprint the normalized/compressed image blob when available instead of always hashing the noisier source file.
- Updated `src/lib/utils/serverFingerprint.client.ts` to retry the server fingerprint request once and preserve the last error message so callers and logs can distinguish a real hash miss from transport or validation failure.
- Updated `scripts/backfill-server-phashes.ts` so pHash backfills now maintain `fingerprint_status`/`fingerprint_error`, and added `scripts/backfill-orb-index.ts` to retry ORB indexing for rows marked `pending`, `failed`, or `indexing` that still have a source image URL.
- Verification:
  `npx vitest run src/services/supabaseService.cacheAnalysisResult.test.ts --exclude '.claude/**'` passed.
  `npm run build` passed end to end.
  Focused `eslint` on the touched non-`supabaseService.ts` files completed with `0` errors and only pre-existing warnings in `ImageContext.tsx`, `useImageManagement.ts`, and `ChatModal.tsx`.
  Applied the new status schema to the linked Supabase project through MCP, then applied a follow-up reconciliation so existing `cakegenie_image_features` rows marked their parent cache rows `orb_index_status = 'ready'` instead of leaving the full catalog as pending.
  Post-reconciliation live counts were `10,336` ORB-ready rows, `10` ORB-pending rows, and `1` fingerprint-missing-or-failed row before the repair scripts ran.
  `npx tsx scripts/backfill-server-phashes.ts --limit=20 --concurrency=1` repaired `2` rows, aliased `4` duplicate/legacy hashes to canonical rows, and marked `8` rows failed because their source images are broken (`HTTP 400` or empty image buffers).
  `npx tsx scripts/backfill-orb-index.ts --limit=20 --concurrency=2` indexed `2` rows successfully and marked `8` rows failed for the same broken-source-image reasons.
  Final live counts after the repair passes: fingerprint `ready=10334`, `aliased=4`, `failed=8`; ORB `ready=10338`, `failed=8`, `pending=0`.
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

---

## AI Analysis And Purple Background Trace

### Investigation Plan

- [x] Trace the live upload and AI analysis entrypoints from the customizer UI into the server route.
- [x] Inspect how analysis results are normalized, cached, and persisted for later hydration.
- [x] Trace the follow-up AI image edit flow that creates the purple background version, including triggers and storage.
- [x] Summarize the exact end-to-end behavior, dependencies, and side effects in repo-grounded terms.

### Investigation Review

- Started 2026-05-27 to answer how AI cake analysis and the follow-up purple-background image edit work end to end.
- The live upload path is `src/contexts/ImageContext.tsx`: it clears stale image state, base64-encodes the file, compresses it, validates it as a single cake, then prefers ORB cache hits before doing fresh AI analysis.
- Validation runs through `POST /api/ai/validate`; accepted images proceed, while known non-cake or unsupported categories map to user-facing rejection messages before any cached result or analysis is used.
- Fresh analysis runs through `POST /api/ai/analyze` using `gemini-3.1-flash-lite-preview` with a strict JSON schema. The first response is intentionally feature-first with coordinates zeroed out, then Roboflow enrichment runs in the background to add positions later.
- Fresh or enriched results are written into `cakegenie_analysis_cache` with pricing, SEO fields, availability, slug, fingerprint coverage, optional Supabase storage image upload, and ORB indexing metadata via `cacheAnalysisResult(...)`.
- The purple-background image is not produced by the main analysis route itself. It is a separate background “Image Studio” pipeline triggered after cache write, then fulfilled by `POST /api/admin/cake-cache-images`.
- Image Studio re-fetches the saved original image, asks Gemini to restage the cake on a seamless light pastel purple studio background, uploads the resulting WebP to Supabase Storage, and stores the URL in `studio_edited_image_url` plus status fields.
- Downstream UI and search helpers prefer `studio_edited_image_url` over `original_image_url`, so once the background job finishes, cards and known-design hydration naturally start showing the polished purple-background asset.
- Verification for this trace was code-path inspection plus existing route tests for `src/app/api/ai/validate/route.test.ts` and `src/app/api/ai/edit-image/route.test.ts`. I did not run a live upload or live AI generation in this pass.

---

## Concurrent Analysis And Studio Edit

### Implementation Plan

- [x] Persist the fast no-cache-hit analysis result immediately after Gemini returns so the shared cache row exists earlier.
- [x] Let that first cache write trigger Image Studio right away, instead of waiting for Roboflow enrichment to finish.
- [x] Update the later enrichment write so it reuses the same cache row without retriggering the studio-edit pipeline.
- [x] Run focused verification on the touched flow and record any remaining risks.

### Implementation Review

- Started 2026-05-27 to reduce end-to-end time by overlapping fast AI cake analysis and the purple-background studio edit on fresh uploads.
- Updated `src/contexts/ImageContext.tsx` so a fresh no-cache-hit upload now starts the first shared `cacheAnalysisResult(...)` call immediately after the fast Gemini analysis returns, instead of waiting for Roboflow enrichment to finish.
- That first cache write now unlocks the existing Image Studio trigger earlier, so the purple-background job can overlap with background enrichment and any remaining cache persistence work.
- Adjusted the later enrichment write to reuse the same cache row with `triggerStudioEdit: false` and `persistSourceAsset: false`, so it updates analysis fields without retriggering the studio job, re-uploading the source image, or resetting ORB coverage state.
- Extended `cacheAnalysisResult(...)` in `src/services/supabaseService.ts` with `persistSourceAsset` to support metadata-only refresh writes safely.
- Added coverage in `src/services/supabaseService.cacheAnalysisResult.test.ts` to verify that metadata-only refreshes do not reset stored source asset coverage fields.
- Verification:
  `npx vitest run src/services/supabaseService.cacheAnalysisResult.test.ts src/app/api/ai/edit-image/route.test.ts src/app/api/ai/validate/route.test.ts` passed with 21 tests.
  `npx eslint src/contexts/ImageContext.tsx src/services/supabaseService.ts src/services/supabaseService.cacheAnalysisResult.test.ts` still reports pre-existing warnings in `ImageContext.tsx` and pre-existing `no-explicit-any` errors across unrelated parts of `src/services/supabaseService.ts`; no new lint failure was isolated to this change.
  `npx tsc --noEmit --pretty false` still fails on existing unrelated repo errors in test files and other pre-existing areas; no targeted failure specific to this concurrency change surfaced in the focused Vitest run.

---

## Auto Swap To Studio Image

### Implementation Plan

- [x] Add a lightweight client-side studio-image availability fetch path keyed by `p_hash`.
- [x] Poll for `studio_edited_image_url` after fast analysis cache creation on fresh uploads and stop once ready or failed.
- [x] Show the studio image in the hero/floating preview as soon as it is available, with a fade transition instead of a hard swap.
- [x] Run focused verification and record any repo-wide pre-existing failures separately.

### Implementation Review

- Started 2026-05-27 to show `studio_edited_image_url` immediately after the background Image Studio job completes.
- Added `getStudioImageAvailabilityByHash(...)` in `src/services/supabaseService.ts` so the client can cheaply check `studio_edit_status` and `studio_edited_image_url` by `p_hash` without reloading the whole page.
- Updated `src/app/customizing/CustomizingClient.tsx` to keep a `liveStudioEditedImageUrl` in local state, clear it on fresh image selection, seed it from known designs when already available, and poll until Image Studio finishes or reports failure.
- The customizing client now prefers that live studio URL for the hero and floating preview as soon as it appears, so the polished purple-background asset can replace the original upload without waiting for another page navigation or a later hydration pass.
- Simplified `src/app/customizing/CustomizingHeroPanel.tsx` into a layered original-image render: the original image remains underneath while the studio image fades in as an overlay on load, avoiding a jarring hard swap and avoiding effect-driven state churn.
- Added or updated focused coverage in `src/app/customizing/CustomizingHeroPanel.test.tsx` for the preferred-original-image swap path and kept the existing cache-write coverage in `src/services/supabaseService.cacheAnalysisResult.test.ts`.
- Verification:
  `npx vitest run src/app/customizing/CustomizingHeroPanel.test.tsx src/services/supabaseService.cacheAnalysisResult.test.ts src/app/api/ai/edit-image/route.test.ts src/app/api/ai/validate/route.test.ts` passed with 33 tests.
  `npx eslint src/app/customizing/CustomizingClient.tsx src/app/customizing/CustomizingHeroPanel.tsx src/app/customizing/CustomizingHeroPanel.test.tsx` completed with warnings only; the warnings are pre-existing unused imports and hook-dependency warnings in `src/app/customizing/CustomizingClient.tsx`, plus a pre-existing unused `reviewStars` value in `src/app/customizing/CustomizingHeroPanel.tsx`.
  `curl -I --max-time 10 http://127.0.0.1:3002/customizing` returned `200 OK`.
  Browser-plugin visual verification was attempted, but the local Playwright browser session was already locked by another process, so I could not complete an in-browser visual pass from this run.

---

## Review Studio-Triggered Icing Mask Generation

### Review Plan

- [x] Inspect the live diff in `useIcingMask`, `CustomizingClient`, and the related tests.
- [x] Trace the real lifecycle for mount-time hydration, studio-image arrival, recolor clicks, and Fix Mask.
- [x] Re-run the focused Vitest coverage and check whether the new studio-image path is actually covered.
- [x] Record concrete correctness risks and any verification gaps.

### Review

- `src/app/customizing/CustomizingClient.tsx` is directionally correct: wiring `baseImageUrl` to `liveStudioEditedImageUrl || originalImagePreview` is the right base-layer change for compositing.
- The main blocker is in `src/hooks/useIcingMask.ts`: the auto-regeneration effect exits whenever `decodedMaskRef.current` is still null, but that ref is null on initial mount and for designs that never had a mask yet. If `studioEditedImageUrl` is already present at mount, or arrives before the original-mask prefetch settles, the effect returns and never re-runs for that studio URL. On the next color click, the cold path still falls back to `baseImage` (the original upload), so the mask is generated from the wrong image.
- A second correctness risk is persistence/caching: `src/services/icingMaskService.ts` overwrites the same storage object path `icing-masks/{cacheId}/v{maskVersion}.png` and then returns the same public URL. The row upsert is `ON CONFLICT DO NOTHING`, so neither the row key nor the URL changes when a studio-derived mask replaces an original-derived mask. Any browser/CDN cache that keeps the old `v1.png` can continue serving the stale mask immediately after regeneration.
- The hook comments say the studio effect clears the old decoded mask before regenerating, but the implementation only sets `status='generating'`; it does not null `decodedMaskRef.current` up front. That leaves the original decoded mask live in memory during the async regeneration window.
- Focused verification passed with `npx vitest run src/hooks/useIcingMask.test.ts src/hooks/useIcingMask.integration.test.ts`, but those tests do not exercise the new studio-image behavior. The only test updates were adding `studioEditedImageUrl: null` to shared param builders, so the new effect, studio-image fetch path, and stable-URL overwrite path remain untested.

### Fix Plan

- [x] Make the hook treat `studioEditedImageUrl` as the canonical mask source even on mount and first click.
- [x] Prevent stale original-derived masks from being prefetched or reused once a studio image is active.
- [x] Update persisted mask writes so regenerations refresh the row and emit a cache-busted URL.
- [x] Add focused coverage for mount-time studio URLs, cold-click studio generation, and regenerated mask URLs.
- [x] Re-run focused verification and note any remaining manual follow-up.

### Fix Review

- Updated `src/hooks/useIcingMask.ts` so the studio-image effect no longer depends on an already-decoded mask being present. It now checks the persisted row, reuses it only when `source_image_url` already matches the active studio URL, otherwise clears any stale in-memory mask and regenerates from the studio image.
- Hardened the prefetch path so a stale original-derived persisted mask is not decoded into memory once `studioEditedImageUrl` is active.
- Hardened the cold recolor path so if a studio image is displayed but its base64 payload has not been cached yet, the hook fetches and converts the studio image on demand before mask generation. If that studio fetch fails, it no longer silently falls back to generating from the original upload.
- Updated `src/services/icingMaskService.ts` so persisted regenerations upsert the canonical row in place and store a cache-busted `mask_url` query string, preventing stale browser/CDN reuse of the old mask object after the same storage path is overwritten.
- Added focused coverage in:
  - `src/hooks/useIcingMask.test.ts` for mount-time studio auto-generation and cold-click studio-source generation
  - `src/services/icingMaskService.test.ts` for in-place row refresh plus cache-busted regenerated URLs
  - `src/hooks/useIcingMask.integration.test.ts` to align persisted/decode expectations with the new cache-busted URL semantics
- Verification:
  `npx vitest run src/hooks/useIcingMask.test.ts src/hooks/useIcingMask.integration.test.ts src/services/icingMaskService.test.ts` passed with 21 tests.
  `npx eslint src/hooks/useIcingMask.ts src/hooks/useIcingMask.test.ts src/hooks/useIcingMask.integration.test.ts src/services/icingMaskService.ts src/services/icingMaskService.test.ts` passed.
  `curl -I --max-time 10 http://127.0.0.1:3002/customizing` returned `200 OK`.
  I did not complete a browser-driven manual recolor pass in this run, so the remaining recommended follow-up is one live customizer check with a studio-edited image plus `Fix Mask`.

---

## Remove Customizer Color Variant Thumbnails

### Plan

- [x] Find where the generated color-variant thumbnails are still rendered in the customizer UI.
- [x] Remove the thumbnail strip and its now-unused hero-panel/client wiring without disturbing the underlying fallback cache.
- [x] Run focused verification on the touched customizer files and record the result.

### Review

- Removed the hero-level color-variant thumbnail strip from `src/app/customizing/CustomizingHeroPanel.tsx`, including the now-unused `colorVariants` and `onSelectColorVariant` props.
- Removed the corresponding client wiring in `src/app/customizing/CustomizingClient.tsx`, including the thumbnail-selection callback and the now-unused destructured `colorVariants` return value from `useDesignUpdate`.
- Kept the underlying color-variant cache logic in `src/hooks/useDesignUpdate.ts` intact, since it still supports the non-mask fallback path and instant cache hits when that older path is used.
- Verification:
  `npx vitest run src/app/customizing/CustomizingHeroPanel.test.tsx` passed with 12 tests total across the matching hero-panel test files in this workspace.
  `npx eslint src/app/customizing/CustomizingClient.tsx src/app/customizing/CustomizingHeroPanel.tsx` completed with warnings only; the warnings are pre-existing unused imports/hook-dependency warnings in `CustomizingClient.tsx` plus the pre-existing unused `reviewStars` warning in `CustomizingHeroPanel.tsx`.

---

## Fix Customizer Review Summary Drift

### Plan

- [x] Trace the landing-page and `/customizing` review-summary sources, including the hero fallback text and any client refresh guards.
- [x] Replace any hardcoded customizer review summary with the live public reviews aggregate so base and slug customizer routes share the same trust source as the homepage.
- [x] Make the customizer treat server review summary as initial data, not the final truth, so new approved reviews can refresh without waiting for the page's ISR snapshot forever.
- [x] Run focused verification and record the result.

### Review

- The homepage and both customizer entry routes now share the same aggregate builder in `src/lib/reviews.ts`, so there is one source of truth for public review count and average rating math.
- `src/app/customizing/[slug]/page.tsx` no longer ships the frozen `{ total: 6, averageRating: 4.8 }` fallback into the hero/footer/schema path; it fetches the live visible+approved review ratings and falls back only to `{ total: 0, averageRating: 0 }` on fetch failure.
- `src/app/customizing/CustomizingClient.tsx` still accepts the server-provided summary for first paint, but it now always refreshes review stats on mount instead of bailing when an initial summary exists. That means new approved reviews can show up on the customizer without waiting forever on the ISR snapshot that first rendered the page.
- `src/app/customizing/CustomizingHeroPanel.tsx` and `src/app/customizing/CustomizingEmptyLandingState.tsx` no longer display fake `4.8` / `6 Happy Customers` copy when no live summary is available. They now fall back to a generic verified-trust message until real review stats are present.
- Verification:
  `npx vitest run src/lib/reviews.test.ts src/app/customizing/CustomizingHeroPanel.test.tsx` passed with 17 tests.
  `npx eslint src/lib/reviews.ts src/lib/reviews.test.ts src/app/page.tsx src/app/customizing/page.tsx src/app/customizing/CustomizingClient.tsx src/app/customizing/CustomizingHeroPanel.tsx src/app/customizing/CustomizingHeroPanel.test.tsx src/app/customizing/CustomizingEmptyLandingState.tsx` completed with warnings only, all pre-existing in the customizer files.
  `npx eslint 'src/app/customizing/[slug]/page.tsx'` still reports pre-existing `@typescript-eslint/no-explicit-any` errors in that file; the review-summary change did not add new lint errors there.
  `git diff --check -- src/lib/reviews.ts src/lib/reviews.test.ts src/app/page.tsx src/app/customizing/page.tsx 'src/app/customizing/[slug]/page.tsx' src/app/customizing/CustomizingClient.tsx src/app/customizing/CustomizingHeroPanel.tsx src/app/customizing/CustomizingHeroPanel.test.tsx src/app/customizing/CustomizingEmptyLandingState.tsx tasks/todo.md tasks/lessons.md` passed.
# Custom Cake Collection SEO Blueprint

### Plan

- [x] Inspect the current collection schema, collection-page metadata, and studio-image synchronization behavior.
- [x] Audit existing collection slugs so the launch set adds missing intent pages instead of duplicating active collections.
- [x] Research current Philippines keyword signals and Cebu-facing SERP evidence for color, aesthetic, milestone, and recipient cake searches.
- [x] Draft collection-page SEO blueprints with metadata, FAQs, image-matching tags, and an execution playbook.
- [x] Add an idempotent SQL migration for the proposed collection rows.

### Review

- Added `docs/seo/2026-06-02-custom-cake-collection-blueprints.md` with 10 recommended collection pages, copy, meta tags, FAQ content, image synchronization guidance, and deployment steps.
- Added `supabase/migrations/20260602090000_add_custom_cake_merchandising_collections.sql` using `ON CONFLICT (slug) DO UPDATE` so the script is safe to re-run.
- Kept existing `vintage-cake`, `minimalist-cake`, `drip-cake`, `debut-cake`, `anniversary-cake`, `gender-reveal-cake`, `money-cake`, `floral-cake`, `ribbon-cake`, and `lambeth-cake` rows out of the insert set to avoid cannibalizing duplicate collection pages.
- Confirmed the collection route renders visible FAQ blocks and should keep commercial `FAQPage` structured data disabled.

# Programmatic Collection Trend Pipeline

### Plan

- [x] Replace location-cloned collection expansion with visually distinct Cebu-wide storefronts.
- [x] Add publication metadata and strict indexability gates to `cakegenie_collections`.
- [x] Add curated visual-combination collection seeds while preserving existing trend-theme collections.
- [x] Add a protected weekly DataForSEO trend-discovery cron route with a stocking queue.
- [x] Keep thin or draft rows out of `/collections`, storefront rendering, and the sitemap.
- [x] Update the studio-image synchronizer to promote stocked collections after cache verification.
- [x] Add focused tests and document verification limits.

### Review

- Added `supabase/migrations/20260602103000_add_collection_quality_metadata.sql` with `candidate`, `stocking`, `published`, and `retired` lifecycle states plus trend and inventory metadata.
- Revised the uncommitted merchandising migration to add five curated visual combinations: black minimalist, pink vintage, red candy, sage green minimalist, and black-and-gold cakes.
- Added `/api/collections/trends/cron`, protected by `CRON_SECRET`, and scheduled it weekly in `vercel.json`. It uses DataForSEO credentials, rejects generic or duplicate slugs, queues under-stocked topics, and publishes only topics with at least eight priced cache matches and a sample image.
- Updated collection directory queries, storefront behavior, sitemap generation, and `scripts/update-collections-studio-images.ts` so thin stocking rows remain non-indexable until inventory is ready.
- Corrected `docs/seo/2026-06-02-custom-cake-collection-blueprints.md`: visible FAQs remain useful, but commercial collection pages should not add `FAQPage` JSON-LD.
- Verification:
  `npx vitest run src/lib/collections/quality.test.ts src/app/api/collections/trends/cron/route.test.ts src/app/collections/'[category]'/page.test.tsx src/app/sitemap.test.ts` passed with 9 tests.
  `git diff --check` passed before the final documentation update.
  Focused ESLint still reports pre-existing `react-hooks/set-state-in-effect` errors in `src/app/collections/CollectionsClient.tsx`.
  `npx tsc --noEmit` still reports pre-existing repository test-type failures outside this change.

# Initial Trend Collection Research Run

### Plan

- [x] Audit the existing 399 collection slugs to avoid duplicating recent themes.
- [x] Research current entertainment, K-pop, and collectible-toy signals.
- [x] Seed a focused non-indexable stocking queue for missing themes.
- [x] Write a manual `/admin/search-analysis` intake runbook with exact query suggestions.

### Review

- Added `supabase/migrations/20260602113000_seed_initial_trend_collection_stocking_queue.sql` with nine `stocking` rows: KATSEYE, Stray Kids, TWICE, ENHYPEN, aespa, Jellycat, Baby Three, Crybaby, and Twinkle Twinkle.
- Kept all rows non-indexable until manual search-analysis intake and the eight-design synchronizer gate promote them.
- Added `docs/seo/2026-06-02-initial-trend-search-analysis-runbook.md` with exact search queries, execution order, existing-theme refresh suggestions, and research links.
- Removed broad image-matching tags such as `kpop cake`, `blind box cake`, and `pop mart cake` from the seed rows so unrelated cache designs cannot inflate collection coverage.
- Verification:
  `git diff --check` passed.
  The seed migration contains nine unique slugs, all new across the existing migration history.
  `npx vitest run src/lib/collections/quality.test.ts src/app/api/collections/trends/cron/route.test.ts src/app/collections/'[category]'/page.test.tsx src/app/sitemap.test.ts` passed with 9 tests.
  Focused ESLint passed with only the repository's stale Browserslist database notice.

# Fix Live Collection Metadata Schema Drift

### Plan

- [x] Trace the browser error to the exact Supabase select that requests `collection_type`.
- [x] Compare the live `cakegenie_collections` columns against the migration that introduced collection publication metadata.
- [x] Apply the existing idempotent collection metadata migration to the live database.
- [x] Verify the frontend select fields now resolve against Supabase/PostgREST.
- [x] Document what happened and the verification result.

### Review

- Root cause: the current frontend query in `getDesignCategories()` had deployed with collection publication metadata fields, but the live `cakegenie_collections` table was still on the old schema.
- Before the fix, live Supabase only had the old collection columns and was missing `collection_type`, `trend_score`, `publication_status`, `is_indexable`, `matched_design_count`, `studio_image_count`, and `parent_slug`.
- Applied the existing idempotent migration SQL from `supabase/migrations/20260602103000_add_collection_quality_metadata.sql` to live Supabase and sent `NOTIFY pgrst, 'reload schema'`.
- Verification:
  - Live `information_schema.columns` now shows the new metadata columns.
  - The exact browser/Data API field set now succeeds through `/rest/v1/cakegenie_collections` and returns a published collection row with `collection_type = evergreen`.
