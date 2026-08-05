begin;

-- Create pricing_rules entries for the new `plastic_crown` main topper type.
-- Prices are an exact copy of the existing `toy` pricing rules so that crowns
-- remain priced identically to the current toy classification.
--
-- This uses INSERT ... SELECT so that any future toy price changes are mirrored
-- by re-running an equivalent copy migration. The guard prevents duplicates.

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
  'plastic_crown',
  'plastic_crown_' || source.size,
  source.size,
  source.classification,
  replace(source.description, 'toy', 'plastic crown'),
  source.price,
  source.category,
  source.quantity_rule,
  source.multiplier_rule,
  source.special_conditions,
  source.merchant_id,
  true
from public.pricing_rules as source
where source.item_type = 'toy'
  and source.is_active = true
  and source.size is not null
  and not exists (
    select 1
    from public.pricing_rules as existing
    where existing.item_type = 'plastic_crown'
      and existing.item_key = 'plastic_crown_' || source.size
      and existing.merchant_id is not distinct from source.merchant_id
      and existing.is_active = true
  );

commit;
