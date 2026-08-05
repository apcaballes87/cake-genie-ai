begin;

-- 1. Deactivate redundant meringue rule (rule_id 155, price 10).
--    Keep rule_id 159 (price 15) which matches legacy pricingService.ts (15 per piece).
update public.pricing_rules
  set is_active = false,
      updated_at = now()
where rule_id = 155
  and is_active = true;

-- 2. Add a support_element rule for the legacy plastic_ball type.
--    Previously only existed under main_topper category (price 20, buy_3_get_1_free).
--    This ensures plastic_ball items classified as support elements by the AI
--    analyzer are priced correctly instead of defaulting to 0.
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
  is_active
)
select * from (
  values (
    'plastic_ball',
    'plastic_ball',
    'support',
    null,
    'Legacy Plastic Ball (support element)',
    20.00,
    'support_element',
    'buy_3_get_1_free',
    null,
    null::jsonb,
    true
  )
) as v(item_key, item_type, classification, size, description, price, category, quantity_rule, multiplier_rule, special_conditions, is_active)
where not exists (
  select 1 from public.pricing_rules
  where item_key = 'plastic_ball'
    and category = 'support_element'
    and is_active = true
);

commit;
