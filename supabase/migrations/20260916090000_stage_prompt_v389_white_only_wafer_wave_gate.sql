-- Stage v3.89 without altering the verified v3.88 prompt, cache rows, or pricing.
begin;

do $migration$
declare
  active_count integer;
  source_version text;
  source_prompt text;
  next_prompt text;
  v388_md5 constant text := 'c4afb9b84576b1c37501e9a56fd379f6';
  v389_md5 constant text := '7522fb1ba49ee59513d3cefddba8444c';
begin
  lock table public.ai_prompts in share row exclusive mode;

  select count(*) into active_count
  from public.ai_prompts
  where is_active = true;
  if active_count <> 1 then
    raise exception 'Cannot stage v3.89: expected exactly one active prompt, found %', active_count;
  end if;

  select version, prompt_text into source_version, source_prompt
  from public.ai_prompts
  where is_active = true;
  if source_version <> '3.88' or md5(source_prompt) <> v388_md5 then
    raise exception 'Cannot stage v3.89: verified active v3.88 source is required';
  end if;

  if exists (select 1 from public.ai_prompts where version = '3.89') then
    raise exception 'Cannot stage v3.89: target version already exists';
  end if;

  next_prompt := source_prompt;

  if position($v389_title_old$**v3.88 Version - Sized Filler Flower Support Normalization**

### CHANGELOG
- Added a direct-diameter-sized, per-piece filler-flower type for small filler and baby's-breath flowers; every size band has the same per-piece price.$v389_title_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.89: title/changelog anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v389_title_old$**v3.88 Version - Sized Filler Flower Support Normalization**

### CHANGELOG
- Added a direct-diameter-sized, per-piece filler-flower type for small filler and baby's-breath flowers; every size band has the same per-piece price.$v389_title_old$,
    $v389_title_new$**v3.89 Version - White-Only Wafer-Paper Side-Wave Verification**

### CHANGELOG
- Restrict the priced wafer-paper side-wave type to directly resolved, white, unprinted wafer sheets; ivory, cream, beige, tan, colored, printed, blurred, or ambiguous side treatments fail closed.
- Preserve the direct-diameter-sized, per-piece filler-flower type for small filler and baby's-breath flowers; every size band has the same per-piece price.$v389_title_new$);

  if position($v389_checkpoint_old$Emit it only when the image directly shows **all** of these construction cues
on a cake side: (1) individually distinguishable thin paper sheets or strips,
(2) those sheets adhered upright and visibly separate from the iced side,
(3) loose/free wavy, ruffled, or pleated sheet edges, and (4) a repeated,
predominantly full-height side-wrap architecture around a tier.
(4) vertial sheets are connected to the sides of the cake$v389_checkpoint_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.89: checkpoint anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v389_checkpoint_old$Emit it only when the image directly shows **all** of these construction cues
on a cake side: (1) individually distinguishable thin paper sheets or strips,
(2) those sheets adhered upright and visibly separate from the iced side,
(3) loose/free wavy, ruffled, or pleated sheet edges, and (4) a repeated,
predominantly full-height side-wrap architecture around a tier.
(4) vertial sheets are connected to the sides of the cake$v389_checkpoint_old$,
    $v389_checkpoint_new$Emit it only when the image directly shows **all** of these construction cues
on a cake side: (1) individually distinguishable thin paper sheets or strips,
(2) those sheets adhered upright and visibly separate from the iced side,
(3) loose/free wavy, ruffled, or pleated sheet edges, (4) a repeated,
predominantly full-height side-wrap architecture around a tier, and (5)
visibly white, unprinted sheets. Ivory, cream, beige, tan, colored, printed,
patterned, blurred, or ambiguous sheets fail this type.$v389_checkpoint_new$);

  if position($v389_color_old$Do not infer this type from white color, generic words such as wave, ruffle,
texture, wafer, or paper, or from a soft/blurred image. Do not use it for
flowers, leaves, butterflies, lace, plaques, quilted/fondant panels, piped
borders, piped swags, isolated side accents, or continuous icing texture. If
all four cues are not directly visible, omit `edible_photo_side_wave`.$v389_color_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.89: white-color evidence anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v389_color_old$Do not infer this type from white color, generic words such as wave, ruffle,
texture, wafer, or paper, or from a soft/blurred image. Do not use it for
flowers, leaves, butterflies, lace, plaques, quilted/fondant panels, piped
borders, piped swags, isolated side accents, or continuous icing texture. If
all four cues are not directly visible, omit `edible_photo_side_wave`.$v389_color_old$,
    $v389_color_new$Do not infer this type from white color, generic words such as wave, ruffle,
texture, wafer, or paper, or from a soft/blurred image. White is necessary but
never sufficient: a white ruffle, white piping, white petals, or a white
vertical texture is not a wafer sheet. Do not use it for flowers, leaves,
butterflies, lace, plaques, quilted/fondant panels, piped borders, piped swags,
isolated side accents, or continuous icing texture. If all five cues are not
directly visible, omit `edible_photo_side_wave`.$v389_color_new$);

  if position($v389_reconcile_old$**Output reconciliation:** Never use `wafer paper` or `wafer-paper` in an
item description unless you verified all four direct-image cues above and
emitted the matching `edible_photo_side_wave` support row. Conversely, when
all four cues are visible, emit that row with its tier quantity; do not describe
a verified wafer-paper side wrap only as icing.$v389_reconcile_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.89: wafer reconciliation anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v389_reconcile_old$**Output reconciliation:** Never use `wafer paper` or `wafer-paper` in an
item description unless you verified all four direct-image cues above and
emitted the matching `edible_photo_side_wave` support row. Conversely, when
all four cues are visible, emit that row with its tier quantity; do not describe
a verified wafer-paper side wrap only as icing.$v389_reconcile_old$,
    $v389_reconcile_new$**Output reconciliation:** Never use `wafer paper` or `wafer-paper` in an
item description unless you verified all five direct-image cues above and
emitted the matching `edible_photo_side_wave` support row. Conversely, when
all five cues are visible, emit that row with its tier quantity; do not describe
a verified wafer-paper side wrap only as icing.$v389_reconcile_new$);

  if position($v389_forensics_old$### CONDITIONED WAFER PAPER VERTICAL-WAVE SIDE WRAP (REQUIRED)

Conditioned Wafer Paper: Thin wafer paper strips are softened with a light
mist of water/alcohol, shaped into loose waves, and adhered upright along the
perimeter for an ultra-light, delicate look.

Use this fulfillment rule only when all four direct-image cues in the
PRE-EMISSION UPRIGHT WAFER-PAPER SIDE CHECKPOINT are visible. It never follows
from a textual label or a guessed material. The correct visual is a perimeter
of repeated, individually distinguishable thin upright sheets with loose/free
wavy edges and visible separation from the iced side—even when the sheets are
white and unprinted.$v389_forensics_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.89: visual-forensics anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v389_forensics_old$### CONDITIONED WAFER PAPER VERTICAL-WAVE SIDE WRAP (REQUIRED)

Conditioned Wafer Paper: Thin wafer paper strips are softened with a light
mist of water/alcohol, shaped into loose waves, and adhered upright along the
perimeter for an ultra-light, delicate look.

Use this fulfillment rule only when all four direct-image cues in the
PRE-EMISSION UPRIGHT WAFER-PAPER SIDE CHECKPOINT are visible. It never follows
from a textual label or a guessed material. The correct visual is a perimeter
of repeated, individually distinguishable thin upright sheets with loose/free
wavy edges and visible separation from the iced side—even when the sheets are
white and unprinted.$v389_forensics_old$,
    $v389_forensics_new$### WHITE-ONLY CONDITIONED WAFER PAPER VERTICAL-WAVE SIDE WRAP (REQUIRED)

Conditioned Wafer Paper: Thin wafer paper strips are softened with a light
mist of water/alcohol, shaped into loose waves, and adhered upright along the
perimeter for an ultra-light, delicate look.

Use this fulfillment rule only when all five direct-image cues in the
PRE-EMISSION UPRIGHT WAFER-PAPER SIDE CHECKPOINT are visible. It never follows
from a textual label or a guessed material. The correct visual is a perimeter
of repeated, individually distinguishable thin upright sheets with loose/free
wavy edges and visible separation from the iced side. The sheets themselves
must be visibly white and unprinted: ivory, cream, beige, tan, colored,
printed, patterned, blurred, or uncertain sheets are not this fulfillment type.$v389_forensics_new$);

  if position($v389_dense_old$boundaries. This is still valid only when all four checkpoint cues are directly
visible.$v389_dense_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.89: dense-curtain anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v389_dense_old$boundaries. This is still valid only when all four checkpoint cues are directly
visible.$v389_dense_old$,
    $v389_dense_new$boundaries. This is still valid only when all five checkpoint cues are directly
visible.$v389_dense_new$);

  if position($v389_type_old$| `edible_photo_side_wave` | waferpaper | Conditioned unprinted wafer-paper strips shaped into loose upright waves around a cake side. Determine quantity from the number of directly visible cake tiers bearing the verified wave—not the cake's total tier count: 1 covered tier -> 1, 2 -> 3, 3 -> 4. A 2 Tier or 3 Tier cake with waves on one tier uses 1. Do not count individual ripples or infer hidden coverage. |$v389_type_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.89: support-type table anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v389_type_old$| `edible_photo_side_wave` | waferpaper | Conditioned unprinted wafer-paper strips shaped into loose upright waves around a cake side. Determine quantity from the number of directly visible cake tiers bearing the verified wave—not the cake's total tier count: 1 covered tier -> 1, 2 -> 3, 3 -> 4. A 2 Tier or 3 Tier cake with waves on one tier uses 1. Do not count individual ripples or infer hidden coverage. |$v389_type_old$,
    $v389_type_new$| `edible_photo_side_wave` | waferpaper | White, unprinted conditioned wafer-paper strips shaped into loose upright waves around a cake side. Require all five direct cues: separately visible thin strips, upright separate attachment, loose/free wavy edges, repeated predominantly full-height wrap, and visibly white/unprinted sheets. Ivory, cream, beige, tan, colored, printed, blurred, or ambiguous treatments are not this type. Determine quantity from the number of directly visible cake tiers bearing the verified wave—not the cake's total tier count: 1 covered tier -> 1, 2 -> 3, 3 -> 4. A 2 Tier or 3 Tier cake with waves on one tier uses 1. Do not count individual ripples or infer hidden coverage. |$v389_type_new$);

  if md5(next_prompt) <> v389_md5 then
    raise exception 'Cannot stage v3.89: assembled prompt checksum is unexpected';
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description)
  values (
    '3.89',
    next_prompt,
    false,
    'White-only evidence-gated wafer-paper side waves require five direct visual cues.'
  );
end;
$migration$;

commit;
