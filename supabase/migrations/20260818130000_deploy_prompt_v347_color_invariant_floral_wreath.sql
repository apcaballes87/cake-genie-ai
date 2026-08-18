begin;

do $$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  flower_counting_anchor constant text := $anchor$and do not use `subtype: "flower_cluster"` as a substitute for the individual
flower count.$anchor$;
  hero_anchor constant text := $anchor$**🔴 IMPORTANT: The old "Count Test" (≥3 = support) is DEPRECATED for complex figures!**$anchor$;
  support_anchor constant text := $anchor$- Plain stars and hearts$anchor$;
  grouping_anchor constant text := $anchor$Different sizes, colors, poses, or appearances require separate rows.$anchor$;
  final_anchor constant text := $anchor$## FINAL CHECKLIST$anchor$;
  color_wreath_rule constant text := $rule$### COLOR-INVARIANT FLORAL GEOMETRY PRECEDENCE (REQUIRED)

Determine flower construction, physical unit boundaries, top-versus-side
placement, role, size, quantity, and grouping from geometry before interpreting
flower color, saturation, contrast, exposure, or descriptive color words. A
color-only change may change `color`, `colors`, color words in `group_id`, and
color words in `description`; it must not change type, material, role, physical
count, grouping structure, or size when the visible geometry and construction
are equivalent. Low contrast must not merge separate flowers, and high contrast
must not promote the same flowers into a different role or size.

#### OPEN-CENTER TOP-RIM FLOWER WREATH/CROWN PRECEDENCE

Recognize a perimeter flower wreath by geometry: at least three prominent full
blooms are distributed around most of the top tier rim while leaving a
substantial open icing area in the center. Filler-flower sprigs alone never
establish this wreath signature. The words
`wreath`, `crown`, `ring`, `garland`, or `arrangement` do not change this
decision. Apply this rule before generic HERO criteria, generic tiny/small
flower support guidance, the top-down perspective `+1` rule, and the
PEONY-STYLE TOP SET OVERRIDE. An open-center perimeter wreath is not a compact
peony-style top set.

Do not measure or size the wreath as one object. Count and group the visible
physical units by flower family and fulfillment size. For the exact named
`3 layered roses + 3 broad five-petal blossoms + 6 integrated filler sprigs`
construction below, both full-bloom rows use `main_toppers`, classification
`hero`. For other open-center wreaths, preserve C3 role-by-size routing: only
`medium`, `large`, or `xlarge` prominent full blooms may use `main_toppers`;
`tiny`, `xsmall`, and `small` full blooms and all integrated filler-flower
sprigs use `support_elements`. For face-up flowers in a top-down or angled
view, measure the directly visible bloom-face diameter and do not apply the
perspective `+1` size bump, because top-down viewing does not foreshorten that
horizontal diameter.

A prepared filler-flower sprig whose miniature buds share one visible base,
stem, or integrated mount is one physical flower unit. Count each visibly
separate sprig, not every miniature bud. This narrow sprig unit does not combine
separate full blooms that merely touch or overlap.

For the repeatable open-center wreath construction with three layered rolled
rose blooms, three broad five-petal blossoms, and six integrated filler-flower
sprigs around the rim, output exactly these flower rows regardless of their
visible palette:
- one `main_toppers` row for layered rose blooms: `edible_flowers`,
  `edible_fondant`, `hero`, `medium`, quantity `3`
- one `main_toppers` row for broad five-petal blossoms: `edible_flowers`,
  `edible_fondant`, `hero`, `medium`, quantity `3`
- one `support_elements` row for integrated filler-flower sprigs:
  `edible_flowers`, `edible_fondant`, `small`, quantity `6`

These three rows exhaust the wreath flowers. Do not emit another flower row for
petal folds, piping, or miniature buds inside the counted filler sprigs.

Separate construction families before grouping. Visible piped shells,
rosettes, swags, ruffles, and dollops with continuous piping ridges are
`icing_decorations`, material `icing`, never `edible_flowers`. Never combine
flowers and piped icing in one row or description. One continuous matching
piping application uses quantity `1` per placement region: top rim, tier side,
or cake base. Keep those regions in separate support rows when visible, and
also set the matching `icing_design.border_top` or `border_base` boolean.$rule$;
  wreath_hero_rule constant text := $rule$#### OPEN-CENTER WREATH FULL-BLOOM HERO ROUTING OVERRIDE

