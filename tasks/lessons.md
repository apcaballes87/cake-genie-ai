# Lessons

- When a Google Cloud billing screenshot shows a model SKU such as `Text Input Caching Storage`, do not attribute the charge to GCS object storage. Verify the billed product/SKU and project ID separately; Vertex context-cache resources can retain prompt tokens for their TTL even when the GCS batch bucket is nearly empty.

- For paid Vertex batch imports, never delete the output object until database persistence has been verified. If cleanup runs after an import failure, use the bucket's Soft Delete window to recover the exact output before considering an AI resubmission.

- When adding a new hit counter, verify the exact live ledger query and distinguish it from legacy `usage_count`; report the attributed cache row, source, and timestamp so a user can reconcile a just-completed upload.

- When a Prompt Lab exposes editable decoding controls, the server must validate supported ranges and forward the accepted values through every lab generation path. A fixed default is an initial state, not a rejection rule for every experiment.

- For cake prompt patches, register every precedence-bearing rule in one OUTPUT ORDER list and cross-reference its step. Audit upstream rejection/membership gates, downstream enum and pricing contracts, and repeated summaries together; a local wording fix can otherwise remain unreachable or contradictory. Keep thickness ownership in one paragraph and geometry-field names distinct from real-world size estimates.

- When Computer Use is requested for local configuration, first check the available terminal/host tools. If macOS Terminal UI is blocked by Computer Use safety restrictions, continue through the approved workspace shell or host connection instead of treating the UI restriction as the task blocker.

- When repeated-item bboxes are too large, treat it as a generic representative-unit contract failure, not a type-specific lollipop problem. The bbox rule must apply uniformly to every repeated main/support row, and local sizing should continue to calculate from whatever bbox is emitted rather than adding isolated type exceptions.

- For piped flowers, decide fulfillment scope before applying repeated-item geometry: a cohesive piped cluster is one coverage-priced row with quantity one and one cluster BBox, while independently placed piped blooms are `icing_decorations` with counted, local unit boxes. Never let a cluster BBox determine its coverage price.

- When local cake sizing corrects high-angle geometry, preserve the AI-emitted measurement endpoints for the overlay and apply the effective height only inside the shared calculation. Use the same effective geometry for both eligible single-body `cakeThickness` inference and topper reference area, while leaving fixed-height and multi-tier types on their existing rules.

- When the bbox reference-area formula changes, keep physical cake-height selection separate from topper/support sizing. Use diameter width squared for the stable area reference and add a regression proving that changing the height-line length cannot change the resulting size band.

- When a feature is paused, hide its visible status indicator at the specific active render seam instead of removing unrelated loading states. For cake analysis speed changes, update both the helper default and shared request config so direct and batch calls send the same provider thinking level.

- When hiding analysis visuals for a storefront request, add an explicit display-only overlay flag. Keep the validated geometry and detected-element boxes available so sizing, persistence, and admin review are unaffected.

- When a repeated analysis row drives bbox-area pricing, define `box_2d` as one representative visible unit in both the response schema description and the highest-precedence generation instruction. Name multiple concrete repeated families so the rule applies uniformly instead of being read as a gemstone-only exception.

- When repeated geometry has legitimate region-level treatments, separate discrete-unit and aggregate-treatment scope explicitly. Use a bounded type allowlist and preserve existing fulfillment quantity rules; never let “hard to count” alone turn a countable cluster into a full-region box.

- When one grouped row needs per-unit geometry, keep the row-level quantity and priceable size for compatibility but return a bounded box/confidence collection: exactly min(quantity, 5) for discrete units, one regional box for aggregate treatments, and preserve a reader for historical singular boxes.

- After changing Vercel environment variables, verify the deployed function's raw provider resource and redeploy before diagnosing Google IAM. The dashboard can show corrected values while the live deployment still uses its previous environment snapshot.

- When a cake-analysis description/type mismatch can be corrected at the existing strict post-processing seam, prefer a narrow primary-object reconciliation table over redesigning the whole taxonomy. Split secondary garnish phrases first, preserve composite descriptions, and leave ambiguous rows unchanged.

- When a Google OAuth flow is supposed to return to a specific page, do not rely only on the callback query parameter. Persist the validated internal destination before leaving the browser and add a post-auth recovery path for providers or callbacks that drop `next`.

- When a public Shopify upload still fails after switching to an existing bucket, do not assume a broad `public` storage policy is actually the effective client path. Verify the exact project, bucket, policy, and anonymous REST upload with the same public key, then provision a dedicated bucket/policy contract for the integration.

