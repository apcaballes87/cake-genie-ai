begin;

do $$
declare
  matched_rule_count integer;
begin
  select count(*)
  into matched_rule_count
  from (
    values
      ('cardstock_xsmall', 'cardstock', 'xsmall', 20.00::numeric),
      ('cardstock_xlarge', 'cardstock', 'xlarge', 150.00::numeric),
      ('dragees_xsmall', 'dragees', 'xsmall', 0.00::numeric),
      ('dragees_xlarge', 'dragees', 'xlarge', 150.00::numeric),
      ('edible_2d_shapes_xsmall', 'edible_2d_shapes', 'xsmall', 8.00::numeric),
      ('edible_2d_shapes_xlarge', 'edible_2d_shapes', 'xlarge', 75.00::numeric),
      ('edible_2d_support_xsmall', 'edible_2d_support', 'xsmall', 8.00::numeric),
      ('edible_2d_support_xlarge', 'edible_2d_support', 'xlarge', 150.00::numeric),
      ('edible_3d_complex_xsmall', 'edible_3d_complex', 'xsmall', 175.00::numeric),
      ('edible_3d_complex_xlarge', 'edible_3d_complex', 'xlarge', 900.00::numeric),
      ('edible_3d_ordinary_xsmall', 'edible_3d_ordinary', 'xsmall', 20.00::numeric),
      ('edible_3d_ordinary_xlarge', 'edible_3d_ordinary', 'xlarge', 300.00::numeric),
      ('edible_flowers_xsmall', 'edible_flowers', 'xsmall', 8.00::numeric),
      ('edible_flowers_xlarge', 'edible_flowers', 'xlarge', 200.00::numeric),
      ('figurine_xlarge', 'figurine', 'xlarge', 120.00::numeric),
      ('plastic_ball_regular_xlarge', 'plastic_ball_regular', 'xlarge', 50.00::numeric),
      ('printout_xlarge', 'printout', 'xlarge', 0.00::numeric),
      ('toy_xlarge', 'toy', 'xlarge', 400.00::numeric)
  ) as expected(item_key, item_type, size, price)
  join public.pricing_rules as rule
    on rule.item_key = expected.item_key
   and rule.item_type = expected.item_type
   and rule.size = expected.size
   and rule.price = expected.price
   and rule.is_active = true
   and rule.category is null;

  if matched_rule_count <> 18 then
    raise exception
      'Expected all 18 active uncategorized xsmall/xlarge pricing rules with their existing prices; found %',
      matched_rule_count;
  end if;

  if not exists (
    select 1
    from public.pricing_rules
    where is_active = true
      and item_key = 'edible_2d_support_heavy'
      and item_type = 'edible_2d_support'
      and size = 'large'
      and category = 'support_element'
  ) then
    raise exception 'Expected active edible_2d_support_heavy source rule';
  end if;

  if not exists (
    select 1
    from public.pricing_rules
    where is_active = true
      and item_key = 'edible_3d_ordinary_tiny'
      and item_type = 'edible_3d_ordinary'
      and size = 'tiny'
      and category = 'main_topper'
  ) then
    raise exception 'Expected active edible_3d_ordinary_tiny source rule';
  end if;

  if not exists (
    select 1
    from public.pricing_rules
    where is_active = true
      and item_key = 'edible_3d_ordinary_ice_cream_cone'
      and item_type = 'edible_3d_ordinary'
      and btrim(size, E' \t\n\r') = 'medium'
      and size is distinct from btrim(size, E' \t\n\r')
  ) then
    raise exception 'Expected malformed active ice-cream-cone size source rule';
  end if;
end
$$;

-- Normalize malformed active text values before enforcing the contract.
update public.pricing_rules
set
  size = nullif(btrim(size, E' \t\n\r'), ''),
  updated_at = now()
where is_active = true
  and size is not null
  and size is distinct from nullif(btrim(size, E' \t\n\r'), '');

update public.pricing_rules
set
  quantity_rule = nullif(btrim(quantity_rule, E' \t\n\r'), ''),
  updated_at = now()
where is_active = true
  and quantity_rule is not null
  and quantity_rule is distinct from nullif(btrim(quantity_rule, E' \t\n\r'), '');

-- Complete the xsmall/xlarge rule families without changing their stored prices.
update public.pricing_rules
set
  category = 'main_topper',
  classification = 'non-gumpaste',
  quantity_rule = 'per_piece',
  updated_at = now()
where is_active = true
  and category is null
  and item_key in ('cardstock_xsmall', 'cardstock_xlarge')
  and item_type = 'cardstock';

update public.pricing_rules
set
  category = 'support_element',
  classification = 'support',
  quantity_rule = 'buy_3_get_1_free',
  special_conditions = jsonb_build_object('allowance_eligible', true),
  updated_at = now()
where is_active = true
  and category is null
  and item_key in ('dragees_xsmall', 'dragees_xlarge')
  and item_type = 'dragees';

update public.pricing_rules
set
  category = 'main_topper',
  classification = 'hero',
  quantity_rule = 'per_piece',
  special_conditions = jsonb_build_object('allowance_eligible', true),
  updated_at = now()
where is_active = true
  and category is null
  and item_key in ('edible_2d_shapes_xsmall', 'edible_2d_shapes_xlarge')
  and item_type = 'edible_2d_shapes';

update public.pricing_rules
set
  category = 'support_element',
  classification = 'support',
  quantity_rule = 'per_piece',
  special_conditions = jsonb_build_object('allowance_eligible', true),
  updated_at = now()
