# Implementation Plan: Customizing Page Icing Mask (Persistent Mask-Based Recolor)

## Overview

This plan implements the persistent, mask-based icing recolor flow for the customizing page in
incremental steps. Infrastructure comes first (migration, types, shared color-adjustment helper),
then the data/IO service layer with its property tests, then the pure client compositor with its
property tests, then the React orchestration hook, and finally UI wiring and integration.

Implementation language: **TypeScript** (matches the existing Next.js codebase). Property-based
tests use **fast-check** with **vitest**, mirroring the existing tests under
`src/lib/imageVariants/__tests__/`. The instant recolor reuses `buildAdjustedIcingLayer` /
`getNonBlackAlpha` (`src/lib/icingLayerComposite.ts`) and the HSL math
(`src/lib/instantIcingRecolor.ts`) unchanged, and the persistence layer mirrors the existing
`cakegenie_color_variants` conventions in `src/hooks/useDesignUpdate.ts`.

## Tasks

- [x] 1. Set up database and type infrastructure
  - [x] 1.1 Create the `cakegenie_icing_masks` migration
    - Add a new SQL migration under `supabase/migrations/` creating `public.cakegenie_icing_masks`
      with columns: `id` (UUID PK), `cache_id` (UUID NOT NULL, FK -> `cakegenie_analysis_cache(id)`
      ON DELETE CASCADE), `mask_url` (TEXT NOT NULL), `source_image_url` (TEXT), `mask_version`
      (SMALLINT NOT NULL DEFAULT 1), `width` (INTEGER), `height` (INTEGER), `status` (TEXT NOT NULL
      DEFAULT 'ready'), `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
    - Add `CONSTRAINT cakegenie_icing_masks_cache_version_uniq UNIQUE (cache_id, mask_version)`
    - Add `CREATE INDEX idx_cakegenie_icing_masks_cache_id ON public.cakegenie_icing_masks (cache_id)`
    - Enable RLS and add policies mirroring `cakegenie_color_variants` (public read, authenticated insert)
    - _Requirements: 3.1, 6.1, 6.5_

  - [x] 1.2 Add the `CakeGenieIcingMask` TypeScript type
    - Add the `CakeGenieIcingMask` interface to `src/lib/database.types.ts` alongside
      `CakeGenieColorVariant` (fields: `id`, `cache_id`, `mask_url`, `source_image_url`,
      `mask_version`, `width`, `height`, `status: 'ready' | 'failed'`, `created_at`)
    - _Requirements: 6.1_

- [x] 2. Extract the shared color-adjustment helper
  - [x] 2.1 Move `getLayerColorAdjustments` into a shared module
    - Extract the `getLayerColorAdjustments` (and its `hexToRgb`/`MASK_LAYER_BASE_COLOR` `#FF0000`
      base) implementation currently inline in
      `src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx` into a shared module
      (e.g. `src/lib/icingLayerComposite.ts`), returning `{ hueShift, saturationShift, lightnessShift }`
    - Refactor `IcingRecolorLabClient.tsx` to import the shared helper so the lab and the customizer
      use one implementation
    - _Requirements: 9.3_

  - [x]* 2.2 Write property test for HSL color math round-trip
    - **Property 4: HSL round-trip stability**
    - **Validates: Requirements 9.3**
    - For all valid hex colors, assert `hslToRgb(rgbToHsl(hexToRgb(c)))` round-trips within ±1 per channel

  - [x]* 2.3 Write property test for zero-shift at the mask base color
    - **Property 4: HSL round-trip stability**
    - **Validates: Requirements 9.3**
    - Assert `getLayerColorAdjustments('#FF0000')` returns zero hue, saturation, and lightness shift

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement the icing mask service
  - [x] 4.1 Implement `getIcingMask` in `src/services/icingMaskService.ts`
    - Create `src/services/icingMaskService.ts` using the existing Supabase client pattern
      (`getSupabaseClient` from `src/lib/supabase/client.ts`)
    - Implement `getIcingMask(cacheId)` that selects the `status='ready'` row for
      `(cache_id, CURRENT_MASK_VERSION)`, returns `null` when absent (does not throw on "not found"),
      and only throws on transport errors
    - _Requirements: 1.4, 3.3, 3.4_

  - [x] 4.2 Implement `generateAndPersistIcingMask`
    - Add `generateAndPersistIcingMask(params)` to `src/services/icingMaskService.ts` that calls
      `editCakeImage(ICING_CONVERSION_PROMPT, baseImage, [], [], null, ICING_LAYER_SYSTEM_INSTRUCTION,
      'gemini-2.5-flash-image', traceId, 'customizing-icing-mask')`, decodes mask dimensions, uploads
      a lossless PNG to `icing-masks/{cacheId}/v{maskVersion}.png` with `upsert: true`, and inserts the
      row idempotently with `ON CONFLICT (cache_id, mask_version) DO NOTHING` (re-reading the winning row)
    - On Gemini/storage error, record a `status='failed'` row for `(cacheId, maskVersion)` and rethrow
    - Skip the storage write and DB insert entirely when `cacheId` is null (in-memory-only generation)
    - Regenerate and persist a new ready record when the base image changes or `CURRENT_MASK_VERSION`
      exceeds the existing record's version
    - _Requirements: 1.1, 1.2, 3.1, 3.5, 3.6, 5.4, 6.2, 6.3, 6.4, 6.6, 7.1, 10.1, 10.2, 10.3_

  - [x]* 4.3 Write property test for at-most-once generation idempotency
    - **Property 1: At-most-once generation per design/version** (and **Property 5: Idempotent persistence**)
    - **Validates: Requirements 1.5, 6.6**
    - Against an in-memory Supabase double, assert repeated/concurrent `generateAndPersistIcingMask`
      calls for one `cacheId` yield exactly one ready row and one stored object

  - [x]* 4.4 Write unit tests for the service
    - Test `getIcingMask` returns `null` (not throw) when no row and the row when present
    - Test the storage path is `icing-masks/{cacheId}/v{version}.png`
    - Test that on `editCakeImage` throw a `status='failed'` row is recorded and the error rethrown
    - _Requirements: 1.4, 5.4, 6.3_