- When a Vercel build reports a type mismatch that the current local tree does not reproduce, do not assume the deploy log is wrong and do not patch only the call site blindly. Check the full API seam and prefer a compatibility-safe contract at the shared boundary, then rerun `npm run build`.
- For follow-up UI requests on `/price-list`, do not stop at generic cards if the user points to `/customizing` selectors. Reuse the real customizer interaction model and assets for icing base, cake shape, size, and height whenever the page is meant to feel like an extension of the customizer.
- When the user points to a specific CTA on landing or customizer, copy that CTA literally instead of rewriting the text into a more specific variant. For this repo, `Upload your design` on `/customizing#upload` should stay verbatim when the user asks for the same CTA.
- When the user says to use the landing-page CTA, match the landing CTA's behavior, not just the styling or a nearby upload link. In this repo the homepage hero CTA opens the landing uploader modal, so cross-page reuse should target that same flow (for example `/?upload=1`) rather than `/customizing#upload`.
- For `/price-list`, do not show soft-icing and fondant variants as duplicate cake-type cards. Combine matching shapes/tier counts into one card, then expose icing/finish as an in-card toggle so users compare prices without scanning redundant sections.
- For `/price-list` mobile cards, avoid fixed-width circle rows inside cake-type sections. The size/price options need a responsive grid or smaller mobile dimensions; otherwise cards like `1 Tier`, `2 Tier`, and `3 Tier` overflow to the right.
- For `/price-list` discount messaging, do not hardcode a visual markdown from the presence of a saved code alone. Reuse the shared discount validator per base amount so minimum-order, fixed-amount, max-cap, and account-restriction rules stay consistent with cart.
- When adding `useSearchParams()` to a shared client like `LandingClient`, audit every static marketing page that renders it and wrap those call sites in `Suspense`. A homepage-only check is not enough; prerender can fail later on routes like `/kids-party-cakes-cebu` or `/mothersdaycakes`.
- For customizer AI chat section polish, do not wrap the AI chat controls in a `genie-card`/white card container. Let the controls render directly in the customization flow unless the user explicitly asks for a framed section.
- For customizer AI chat thickness tuning, the preferred compact scale is about `41px` outer height: upload and field `41px`, textarea `39px`, and inset send button `33px`. Do not drift back to the thicker `48px` composer unless explicitly requested.
- For customizer AI chat placeholder wrapping, keep the field text at `12px` before changing control width or send-button spacing; the desktop icing-color placeholder fits one line at that size, and autocomplete prompts should use compact `12px` rows with tighter padding.
- For customizer composer sizing corrections, prioritize rendered box measurements over class-name intent. A bordered wrapper with an inline textarea can render taller than the upload button even when both declare matching Tailwind heights; make the textarea `block` and account for the wrapper border when matching visible control height.
- For customizer composer polish, use a fixed default control scale rather than chasing screenshots with raw Tailwind swaps: upload button and text field should share the same base height, the send button should be materially smaller inside the field, and textarea autosize should preserve the one-line height until real wrapping/newlines occur.
- Do not make an input larger to make an oversized embedded button fit. For the customizer AI chat, preserve the compact field height first, then reduce the send button and adjust inner padding so the button fits inside the existing text field.
- For the customizer AI chat composer, matching raw heights is not enough if the textarea and send button do not share the same visual container. Put the send button inside the field wrapper itself so the control reads as one input by default.
- For the customizer AI chat, treat plain `Enter` as textarea newline behavior unless the user explicitly asks for chat-style submit-on-enter. Suggestion navigation and submission shortcuts should not silently override multiline editing expectations.
- For the `/customizing` mobile hero, do not force every image through the scrollable pan treatment. Compare the source aspect ratio against the fixed mobile hero frame first, and use a cover-fill render path for wider images so the frame cannot show bottom whitespace.
- When recalculating `cakegenie_analysis_cache.price`, never default a missing base-price lookup to `0` and continue writing. Normalize raw `analysis_json.cakeType` to a canonical `CakeType`, and if no `productsizes_cakegenie` row exists after normalization, skip or fail that row loudly instead of corrupting the stored total.
- When the user narrows a broad customizer strategy from “CRO plus agent readiness” down to “agent readiness only,” drop the conversion redesign scope completely. Keep the implementation centered on semantics, accessibility, and machine-readable state instead of sneaking UX optimization work back in.
- When retiring an older SEO surface in Genie.ph, do not stop at `robots` or sitemap changes alone. Also check first-party discovery surfaces like `/customizing` theme chips and JSON-LD item lists so the deprecated hub is not still being promoted internally.