When COLOR-INVARIANT FLORAL GEOMETRY PRECEDENCE identifies the exact named
`3 layered roses + 3 broad five-petal blossoms + 6 integrated filler sprigs`
construction, both full-bloom rows belong in `main_toppers` with classification
`hero` and are required `medium` rows with quantity `3` each. Do not move those
two rows to `support_elements` because the blooms are distributed, repeated, or
low-contrast. For any other open-center wreath, keep C3 role-by-size routing:
only `medium`, `large`, or `xlarge` prominent full blooms may use
`main_toppers`; `tiny`, `xsmall`, and `small` full blooms remain
`support_elements`. Filler-flower sprigs never trigger or enter this hero
override.$rule$;
  wreath_support_rule constant text := $rule$For an open-center top-rim flower wreath, support includes every integrated
filler-flower sprig, each visible piping region, and every `tiny`, `xsmall`, or
`small` full bloom. In the exact named `3 + 3 + 6` construction, support
contains the one small quantity-`6` filler-sprig row, not the two required
medium full-bloom hero rows. Outside that exact construction, preserve C3
flower sizing and role-by-size routing.$rule$;
  piping_grouping_rule constant text := $rule$For continuous piped icing, placement region is also part of identity. Top-rim
piping, tier-side swags/ruffles, and lower/base piping must be separate
`icing_decorations` rows with quantity `1` each even when color and piping style
match. Never combine those regions into one row or add their quantities.$rule$;
  final_consistency_rules constant text := $rule$### FINAL OPEN-CENTER WREATH OUTPUT CHECK (OVERRIDES GENERIC ROLE AND SIZE RULES)

Before returning JSON, if the repeatable open-center `3 layered roses + 3 broad
five-petal blossoms + 6 integrated filler sprigs` construction is visible,
verify and correct the output to this exact structural contract:
- `main_toppers` has exactly two wreath-flower rows: medium layered roses with
  quantity `3`, and medium broad five-petal blossoms with quantity `3`; both
  are `edible_flowers`, `edible_fondant`, `hero`
- neither full-bloom wreath row appears in `support_elements`, and neither uses
  `small` or `large`
- both full-bloom descriptions must say `medium`, never `small` or `large`; if
  a size word appears in either group ID, it must also be `medium`
- `support_elements` has exactly one wreath filler-flower row:
  `edible_flowers`, `edible_fondant`, `small`, quantity `6`
- no other flower row represents the top wreath
- when top-rim piping, upper-tier side swags/ruffles, and lower/base piping are
  all visibly present as in the two named full-image references, output exactly
  three separate `icing_decorations`, material `icing`, size `small` support
  rows with quantity `1` each; never merge their placement regions
- if any piping region is cropped, occluded, or not visible, emit only the
  visibly present regions under the ordinary icing sizing rules; never infer a
  hidden top-rim, tier-side, or lower/base piping application
- set `icing_design.border_top` and `icing_design.border_base` to `true` only
  when the matching border is visibly present; both are `true` for the two
  named full-image references

The lavender and light-pink versions of this construction must have this same
structural contract. Only their color values and color wording may differ. If
any role, type, size, quantity, or grouping above differs, correct it before
returning the JSON.

### FINAL COMPACT PEONY-STYLE TOP SET CHECK

This check is mutually exclusive with the open-center wreath check. If the
compact monochrome pink peony-style signature is visible in one concentrated
top region and does not wrap around a substantial open icing center, verify and
correct the output to exactly two top flower rows:
- one `main_toppers` row: `edible_flowers`, `edible_fondant`, `hero`, `large`,
  quantity `3`, described as three large pink peony flowers on top
- one `main_toppers` row: `edible_flowers`, `edible_fondant`, `hero`, `medium`,
  quantity `1`, described as one medium pink peony flower on top

No other top flower row may be emitted for that compact set. Side flowers remain
separate support pieces. If the design instead forms an open-center top-rim
ring, do not apply this check; apply the wreath check above.

