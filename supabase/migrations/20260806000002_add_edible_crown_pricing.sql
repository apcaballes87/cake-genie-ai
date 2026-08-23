begin;

-- Create pricing_rules entries for the `edible_crown` main topper type.
-- Edible crowns use the toy price bands plus PHP 100 per piece.
-- The source rule copy preserves quantity and merchant-specific behavior.

insert into public.pricing_rules (
  item_type,
  item_key,
  size,
  classification,
  description,
  price,
  category,
  quantity_rule,
  multiplier_rule,
  special_conditions,
  merchant_id,
  is_active
)
select
  'edible_crown',
  'edible_crown_' || source.size,
  source.size,
  source.classification,
  replace(source.description, 'toy', 'edible crown'),
  source.price + 100,
  source.category,
  source.quantity_rule,
  source.multiplier_rule,
  source.special_conditions,
  source.merchant_id,
  true
from public.pricing_rules as source
where source.item_type = 'toy'
  and source.category = 'main_topper'
  and source.is_active = true
  and source.size is not null
  and not exists (
    select 1
    from public.pricing_rules as existing
    where existing.item_type = 'edible_crown'
      and existing.item_key = 'edible_crown_' || source.size
      and existing.merchant_id is not distinct from source.merchant_id
      and existing.is_active = true
  );

commit;