- Cupcake-only uploads are accepted cake designs in the current analyzer. Do not explain cupcake analysis problems through a `cupcakes_only` rejection path; inspect the active schema/prompt contract for missing accepted-output fields instead.
- For Pinterest feeds and catalog exports, do not trust raw design slugs as reader-facing titles. Strip trailing short hash-like slug suffixes such as `30e2` so Pinterest sees clean product names instead of internal uniqueness tokens.
- When explaining pipeline timing in the customizer upload flow, distinguish exactly between "starts at the same time as fast `/api/ai/analyze`" and "starts immediately after fast analysis" or "runs in parallel with enrichment." In this repo, those are materially different behaviors and the user will care about the latency distinction.
- For fresh `/customizing` uploads, do not infer studio-edit start time from the client fetch being created. Verify when `studio_edit_status = processing` is actually persisted; if the cache row does not exist yet, the visible studio job can appear to start only after analysis/cache write even if `/api/ai/trigger-studio-edit` was called earlier.
- When a user reports a missing side effect in the upload flow, verify the active production path first. In this repo, `ImageContext` is the live customizer upload path, while older hooks may still contain logic that looks correct but is not authoritative.
- For ORB indexing, keep the trigger in the shared cache write flow instead of only in one UI caller. That prevents fresh AI analyses from being cached without `cakegenie_image_features` when different upload surfaces reuse the same backend write helper.
- When a server route needs to wrap a Node `Buffer` in a `Blob` for shared helpers, convert it to `Uint8Array.from(buffer)` first. Next 16 / TypeScript can reject `Buffer` as a direct `BlobPart` in production builds even when local edits look fine.
- When a change touches build-time data paths, verify with a full `npm run build`, not just type checks or focused tests. In this repo, prerender can surface extra production-only issues like missing live-schema columns or Supabase RPC timeouts.
- When expanding content inside the desktop customizer's sticky right-column scroller, do not rely on `scrollIntoView({ block: 'nearest' })` alone. In this layout it can expand the section while leaving the actual cards clipped below the visible area, so scroll the real overflow parent to the advanced section's first visible card instead.
- For the desktop customizer's sticky right-column scroller, do not rely only on a window-level wheel redirect. When the cursor is hovering the sidebar itself, attach direct wheel ownership to that scroll container so advanced expansion does not fall back to whole-page scrolling before the sidebar reaches its own top or bottom edge.
- For Cebu cake shop comparison content, include Cakes and Memories Bakeshop in the core competitive set when discussing custom birthday cakes, themed cakes, affordable moist chocolate cakes, simple occasions, or short 2-3 day rush lead times. Do not let broader SEO lists omit the user's known local source of truth.
- In Cebu cake shop comparison content, avoid positioning Chedz too close to Cakes and Memories. Keep Cakes and Memories focused on affordable custom birthday and themed cakes, while Chedz should be framed around weddings, premium celebration cakes, and its long-standing Cebu bakeshop reputation.
- For the `/best-cake-shops-cebu` top 10 set, use Tamp Cafe & Co. instead of Treat Street Cafe when the page needs a cafe-cake and dine-in celebration option with multiple Cebu branches.
- For evergreen comparison pages like `/best-cake-shops-cebu`, do not leave hidden ranking cues in place after the user asks to remove rankings. Remove both the visible ranking copy and the underlying rank-based anchors/schema semantics so the page reads consistently as a guide rather than a leaderboard.
- When a committed file imports a new local helper or test utility, always confirm the helper file itself is tracked before pushing. In this repo, `git diff` on only modified files can hide untracked dependencies that will break Vercel with `Module not found`.
- When handing the user a localhost route for manual testing, do not stop at “the page rendered during verification.” Leave a reachable local server running and give the exact full URL with port, otherwise `127.0.0.1` can fail even though the feature itself is implemented correctly.
- When the user gives exact prompt wording for an AI workflow, store that text as a dedicated source of truth and preserve it verbatim instead of paraphrasing it into a broader generic prompt.
- When the user replaces a prompt with exact new wording, update only the named prompt source unless they explicitly ask to also change supporting system instructions or UI copy. Keep the replacement literal and scoped.
- When changing the live `ai_prompts` prompt in Supabase, never overwrite the current active row in place. Create a new row with a higher version and make that new row active, preserving prior prompt versions for rollback/history.
- For internal AI experiment pages, do not hide the active prompt only in source files when the prompt itself is the main tuning surface. Expose it in the UI and let the user rerun against the same input without another upload.
- When the user asks an internal lab or customizer surface to match an existing product control, inspect and reuse that real UI pattern instead of leaving behind generic controls like sliders.
- For internal experiment pages, start with the minimum click path that directly tests the hypothesis. Avoid adding multi-step manual tooling when the user is really trying to validate one simple end-to-end interaction.
- When debugging `/customizing` versus `/customizing/[slug]`, do not assume `recentSearchDesign` exists on the base route. Fresh uploads rely on `ImageContext` state like `currentCacheId`, so route-specific bugs can hide behind correct slug-route behavior.
- For homepage-style trust badges, do not leave separate hardcoded review numbers on customizer surfaces or skip client refresh just because SSR passed an initial summary. In this repo, review counts change over time, so the homepage and customizer must share the same live aggregate source and treat SSR values as a starting point rather than a permanent truth.
- For offline Vertex batches, distinguish the provider submission size from the server-side import chunk size in both implementation and UI copy. A single 1,000-item AI batch can still require bounded resumable imports to stay within Vercel function limits, and those imports should advance automatically instead of requiring repeated button clicks.
- For resumable Vertex batch runs, treat each persisted GCS input/output URI as the source of truth. Historical runs may use either `gs://bucket/run-id/output` or `gs://bucket/prefix/run-id/output`; stage-transition code must support both instead of requiring a non-empty configured prefix.
- For Genie AI cake analysis, keep Gemini 3.1 Flash Lite on `ThinkingLevel.MEDIUM` unless the user explicitly requests another experiment. Do not infer "faster" means `MINIMAL` or `LOW` should become the committed default.