- [x] 5. Implement the client-side compositor
  - [x] 5.1 Implement `recolorWithMask`
    - Add a compositor routine (e.g. `src/lib/icingMaskComposite.ts`) that constrains working
      dimensions via `constrainDimensions(naturalW, naturalH, PREVIEW_MAX_DIMENSION)`, draws the base
      image, rescales the mask `ImageData` to the working dimensions when they differ, applies
      `getLayerColorAdjustments` + `buildAdjustedIcingLayer`, composites the keyed layer over the base,
      and returns a `image/webp` data URL
    - Guard against non-positive base dimensions: produce no output and signal an error to the caller
    - _Requirements: 2.1, 8.1, 8.2, 8.3, 8.4, 9.1, 9.4_

  - [x]* 5.2 Write property test for layer-builder non-mutation and length
    - **Property 3: Recolor preserves geometry**
    - **Validates: Requirements 8.3, 9.4**
    - For all mask buffers, assert `buildAdjustedIcingLayer` never mutates the input buffer and returns
      a buffer of equal length

  - [x]* 5.3 Write property test for keyed-out pixels untouched
    - **Property 7: Keyed-out pixels are untouched**
    - **Validates: Requirements 9.2**
    - For all pixels where `getNonBlackAlpha(r,g,b) == 0`, assert the composited output pixel equals the
      base image pixel across target hexes

  - [x]* 5.4 Write unit tests for the compositor
    - Test mask rescale when stored mask dimensions differ from working dimensions
    - Test output dimensions equal the constrained working dimensions
    - Test the non-positive base dimension error path leaves the preview unchanged
    - _Requirements: 8.1, 8.2, 9.1_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement the `useIcingMask` hook
  - [x] 7.1 Implement mask prefetch, decode, and lifecycle state
    - Create `src/hooks/useIcingMask.ts` that, on mount and `cacheId` change, prefetches the mask row
      via `getIcingMask` and decodes the mask image into an in-memory `ImageData` cache
    - Expose `status` (`idle | generating | ready | error`) and `hasMask`; report `idle` before any
      interaction, `ready` once decoded, and `error` when decode/load fails
    - _Requirements: 3.2, 4.1, 4.2, 4.6, 4.7_

  - [x] 7.2 Implement `recolorIcing` (warm + cold + no-cacheId paths)
    - Generate the mask via `generateAndPersistIcingMask` when missing (status `generating`), then
      composite via `recolorWithMask` and call `onRecolored(dataUrl, hex)`
    - On the warm path, recolor purely client-side with no network/Gemini call
    - Add a request-id guard (mirroring `generationRequestIdRef` in the lab) so the latest click wins
      and superseded results are discarded
    - For designs with no `cacheId`, generate an in-memory-only mask once and reuse it for subsequent clicks
    - _Requirements: 1.3, 2.2, 2.4, 2.5, 7.2, 7.3_

  - [x] 7.3 Implement fallback and error handling
    - On generation error or no usable mask image, invoke `onFallback(hex, name)` exactly once and set
      `status='error'`
    - On a stored mask that cannot be decoded/loaded, attempt regeneration exactly once, then fall back
      exactly once if that also fails
    - On client-side compositing failure with a ready mask, retain the current preview and set `status='error'`
    - When the fallback also fails, set `status='error'` and leave the preview unchanged
    - _Requirements: 2.3, 2.6, 5.1, 5.2, 5.3, 5.5, 5.6, 7.4_

  - [x]* 7.4 Write unit tests for the hook
    - Mock `icingMaskService`; test lifecycle transitions (idle -> generating -> ready/error), warm-path
      no-network behavior, last-click-wins, and the fallback invocations (each exactly once)
    - _Requirements: 4.1, 4.2, 4.6, 4.7, 5.1, 5.2, 5.3_

