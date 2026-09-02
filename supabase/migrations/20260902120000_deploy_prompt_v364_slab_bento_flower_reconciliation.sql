-- Deploy prompt v3.64. Preserve the v3.62 Bento multi-icon normalization,
-- include the Slab Cake contract, and reconcile plural flower row wording.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  v362_md5 constant text := 'ccdd05a22ecab9817f74cd750aff809b';
  v363_md5 constant text := '310289218544b2c82c4b095f9c357acc';
  v364_md5 constant text := '534ba678ce22d28baa3ea97a2dc35cfc';
  v362_heading constant text := '**v3.62 Version - Bento Multi-Icon Edible Photo Tops**';
  v363_heading constant text := '**v3.63 Version - Slab Cake Type**';
  v364_heading constant text := '**v3.64 Version - Slab Cake, Bento Montage, and Flower Row Reconciliation**';
  old_cake_type_list constant text := $anchor$Must be one of: `"Bento"`, `"1 Tier"`, `"2 Tier"`, `"3 Tier"`, `"1 Tier Fondant"`, `"2 Tier Fondant"`, `"3 Tier Fondant"`, `"Square"`, `"Rectangle"`, `"Square Fondant"`, `"Rectangle Fondant"`, `"Cupcake"`, `"Bento Cupcake Set"`$anchor$;
  new_cake_type_list constant text := $anchor$Must be one of: `"Bento"`, `"1 Tier"`, `"2 Tier"`, `"3 Tier"`, `"1 Tier Fondant"`, `"2 Tier Fondant"`, `"3 Tier Fondant"`, `"Square"`, `"Rectangle"`, `"Slab Cake"`, `"Square Fondant"`, `"Rectangle Fondant"`, `"Cupcake"`, `"Bento Cupcake Set"`$anchor$;
  rectangle_shape_anchor constant text := $anchor$Use `Rectangle` when the cake body is clearly longer in one direction, with a
rectangular footprint or sheet-cake/block shape.
$anchor$;
  slab_shape_block constant text := $anchor$Use `Rectangle` when the cake body is clearly longer in one direction, with a
rectangular footprint or sheet-cake/block shape.

### SLAB CAKE — TALL, NARROW RECTANGLE

Use `Slab Cake` only for a visibly tall, narrow, single-layer rectangular slab
with the long bar-like proportions of our 4x12, 5x14, or 6x16 slab formats.
It MUST use `cakeThickness: "6 in"` and `icing_design.base: "soft_icing"`.
Do not infer or emit an exact slab size from the image; the customer chooses the
size after analysis. Ordinary rectangular sheet/block cakes remain `Rectangle`,
even when the exact dimensions are unclear.
$anchor$;
  old_icing_contract constant text := $anchor$requires `icing_design.base: "fondant"`. A non-Fondant tier, square, or
rectangle cakeType requires `icing_design.base: "soft_icing"`. `Bento`,
$anchor$;
  new_icing_contract constant text := $anchor$requires `icing_design.base: "fondant"`. A non-Fondant tier, square, rectangle, or
slab cakeType requires `icing_design.base: "soft_icing"`. `Bento`,
$anchor$;
  old_thickness_matrix_row constant text := $anchor$| `Square`, `Rectangle` | `"3 in"`, `"4 in"` |
$anchor$;
  new_thickness_matrix_row constant text := $anchor$| `Square`, `Rectangle` | `"3 in"`, `"4 in"` |
| `Slab Cake` | `"6 in"` |
$anchor$;
  flower_ignore_heading constant text := '### IGNORE NON-DESIGN BRANDING / WATERMARKS / PACKAGING TEXT';
  flower_wording_block constant text := $anchor$### FLOWER ROW QUANTITY–WORDING RECONCILIATION (REQUIRED)

Every `edible_flowers` row is priced by individual bloom. When `quantity` is
2 or more, `group_id` and `description` must name the individual plural flowers
and agree with that count. Do not use `cluster`, `bouquet`, `spray`,
`arrangement`, `bunch`, or `group` as the counted object or primary noun in
that row.

For example, 25 chamomile blooms on top must use a group ID such as
`top_chamomile_flowers` and description `25 individual chamomile flowers
arranged on top`, never `top_chamomile_cluster` or `cluster of chamomile
flowers on top`.$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.64: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.64';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.64'
        and is_active = true
        and md5(prompt_text) = v364_md5
    ) then
      raise exception 'Cannot record ai_prompts v3.64: an unexpected v3.64 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) = v362_md5 then
    if position(v362_heading in source_prompt) = 0
      or position(old_cake_type_list in source_prompt) = 0
      or position(rectangle_shape_anchor in source_prompt) = 0
      or position(old_icing_contract in source_prompt) = 0
      or position(old_thickness_matrix_row in source_prompt) = 0 then
      raise exception 'Cannot create ai_prompts v3.64: expected v3.62 Slab Cake anchors were not found';
    end if;

    next_prompt := replace(source_prompt, v362_heading, v364_heading);
    next_prompt := replace(next_prompt, old_cake_type_list, new_cake_type_list);
    next_prompt := replace(next_prompt, rectangle_shape_anchor, slab_shape_block);
    next_prompt := replace(next_prompt, old_icing_contract, new_icing_contract);
    next_prompt := replace(next_prompt, old_thickness_matrix_row, new_thickness_matrix_row);
  elsif md5(source_prompt) = v363_md5 then
    if position(v363_heading in source_prompt) = 0 then
      raise exception 'Cannot create ai_prompts v3.64: expected v3.63 heading was not found';
    end if;

    next_prompt := replace(source_prompt, v363_heading, v364_heading);
  else
    raise exception 'Cannot create ai_prompts v3.64: active prompt must be the verified v3.62 or v3.63 baseline';
  end if;

  if position(flower_ignore_heading in next_prompt) = 0
    or position('### FLOWER ROW QUANTITY–WORDING RECONCILIATION (REQUIRED)' in next_prompt) > 0 then
    raise exception 'Cannot create ai_prompts v3.64: flower wording insertion anchor was not found or already exists';
  end if;

  next_prompt := replace(
    next_prompt,
    flower_ignore_heading,
    flower_wording_block || E'\n\n' || flower_ignore_heading
  );

  if position(v364_heading in next_prompt) = 0
    or position('### BENTO MULTI-ICON TOP MONTAGE TO EDIBLE PHOTO TOP (REQUIRED)' in next_prompt) = 0
    or position('### SLAB CAKE — TALL, NARROW RECTANGLE' in next_prompt) = 0
    or position('### FLOWER ROW QUANTITY–WORDING RECONCILIATION (REQUIRED)' in next_prompt) = 0
    or md5(next_prompt) <> v364_md5 then
    raise exception 'Cannot create ai_prompts v3.64: prompt assembly did not match the verified combined source';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.64',
    next_prompt,
    true,
    'v3.64 — Preserve Bento multi-icon photo-top fulfillment, add Slab Cake, and require per-bloom flower row wording.',
    now()
  );
end;
$migration$;

commit;