- When auditing `/api/ai/analyze` classification mistakes, do not blame generated slugs, links, SEO titles, or post-analysis metadata as model inputs. The analyzer receives the image plus prompt; slug/link generation happens after analysis. Diagnose prompt/image/schema/pricing from the actual model inputs first.
- When batch search-analysis output describes a different image than `original_image_url`, treat it as a possible output-correlation/import bug before blaming model hallucination. Vertex batch output order is not stable; import must correlate by echoed request image URI, and the database must have every submitted item mapped to the run before the provider job is submitted.
- When the user manually changes the live `ai_prompts` database prompt, also check whether the repo hardcoded prompt and fallback prompt need the same wording so local/backup behavior does not drift from production.
- Do not keep multiple local cake-analysis prompt snapshots unless each has a real runtime purpose. Prefer one maintained `fallback-prompt.txt` file and wire it into the failure path if it is called a fallback.
- When moving a legacy AI analysis type out of a pricing category, preserve local enum/display compatibility for stale cached rows while changing the pricing source of truth. For example, `edible_photo_print` can remain accepted as a legacy main topper type while pricing rules treat it as a support element going forward.
- When tightening Supabase prompt-loader types, check every route that passes a typed Supabase client into the shared loader before pushing. In this repo, both `/api/ai/analyze` and `/api/ai/analyze-url` can hit Next/TypeScript "excessively deep" type instantiation unless the shared prompt-loader client type is reached through a narrow cast.
- When the user explicitly points to a Codex app feature or docs page, switch the task to that product surface immediately. Do not keep answering at the app-usage or vendor-policy level once they clarify they want Codex automations, threads, or other app-native workflow setup.
- For variable-height customizer message fields, top-align adjacent fixed-height controls. Center alignment makes dropdowns and actions drift downward as soon as the textarea expands to two lines.
- For screenshot-driven spacing requests, calculate the combined inter-row gap from both row padding and parent stack spacing; changing only one makes the visible reduction too small.
- When sanitizing customer-facing AI provider errors in the customizer, audit every renderer that receives the combined `error` value, especially `CustomizingHeroPanel`, the sidebar/mobile error card, and the sticky action bar. Fixing only `analysisError` cards can still leak raw Vertex or Workload Identity details over the hero image.
- When rewriting an existing Supabase RPC, preserve the established parameter/type compatibility at every predicate, not just the function signature. In this repo, `create_split_order_from_cart` still accepts `p_cart_item_ids text[]`, so `cakegenie_cart.cart_item_id` comparisons must keep the `::text` cast or checkout will fail at runtime with `operator does not exist: uuid = text`.
- When the user responds to a recommendation list with item-by-item approvals and rejects, implement only the approved items and leave the rejected ones untouched. Do not quietly bundle nearby CRO changes just because they seem related.
- When checking whether a cached cake-analysis type defaults correctly in `/customizing`, trace both the persisted `analysis_json` and `mapAnalysisToState` hydration. A correct DB/cache type can still be silently changed before the customizer UI renders.
- When the user asks to fix only stored image dimensions, keep the scope strictly on dimension re-measurement and backfill. Do not escalate to AI/Vertex regeneration unless they explicitly ask to repair the generated asset itself.
- When a user points out that the rejection rule already exists in the active cake-analysis prompt, do not describe the issue as a missing prompt rule. Separate prompt presence from enforcement: verify the production prompt row/version, model output, and cache-hit path before concluding why an upload was accepted.
# Lesson: Verify every route-specific render seam for shared UI requests

- When the user specifies physical cake height from image aspect ratio, keep the measured geometry line separate from the application-owned height band. Resolve overlapping thresholds explicitly: at exactly 1.2, the <=1.2 rule selects 6 inches.

