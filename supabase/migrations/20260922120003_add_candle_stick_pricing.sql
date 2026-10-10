-- Add the plain straight candle-stick rule without changing the existing
-- candle rule or any historical analysis-cache rows.
begin;

do $migration$
declare
  source_rule public.pricing_rules%rowtype;
  source_count integer;
  existing_count integer;
begin
  select count(*) into source_count
  from public.pricing_rules
  where item_key = 'candle'
    and item_type = 'candle'
    and category = 'main_topper'
    and size is null
    and is_active = true;

  if source_count <> 1 then
    raise exception 'Cannot add candle_stick pricing: expected exactly one active size-free candle rule, found %', source_count;
  end if;

  select * into source_rule
  from public.pricing_rules
  where item_key = 'candle'
    and item_type = 'candle'
    and category = 'main_topper'
    and size is null
    and is_active = true;

  select count(*) into existing_count
  from public.pricing_rules
  where item_key = 'candle_stick'
    and item_type = 'candle_stick'
    and category = 'main_topper'
    and size is null
    and merchant_id is not distinct from source_rule.merchant_id;

  if existing_count > 1 then
    raise exception 'Cannot add candle_stick pricing: duplicate merchant-scoped rules already exist';
  end if;

  if existing_count = 1 then
    if not exists (
      select 1
      from public.pricing_rules
      where item_key = 'candle_stick'
        and item_type = 'candle_stick'
        and category = 'main_topper'
        and size is null
        and merchant_id is not distinct from source_rule.merchant_id
        and price = 10
        and quantity_rule = 'per_piece'
        and is_active = true
    ) then
      raise exception 'Cannot add candle_stick pricing: existing merchant-scoped rule has unexpected values';
    end if;
    return;
  end if;

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
    is_active,
    created_at,
    updated_at
  )
  values (
    'candle_stick',
    'candle_stick',
    'hero',
    null,
    'Plain straight cylindrical wax candle stick priced per piece.',
    10,
    'main_topper',
    'per_piece',
    null,
    null,
    source_rule.merchant_id,
    true,
    now(),
    now()
  );
end;
$migration$;

commit;
