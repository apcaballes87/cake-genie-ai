-- Deploy prompt v3.59. Retain direct wafer-sheet identification while allowing
-- ordinary compatible non-wafer classifications after the gate fails.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_heading constant text := '**v3.58 Version - Wafer-Sheet Identification and Petal-Ruffle Fallback**';
  new_heading constant text := '**v3.59 Version - Direct Wafer-Sheet Identification**';
  old_exclusions_and_fallback constant text := $anchor$Do NOT classify this feature as `edible_photo_side`, `edible_photo_print`,
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
  new_exclusions constant text := $anchor$Do NOT classify this feature as `edible_photo_side`, `edible_photo_print`,
`support_printout`, `icing_decorations`, `icing_palette_knife`,
`icing_brush_stroke`, `gumpaste_panel`, or `satin_ribbon`. Continuous piped,
spread, or palette-knife icing texture without separate thin upright sheets;
floral or butterfly cascades; broad cupped, folded, scalloped, or overlapping
flower-petal ruffles; quilted/fondant panels; lace; plaques; and isolated
decorative side accents are not `edible_photo_side_wave`. Do not invent
waferpaper after this gate fails; classify the visible construction under its
ordinary compatible type rule.$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.59: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.59';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.59'
        and is_active = true
        and md5(prompt_text) = 'b587e7da644bc528136c1a1eb9f88613'
    ) then
      raise exception 'Cannot record ai_prompts v3.59: an unexpected v3.59 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> '2e87edb8533e1d8c849792412c74ce7e' then
    raise exception 'Cannot create ai_prompts v3.59: active prompt does not match the v3.58 baseline';
  end if;

  if position(old_heading in source_prompt) = 0
    or position(old_exclusions_and_fallback in source_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.59: expected v3.58 wafer-wave anchors were not found';
  end if;

  next_prompt := replace(source_prompt, old_heading, new_heading);
  next_prompt := replace(next_prompt, old_exclusions_and_fallback, new_exclusions);

  if position(new_heading in next_prompt) = 0
    or position('Do not invent' || chr(10) || 'waferpaper after this gate fails' in next_prompt) = 0
    or position('PETAL-RUFFLE FLOWER CLASSIFICATION AFTER FAILED WAFER GATE' in next_prompt) <> 0
    or md5(next_prompt) <> 'b587e7da644bc528136c1a1eb9f88613' then
    raise exception 'Cannot create ai_prompts v3.59: direct wafer-sheet identification was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.59',
    next_prompt,
    true,
    'v3.59 — Require direct wafer-sheet evidence; use the ordinary compatible type after the wafer gate fails.',
    now()
  );
end;
$migration$;

commit;