- When a user reports an unwanted upload-side image transformation, disable the trigger at every active seam: the landing upload coordinator, the shared cache-write fallback, and the trigger endpoint. Stopping only the visible client request still permits background or alternate upload paths to create an edited asset.

- When adding a visible CTA to a route family, inspect both the base route and dynamic slug route before concluding the UI is covered. A shared-looking section may be rendered by separate components, and a condition such as `!slug && analysisResult` can make a valid component change invisible on the route users actually visit.
# Lesson: Keep background AI fallback states silent when the original experience remains usable

- When a background enhancement fails but the original asset is still valid, stop the loading state and preserve the fallback silently. Do not surface provider or pipeline availability copy unless the user must take action.

# Lesson: Put shared mobile presentation rules at the global page seam

- When a mobile visual rule is intended to apply across the site, verify representative static, interactive, search, commerce, and dynamic routes before choosing a component-local wrapper. A route-local zoom can make one page look right while every other page stays at the default scale; use the global `body` mobile breakpoint and confirm fixed UI plus desktop behavior separately.

# Lesson: Separate live prompt state from a proposed migration version

- When discussing an un-applied AI prompt release, state the current live version first and describe the higher version only as proposed/local. Never let a proposed migration version read as if it were active in production.

# Lesson: Gate public cake discovery on publication readiness, not cache existence

- When separating delayed SEO from cake analysis, keep `cakegenie_analysis_cache` as the public catalog source. Gate Trending, search, product pages, feeds, and sitemaps on the shared published state that represents the 48-hour delay plus completed title, description, and alt text; do not remove fresh cache records from uploader pricing or customization.

# Lesson: Measure cake height from the front rim

- For cake measurement overlays, the height line must start on the lower/closer arc of the visible top ellipse—the near/front rim where the top surface transitions into the front-facing wall—and end at the near/front lower rim, not the highest pixel, rear arc, board, or plate. Preserve the model's endpoint coordinates and allow perspective-slanted diameter and height lines; keep topper boxes independent of cake measurements.

# Lesson: Keep local bbox sizing separate from historical AI size semantics

- When moving cake-element sizing from AI to local geometry, use a new persisted sizing marker and preserve unmarked or prior three-band cache rows. Apply the local calculator only after all required geometry is present, and never use an AI size fallback for a fresh result when local sizing is the source of truth.

# Lesson: Include explicit runtime and deployment blockers in operational prompts

- When writing a runbook prompt for a service, state both whether runtime tests actually ran and which dependencies prevented them from running. Also distinguish a migration file being created from the migration being applied, and name required matching server secrets such as `ORB_INTERNAL_SECRET` on every deployment side.

# Lesson: Verify bundled WASM through the real Next.js route

- A server-only WASM unit test can pass while the Next.js bundle cannot locate its binary asset. Externalize the package when required by its runtime loader and smoke-test the actual HTTP route before treating the deployment path as verified.
# Lesson: Validate crop robustness with real same-design assets

When perceptual-hash distances look implausibly high, test the exact original
assets and their controlled variants before changing the threshold. A small
synthetic fixture can look healthy while real same-cake framing differences
produce distances around `78` to `108`; normalization experiments must be
compared on the same pipeline and must include visually similar hard negatives.

# Lesson: Score cake inventory by identity and location, not total alone

For cake-analysis gold fixtures, compare model observations to adjudicated object centers and identities before treating an exact total as accuracy. A model can miss one visible flower and duplicate another while preserving the same total count. Report exact-instance and grouping agreement separately from total-count agreement, and keep invalid geometry from improving apparent variance by reducing the number of assembled outputs.

# Lesson: Exercise real observation variants before calling localhost usable

A single successful cake fixture does not establish that a new private observation contract is usable from the browser. Replay mismatched-but-decisive structured evidence and realistic perspective-slanted measurement lines through the API route before handing off localhost. Treat construction evidence as authoritative for deterministic fallback mapping, and validate whether a line crosses the intended object with a practical geometric tolerance instead of requiring exact horizontal coordinates from a vision model.

# Lesson: Do not add deferred or role-conflicting support types

- A type mentioned in a patch list is not ready for the generated support enum until its role, runtime validation, display mapping, and pricing rule all agree. If readable content already belongs exclusively to `cake_messages`, keep it out of support types. If a product add-on has no approved pricing contract, preserve any required cake-type classification but omit the add-on and decorations exclusive to it from emitted item rows.

# Lesson: Put pricing next to the analyzed item it explains

- In internal analysis tools, show an item’s calculated add-on in that item’s own topper or support card. Keep base price, total, and size-option context inside the analysis summary instead of duplicating a separate final-price panel.

