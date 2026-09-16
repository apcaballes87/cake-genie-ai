-- Stage v3.90 without changing the verified v3.89 prompt, cache rows, or pricing.
begin;

do $migration$
declare
  active_count integer;
  source_version text;
  source_prompt text;
  next_prompt text;
  v389_md5 constant text := '7522fb1ba49ee59513d3cefddba8444c';
  v390_md5 constant text := 'ac7f65da35135d3d4e42e90b7c82e655';
begin
  lock table public.ai_prompts in share row exclusive mode;

  select count(*) into active_count
  from public.ai_prompts
  where is_active = true;
  if active_count <> 1 then
    raise exception 'Cannot stage v3.90: expected exactly one active prompt, found %', active_count;
  end if;

  select version, prompt_text into source_version, source_prompt
  from public.ai_prompts
  where is_active = true;
  if source_version <> '3.89' or md5(source_prompt) <> v389_md5 then
    raise exception 'Cannot stage v3.90: verified active v3.89 source is required';
  end if;

  if exists (select 1 from public.ai_prompts where version = '3.90') then
    raise exception 'Cannot stage v3.90: target version already exists';
  end if;

  next_prompt := source_prompt;

  if position($old$**v3.89 Version - White-Only Wafer-Paper Side-Wave Verification**$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.90: version-title anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$**v3.89 Version - White-Only Wafer-Paper Side-Wave Verification**$old$,
    $new$**v3.90 Version - Piped Botanical Construction and Soft-Icing Evidence**$new$);

  if position($old$- Restrict the priced wafer-paper side-wave type to directly resolved, white, unprinted wafer sheets; ivory, cream, beige, tan, colored, printed, blurred, or ambiguous side treatments fail closed.$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.90: changelog anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$- Restrict the priced wafer-paper side-wave type to directly resolved, white, unprinted wafer sheets; ivory, cream, beige, tan, colored, printed, blurred, or ambiguous side treatments fail closed.$old$,
    $new$- Require construction-first grouping for piped flowers and their integrated piped foliage; directly piped botanicals never become fondant flowers, filler flowers, or separate fondant leaves.
- Require positive continuous-sheet evidence before choosing a fondant cake body; smooth pastel color, a neat gradient, floral decorations, or a single image angle are insufficient.
- Preserve the white-only wafer-paper side-wave gate: ivory, cream, beige, tan, colored, printed, blurred, or ambiguous side treatments fail closed.$new$);

  if position($old$### EDIBLE LEAF AND FOLIAGE NORMALIZATION (BINDING)

Every discrete edible leaf or foliage piece—whether fondant or gumpaste; cut,
stamped, flat, shallow-relief, molded, upright, on the top, or on the side—MUST
be emitted only in `support_elements` as `type: "edible_2d_support"`,
`material: "edible_fondant"`, and `size: "small"`. This remains mandatory
even when a leaf is individually prominent, grouped into a spray, appears
three-dimensional, or accompanies focal flowers. Group only visually identical
leaves and set `quantity` to the directly visible leaf count.

This leaf rule overrides every flower, flat-shape, focal-shape, complexity,
bundle, role, and direct-diameter sizing rule in this prompt. Never classify a
discrete edible leaf or foliage piece as `edible_flowers`, `gumpaste_bundle`,
`edible_2d_shapes`, `edible_2d_complex`, or `edible_3d_ordinary`. A leaf shape
that exists only as an integrated piped, palette-knife, brushed, or painted
icing stroke remains governed by its icing-technique rule; it is not a separate
edible leaf piece.

### FILLER FLOWER AND BABY'S-BREATH NORMALIZATION (BINDING)

A small, generic filler flower or any baby's-breath flower is always an
`edible_flowers_filler` row in `support_elements` with material
`edible_fondant`. Count every directly visible flower and group only matching
visible appearance and color. This includes small white filler flowers mixed
into floral arrangements, individual white baby's-breath flowers in a
cascading side spray, edible white filler flowers on a side, and edible white
and pink filler flowers on a top.

`edible_flowers_filler` must emit exactly one direct-diameter `size`: `small`,
`medium`, or `large`. Omit `size_line`, `bbox`, and `coverage` regardless of
the apparent physical scale or placement. It is never a main topper or
`edible_flowers`; its price remains ₱5 per visible flower in every size band.
This rule overrides ordinary-flower, intricate-flower, role, direct diameter,
and grouping rules. Do not use it for a distinct ordinary or intricate bloom
merely because that bloom is small.$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.90: leaf-and-filler anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$### EDIBLE LEAF AND FOLIAGE NORMALIZATION (BINDING)

Every discrete edible leaf or foliage piece—whether fondant or gumpaste; cut,
stamped, flat, shallow-relief, molded, upright, on the top, or on the side—MUST
be emitted only in `support_elements` as `type: "edible_2d_support"`,
`material: "edible_fondant"`, and `size: "small"`. This remains mandatory
even when a leaf is individually prominent, grouped into a spray, appears
three-dimensional, or accompanies focal flowers. Group only visually identical
leaves and set `quantity` to the directly visible leaf count.

This leaf rule overrides every flower, flat-shape, focal-shape, complexity,
bundle, role, and direct-diameter sizing rule in this prompt. Never classify a
discrete edible leaf or foliage piece as `edible_flowers`, `gumpaste_bundle`,
`edible_2d_shapes`, `edible_2d_complex`, or `edible_3d_ordinary`. A leaf shape
that exists only as an integrated piped, palette-knife, brushed, or painted
icing stroke remains governed by its icing-technique rule; it is not a separate
edible leaf piece.

### FILLER FLOWER AND BABY'S-BREATH NORMALIZATION (BINDING)

A small, generic filler flower or any baby's-breath flower is always an
`edible_flowers_filler` row in `support_elements` with material
`edible_fondant`. Count every directly visible flower and group only matching
visible appearance and color. This includes small white filler flowers mixed
into floral arrangements, individual white baby's-breath flowers in a
cascading side spray, edible white filler flowers on a side, and edible white
and pink filler flowers on a top.

`edible_flowers_filler` must emit exactly one direct-diameter `size`: `small`,
`medium`, or `large`. Omit `size_line`, `bbox`, and `coverage` regardless of
the apparent physical scale or placement. It is never a main topper or
`edible_flowers`; its price remains ₱5 per visible flower in every size band.
This rule overrides ordinary-flower, intricate-flower, role, direct diameter,
and grouping rules. Do not use it for a distinct ordinary or intricate bloom
merely because that bloom is small.$old$,
    $new$### PIPED BOTANICAL TREATMENT — CONSTRUCTION PRECEDENCE (BINDING)

See OUTPUT ORDER step 6.

Before naming a flower or leaf, determine its construction. When petals,
rosettes, buds, and/or pointed foliage strokes have extrusion ridges,
piping-tip seams, soft peaks, or continuous joins into the same iced surface,
they are one integrated piped-botanical treatment. Use `material: "icing"` and
the grouped placement row: `piped_flowers_top` on the top and/or
`piped_flowers_side` on the side. Include its piped foliage in that treatment
description; do not count individual piped flowers or leaves and do not emit
`edible_flowers`, `edible_flowers_filler`, or `edible_2d_support` for it.

The nearest non-qualifying construction is a separately placed
fondant/gumpaste botanical piece: smooth or thick matte petals/leaves, visibly
cut, molded, or sculpted edges, a self-contained body, or a clear
separation/shadow from the iced surface. Only those separate pieces use
`edible_flowers` or `edible_2d_support` with `material: "edible_fondant"`.
If there are no piped flowers, a non-floral piped foliage border remains
`icing_decorations` rather than a piped-flower row.

This construction gate is before and overrides ordinary-flower,
filler-flower, and edible-leaf normalization. It does not change a separate
fondant/gumpaste botanical piece into icing merely because it is next to piped
icing.

### EDIBLE LEAF AND FOLIAGE NORMALIZATION (BINDING)

After `PIPED BOTANICAL TREATMENT — CONSTRUCTION PRECEDENCE` has failed, every
discrete edible leaf or foliage piece—whether fondant or gumpaste; cut,
stamped, flat, shallow-relief, molded, upright, on the top, or on the side—MUST
be emitted only in `support_elements` as `type: "edible_2d_support"`,
`material: "edible_fondant"`, and `size: "small"`. This remains mandatory
even when a leaf is individually prominent, grouped into a spray, appears
three-dimensional, or accompanies focal flowers. Group only visually identical
leaves and set `quantity` to the directly visible leaf count.

This leaf rule overrides every flower, flat-shape, focal-shape, complexity,
bundle, role, and direct-diameter sizing rule that follows the construction
gate. Never classify a discrete edible leaf or foliage piece as `edible_flowers`, `gumpaste_bundle`,
`edible_2d_shapes`, `edible_2d_complex`, or `edible_3d_ordinary`. A leaf shape
that exists only as an integrated piped, palette-knife, brushed, or painted
icing stroke remains governed by its icing-technique rule; it is not a separate
edible leaf piece.

### FILLER FLOWER AND BABY'S-BREATH NORMALIZATION (BINDING)

After `PIPED BOTANICAL TREATMENT — CONSTRUCTION PRECEDENCE` has failed, a
small, generic filler flower or any baby's-breath flower is always an
`edible_flowers_filler` row in `support_elements` with material
`edible_fondant`. Count every directly visible flower and group only matching
visible appearance and color. This includes small white filler flowers mixed
into floral arrangements, individual white baby's-breath flowers in a
cascading side spray, edible white filler flowers on a side, and edible white
and pink filler flowers on a top.

`edible_flowers_filler` must emit exactly one direct-diameter `size`: `small`,
`medium`, or `large`. Omit `size_line`, `bbox`, and `coverage` regardless of
the apparent physical scale or placement. It is never a main topper or
`edible_flowers`; its price remains ₱5 per visible flower in every size band.
This rule overrides ordinary-flower, intricate-flower, role, direct diameter,
and grouping rules after the construction gate. Do not use it for a distinct
ordinary or intricate bloom merely because that bloom is small, and do not use
it for directly piped buds or blossoms.$new$);

  if position($old$  Every non-piped cake-member flower is `edible_flowers` under this override.
  Piped icing flowers use the grouped top/side coverage rule below.$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.90: flower-protocol anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$  Every non-piped cake-member flower is `edible_flowers` under this override.
  Piped icing flowers use the grouped top/side coverage rule below.$old$,
    $new$  Every cake-member flower that fails the construction gate is `edible_flowers`
  under this override. Piped botanical treatments use the grouped top/side
  coverage rule below.$new$);

  if position($old$### PIPED ICING FLOWERS — GROUPED COVERAGE PRICING (AUTHORITATIVE)

See OUTPUT ORDER step 6.

Piped flowers are icing only: directly piped buttercream/frosting petals,
rosettes, shells, ruffles, star-tip blossoms, or swirls that visibly merge into
the iced cake surface. Their ridged or petalled frosting texture is not
separate fondant or gumpaste construction, even when the flower resembles a
rose, peony, or blossom.

Emit the complete treatment as one row with `material: "icing"` and
`quantity: 1`—never one row per bloom:

- Top-surface flowers: one `main_toppers` row with `type:
  "piped_flowers_top"`, `classification: "hero"`, and `coverage` measured
  against the directly visible top surface.
- Sidewall flowers: one `support_elements` row with `type:
  "piped_flowers_side"` and `coverage` measured against the directly visible
  iced cake-side area. If an independent treatment appears on both top and
  side, emit one row of each type.

Set `coverage` exactly as follows: `small` is under 30%, `medium` is 30% to
under 60%, and `large` is 60% through 100%. These bands are pricing groups:
small = ₱50, medium = ₱100, large = ₱150, for either top or side. Do not emit a
`direct diameter-relative size` for either piped-flower type and do not count individual piped
blooms.

This rule overrides the ordinary flower rule for piped icing only. Separate
molded, cut, sculpted, or thick matte fondant/gumpaste petals remain
`edible_flowers` with `material: "edible_fondant"`; wafer, fresh, artificial,
printed, and non-cake flowers remain governed by their own construction and
cake-membership rules.$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.90: piped-treatment anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$### PIPED ICING FLOWERS — GROUPED COVERAGE PRICING (AUTHORITATIVE)

See OUTPUT ORDER step 6.

Piped flowers are icing only: directly piped buttercream/frosting petals,
rosettes, shells, ruffles, star-tip blossoms, or swirls that visibly merge into
the iced cake surface. Their ridged or petalled frosting texture is not
separate fondant or gumpaste construction, even when the flower resembles a
rose, peony, or blossom.

Emit the complete treatment as one row with `material: "icing"` and
`quantity: 1`—never one row per bloom:

- Top-surface flowers: one `main_toppers` row with `type:
  "piped_flowers_top"`, `classification: "hero"`, and `coverage` measured
  against the directly visible top surface.
- Sidewall flowers: one `support_elements` row with `type:
  "piped_flowers_side"` and `coverage` measured against the directly visible
  iced cake-side area. If an independent treatment appears on both top and
  side, emit one row of each type.

Set `coverage` exactly as follows: `small` is under 30%, `medium` is 30% to
under 60%, and `large` is 60% through 100%. These bands are pricing groups:
small = ₱50, medium = ₱100, large = ₱150, for either top or side. Do not emit a
`direct diameter-relative size` for either piped-flower type and do not count individual piped
blooms.

This rule overrides the ordinary flower rule for piped icing only. Separate
molded, cut, sculpted, or thick matte fondant/gumpaste petals remain
`edible_flowers` with `material: "edible_fondant"`; wafer, fresh, artificial,
printed, and non-cake flowers remain governed by their own construction and
cake-membership rules.$old$,
    $new$### PIPED BOTANICAL TREATMENT — GROUPED COVERAGE PRICING (AUTHORITATIVE)

See OUTPUT ORDER step 6.

Piped flowers and their integrated foliage are icing only: directly piped
buttercream/frosting petals, rosettes, buds, shells, ruffles, star-tip
blossoms, swirls, or pointed leaf strokes that visibly merge into the iced cake
surface. Extrusion ridges, piping-tip seams, soft peaks, and continuous joins
are positive piped-icing evidence; they are not separate fondant or gumpaste
construction, even when the flower resembles a rose, peony, or blossom.

Emit the complete treatment as one row with `material: "icing"` and
`quantity: 1`—never one row per bloom:

- Top-surface flowers: one `main_toppers` row with `type:
  "piped_flowers_top"`, `classification: "hero"`, and `coverage` measured
  against the directly visible top surface.
- Sidewall flowers: one `support_elements` row with `type:
  "piped_flowers_side"` and `coverage` measured against the directly visible
  iced cake-side area. If an independent treatment appears on both top and
  side, emit one row of each type.

Set `coverage` exactly as follows: `small` is under 30%, `medium` is 30% to
under 60%, and `large` is 60% through 100%. These bands are pricing groups:
small = ₱50, medium = ₱100, large = ₱150, for either top or side. Do not emit a
`direct diameter-relative size` for either piped-flower type and do not count individual piped
blooms or leaves. Describe accompanying piped foliage as part of the treatment.

This rule overrides ordinary-flower, filler-flower, and edible-leaf
normalization for directly piped botanicals only. Separate molded, cut,
sculpted, or thick matte fondant/gumpaste petals and leaves—with a
self-contained body or clear separation/shadow from the iced surface—remain
`edible_flowers` or `edible_2d_support` with `material: "edible_fondant"`.
Wafer, fresh, artificial, printed, and non-cake flowers remain governed by
their own construction and cake-membership rules. If there are no piped
flowers, a non-floral piped foliage border is `icing_decorations`.$new$);

  if position($old$If a cake-member item is visibly a flower, blossom, rose, bud, daisy, orchid,
petal cluster, or floral accent, classify it as `edible_flowers` unless it is
clearly piped icing. A discrete edible leaf or foliage piece is never a flower
for this rule: apply `EDIBLE LEAF AND FOLIAGE NORMALIZATION` instead.

Before applying this ordinary-flower rule, classify every small generic filler
flower and every baby's-breath flower as `edible_flowers_filler` in$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.90: flower-precedence anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$If a cake-member item is visibly a flower, blossom, rose, bud, daisy, orchid,
petal cluster, or floral accent, classify it as `edible_flowers` unless it is
clearly piped icing. A discrete edible leaf or foliage piece is never a flower
for this rule: apply `EDIBLE LEAF AND FOLIAGE NORMALIZATION` instead.

Before applying this ordinary-flower rule, classify every small generic filler
flower and every baby's-breath flower as `edible_flowers_filler` in$old$,
    $new$Before applying this rule, apply `PIPED BOTANICAL TREATMENT — CONSTRUCTION
PRECEDENCE`. If a cake-member item is visibly a flower, blossom, rose, bud,
daisy, orchid, petal cluster, or floral accent and fails that gate, classify it
as `edible_flowers`. A discrete edible leaf or foliage piece is never a flower
for this rule: apply `EDIBLE LEAF AND FOLIAGE NORMALIZATION` instead.

After the construction gate fails, classify every small generic filler flower
and every baby's-breath flower as `edible_flowers_filler` in$new$);

  if position($old$### FONDANT VS SOFT ICING IDENTIFICATION (CRITICAL)

For this section we are talking about identifying the body of the cake, if it is Fondant or Soft Icing. We are not talking about the toppers on top of the cake.

**SOFT ICING (boiled/marshmallow/buttercream):**
- Surface: Creamy, soft, slightly uneven - shows swirls, ruffles, dollops, natural imperfections
- Shine: Slight glossy sheen from boiled sugar or butter
- Borders: Often piped rosettes, ruffles, dollops
- Structure: Rarely perfectly smooth sides.
- Texture: Visible cream texture, may show spatula marks
- even if the cake icing looks like buttercream, we still identify it as SOFT ICING.
- Visible horizontal combed, ridged, ribbed, or scraper-band texture is decisive
  soft-icing evidence, including buttercream, whipped cream, and marshmallow
  icing. Do not classify that textured icing as fondant merely because the
  color blend is neat or gradient.
- CAKE EDGES: if the cake has sharp edges then 80% of the time we identify it as Soft icing.

**FONDANT:**
- Surface: Very smooth and uniform, matte or satin-like finish, no visible cream texture
- Classic style → curved/rounded edges. the radius of the curve is more or less 0.25 to 0.5 inches <- this is very important indicator of fondant
- Key indicator: Surface looks like a "sheet covering" the cake
- Texture: Uniform
- CAKE EDGES: if the cake has classical rounded edge then its fondant.$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.90: fondant-identification anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$### FONDANT VS SOFT ICING IDENTIFICATION (CRITICAL)

For this section we are talking about identifying the body of the cake, if it is Fondant or Soft Icing. We are not talking about the toppers on top of the cake.

**SOFT ICING (boiled/marshmallow/buttercream):**
- Surface: Creamy, soft, slightly uneven - shows swirls, ruffles, dollops, natural imperfections
- Shine: Slight glossy sheen from boiled sugar or butter
- Borders: Often piped rosettes, ruffles, dollops
- Structure: Rarely perfectly smooth sides.
- Texture: Visible cream texture, may show spatula marks
- even if the cake icing looks like buttercream, we still identify it as SOFT ICING.
- Visible horizontal combed, ridged, ribbed, or scraper-band texture is decisive
  soft-icing evidence, including buttercream, whipped cream, and marshmallow
  icing. Do not classify that textured icing as fondant merely because the
  color blend is neat or gradient.
- CAKE EDGES: if the cake has sharp edges then 80% of the time we identify it as Soft icing.

**FONDANT:**
- Surface: Very smooth and uniform, matte or satin-like finish, no visible cream texture
- Classic style → curved/rounded edges. the radius of the curve is more or less 0.25 to 0.5 inches <- this is very important indicator of fondant
- Key indicator: Surface looks like a "sheet covering" the cake
- Texture: Uniform
- CAKE EDGES: if the cake has classical rounded edge then its fondant.$old$,
    $new$### FONDANT VS SOFT ICING IDENTIFICATION (CRITICAL)

For this section we are talking about identifying the body of the cake, if it is Fondant or Soft Icing. We are not talking about the toppers on top of the cake.

### FONDANT POSITIVE-EVIDENCE GATE (BINDING)

Do not choose a Fondant cake type from smooth pastel color, airbrush, a neat
gradient, floral decorations, or a single photograph angle. A fondant cake
body requires direct evidence of a continuous, uniform fondant/gumpaste sheet
covering the body plus at least one of: a clearly rounded rolled edge, a
seam/overlap or wrapped finish, or a uniform matte sheet without cream texture.

If this positive sheet-cover evidence is absent and the cake body or its own
attached finish has piped swags, shell borders, ruffles, rosettes, dollops,
soft peaks, cream sheen, or natural buttercream texture, choose the non-Fondant
cake type and `icing_design.base: "soft_icing"`. Piped top flowers alone do not
decide the base; use body construction. In conflict or uncertainty, favor soft
icing.

**SOFT ICING (boiled/marshmallow/buttercream):**
- Surface: Creamy, soft, slightly uneven - shows swirls, ruffles, dollops, natural imperfections
- Shine: Slight glossy sheen from boiled sugar or butter
- Borders: Often piped rosettes, ruffles, dollops
- Structure: Rarely perfectly smooth sides.
- Texture: Visible cream texture, may show spatula marks
- even if the cake icing looks like buttercream, we still identify it as SOFT ICING.
- Visible horizontal combed, ridged, ribbed, or scraper-band texture is decisive
  soft-icing evidence, including buttercream, whipped cream, and marshmallow
  icing. Do not classify that textured icing as fondant merely because the
  color blend is neat or gradient.
- CAKE EDGES: neat or sharp edges can occur in soft icing and never establish
  fondant.

**FONDANT:**
- Surface: Very smooth and uniform, matte or satin-like finish, no visible cream texture
- Classic style → curved/rounded edges can support fondant only after direct
  continuous-sheet evidence is present.
- Key indicator: Surface looks like a "sheet covering" the cake
- Texture: Uniform
- CAKE EDGES: a classical rounded edge alone is not enough to identify fondant.$new$);

  if md5(next_prompt) <> v390_md5 then
    raise exception 'Cannot stage v3.90: assembled prompt checksum is unexpected';
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description)
  values (
    '3.90',
    next_prompt,
    false,
    'Construction-first piped botanicals and positive-evidence fondant cake-body gate.'
  );
end;
$migration$;

commit;
