# Requirements Document

## Introduction

This feature brings the persistent, mask-based icing recolor flow to the customizing page. Today,
recoloring a cake's icing body sends a request to Gemini on every color click, which is slow and
expensive. This feature generates a reusable "icing mask" (the icing rendered solid red and
everything else pitch-black) exactly once per cake design, persists it permanently in Supabase
Storage and a new database table, and then composites any chosen color entirely on the client.
After the one-time generation, every color click — for the original user and for any other user of
the same design — recolors instantly with no further Gemini calls.

The mask is a property of the cake design (keyed via the design's `cache_id`), so it is generated
at most once per design across the entire platform. When mask generation or loading fails, the
system falls back to the existing Gemini color-variant path so the customer always receives a
recolored cake.

These requirements are derived from the approved design document. Each acceptance criterion is
written to be precise and testable so the design's correctness properties can map back to specific
requirement numbers.

## Glossary

- **Icing Mask**: The Gemini-generated reference image in which the cake's icing body is rendered solid red (`#FF0000`) and every non-icing element (decorations, text, borders, background) is rendered pitch-black (`#000000`).
- **Icing Mask System**: The end-to-end feature comprising the service, hook, compositor, database table, and storage objects described in this document.
- **Icing Mask Service**: The server-of-record access layer that reads and writes Mask Records and storage objects and invokes the Mask Generator. Implemented as `icingMaskService`.
- **Mask Generator**: The Gemini image-generation call (`editCakeImage` with the Icing Conversion Prompt) that produces an Icing Mask from a Base Image.
- **Icing Recolor Hook**: The React orchestration hook (`useIcingMask`) that owns the in-memory mask cache, lifecycle state, and the recolor action.
- **Icing Compositor**: The client-side canvas routine that keys out black mask pixels and applies the HSL color shift (built on `buildAdjustedIcingLayer` and `getNonBlackAlpha`).
- **Mask Record**: A row in the `cakegenie_icing_masks` table describing one Icing Mask (its storage URL, dimensions, version, and status).
- **Mask Store**: The combination of the Supabase Storage object (the PNG mask file) and the `cakegenie_icing_masks` table row.
- **Cache ID**: The identifier of a `cakegenie_analysis_cache` row (`recentSearchDesign.id`) that uniquely identifies a cake design and is the foreign key for a Mask Record.
- **Base Image**: The current working cake image being customized (the design's original or last-edited image).
- **Mask Version**: An integer (`CURRENT_MASK_VERSION`, default 1) identifying the Icing Conversion Prompt semantics used to generate a mask.
- **Mask Base Color**: The fixed red color `#FF0000` that the Mask Generator paints the icing body in.
- **Preview Max Dimension**: The maximum constrained working dimension (1200 px) used for compositing, matching the recolor lab.
- **Non-Black Alpha**: The keying strength returned by `getNonBlackAlpha`; a value of `0` marks a fully keyed-out (non-icing) pixel.
- **Mask Lifecycle State**: One of `idle`, `ready`, `generating`, or `error`, describing the current mask status for a design.
- **Color Variant Fallback**: The existing Gemini-based recolor path (`useDesignUpdate` / `cakegenie_color_variants`) used when the mask path is unavailable.

## Requirements

### Requirement 1: One-time icing mask generation on first color selection

**User Story:** As a customer customizing a cake, I want the first icing body color I pick to produce a correctly recolored cake, so that I can preview colors even before a mask exists for the design.

#### Acceptance Criteria

1. WHEN a customer selects an icing body color, IF no ready Mask Record exists for the design's Cache ID at the current Mask Version, THEN THE Icing Mask Service SHALL invoke the Mask Generator exactly once to generate an Icing Mask from the design's current Base Image using the Icing Conversion Prompt.
2. WHEN icing mask generation succeeds, THE Icing Mask Service SHALL return a Mask Record with status ready for the design's Cache ID and current Mask Version.
3. WHEN the first icing mask generation for a design succeeds, THE Icing Mask System SHALL apply the icing body color that triggered the generation to produce a recolored cake preview using the newly generated Icing Mask.
4. WHERE a ready Mask Record already exists for the design's Cache ID at the current Mask Version, THE Icing Mask Service SHALL return the existing Mask Record without invoking the Mask Generator.
5. WHEN two or more icing body color selections occur concurrently for the same design that has no ready Mask Record at the current Mask Version, THE Icing Mask Service SHALL invoke the Mask Generator at most once and SHALL produce at most one ready Mask Record for that Cache ID and Mask Version.

### Requirement 2: Instant client-side recolor reuse (warm path)

**User Story:** As a customer, I want every icing color click after the first to recolor the cake instantly, so that I can explore color options quickly.

#### Acceptance Criteria

1. WHILE a ready Icing Mask is held in memory, WHEN a customer selects an icing body color, THE Icing Compositor SHALL produce the recolored image using only client-side canvas computation.
2. WHILE a ready Icing Mask is held in memory, WHEN a customer selects an icing body color, THE Icing Recolor Hook SHALL complete the recolor without issuing any network request to the Mask Generator or the Color Variant Fallback.
3. WHEN the Icing Compositor produces a recolored image, THE Icing Recolor Hook SHALL display that image as the customized cake preview.
4. WHILE a ready Icing Mask is held in memory, WHEN a customer selects an icing body color, THE Icing Recolor Hook SHALL display the recolored cake preview within 200 milliseconds of the selection.
5. WHEN a customer makes multiple icing body color selections in rapid succession, THE Icing Recolor Hook SHALL display the recolored preview for the most recently selected color AND SHALL discard the results of superseded selections.
6. IF client-side compositing fails while a ready Icing Mask is held in memory, THEN THE Icing Recolor Hook SHALL retain the current cake preview AND SHALL report the Mask Lifecycle State as error.

### Requirement 3: Persistent, cross-user mask reuse

**User Story:** As the platform, I want a design's icing mask stored permanently and shared across all users, so that the Gemini generation cost is incurred at most once per design.

#### Acceptance Criteria

1. WHEN icing mask generation succeeds for a design, THE Icing Mask Service SHALL persist the mask image to the Mask Store, keyed by the design's Cache ID and Mask Version, as a durable object that remains retrievable across browser sessions and server restarts until the design's Cache ID is deleted.
2. WHEN a customer loads a design that has a ready Mask Record, THE Icing Recolor Hook SHALL load the stored mask image into memory before the customer's first icing body color selection is composited.
3. IF a ready Mask Record exists for a design, THEN THE Icing Mask Service SHALL serve the stored mask image to every customer that requests that design.
4. IF a ready Mask Record exists for a design's Cache ID and Mask Version, THEN THE Icing Mask Service SHALL serve the stored mask image without invoking the Mask Generator.
5. WHILE no condition in criterion 6 applies, THE Icing Mask Service SHALL invoke the Mask Generator at most once per Cache ID and Mask Version across all customers of that design.
6. WHEN a design's Base Image changes or the current Mask Version exceeds the Mask Version of the design's ready Mask Record, THE Icing Mask Service SHALL generate a new Icing Mask and persist it as the ready Mask Record for the current Mask Version.

### Requirement 4: Mask lifecycle and loading states

**User Story:** As a customer, I want clear feedback while a mask is being generated, so that I understand the one-time wait and can keep using the rest of the page.

#### Acceptance Criteria

1. WHILE a design has loaded with no Icing Mask in memory and no icing color selected, THE Icing Recolor Hook SHALL report the Mask Lifecycle State as idle.
2. WHILE icing mask generation is in progress, THE Icing Recolor Hook SHALL report the Mask Lifecycle State as generating.
3. WHILE the Mask Lifecycle State is generating, THE Icing Mask System SHALL display a loading spinner on the icing color group from which the color that triggered generation was selected.
4. WHILE the Mask Lifecycle State is generating, THE Icing Mask System SHALL keep every customization control other than the affected icing color group enabled and responsive to user input.
5. WHEN the Mask Lifecycle State transitions out of generating to either ready or error, THE Icing Mask System SHALL remove the loading spinner from the affected icing color group.
6. WHEN a ready Icing Mask is loaded into memory, THE Icing Recolor Hook SHALL report the Mask Lifecycle State as ready.
7. IF icing mask generation or mask loading fails, THEN THE Icing Recolor Hook SHALL report the Mask Lifecycle State as error.

### Requirement 5: Graceful fallback to the Gemini color-variant path

**User Story:** As a customer, I want to still get a recolored cake when the mask path fails, so that icing color customization never dead-ends.

#### Acceptance Criteria

1. IF the Mask Generator returns an error or returns no usable Icing Mask image during generation, THEN THE Icing Recolor Hook SHALL invoke the Color Variant Fallback for the selected color exactly once.
2. IF a stored Icing Mask cannot be decoded or loaded into memory, THEN THE Icing Recolor Hook SHALL attempt regeneration of the Icing Mask exactly once.
3. IF the regeneration attempt in criterion 2 returns an error or returns no usable Icing Mask image, THEN THE Icing Recolor Hook SHALL invoke the Color Variant Fallback for the selected color exactly once.
4. WHEN icing mask generation or regeneration fails for a design that has a Cache ID, THE Icing Mask Service SHALL record a Mask Record with status `failed` for the design's Cache ID and Mask Version, regardless of whether the Color Variant Fallback subsequently succeeds.
5. WHEN the Color Variant Fallback returns a recolored image, THE Icing Recolor Hook SHALL display that image as the customized cake preview.
6. IF the Color Variant Fallback also fails to return a recolored image, THEN THE Icing Recolor Hook SHALL report the Mask Lifecycle State as error AND SHALL leave the current cake preview unchanged.

### Requirement 6: Database persistence and idempotency

**User Story:** As the platform, I want mask persistence to be idempotent and uniquely keyed, so that concurrent first-clicks and re-runs do not create duplicate records or objects.

#### Acceptance Criteria

1. WHEN the Icing Mask Service persists a Mask Record, THE Icing Mask Service SHALL store it in the `cakegenie_icing_masks` table under a unique constraint that permits at most one row per combination of Cache ID and Mask Version.
2. IF a Mask Record insert conflicts with an existing record for the same Cache ID and Mask Version, THEN THE Icing Mask Service SHALL leave the existing record unchanged, SHALL discard the conflicting insert without raising an error, AND SHALL return the existing Mask Record to the caller.
3. WHEN the Icing Mask Service uploads a mask image for a Cache ID, THE Icing Mask Service SHALL write it to the storage path `icing-masks/{cacheId}/v{maskVersion}.png`.
4. WHEN a mask image already exists at the target storage path, THE Icing Mask Service SHALL overwrite the object in place such that exactly one stored object exists at that path.
5. WHEN a design row is deleted from `cakegenie_analysis_cache`, THE Mask Store SHALL delete every Mask Record that references that design's Cache ID across all Mask Versions, such that no Mask Record referencing that Cache ID remains.
6. WHEN icing mask generation completes for a Cache ID and Mask Version under any number of concurrent or repeated attempts, THE Icing Mask System SHALL maintain exactly one Mask Record row and exactly one stored mask object for that Cache ID and Mask Version.

### Requirement 7: Designs without a Cache ID

**User Story:** As a customer customizing an ad-hoc design that is not yet cached, I want icing color changes to still work, so that I am not blocked by a missing persistence key.

#### Acceptance Criteria

1. IF a design has no Cache ID, THEN THE Icing Mask Service SHALL skip writing the Mask Record AND SHALL skip writing the storage object.
2. WHEN a customer selects an icing body color for a design that has no Cache ID, THE Icing Mask System SHALL generate an in-memory-only Icing Mask, produce a recolored preview for the selected color, AND display that preview, without persisting the mask.
3. WHILE an in-memory-only Icing Mask is held for a design that has no Cache ID, WHEN the customer selects another icing body color, THE Icing Compositor SHALL produce the recolored preview client-side without re-invoking the Mask Generator.
4. IF an in-session Icing Mask cannot be produced for a design that has no Cache ID, THEN THE Icing Recolor Hook SHALL invoke the Color Variant Fallback for the selected color exactly once.

### Requirement 8: Mask and base image dimension handling

**User Story:** As a customer, I want recolors to look correct even when a stored mask was generated at a different size than the current preview, so that the recolored icing aligns with the cake.

#### Acceptance Criteria

1. WHEN the Icing Compositor recolors using an Icing Mask, THE Icing Compositor SHALL set the working dimensions so that the longer side equals the smaller of the Base Image's native longer side and the Preview Max Dimension, preserving the Base Image aspect ratio, with each dimension rounded to the nearest whole pixel and never less than 1 pixel.
2. IF either the width or the height of the Icing Mask differs from the working dimensions, THEN THE Icing Compositor SHALL rescale the mask so that its width and height each equal the working dimensions before compositing.
3. WHEN the Icing Compositor produces a recolored image, THE Icing Compositor SHALL output an image whose width and height each equal the working dimensions from criterion 1.
4. IF the Base Image has a non-positive width or height, THEN THE Icing Compositor SHALL produce no recolored output, SHALL report an error to the caller, AND SHALL leave the current cake preview unchanged.

### Requirement 9: Geometry preservation and keyed-out pixels

**User Story:** As a customer, I want only the icing to change color, so that decorations, text, borders, and background stay exactly as in the original photo.

#### Acceptance Criteria

1. WHEN the Icing Compositor recolors the icing, THE Icing Compositor SHALL change the color of only those pixels the Icing Mask marks as non-black icing (Non-Black Alpha greater than zero).
2. FOR ALL Icing Mask pixels whose Non-Black Alpha equals zero, THE Icing Compositor SHALL set the corresponding output pixel equal to the Base Image pixel for every selected color.
3. WHEN a customer selects a color equal to the Mask Base Color, THE Icing Compositor SHALL reproduce the mask's base red icing layer with zero hue, saturation, and lightness shift.
4. WHEN the Icing Compositor recolors the icing for any selected color, THE Icing Compositor SHALL preserve the framing, position, and pixel dimensions of the Base Image in the output.

### Requirement 10: Lossless mask storage integrity

**User Story:** As the platform, I want masks stored losslessly, so that black keying stays accurate and recolors remain clean.

#### Acceptance Criteria

1. WHEN the Icing Mask Service stores a mask image, THE Icing Mask Service SHALL encode it as a PNG without applying any lossy compression, such that decoding the stored object reproduces every stored pixel's RGBA channel values bit-for-bit with no quantization, chroma subsampling, or color loss.
2. WHEN a stored mask PNG is decoded and keyed with the Non-Black Alpha function, THE Icing Mask System SHALL produce an alpha mask in which every pixel's Non-Black Alpha value is identical to the Non-Black Alpha value the Mask Generator produced for the corresponding pixel before storage.
3. WHEN a stored mask PNG is decoded, THE Icing Mask System SHALL yield RGB channel values of exactly 0 for every pixel the Mask Generator rendered as pitch-black `#000000`, so that each such pixel's Non-Black Alpha equals zero.