# Lesson: Do not present invalid raw analysis as a zero-item result

- When a provider JSON payload reaches the lab but fails the shared storefront contract, expose the exact validation reason and raw inventory separately. Do not render raw items as validated cards, show zero counts as if analysis succeeded, or allow missing-price metadata to crash the display.

# Lesson: Keep run controls and run status together

- On an internal test surface, put execution status and metadata directly beneath the settings that produced them. Leave detailed output cards in their existing result area so the input-to-output layout remains clear.

# Lesson: Label production-equivalent and experimental AI runs honestly

- A lab can use the production runner without writing customer state. When an active prompt is unchanged, call the runtime loader rather than replaying copied text; label edited prompts, staged versions, sizing presets, and alternate models as experiments. State any remaining privacy-driven difference, such as disabled prompt-cache writes.

# Lesson: Keep diagnostic geometry beside the analyzed item

- When a raw AI response reports per-item coordinates, do not duplicate the same measurements in a separate top-level `items` list and inside `main_toppers` or `support_elements`. Keep only shared geometry such as the cake-top diameter at the top level, and put each item measurement array on its owning analysis row so the response has one source of truth.

# Lesson: Use one preview and return real box geometry

- When the user asks for one image preview, render the grid and diagnostics in the Test image only; do not also show a server-generated grid image in the results column. If the user asks to see box coordinates, return a per-item grid `bbox` with top-left and bottom-right points instead of drawing only a vertical height line.

# Lesson: Localize grid geometry separately from cake classification

- Do not ask one vision response to classify, count, map storefront rows, and place pricing-critical grid geometry at the same time. Freeze the accepted row manifest first, then use an image-only coordinate pass that measures the physical top-tier cross-section and one tight representative unit per row. Reject reversed boxes and non-horizontal/non-vertical cake spans before local area sizing runs.

# Lesson: Preserve the requested image transform in the named analysis path

- If a user specifies `original image → grid overlay → one-pass cake analysis`, do not optimize that analysis call back to the unmodified image. The grid must be visible to every vision call that is expected to estimate grid coordinates; a later refinement pass may use the same overlay, but cannot replace the requested overlay-aware one-pass analysis.

# Lesson: Normalize interchangeable vision-box corners before rejecting output

- A vision model may provide the two opposite rectangle corners in reverse order even when both coordinates are valid. Canonicalize them with per-axis min/max before grid snapping and sizing; reject only zero-width or zero-height boxes. Do not discard an otherwise valid storefront analysis for recoverable corner ordering.

# Lesson: Insert app-derived sizing before strict storefront validation

- When a grid response schema intentionally removes model-provided `size`, calculate the bbox-area ratio and insert the app-derived category into every size-bearing row before calling the storefront validator. The post-validation pass may reconcile types and reapply the same geometry, but it cannot be the first place size is supplied. Use the explicitly requested global bands when the experiment defines them, not inherited type-aware bands.

# Lesson: Snap vision boxes outward, never to the nearest shared line

- When a visible grid must also be the pricing geometry, floor the normalized top/left edges and ceil the bottom/right edges. Nearest-line rounding can collapse valid sub-cell detections into zero area and make the entire analysis fail. Outward snapping keeps the box grid-aligned, contains the observed unit, and guarantees at least one cell for every positive-area source box.

# Lesson: Expose the visual model input on coordinate-debug surfaces

- A browser-rendered overlay is not enough to audit a vision-coordinate result. When a lab generates a grid raster for Gemini, return and expose its generated visual preview directly beneath the test image, and state which stage receives it. Distinguish the original-photo inventory input from the grid-overlay coordinate input in two-step mode.

# Lesson: Never expose a raw data URL as the primary image-debug link

- Some in-app browser contexts render a clicked `data:image/...` URI as text instead of an image. Decode the returned base64 payload into a typed Blob and open its temporary `blob:` URL, then offer a named download as a fallback.

# Lesson: Calibrate vision boxes one immutable row at a time

- A single locator request that sees several overlapping topper/support descriptions can borrow the largest salient rectangle for unrelated rows. Measure cake reference geometry independently, then issue one schema-locked, single-target locator request per immutable storefront row. Do not let provisional geometry from the classification response block the calibrated locator that supersedes it.

# Lesson: Do not silently replace mandatory grid geometry

- When the sizing experiment declares representative bboxes mandatory, a missing, malformed, or collapsed bbox is a contract failure. Do not substitute a line or alternate measurement method: keep the failure explicit so the locator/prompt can be corrected and the displayed box remains the priced geometry.

# Lesson: Never replace one-pass raw coordinates after rendering them