- [x] 8. Wire the feature into the customizing UI
  - [x] 8.1 Update `CustomizingIcingEditorPanel`
    - Route the Body/Top/Side icing `ColorPalette` `onColorChange` handlers through the mask-based
      `recolorIcing(hex, name)` action
    - Add an `isGeneratingMask` prop and show a loading spinner on the affected icing color group while
      generating, keeping all other controls enabled and responsive, and removing the spinner on
      transition to ready/error
    - _Requirements: 2.3, 4.3, 4.4, 4.5_

  - [x] 8.2 Wire `useIcingMask` into `CustomizingClient`
    - Instantiate `useIcingMask` alongside `useDesignUpdate`, deriving `cacheId` from
      `recentSearchDesign?.id`, `baseImage` from `originalImageData`, and `baseImageUrl` from
      `originalImagePreview`
    - Connect `onRecolored` to `setEditedImage` + `setActiveTab('customized')` (plus the icing color
      state update and `scrollToHero`); connect `onFallback` to the existing `handleUpdateDesign` Gemini
      color-variant path
    - Pass the mask generating state down to `CustomizingIcingEditorPanel`
    - _Requirements: 1.3, 2.3, 5.5, 7.2_

  - [x]* 8.3 Write integration tests for the wired flow
    - Cold path: maskless design first click generates + persists + renders a recolored hero
    - Warm path: reloaded design recolors with zero `/api/ai/edit-image` calls
    - Fallback path: stub `editCakeImage` to throw and assert `onFallback` runs the color-variant flow
    - Cross-user reuse: seed a mask row and assert a fresh memory cache reuses `mask_url` without generation
    - _Requirements: 1.1, 1.3, 2.2, 3.3, 5.1, 5.5_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP.
- Each task references specific requirement sub-clauses for traceability.
- Property tests use fast-check and validate the design's numbered correctness properties.
- Unit and integration tests validate specific examples, edge cases, and end-to-end wiring.
- The service, compositor, and color math reuse existing modules; only the mask orchestration,
  persistence table, and UI wiring are new.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "4.1", "5.1"] },
    { "id": 2, "tasks": ["4.2", "5.2", "5.3", "5.4"] },
    { "id": 3, "tasks": ["4.3", "4.4", "7.1"] },
    { "id": 4, "tasks": ["7.2"] },
    { "id": 5, "tasks": ["7.3"] },
    { "id": 6, "tasks": ["7.4", "8.1", "8.2"] },
    { "id": 7, "tasks": ["8.3"] }
  ]
}
```
