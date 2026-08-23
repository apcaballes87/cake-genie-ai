-- Deploy prompt v3.54. Require direct construction evidence for priced
-- conditioned wafer-paper waves and promote distinct intricate cake flowers.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_heading constant text := '**v3.53 Version - Gumpaste Stripe Coverage Clarification**';
  new_heading constant text := '**v3.54 Version - Evidence-Gated Wafer Waves and Intricate Flowers**';
  old_wafer_checkpoint constant text := $anchor$### PRE-EMISSION UPRIGHT WAFER-PAPER SIDE CHECKPOINT (REQUIRED)

Before deciding that a vertical, wavy, rippled, ruffled, or pleated cake-side
finish is icing, inspect whether it is made of distinct thin upright strips or
panels with their own loose wavy edges and visible separation from the iced
side. If it is, it is **Conditioned Wafer Paper**, even when it is all white,
unprinted, and covers the full side: emit the `edible_photo_side_wave` support
element using the tier fulfillment units in the conditioned-wafer-paper rule
below. Do not omit that support element or describe the separate strips as
icing texture. Do not use this type from wave wording alone: a continuous
piped, spread, or palette-knife texture with no separate upright sheets
remains icing.$anchor$;
  new_wafer_checkpoint constant text := $anchor$### PRE-EMISSION UPRIGHT WAFER-PAPER SIDE CHECKPOINT (REQUIRED)

`edible_photo_side_wave` is an exceptional, evidence-gated fulfillment type.
Emit it only when the image directly shows **all** of these construction cues
on a cake side: (1) individually distinguishable thin paper sheets or strips,
(2) those sheets adhered upright and visibly separate from the iced side,
(3) loose/free wavy, ruffled, or pleated sheet edges, and (4) a repeated,
predominantly full-height side-wrap architecture around a tier.

Do not infer this type from white color, generic words such as wave, ruffle,
texture, wafer, or paper, or from a soft/blurred image. Do not use it for
flowers, leaves, butterflies, lace, plaques, quilted/fondant panels, piped
borders, piped swags, isolated side accents, or continuous icing texture. If
all four cues are not directly visible, omit `edible_photo_side_wave`.$anchor$;
  old_wafer_forensics constant text := $anchor$This fulfillment rule overrides generic edible-photo image/print wording and
generic icing-texture classification when the cake side visibly has distinct,
thin, upright, wavy, rippled, ruffled, or pleated wafer-paper strips or panels
adhered around a tier. It applies even when the wafer paper has no printed
image.$anchor$;
  new_wafer_forensics constant text := $anchor$Use this fulfillment rule only when all four direct-image cues in the
PRE-EMISSION UPRIGHT WAFER-PAPER SIDE CHECKPOINT are visible. It never follows
from a textual label or a guessed material. The correct visual is a perimeter
of repeated, individually distinguishable thin upright sheets with loose/free
wavy edges and visible separation from the iced side—even when the sheets are
white and unprinted.$anchor$;
  old_wafer_quantity_tail constant text := $anchor$- 1 Tier -> quantity `1`
- 2 Tier -> quantity `3`
- 3 Tier -> quantity `4`

Do NOT classify this feature as `edible_photo_side`, `edible_photo_print`,$anchor$;
  new_wafer_quantity_tail constant text := $anchor$- 1 Tier -> quantity `1`
- 2 Tier -> quantity `3`
- 3 Tier -> quantity `4`

Its description must state the observed construction evidence: repeated,
predominantly full-height perimeter wrap of separate thin upright wafer-paper
strips/sheets with loose/free wavy edges. If the evidence cannot be described
truthfully, omit the item.

Do NOT classify this feature as `edible_photo_side`, `edible_photo_print`,$anchor$;
  old_wafer_exclusions constant text := $anchor$`icing_brush_stroke`, `gumpaste_panel`, or `satin_ribbon`. Continuous piped,
spread, or palette-knife icing texture without separate thin upright sheets
remains an icing type, not `edible_photo_side_wave`.$anchor$;
  new_wafer_exclusions constant text := $anchor$`icing_brush_stroke`, `gumpaste_panel`, or `satin_ribbon`. Continuous piped,
spread, or palette-knife icing texture without separate thin upright sheets;
floral or butterfly cascades; quilted/fondant panels; lace; plaques; and
isolated decorative side accents are not `edible_photo_side_wave`.$anchor$;
  flower_placement_anchor constant text := $anchor$`edible_2d_support`; the hero criteria never promote them to `main_toppers`.
