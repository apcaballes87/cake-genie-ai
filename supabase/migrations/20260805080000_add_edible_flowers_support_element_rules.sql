begin;

-- Add support_element pricing rules for edible_flowers medium, large, and xlarge.
-- These sizes previously only existed under the main_topper category, causing the
-- pricing engine to return 0 when edible_flowers appeared as a support_element
-- (e.g. wedding cake floral cascades). Prices mirror the existing main_topper rules.
insert into public.pricing_rules (
  item_key,
  item_type,
  classification,
  size,
  description,
  price,
  category,
  quantity_rule,
  multiplier_rule,
  special_conditions,
  merchant_id,
  is_active
)
select * from (
  values
    ('edible_flowers_medium', 'edible_flowers', 'support', 'medium', 'Medium support edible flowers', 100.00, 'support_element', 'buy_3_get_1_free', null, null::jsonb, 'd29d384c-3265-4d96-9637-86888a8f649d'::uuid, true),
    ('edible_flowers_large', 'edible_flowers', 'support', 'large', 'Large support edible flowers', 150.00, 'support_element', 'buy_3_get_1_free', null, null::jsonb, 'd29d384c-3265-4d96-9637-86888a8f649d'::uuid, true),
    ('edible_flowers_xlarge', 'edible_flowers', 'support', 'xlarge', 'X-Large support edible flowers', 200.00, 'support_element', 'buy_3_get_1_free', null, null::jsonb, null, true)
) as v(item_key, item_type, classification, size, description, price, category, quantity_rule, multiplier_rule, special_conditions, merchant_id, is_active)
where not exists (
  select 1 from public.pricing_rules
  where pricing_rules.item_key = v.item_key
    and pricing_rules.category = v.category
    and (pricing_rules.merchant_id is not distinct from v.merchant_id)
    and pricing_rules.is_active = true
);

commit;