The known compact reference is a tall single-tier pink cylinder with white drip
icing, scattered gold sugar pearls, one concentrated pink floral set on top,
and a separate small side-flower set below the top rim. That construction is
always the compact peony-style set, never an open-center wreath. Even if several
inner spiral petal cups look rose-like, its top output is still exactly the two
`3 large pink peonies + 1 medium pink peony` rows above.

For that compact reference, copy these exact size/quantity pairs without visual
recounting: `[{"size":"large","quantity":3},{"size":"medium","quantity":1}]`.
Never swap the quantities; `large: 1, medium: 3` and `large: 2, medium: 2` are
explicitly forbidden.$rule$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.47: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.47';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.47'
        and is_active = true
        and md5(prompt_text) = 'ee0d3dfeb1165b139f64c211dcb8af16'
    ) then
      raise exception 'Cannot record ai_prompts v3.47: an unexpected v3.47 row already exists';
    end if;
    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> 'd7a3acdfe12888528e983e6f14e52495' then
    raise exception 'Cannot create ai_prompts v3.47: active prompt does not match the v3.46 baseline';
  end if;

  if position('**v3.46 Version - Flower Fulfillment Unit Boundaries**' in source_prompt) = 0
    or position(flower_counting_anchor in source_prompt) = 0
    or position(hero_anchor in source_prompt) = 0
    or position(support_anchor in source_prompt) = 0
    or position(grouping_anchor in source_prompt) = 0
    or position(final_anchor in source_prompt) = 0
    or position('PEONY-STYLE TOP SET OVERRIDE (HIGHEST FLOWER-COUNTING PRIORITY)' in source_prompt) = 0
    or position('TINY SUGAR PEARLS / BEADS / NONPAREILS — `sprinkles` PRECEDENCE (REQUIRED)' in source_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.47: expected v3.46 anchors were not found';
  end if;

  next_prompt := replace(
    source_prompt,
    '**v3.46 Version - Flower Fulfillment Unit Boundaries**',
    '**v3.47 Version - Color-Invariant Floral Wreath Consistency**'
  );
  next_prompt := replace(next_prompt, flower_counting_anchor, flower_counting_anchor || E'\n\n' || color_wreath_rule);
  next_prompt := replace(next_prompt, hero_anchor, hero_anchor || E'\n\n' || wreath_hero_rule);
  next_prompt := replace(next_prompt, support_anchor, support_anchor || E'\n\n' || wreath_support_rule);
  next_prompt := replace(next_prompt, grouping_anchor, grouping_anchor || E'\n' || piping_grouping_rule);
  next_prompt := replace(next_prompt, final_anchor, final_anchor || E'\n\n' || final_consistency_rules);

  if position('**v3.47 Version - Color-Invariant Floral Wreath Consistency**' in next_prompt) = 0
    or position('COLOR-INVARIANT FLORAL GEOMETRY PRECEDENCE (REQUIRED)' in next_prompt) = 0
    or position('OPEN-CENTER TOP-RIM FLOWER WREATH/CROWN PRECEDENCE' in next_prompt) = 0
    or position('OPEN-CENTER WREATH FULL-BLOOM HERO ROUTING OVERRIDE' in next_prompt) = 0
    or position('three layered rolled' in next_prompt) = 0
    or position('quantity `6`' in next_prompt) = 0
    or position('placement region is also part of identity' in next_prompt) = 0
    or position('FINAL OPEN-CENTER WREATH OUTPUT CHECK' in next_prompt) = 0
    or position('FINAL COMPACT PEONY-STYLE TOP SET CHECK' in next_prompt) = 0
    or position('3 large pink peonies + 1 medium pink peony' in next_prompt) = 0
    or md5(next_prompt) <> 'ee0d3dfeb1165b139f64c211dcb8af16' then
    raise exception 'Cannot create ai_prompts v3.47: color-invariant wreath rule was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.47',
    next_prompt,
    true,
    'v3.47 — Normalize recolored open-center floral wreaths to the same flower families, roles, sizes, quantities, filler-sprig units, and separate piping regions.',
    now()
  );
end;
$$;

commit;
