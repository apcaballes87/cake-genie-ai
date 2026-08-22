-- Deploy prompt v3.48 and the dedicated conditioned-wafer-paper wave SKU.
-- The new support type is intentionally separate from edible_photo_side so
-- printed edible-photo wraps retain their existing flat pricing behavior.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  wave_rule_count integer;
  visual_forensic_anchor constant text := $anchor$## VISUAL FORENSIC LIBRARY (Material Identification)

Apply these protocols to determine materials:$anchor$;
  output_order_anchor constant text := $anchor$8. Item description and construction/material/type reconciliation
9. Colors and icing
10. SEO copy$anchor$;
  early_checkpoint constant text := $rule$### PRE-EMISSION UPRIGHT WAFER-PAPER SIDE CHECKPOINT (REQUIRED)

Before deciding that a vertical, wavy, rippled, ruffled, or pleated cake-side
finish is icing, inspect whether it is made of distinct thin upright strips or
panels with their own loose wavy edges and visible separation from the iced
side. If it is, it is **Conditioned Wafer Paper**, even when it is all white,
unprinted, and covers the full side: emit the `edible_photo_side_wave` support
element using the tier fulfillment units in the conditioned-wafer-paper rule
below. Do not omit that support element or describe the separate strips as
icing texture. Do not use this type from wave wording alone: a continuous
piped, spread, or palette-knife texture with no separate upright sheets
remains icing.$rule$;
  wave_rule constant text := $rule$### CONDITIONED WAFER PAPER VERTICAL-WAVE SIDE WRAP (REQUIRED)

Conditioned Wafer Paper: Thin wafer paper strips are softened with a light
mist of water/alcohol, shaped into loose waves, and adhered upright along the
perimeter for an ultra-light, delicate look.

This fulfillment rule overrides generic edible-photo image/print wording and
generic icing-texture classification when the cake side visibly has distinct,
thin, upright, wavy, rippled, ruffled, or pleated wafer-paper strips or panels
adhered around a tier. It applies even when the wafer paper has no printed
image.

Emit exactly one `support_elements` row for the whole conditioned wafer-paper
wave feature: `type: "edible_photo_side_wave"`, `material: "waferpaper"`,
`size: "large"`, and a descriptive group ID such as
`conditioned_waferpaper_vertical_wave_side_wrap`. These are bakery
fulfillment/pricing units, not a count of every visible ripple or sheet edge:
- 1 Tier -> quantity `1`
- 2 Tier -> quantity `3`
- 3 Tier -> quantity `4`

