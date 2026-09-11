-- Stage v3.78 piped-icing flower classification and its grouped pricing rules.
-- This does not modify historical cached analyses, carts, or orders. Apply the
-- paired activation migration only after the application type/schema release.

begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  source_prompt text;
  next_prompt text;
  target_prompt_count integer;
  v377_md5 constant text := '84cdb815fd837b37e37431cc75a550ac';
  flower_anchor constant text := '### FLOWER TYPE PRECEDENCE';
  piped_flower_rule constant text := $piped_rule$### PIPED ICING FLOWERS — GROUPED COVERAGE PRICING (AUTHORITATIVE)

Piped flowers are icing only: directly piped buttercream/frosting petals,
rosettes, shells, ruffles, star-tip blossoms, or swirls that visibly merge into
the iced cake surface. Their ridged or petalled frosting texture is not
separate fondant or gumpaste construction, even when the flower resembles a
rose, peony, or blossom.

Emit the complete treatment as one row with \`material: "icing"\` and
\`quantity: 1\`—never one row per bloom:

- Top-surface flowers: one \`main_toppers\` row with \`type:
  "piped_flowers_top"\`, \`classification: "hero"\`, and \`coverage\` measured
  against the directly visible top surface.
- Sidewall flowers: one \`support_elements\` row with \`type:
  "piped_flowers_side"\` and \`coverage\` measured against the directly visible
  iced cake-side area. If an independent treatment appears on both top and
  side, emit one row of each type.

Set \`coverage\` exactly as follows: \`small\` is under 30%, \`medium\` is 30% to
under 60%, and \`large\` is 60% through 100%. These bands are pricing groups:
small = ₱50, medium = ₱100, large = ₱150, for either top or side. Do not emit a
\`size_line\` for either piped-flower type and do not count individual piped
blooms.

This rule overrides the ordinary flower rule for piped icing only. Separate
molded, cut, sculpted, or thick matte fondant/gumpaste petals remain
\`edible_flowers\` with \`material: "edible_fondant"\`; wafer, fresh, artificial,
printed, and non-cake flowers remain governed by their own construction and
cake-membership rules.$piped_rule$;
begin
  select count(*), min(version::text)
  into active_prompt_count, active_prompt_version
  from public.ai_prompts
  where is_active = true;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.78';

  if target_prompt_count > 0 then
    if target_prompt_count = 1
      and exists (
        select 1 from public.ai_prompts
        where version = '3.78'
          and position('PIPED ICING FLOWERS — GROUPED COVERAGE PRICING' in prompt_text) > 0
          and position('"piped_flowers_top"' in prompt_text) > 0
          and position('"piped_flowers_side"' in prompt_text) > 0
      ) then
      return;
    end if;
    raise exception 'Cannot stage v3.78: an unexpected v3.78 prompt already exists';
  end if;

  if active_prompt_count <> 1 or active_prompt_version <> '3.77' then
    raise exception 'Cannot stage v3.78: expected exactly one active v3.77 prompt, found count=% version=%', active_prompt_count, coalesce(active_prompt_version, '<none>');
  end if;

  select prompt_text into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> v377_md5 then
    raise exception 'Cannot stage v3.78: active v3.77 prompt checksum is unexpected';
  end if;

  if position(flower_anchor in source_prompt) = 0 then
    raise exception 'Cannot stage v3.78: expected flower precedence anchor is absent';
  end if;

  next_prompt := replace(
    source_prompt,
    flower_anchor,
    piped_flower_rule || E'\n\n' || flower_anchor
  );

  if position('PIPED ICING FLOWERS — GROUPED COVERAGE PRICING' in next_prompt) = 0
    or position('"piped_flowers_top"' in next_prompt) = 0
    or position('"piped_flowers_side"' in next_prompt) = 0 then
    raise exception 'Cannot stage v3.78: piped flower rule was not inserted';
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description)
  values (
    '3.78',
    next_prompt,
    false,
    'v3.78 — Classify piped icing flowers as grouped top or side coverage treatments, separate from fondant/gumpaste flowers.'
  );

  if exists (
    select 1
    from public.pricing_rules
    where is_active = true
      and merchant_id is null
      and item_type in ('piped_flowers_top', 'piped_flowers_side')
      and (
        quantity_rule is distinct from 'fixed'
        or price not in (50.00, 100.00, 150.00)
        or category not in ('main_topper', 'support_element')
      )
  ) then
    raise exception 'Cannot stage v3.78: unexpected active global piped-flower pricing rule exists';
  end if;

  insert into public.pricing_rules (
    item_key, item_type, classification, size, coverage, description, price,
    is_active, quantity_rule, multiplier_rule, special_conditions, category,
    sub_item_type, merchant_id
  )
  select *
  from (
    values
      ('piped_flowers_top_small', 'piped_flowers_top', 'hero', 'small', 'small', 'Grouped piped icing flowers covering under 30% of the cake top', 50.00::numeric, true, 'fixed', null::text, null::jsonb, 'main_topper', null::text, null::uuid),
      ('piped_flowers_top_medium', 'piped_flowers_top', 'hero', 'medium', 'medium', 'Grouped piped icing flowers covering 30% to under 60% of the cake top', 100.00::numeric, true, 'fixed', null::text, null::jsonb, 'main_topper', null::text, null::uuid),
      ('piped_flowers_top_large', 'piped_flowers_top', 'hero', 'large', 'large', 'Grouped piped icing flowers covering 60% or more of the cake top', 150.00::numeric, true, 'fixed', null::text, null::jsonb, 'main_topper', null::text, null::uuid),
      ('piped_flowers_side_small', 'piped_flowers_side', 'support', 'small', 'small', 'Grouped piped icing flowers covering under 30% of the cake side', 50.00::numeric, true, 'fixed', null::text, null::jsonb, 'support_element', null::text, null::uuid),
      ('piped_flowers_side_medium', 'piped_flowers_side', 'support', 'medium', 'medium', 'Grouped piped icing flowers covering 30% to under 60% of the cake side', 100.00::numeric, true, 'fixed', null::text, null::jsonb, 'support_element', null::text, null::uuid),
      ('piped_flowers_side_large', 'piped_flowers_side', 'support', 'large', 'large', 'Grouped piped icing flowers covering 60% or more of the cake side', 150.00::numeric, true, 'fixed', null::text, null::jsonb, 'support_element', null::text, null::uuid)
  ) as candidate(
    item_key, item_type, classification, size, coverage, description, price,
    is_active, quantity_rule, multiplier_rule, special_conditions, category,
    sub_item_type, merchant_id
  )
  where not exists (
    select 1
    from public.pricing_rules as existing
    where existing.is_active = true
      and existing.merchant_id is not distinct from candidate.merchant_id
      and existing.item_key = candidate.item_key
      and existing.category = candidate.category
      and existing.size = candidate.size
  );

  if (select count(*) from public.pricing_rules
      where is_active = true
        and merchant_id is null
        and item_key in (
          'piped_flowers_top_small', 'piped_flowers_top_medium', 'piped_flowers_top_large',
          'piped_flowers_side_small', 'piped_flowers_side_medium', 'piped_flowers_side_large'
        )
        and quantity_rule = 'fixed'
        and price in (50.00, 100.00, 150.00)) <> 6 then
    raise exception 'Cannot stage v3.78: expected six active global piped-flower pricing rules';
  end if;
end;
$migration$;

commit;