- If Prompt Lab presents raw one-pass grid JSON for review, the same normalized bbox values must drive the overlay, sizing table, category calculation, and pricing. A later calibration or locator request is a separate model answer and must never silently overwrite the displayed raw response.

# Lesson: Keep grid coordinates out of optional pixel geometry

- A grid-mode prompt can make Gemini place 0–20 coordinates into optional legacy fields such as `cake_messages[].bbox`, whose storefront contract requires 0–1000 pixel integers. Remove those fields from the grid response schema and strip any model-supplied value before validation. For the requested reference-area denominator, project valid perspective-slanted cake endpoints to horizontal diameter and vertical wall-height spans; reject only a zero extent.

# Lesson: Keep shared module exports and consumers synchronized

- When an experimental coordinate mode is wired into the server and UI, update the shared geometry module in the same change. Verify every imported prompt, schema, calculator, type, and overlay symbol exists before deployment; a partial export seam fails during Turbopack module analysis before behavior tests can exercise the feature.

# Lesson: Make the UI expose every required coordinate mode

- If a feature has two coordinate systems, do not leave the UI as a legacy enable/disable checkbox. Render exactly the two named choices and send the selected mode explicitly so the prompt suffix, image overlay, response schema, and result display cannot silently disagree.

# Lesson: Anchor cake height to the visible front-center wall

- For Prompt Lab cake geometry, “height” means the visible front wall: start at the top front edge where the top surface meets the sidewall and end at the base. State this explicitly in the geometry prompt and validate that the returned vertical line stays near the midpoint of the diameter span; axis validation alone can accept a rear or off-center line.

# Lesson: Keep true one-pass geometry isolated from the two-call reference

- A single combined Gemini response can carry baseline analysis and exhaustive geometry, but it cannot freeze an intermediate manifest. Expose it as a separate Prompt Lab experiment, validate nested analysis and geometry independently, and keep normal baseline pricing authoritative until the combined mode is benchmarked against the two-call reference.

# Lesson: Do not let one-pass analysis validation hide independent geometry

- In the combined response, a missing production field such as `support_elements[].size` must be reported as an analysis validation error without discarding valid geometry from the same response. Validate the nested analysis and geometry independently, and make the editable combined prompt explicitly prohibit null or missing required pricing fields.

# Lesson: Merge geometry by stable analysis identity, not array position

- To expose review boxes alongside priced `main_toppers` and `support_elements`, match geometry to normalized `group_id` (accepting a detector suffix such as `_elem`) and keep unmatched decorations in the exhaustive geometry inventory. Never assume the two arrays have the same order or cardinality.

# Lesson: Keep provider schemas aligned with strict post-processing

- If strict validation requires a field, the combined response schema must require it too. Direct-sizing analysis previously exposed `size` as optional at the provider boundary even though validation required it for non-filler rows; that allowed Gemini to omit it and fail the whole analysis. Also canonicalize recoverable reversed measurement endpoints while retaining the raw model response for audit.

# Lesson: Test the user-named surface, not an adjacent diagnostic path

- When the user asks to test landing-page upload analysis, exercise the homepage uploader and its navigation into the live customizer flow. Prompt Lab can verify an isolated contract, but it does not prove the landing-page upload, cache, enrichment, and rendered analysis behavior the user asked about.

# Lesson: Preserve the contract cause behind generic AI route errors

- A browser `500` with `Invalid response format from AI` does not identify whether JSON parsing, row geometry, or final storefront validation failed. Keep the public production message safe, but surface the nested validator cause in local development and include prompt/system-instruction bytes in prompt-cache reuse keys so landing-page tests exercise the current contract.

# Lesson: Treat missing integrated geometry as a prompt/cache-version signal

- A successful analysis can still have no boxes when its payload is `three_band_v1` or `ai_diameter_anchor`; those contracts intentionally omit `geometry` and `box_2d`. Check the emitted `analysis_size_schema` and server prompt version before changing the overlay. Keep historical rows unchanged and use a fresh or explicitly rerun v3.92 request for integrated geometry.

# Lesson: Keep repeated-unit bbox failures bounded and visible

- A discrete row must never use an arrangement-wide box. The integrated contract caps unit boxes at five, preserves the reported quantity for pricing, and logs when Gemini localizes fewer tight units than that cap; never silently turn the missing units into a large cluster box.

# Lesson: Keep integrated area bands application-owned

- When a size threshold changes, update the deterministic integrated-bbox calculator and its authoritative system override together. Historical schemas and cached size labels must remain unchanged.

# Lesson: Canonicalize model measurement endpoints

- A valid Gemini measurement can arrive in reverse endpoint order. Normalize diameter lines by x and height lines by y before orientation, midpoint, aspect-ratio, and sizing checks; reject only genuinely non-horizontal or non-vertical geometry.