Do NOT classify this feature as `edible_photo_side`, `edible_photo_print`,
`support_printout`, `icing_decorations`, `icing_palette_knife`,
`icing_brush_stroke`, `gumpaste_panel`, or `satin_ribbon`. Continuous piped,
spread, or palette-knife icing texture without separate thin upright sheets
remains an icing type, not `edible_photo_side_wave`.$rule$;
  existing_photo_side_row constant text := $row$| `edible_photo_side` | waferpaper | Full edible image side panel or wrap covering a cake side. Size by side coverage: tiny (narrow strip), small (<40%), medium (40% to <80%), large (≥80%). Use quantity 1 per covered side region |$row$;
  wave_table_row constant text := $row$| `edible_photo_side_wave` | waferpaper | Conditioned unprinted wafer-paper strips shaped into loose upright waves around a cake side. Always large. Quantity is 1 for 1 Tier, 3 for 2 Tier, and 4 for 3 Tier bakery fulfillment/pricing units; do not count individual ripples. |$row$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.48: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.48';

  select count(*)
  into wave_rule_count
  from public.pricing_rules
  where item_key = 'edible_photo_side_wave_large'
    and item_type = 'edible_photo_side_wave'
    and category = 'support_element'
    and merchant_id = 'd29d384c-3265-4d96-9637-86888a8f649d';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.48'
        and is_active = true
        and md5(prompt_text) = 'ec97bd2220713f89edba76d2626bf7e8'
    ) then
      raise exception 'Cannot record ai_prompts v3.48: an unexpected v3.48 row already exists';
    end if;

    if wave_rule_count <> 1 or not exists (
      select 1
      from public.pricing_rules
      where item_key = 'edible_photo_side_wave_large'
        and item_type = 'edible_photo_side_wave'
        and category = 'support_element'
        and classification = 'non-gumpaste'
        and size = 'large'
        and coverage = 'heavy'
        and price = 500
        and quantity_rule = 'per_piece'
        and multiplier_rule is null
        and special_conditions is null
        and is_active = true
        and merchant_id = 'd29d384c-3265-4d96-9637-86888a8f649d'
    ) then
      raise exception 'Cannot record ai_prompts v3.48: conditioned wafer-paper wave pricing rule is missing or unexpected';
    end if;

    return;
  end if;

  if wave_rule_count <> 0 then
    raise exception 'Cannot create ai_prompts v3.48: conditioned wafer-paper wave pricing rule already exists unexpectedly';
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> '735d6ba689d1b42b47578e94fc8a79fd' then
    raise exception 'Cannot create ai_prompts v3.48: active prompt does not match the v3.46 baseline';
  end if;

  if position('**v3.46 Version - Schema Compatibility And Determinism Fixes**' in source_prompt) = 0
    or position(visual_forensic_anchor in source_prompt) = 0
    or position(output_order_anchor in source_prompt) = 0
    or position(existing_photo_side_row in source_prompt) = 0
    or position('edible_photo_side_wave' in source_prompt) <> 0 then
    raise exception 'Cannot create ai_prompts v3.48: expected v3.46 wafer-paper anchors were not found';
  end if;

  next_prompt := replace(
    source_prompt,
    '**v3.46 Version - Schema Compatibility And Determinism Fixes**',
    '**v3.48 Version - Conditioned Wafer Paper Wave Fulfillment**'
  );
  next_prompt := replace(
    next_prompt,
    output_order_anchor,
    output_order_anchor || E'\n\n' || early_checkpoint
  );
  next_prompt := replace(
    next_prompt,
    visual_forensic_anchor,
    visual_forensic_anchor || E'\n\n' || wave_rule
  );
  next_prompt := replace(
    next_prompt,
    existing_photo_side_row,
    wave_table_row || E'\n' || existing_photo_side_row
  );

  if position('CONDITIONED WAFER PAPER VERTICAL-WAVE SIDE WRAP (REQUIRED)' in next_prompt) = 0
    or position('PRE-EMISSION UPRIGHT WAFER-PAPER SIDE CHECKPOINT (REQUIRED)' in next_prompt) = 0
    or position('`type: "edible_photo_side_wave"`, `material: "waferpaper"`' in next_prompt) = 0
    or position('- 1 Tier -> quantity `1`' in next_prompt) = 0
    or position('- 2 Tier -> quantity `3`' in next_prompt) = 0
    or position('- 3 Tier -> quantity `4`' in next_prompt) = 0
    or position(wave_table_row in next_prompt) = 0
    or md5(next_prompt) <> 'ec97bd2220713f89edba76d2626bf7e8' then
    raise exception 'Cannot create ai_prompts v3.48: conditioned wafer-paper wave rule was not applied cleanly';
  end if;

  insert into public.pricing_rules (
    item_key,
    item_type,
    classification,
    size,
    coverage,
    description,
    price,
    is_active,
    quantity_rule,
    multiplier_rule,
    special_conditions,
    category,
    merchant_id
  ) values (
    'edible_photo_side_wave_large',
    'edible_photo_side_wave',
    'non-gumpaste',
    'large',
    'heavy',
    'Conditioned Wafer Paper Wave Side Wrap',
    500,
    true,
    'per_piece',
    null,
    null,
    'support_element',
    'd29d384c-3265-4d96-9637-86888a8f649d'
  );

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.48',
    next_prompt,
    true,
    'v3.48 — Classify conditioned unprinted wafer-paper vertical waves as a dedicated priced support type with tier-specific fulfillment units.',
    now()
  );
end;
$migration$;

commit;