where is_active = true
  and category is null
  and item_key in ('edible_2d_support_xsmall', 'edible_2d_support_xlarge')
  and item_type = 'edible_2d_support';

update public.pricing_rules
set
  category = 'main_topper',
  classification = 'hero',
  quantity_rule = 'per_piece',
  special_conditions = null,
  updated_at = now()
where is_active = true
  and category is null
  and item_key in (
    'edible_3d_complex_xsmall',
    'edible_3d_complex_xlarge',
    'edible_3d_ordinary_xsmall',
    'edible_3d_ordinary_xlarge'
  )
  and item_type in ('edible_3d_complex', 'edible_3d_ordinary');

update public.pricing_rules
set
  category = 'support_element',
  classification = 'support',
  quantity_rule = 'buy_3_get_1_free',
  special_conditions = jsonb_build_object('allowance_eligible', false),
  updated_at = now()
where is_active = true
  and category is null
  and item_key = 'edible_flowers_xsmall'
  and item_type = 'edible_flowers';

update public.pricing_rules
set
  category = 'main_topper',
  classification = 'hero',
  quantity_rule = 'buy_3_get_1_free',
  special_conditions = null,
  updated_at = now()
where is_active = true
  and category is null
  and item_key = 'edible_flowers_xlarge'
  and item_type = 'edible_flowers';

update public.pricing_rules
set
  category = 'main_topper',
  classification = 'non-gumpaste',
  quantity_rule = 'per_piece',
  updated_at = now()
where is_active = true
  and category is null
  and item_key = 'figurine_xlarge'
  and item_type = 'figurine';

update public.pricing_rules
set
  category = 'support_element',
  classification = 'support',
  quantity_rule = 'buy_3_get_1_free',
  special_conditions = null,
  updated_at = now()
where is_active = true
  and category is null
  and item_key = 'plastic_ball_regular_xlarge'
  and item_type = 'plastic_ball_regular';

update public.pricing_rules
set
  category = 'main_topper',
  classification = 'non-gumpaste',
  quantity_rule = 'fixed',
  special_conditions = jsonb_build_object('allowance_eligible', false),
  updated_at = now()
where is_active = true
  and category is null
  and item_key = 'printout_xlarge'
  and item_type = 'printout';

update public.pricing_rules
set
  category = 'main_topper',
  classification = 'non-gumpaste',
  quantity_rule = 'per_piece',
  updated_at = now()
where is_active = true
  and category is null
  and item_key = 'toy_xlarge'
  and item_type = 'toy';

-- Every edible 2D support size is countable and allowance eligible. Rename the
-- legacy "heavy" key so the resolver can address the large size canonically.
update public.pricing_rules
set
  item_key = case
    when item_key = 'edible_2d_support_heavy' then 'edible_2d_support_large'
    else item_key
  end,
  category = 'support_element',
  classification = 'support',
  quantity_rule = 'per_piece',
  special_conditions = coalesce(special_conditions, '{}'::jsonb)
    || jsonb_build_object('allowance_eligible', true),
  updated_at = now()
where is_active = true
  and item_type = 'edible_2d_support';

-- The tiny ordinary-3D row previously used an empty quantity rule.
update public.pricing_rules
set
  quantity_rule = 'per_piece',
  updated_at = now()
where is_active = true
  and item_key = 'edible_3d_ordinary_tiny'
  and item_type = 'edible_3d_ordinary'
  and size = 'tiny'
  and category = 'main_topper';

-- Ordinary edible 3D pieces can occur in either generated array. Mirror the
-- existing per-size price into support_element without consuming allowance.
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
  sub_item_type,
  merchant_id
)
select
  source.item_key,
  source.item_type,
  'support',
  source.size,
  source.coverage,
  source.description || ' (support element)',
  source.price,
  true,
  'per_piece',
  source.multiplier_rule,
  jsonb_build_object('allowance_eligible', false),
  'support_element',
  source.sub_item_type,
  source.merchant_id
from public.pricing_rules as source
where source.is_active = true
  and source.item_type = 'edible_3d_ordinary'
  and source.category = 'main_topper'
  and source.size in ('tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge')
  and not exists (
    select 1
    from public.pricing_rules as existing
    where existing.is_active = true
      and existing.item_key = source.item_key
      and existing.category = 'support_element'
      and existing.merchant_id is not distinct from source.merchant_id
  );

-- Replace the global item/category constraint with active, merchant-aware
-- uniqueness. NULLS NOT DISTINCT permits one global rule per key/category.
alter table public.pricing_rules
  drop constraint if exists pricing_rules_item_category_key;

drop index if exists public.pricing_rules_item_category_key;

create unique index pricing_rules_active_merchant_category_item_key
  on public.pricing_rules (merchant_id, category, item_key) nulls not distinct
  where is_active = true;

alter table public.pricing_rules
  add constraint pricing_rules_active_category_check
  check (
    not is_active
    or (
      category is not null
      and category in (
        'main_topper',
        'support_element',
        'message',
        'icing_feature',
        'special'
      )
    )
  ),
  add constraint pricing_rules_active_quantity_rule_check
  check (
    not is_active
    or quantity_rule is null
    or (
      quantity_rule = btrim(quantity_rule, E' \t\n\r')
      and quantity_rule in (
        'per_piece',
        'per_3_pieces',
        'per_digit',
        'buy_3_get_1_free',
        'fixed',
        'flat'
      )
    )
  );

commit;