Only `medium`, `large`, or `xlarge` blooms may appear in `main_toppers`.

### FLOWER PIECE COUNTING AND SIZE PRECEDENCE (BOTH MAIN AND SUPPORT — REQUIRED)$anchor$;
  flower_placement_replacement constant text := $anchor$`edible_2d_support`; the hero criteria never promote them to `main_toppers`.
Only `medium`, `large`, or `xlarge` blooms may appear in `main_toppers`.

### INTRICATE FLOWER MINIMUM-SIZE PRECEDENCE

A cake-member flower with visibly individually sculpted, layered, or detailed
petal construction—such as an intricate rose, tulip, stargazer, sunflower, or
peony—has a minimum size of `medium`. This fulfillment precedence overrides a
smaller raw C3 diameter estimate: emit each such bloom as `edible_flowers`,
material `edible_fondant`, in `main_toppers` with `classification: "hero"`.

Apply this only to a distinct, visibly intricate bloom. Do not promote tiny
buds, simple blossoms, flat flower cutouts, generic filler flowers, or actual
piped buttercream rosettes. Count and size each visible bloom independently;
do not merge intricate blooms with smaller support flowers.

### FLOWER PIECE COUNTING AND SIZE PRECEDENCE (BOTH MAIN AND SUPPORT — REQUIRED)$anchor$;
  old_flower_table_row constant text := '| `edible_flowers` | edible_fondant | Every visible flower, including fresh-looking, natural-looking, silk, cloth, fabric-textured, artificial, or realistic flowers, is fulfilled and priced as edible flowers. Only actual piped buttercream rosettes use `icing_decorations`. |';
  new_flower_table_row constant text := '| `edible_flowers` | edible_fondant | Every cake-member flower, including fresh-looking, natural-looking, silk, cloth, fabric-textured, artificial, or realistic flowers, is fulfilled and priced as edible flowers. Only actual piped buttercream rosettes use `icing_decorations`. |';
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.54: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.54';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.54'
        and is_active = true
        and md5(prompt_text) = 'e4ecfda7bb7bd32c2193475a5f95e112'
    ) then
      raise exception 'Cannot record ai_prompts v3.54: an unexpected v3.54 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> '0c875ad5d112682a9bd93bcf7edf99cf' then
    raise exception 'Cannot create ai_prompts v3.54: active prompt does not match the v3.53 baseline';
  end if;

  if position(old_heading in source_prompt) = 0
    or position(old_wafer_checkpoint in source_prompt) = 0
    or position(old_wafer_forensics in source_prompt) = 0
    or position(old_wafer_quantity_tail in source_prompt) = 0
    or position(old_wafer_exclusions in source_prompt) = 0
    or position(flower_placement_anchor in source_prompt) = 0
    or position(old_flower_table_row in source_prompt) = 0
    or position('INTRICATE FLOWER MINIMUM-SIZE PRECEDENCE' in source_prompt) <> 0 then
    raise exception 'Cannot create ai_prompts v3.54: expected v3.53 anchors were not found';
  end if;

  next_prompt := replace(source_prompt, old_heading, new_heading);
  next_prompt := replace(next_prompt, old_wafer_checkpoint, new_wafer_checkpoint);
  next_prompt := replace(next_prompt, old_wafer_forensics, new_wafer_forensics);
  next_prompt := replace(next_prompt, old_wafer_quantity_tail, new_wafer_quantity_tail);
  next_prompt := replace(next_prompt, old_wafer_exclusions, new_wafer_exclusions);
  next_prompt := replace(next_prompt, flower_placement_anchor, flower_placement_replacement);
  next_prompt := replace(next_prompt, old_flower_table_row, new_flower_table_row);

  if position('INTRICATE FLOWER MINIMUM-SIZE PRECEDENCE' in next_prompt) = 0
    or position('all four cues are not directly visible, omit `edible_photo_side_wave`.' in next_prompt) = 0
    or position('Every cake-member flower' in next_prompt) = 0
    or md5(next_prompt) <> 'e4ecfda7bb7bd32c2193475a5f95e112' then
    raise exception 'Cannot create ai_prompts v3.54: evidence-gated wafer waves and intricate flowers were not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.54',
    next_prompt,
    true,
    'v3.54 — Require direct evidence for conditioned wafer-paper side waves and treat distinct intricate cake flowers as medium-or-larger hero toppers.',
    now()
  );
end;
$migration$;

commit;
