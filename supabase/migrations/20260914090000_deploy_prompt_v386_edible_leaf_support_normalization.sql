-- Normalize every discrete edible fondant/gumpaste leaf or foliage piece to
-- a small edible_2d_support support row. Historical analyses remain unchanged.
begin;

do $migration$
declare
  active_count integer;
  source_version text;
  source_prompt text;
  next_prompt text;
  v385_md5 constant text := 'c98da2f592085f039e653eb938d9701a';
  v386_md5 constant text := '64542a47d0e7f19b51db22a6209ed0e4';
begin
  lock table public.ai_prompts in share row exclusive mode;

  select count(*) into active_count from public.ai_prompts where is_active = true;
  if active_count <> 1 then
    raise exception 'Cannot deploy v3.86: expected exactly one active prompt, found %', active_count;
  end if;

  select version, prompt_text into source_version, source_prompt
  from public.ai_prompts
  where is_active = true;

  if source_version <> '3.85' or md5(source_prompt) <> v385_md5 then
    raise exception 'Cannot deploy v3.86: verified active v3.85 source is required';
  end if;

  if exists (select 1 from public.ai_prompts where version = '3.86') then
    raise exception 'Cannot deploy v3.86: target version already exists';
  end if;

  next_prompt := source_prompt;

  if position($v386_title_old$**v3.85 Version - Clean Direct Diameter-Anchored Sizing**

### CHANGELOG
- Replaced coordinate-line sizing with direct small/medium/large estimation anchored to the visible top-tier cake diameter.$v386_title_old$ in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.86: title/changelog anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v386_title_old$**v3.85 Version - Clean Direct Diameter-Anchored Sizing**

### CHANGELOG
- Replaced coordinate-line sizing with direct small/medium/large estimation anchored to the visible top-tier cake diameter.$v386_title_old$,
    $v386_title_new$**v3.86 Version - Edible Leaf Support Normalization**

### CHANGELOG
- Normalize every discrete edible fondant/gumpaste leaf or foliage piece to a small `edible_2d_support` support row.
- Replaced coordinate-line sizing with direct small/medium/large estimation anchored to the visible top-tier cake diameter.$v386_title_new$);

  if position($v386_size_old$Emit exactly one size value—small, medium, or large—for every topper and support row. Compare one representative physical item with the visible left-to-right diameter of the TOP TIER it sits on or is closest to; for a cupcake use that cupcake body, and for Bento or Bento Cupcake Set use the bento cake body. Use broad anchors: small is clearly under about one-third of that diameter; medium is about one-third to under about two-thirds; large is about two-thirds or more. At a genuinely ambiguous boundary, choose the less expensive adjacent band. Never compare a complete arrangement, full tier stack, board, plate, or background.$v386_size_old$ in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.86: direct-size anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v386_size_old$Emit exactly one size value—small, medium, or large—for every topper and support row. Compare one representative physical item with the visible left-to-right diameter of the TOP TIER it sits on or is closest to; for a cupcake use that cupcake body, and for Bento or Bento Cupcake Set use the bento cake body. Use broad anchors: small is clearly under about one-third of that diameter; medium is about one-third to under about two-thirds; large is about two-thirds or more. At a genuinely ambiguous boundary, choose the less expensive adjacent band. Never compare a complete arrangement, full tier stack, board, plate, or background.$v386_size_old$,
    $v386_size_new$Emit exactly one size value—small, medium, or large—for every topper and support row. Compare one representative physical item with the visible left-to-right diameter of the TOP TIER it sits on or is closest to; for a cupcake use that cupcake body, and for Bento or Bento Cupcake Set use the bento cake body. Use broad anchors: small is clearly under about one-third of that diameter; medium is about one-third to under about two-thirds; large is about two-thirds or more. At a genuinely ambiguous boundary, choose the less expensive adjacent band. Never compare a complete arrangement, full tier stack, board, plate, or background.

### EDIBLE LEAF AND FOLIAGE NORMALIZATION (BINDING)

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
edible leaf piece.$v386_size_new$);

  if position($v386_matrix_old$| Each ball in a multi-ball plastic balloon cluster, bouquet, arch, or garland | `plastic_ball_regular` | `plastic` | support element | representative `direct diameter-relative size` |$v386_matrix_old$ in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.86: canonical matrix anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v386_matrix_old$| Each ball in a multi-ball plastic balloon cluster, bouquet, arch, or garland | `plastic_ball_regular` | `plastic` | support element | representative `direct diameter-relative size` |$v386_matrix_old$,
    $v386_matrix_new$| Each ball in a multi-ball plastic balloon cluster, bouquet, arch, or garland | `plastic_ball_regular` | `plastic` | support element | representative `direct diameter-relative size` |
| Any discrete edible fondant/gumpaste leaf or foliage piece | `edible_2d_support` | `edible_fondant` | support element only | fixed `small` |$v386_matrix_new$);

  if position($v386_complex_old$A single simple cut motif, or a repeated/focal group of identical simple motifs
such as stars, hearts, circles, leaves, or geometric shapes, is never
`edible_2d_complex`. Large span, multiple colors, a flat back, shallow relief,
or an upright support stick does not add components or make a simple motif
complex. Use `edible_2d_shapes` for a focal shape or coherent focal group, and
`edible_2d_support` for other flat accents. A readable logo, wordmark, or brand
design remains `edible_logo_2d` under its dedicated rule.$v386_complex_old$ in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.86: 2D-complex anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v386_complex_old$A single simple cut motif, or a repeated/focal group of identical simple motifs
such as stars, hearts, circles, leaves, or geometric shapes, is never
`edible_2d_complex`. Large span, multiple colors, a flat back, shallow relief,
or an upright support stick does not add components or make a simple motif
complex. Use `edible_2d_shapes` for a focal shape or coherent focal group, and
`edible_2d_support` for other flat accents. A readable logo, wordmark, or brand
design remains `edible_logo_2d` under its dedicated rule.$v386_complex_old$,
    $v386_complex_new$A single simple cut motif, or a repeated/focal group of identical simple motifs
such as stars, hearts, circles, or geometric shapes, is never
`edible_2d_complex`. Large span, multiple colors, a flat back, shallow relief,
or an upright support stick does not add components or make a simple motif
complex. Use `edible_2d_shapes` for a focal shape or coherent focal group, and
`edible_2d_support` for other flat accents. A readable logo, wordmark, or brand
design remains `edible_logo_2d` under its dedicated rule. Discrete edible
leaves and foliage always follow `EDIBLE LEAF AND FOLIAGE NORMALIZATION`.$v386_complex_new$);

  if position($v386_shape_precedence_old$4. Plain stars, dots, hearts, leaves, geometric pieces, and other simple flat
   cut shapes remain `edible_2d_shapes` when one shape or a coherent focal
   group of flat toppers is the dominant decoration, emitted in
   `main_toppers`. All other flat pieces remain `edible_2d_support`, emitted
   in `support_elements`.$v386_shape_precedence_old$ in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.86: flat-shape precedence anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v386_shape_precedence_old$4. Plain stars, dots, hearts, leaves, geometric pieces, and other simple flat
   cut shapes remain `edible_2d_shapes` when one shape or a coherent focal
   group of flat toppers is the dominant decoration, emitted in
   `main_toppers`. All other flat pieces remain `edible_2d_support`, emitted
   in `support_elements`.$v386_shape_precedence_old$,
    $v386_shape_precedence_new$4. Plain stars, dots, hearts, geometric pieces, and other simple flat
   cut shapes remain `edible_2d_shapes` when one shape or a coherent focal
   group of flat toppers is the dominant decoration, emitted in
   `main_toppers`. All other flat pieces remain `edible_2d_support`, emitted
   in `support_elements`; discrete edible leaves and foliage are always
   `edible_2d_support` support rows with `size: "small"`.$v386_shape_precedence_new$);

  if position($v386_flower_old$If a cake-member item is visibly a flower, blossom, rose, bud, daisy, orchid,
petal cluster, or floral accent, classify it as `edible_flowers` unless it is
clearly piped icing.$v386_flower_old$ in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.86: flower precedence anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v386_flower_old$If a cake-member item is visibly a flower, blossom, rose, bud, daisy, orchid,
petal cluster, or floral accent, classify it as `edible_flowers` unless it is
clearly piped icing.$v386_flower_old$,
    $v386_flower_new$If a cake-member item is visibly a flower, blossom, rose, bud, daisy, orchid,
petal cluster, or floral accent, classify it as `edible_flowers` unless it is
clearly piped icing. A discrete edible leaf or foliage piece is never a flower
for this rule: apply `EDIBLE LEAF AND FOLIAGE NORMALIZATION` instead.$v386_flower_new$);

  if position($v386_support_old$- Simple leaves (edible_2d_support only)$v386_support_old$ in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.86: support-category anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v386_support_old$- Simple leaves (edible_2d_support only)$v386_support_old$,
    $v386_support_new$- Every discrete edible leaf or foliage piece (`edible_2d_support`, `small` only)$v386_support_new$);

  if position($v386_bundle_old$| `gumpaste_bundle` | edible_fondant | Cluster of gumpaste items: stones, rocks, seaweeds, leaves (Readable message letters not included). Count as a whole one group|$v386_bundle_old$ in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.86: gumpaste-bundle anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v386_bundle_old$| `gumpaste_bundle` | edible_fondant | Cluster of gumpaste items: stones, rocks, seaweeds, leaves (Readable message letters not included). Count as a whole one group|$v386_bundle_old$,
    $v386_bundle_new$| `gumpaste_bundle` | edible_fondant | Cluster of gumpaste items: stones, rocks, or seaweeds (Readable message letters not included). Count as a whole one group. Discrete edible leaves and foliage use `edible_2d_support` instead. |$v386_bundle_new$);

  if position($v386_support_type_old$| `edible_2d_support` | edible_fondant | Flat 2D gumpaste shapes (stars, dots, confetti, leaves). Always support; count and price per piece. |$v386_support_type_old$ in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.86: edible-2D-support anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v386_support_type_old$| `edible_2d_support` | edible_fondant | Flat 2D gumpaste shapes (stars, dots, confetti, leaves). Always support; count and price per piece. |$v386_support_type_old$,
    $v386_support_type_new$| `edible_2d_support` | edible_fondant | Flat 2D gumpaste shapes (stars, dots, confetti, leaves). Always support; count and price per piece. Every discrete edible leaf or foliage piece is this type in `support_elements` with `size: "small"`, regardless of scale, placement, or focal appearance. |$v386_support_type_new$);

  if position($v386_checklist_old$✅ Application-owned direct diameter-anchor sizing; the model does not emit element sizes$v386_checklist_old$ in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.86: final-checklist anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v386_checklist_old$✅ Application-owned direct diameter-anchor sizing; the model does not emit element sizes$v386_checklist_old$,
    $v386_checklist_new$✅ Application-owned direct diameter-anchor sizing; the model does not emit element sizes
✅ Every discrete edible leaf/foliage piece = `edible_2d_support`, support, `small`$v386_checklist_new$);

  -- The repository fallback deliberately retains its terminal newline. Preserve
  -- exact deployed/fallback bytes so runtime fallback is a true live mirror.
  next_prompt := next_prompt || E'\n';

  if md5(next_prompt) <> v386_md5 then
    raise exception 'Cannot deploy v3.86: assembled prompt checksum is unexpected';
  end if;

  update public.ai_prompts set is_active = false, updated_at = now() where is_active = true;
  insert into public.ai_prompts (version, prompt_text, is_active, description)
  values ('3.86', next_prompt, true,
    'Every discrete edible fondant/gumpaste leaf or foliage piece is a small edible_2d_support support row.');
end;
$migration$;

commit;
