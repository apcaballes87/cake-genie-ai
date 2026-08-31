-- Deploy prompt v3.63. Slab Cake is a tall, narrow, soft-icing rectangle with
-- a fixed 6-inch height; its exact selectable size is chosen after analysis.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_heading constant text := '**v3.62 Version - Bento Multi-Icon Edible Photo Tops**';
  new_heading constant text := '**v3.63 Version - Slab Cake Type**';
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
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.63: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.63';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.63'
        and is_active = true
        and md5(prompt_text) = '310289218544b2c82c4b095f9c357acc'
    ) then
      raise exception 'Cannot record ai_prompts v3.63: an unexpected v3.63 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> 'ccdd05a22ecab9817f74cd750aff809b' then
    raise exception 'Cannot create ai_prompts v3.63: active prompt does not match the v3.62 baseline';
  end if;

  if position(old_heading in source_prompt) = 0
    or position(old_cake_type_list in source_prompt) = 0
    or position(rectangle_shape_anchor in source_prompt) = 0
    or position(old_icing_contract in source_prompt) = 0
    or position(old_thickness_matrix_row in source_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.63: expected v3.62 slab-cake anchors were not found';
  end if;

  next_prompt := replace(source_prompt, old_heading, new_heading);
  next_prompt := replace(next_prompt, old_cake_type_list, new_cake_type_list);
  next_prompt := replace(next_prompt, rectangle_shape_anchor, slab_shape_block);
  next_prompt := replace(next_prompt, old_icing_contract, new_icing_contract);
  next_prompt := replace(next_prompt, old_thickness_matrix_row, new_thickness_matrix_row);

  if position(new_heading in next_prompt) = 0
    or position('### SLAB CAKE — TALL, NARROW RECTANGLE' in next_prompt) = 0
    or position('It MUST use `cakeThickness: "6 in"` and `icing_design.base: "soft_icing"`.' in next_prompt) = 0
    or position('| `Slab Cake` | `"6 in"` |' in next_prompt) = 0
    or md5(next_prompt) <> '310289218544b2c82c4b095f9c357acc' then
    raise exception 'Cannot create ai_prompts v3.63: slab-cake prompt update was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.63',
    next_prompt,
    true,
    'v3.63 — Add the Slab Cake analysis type, fixed 6 in contract, and selectable slab-size guidance.',
    now()
  );
end;
$migration$;

commit;
