begin;

-- The gumpaste allowance is no longer part of the pricing contract.
update public.pricing_rules
set
  is_active = false,
  updated_at = now()
where is_active = true
  and item_key = 'gumpaste_allowance';

commit;
