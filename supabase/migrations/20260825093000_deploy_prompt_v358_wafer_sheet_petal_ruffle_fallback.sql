-- Deploy prompt v3.58. Preserve the direct wafer-sheet gate and require its
-- correct edible-flower fallback for visible petal ruffles.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_heading constant text := '**v3.57 Version - Direct Wafer-Sheet Identification**';
  new_heading constant text := '**v3.58 Version - Wafer-Sheet Identification and Petal-Ruffle Fallback**';
  old_exclusions constant text := $anchor$Do NOT classify this feature as `edible_photo_side`, `edible_photo_print`,
`support_printout`, `icing_decorations`, `icing_palette_knife`,
`icing_brush_stroke`, `gumpaste_panel`, or `satin_ribbon`. Continuous piped,
spread, or palette-knife icing texture without separate thin upright sheets;
floral or butterfly cascades; broad cupped, folded, scalloped, or overlapping
flower-petal ruffles; quilted/fondant panels; lace; plaques; and isolated
decorative side accents are not `edible_photo_side_wave`. When those broad
forms visibly read as edible flower petals, classify them through the flower
rule as `edible_flowers`, material `edible_fondant`; do not invent waferpaper.$anchor$;
  new_exclusions constant text := $anchor$Do NOT classify this feature as `edible_photo_side`, `edible_photo_print`,
`support_printout`, `icing_decorations`, `icing_palette_knife`,
`icing_brush_stroke`, `gumpaste_panel`, or `satin_ribbon`. Continuous piped,
spread, or palette-knife icing texture without separate thin upright sheets;
floral or butterfly cascades; broad cupped, folded, scalloped, or overlapping
flower-petal ruffles; quilted/fondant panels; lace; plaques; and isolated
decorative side accents are not `edible_photo_side_wave`. When those broad
forms visibly read as edible flower petals, classify them through the flower
rule as `edible_flowers`, material `edible_fondant`; do not invent waferpaper.

#### PETAL-RUFFLE FLOWER CLASSIFICATION AFTER FAILED WAFER GATE (REQUIRED)

When the wafer-sheet gate fails and a cake-side treatment visibly reads as
broad, cupped, folded, scalloped, layered, or overlapping edible flower petals
or a flower-petal ruffle, emit `edible_flowers` with material
`edible_fondant`. Never downgrade that treatment to `edible_3d_ordinary`,
`gumpaste_panel`, or `edible_photo_side_wave` just because it covers a tier,
forms a repeated ruffle layer, or does not show an open flower center. Side
placement and broad coverage do not change a visibly petal-shaped edible form
into a generic 3D decoration.$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.58: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.58';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.58'
        and is_active = true
        and md5(prompt_text) = '2e87edb8533e1d8c849792412c74ce7e'
    ) then
      raise exception 'Cannot record ai_prompts v3.58: an unexpected v3.58 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> '73c9cf709921705ce03d0fb6408c9749' then
    raise exception 'Cannot create ai_prompts v3.58: active prompt does not match the v3.57 baseline';
  end if;

  if position(old_heading in source_prompt) = 0
    or position(old_exclusions in source_prompt) = 0
    or position('PETAL-RUFFLE FLOWER CLASSIFICATION AFTER FAILED WAFER GATE' in source_prompt) <> 0 then
    raise exception 'Cannot create ai_prompts v3.58: expected v3.57 petal-ruffle anchors were not found';
  end if;

  next_prompt := replace(source_prompt, old_heading, new_heading);
  next_prompt := replace(next_prompt, old_exclusions, new_exclusions);

  if position(new_heading in next_prompt) = 0
    or position('PETAL-RUFFLE FLOWER CLASSIFICATION AFTER FAILED WAFER GATE' in next_prompt) = 0
    or position('Never downgrade that treatment to `edible_3d_ordinary`' in next_prompt) = 0
    or md5(next_prompt) <> '2e87edb8533e1d8c849792412c74ce7e' then
    raise exception 'Cannot create ai_prompts v3.58: petal-ruffle fallback was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.58',
    next_prompt,
    true,
    'v3.58 — Preserve direct wafer-sheet identification and classify failed-gate petal ruffles as edible flowers.',
    now()
  );
end;
$migration$;

commit;
