-- Add the soft-icing Slab Cake sizes. Each tall slab is deliberately priced
-- like its corresponding 3-inch Rectangle base size.

begin;

update public.productsizes_cakegenie
set
  price = case cakesize
    when '4x12' then 1699
    when '5x14' then 2199
    when '6x16' then 2899
  end,
  display_order = case cakesize
    when '4x12' then 1
    when '5x14' then 2
    when '6x16' then 3
  end
where type = 'Slab Cake'
  and thickness = '6 in'
  and cakesize in ('4x12', '5x14', '6x16');

insert into public.productsizes_cakegenie (
  type,
  thickness,
  cakesize,
  price,
  display_order
)
select
  slab.type,
  slab.thickness,
  slab.cakesize,
  slab.price,
  slab.display_order
from (
  values
    ('Slab Cake', '6 in', '4x12', 1699, 1),
    ('Slab Cake', '6 in', '5x14', 2199, 2),
    ('Slab Cake', '6 in', '6x16', 2899, 3)
) as slab(type, thickness, cakesize, price, display_order)
where not exists (
  select 1
  from public.productsizes_cakegenie existing
  where existing.type = slab.type
    and existing.thickness = slab.thickness
    and existing.cakesize = slab.cakesize
);

commit;