# Lesson: Distinguish endpoint order from perspective drift

- A left-to-right diameter can still fail if its y-drift is large. Treat endpoint direction and perspective tolerance as separate validations; allow strongly slanted cake rims when a usable horizontal span remains, while retaining a truly axis-incompatible regression test.

# Lesson: Keep conditional generated fields aligned across layers

- If a flag such as `gumpasteBaseBoard` makes a color required, require that color in the integrated Gemini response schema and retain a deterministic post-processing fallback for omission. Otherwise Gemini can produce a semantically valid-looking response that the final validator rejects as a 500.

# Lesson: Do not derive source identity from output metadata

- Delayed image jobs must key their source revision from the original asset identity, not mutable output dimensions. Studio completion updates cache dimensions, so including them in the source revision or enqueue trigger would requeue the image that just completed.

# Lesson: Bind delayed-job completions to the claim run

- A stale worker can outlive its lease and overlap a retry. Finalize and failure RPCs must validate the claim run token as well as the source revision, so late work cannot overwrite the job that currently owns the retry.

# Lesson: Keep analysis overlays aligned with the active hero image

- Bounding boxes are useful on both original and customized tabs. Do not gate the overlay on the original tab; derive its rendered bounds from whichever hero image is active while preserving the original frame ratio.

# Lesson: Start client-error audits from the database

- For recent Genie.ph browser-error audits, query Supabase `public.client_errors` first; correlate cart failures through `metadata.cartRequestId` and inspect the live cart row before treating a scheduled retry as recovered. Use Clarity only as supplemental context.

# Lesson: Pace direct model reruns after batch validation failures

- When a large Vertex batch has already produced provider and strict-contract failures, use a direct runner capped at 100 rows with explicit per-row logs, no prompt/context cache, and no GCS staging. Start with concurrency 1, prefer the Studio image, pace rows, back off on 429s, and stop before paying through a recurring quota failure. Remove unrelated local credential-file overrides before ADC impersonation; otherwise every request can fail before reaching Vertex.

# Lesson: Compare rerun settings to production before blaming a model setting

- When a rerun times out, compare both model and thinking level against the deployed production commit before attributing latency. Genie production uses Gemini 3.5 Flash Lite at LOW; the cache rerun explicitly uses Gemini 3.1 Flash Lite. A timeout in that rerun alone is not evidence that LOW is a production problem.

- When Vercel MCP is available for a deployment task, inspect its deployment capability and use it for an isolated Preview before reporting that deployment is blocked by local CLI credentials. Verify production is unaffected and validate the Preview before any production promotion.

# Lesson: Keep bbox failures local to the affected row

- Structured JSON validity does not guarantee bbox count or type/scope compatibility. For the tolerant contract, make one stable-`group_id` bbox-only retry, then retain valid boxes, the original item quantity, and a visible review status; do not reject otherwise valid cake analysis or discard decorations.

# Lesson: Resolve the live active prompt immediately before a rerun

- When the user says a prompt was activated, verify the live `is_active` row immediately before starting paid cache work, require the intended version to be the sole active row, and omit an explicit version override so the runner uses the active prompt. Record the prompt ID/version in the run log.

# Lesson: Preserve an existing share URL shape when exposing pending designs

- When a user points out that an existing slug and option query already identify the item, inspect the route and publication gate, then reuse that URL shape. Distinguish “link works while noindex, then becomes public after SEO publication” from “permanently private” before proposing new tokens, tables, or routes.

# Lesson: Keep bbox gestures in the image scroll chain

- For a tall mobile hero, editable bbox hit targets must be descendants of the image's `overflow-y-auto` scroller. `touch-pan-y` on the hero frame alone can send a bbox-started swipe to the page, skipping image panning. Preserve click/tap activation and verify image-first movement with page handoff at the image edge.

# Lesson: Distinguish configured env names from missing worktree env files

- When a clean migration worktree build reports a missing env variable, inspect the app's actual env adapter and compare only env-file presence/key names across checkouts. Do not imply the project lacks configuration when the isolated worktree simply does not contain its ignored `.env.local`; distinguish app-required `NEXT_PUBLIC_*` names from aliases used only by legacy scripts, and never print or copy values during diagnosis.

# Lesson: Apply requested exclusions to both rows and totals

- When a user narrows an order export (for example, excluding expired orders), remove those rows from the deliverable and recalculate every included-order total. Keep payment and fee reconciliations scoped to the retained orders, and verify the excluded status is absent from the final CSV.
# 2026-10-02 — Apply numeric formula clarifications literally

- When the user clarifies a sizing relationship with an explicit multiplier, update the plan, implementation, prompt contract, and regression test to that exact formula. Do not substitute a measured dimension or an approximately equivalent fraction.
