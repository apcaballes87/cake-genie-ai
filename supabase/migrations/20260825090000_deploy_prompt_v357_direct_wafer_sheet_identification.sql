-- Deploy prompt v3.57. Require directly traceable wafer-sheet faces and free
-- edges before classifying a side treatment as an edible_photo_side_wave.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_heading constant text := '**v3.56 Version - Freestanding Molded Animal Figure Precedence**';
  new_heading constant text := '**v3.57 Version - Direct Wafer-Sheet Identification**';
  old_checkpoint_tail constant text := $anchor$Do not infer this type from white color, generic words such as wave, ruffle,
texture, wafer, or paper, or from a soft/blurred image. Do not use it for
flowers, leaves, butterflies, lace, plaques, quilted/fondant panels, piped
borders, piped swags, isolated side accents, or continuous icing texture. If
all four cues are not directly visible, omit `edible_photo_side_wave`.$anchor$;
  new_checkpoint_tail constant text := $anchor$Do not infer this type from white color, generic words such as wave, ruffle,
texture, wafer, or paper, or from a soft/blurred image. Do not use it for
flowers, leaves, butterflies, lace, plaques, quilted/fondant panels, piped
borders, piped swags, isolated side accents, or continuous icing texture. If
all four cues are not directly visible, omit `edible_photo_side_wave`.

Count a sheet cue only when its narrow sheet face and a free outer sheet edge
can be traced as part of the same separately attached strip. A scalloped fold,
shadow line, overlap boundary, or edge of a cupped petal is not a paper-sheet
boundary. Never promote a dense ruffle mass to this type by rewriting its
contours as thin strips or loose/free sheet edges.$anchor$;
  old_dense_reference constant text := $anchor$In the correct white reference style, the wrap can read as a dense curtain of
many parallel narrow white upright ruffled sheets around the tier; identify the
separate free sheet edges rather than treating the repeated vertical ripples as
continuous icing grooves. This is still valid only when all four checkpoint
cues are directly visible.$anchor$;
  new_dense_reference constant text := $anchor$In the correct white reference style, the wrap can read as a dense curtain of
many parallel narrow white upright ruffled sheets around the tier. Density or
vertical ripples alone are not evidence: the image must still resolve each
traceable narrow sheet face with its own free outer edge and separate attachment
against the iced side. Do not convert scalloped folds, shadows, overlaps, or
cupped/overlapping petal edges in a dense ruffle mass into wafer-sheet
boundaries. This is still valid only when all four checkpoint cues are directly
visible.$anchor$;
  old_exclusions constant text := $anchor$Do NOT classify this feature as `edible_photo_side`, `edible_photo_print`,
`support_printout`, `icing_decorations`, `icing_palette_knife`,
`icing_brush_stroke`, `gumpaste_panel`, or `satin_ribbon`. Continuous piped,
spread, or palette-knife icing texture without separate thin upright sheets;
floral or butterfly cascades; quilted/fondant panels; lace; plaques; and
isolated decorative side accents are not `edible_photo_side_wave`.$anchor$;
  new_exclusions constant text := $anchor$Do NOT classify this feature as `edible_photo_side`, `edible_photo_print`,
`support_printout`, `icing_decorations`, `icing_palette_knife`,
`icing_brush_stroke`, `gumpaste_panel`, or `satin_ribbon`. Continuous piped,
spread, or palette-knife icing texture without separate thin upright sheets;
floral or butterfly cascades; broad cupped, folded, scalloped, or overlapping
flower-petal ruffles; quilted/fondant panels; lace; plaques; and isolated
decorative side accents are not `edible_photo_side_wave`. When those broad
forms visibly read as edible flower petals, classify them through the flower
rule as `edible_flowers`, material `edible_fondant`; do not invent waferpaper.$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.57: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.57';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.57'
        and is_active = true
        and md5(prompt_text) = '73c9cf709921705ce03d0fb6408c9749'
    ) then
      raise exception 'Cannot record ai_prompts v3.57: an unexpected v3.57 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> 'fa54f0f373a0bc6e6ec79096e45322bf' then
    raise exception 'Cannot create ai_prompts v3.57: active prompt does not match the v3.56 baseline';
  end if;

  if position(old_heading in source_prompt) = 0
    or position(old_checkpoint_tail in source_prompt) = 0
    or position(old_dense_reference in source_prompt) = 0
    or position(old_exclusions in source_prompt) = 0
    or position('Count a sheet cue only when its narrow sheet face' in source_prompt) <> 0 then
    raise exception 'Cannot create ai_prompts v3.57: expected v3.56 wafer-wave anchors were not found';
  end if;

  next_prompt := replace(source_prompt, old_heading, new_heading);
  next_prompt := replace(next_prompt, old_checkpoint_tail, new_checkpoint_tail);
  next_prompt := replace(next_prompt, old_dense_reference, new_dense_reference);
  next_prompt := replace(next_prompt, old_exclusions, new_exclusions);

  if position(new_heading in next_prompt) = 0
    or position('Count a sheet cue only when its narrow sheet face and a free outer sheet edge' in next_prompt) = 0
    or position('Density or' in next_prompt) = 0
    or position('flower-petal ruffles' in next_prompt) = 0
    or md5(next_prompt) <> '73c9cf709921705ce03d0fb6408c9749' then
    raise exception 'Cannot create ai_prompts v3.57: direct wafer-sheet identification was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.57',
    next_prompt,
    true,
    'v3.57 — Require direct wafer-sheet faces and free edges; prevent petal ruffles from becoming wafer-wave wraps.',
    now()
  );
end;
$migration$;

commit;
