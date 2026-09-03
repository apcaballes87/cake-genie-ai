-- Replace the ambiguous flat-artwork branch without touching pricing, caches,
-- carts, orders, or other historical prompt rows.

begin;

do $migration$
declare
  source_prompt_version text;
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  v368_md5 constant text := '5eca029210ecc50deec4f3a909785e77';
  v369_md5 constant text := '0555b82678768fe6aab07a5810e87952';
  v368_heading constant text := '**v3.68 Version - Flat Symbol Construction and Role Reconciliation**';
  v369_heading constant text := '**v3.69 Version - Flat 2D Composition Complexity Boundary**';
begin
  select count(*) into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot deploy v3.69: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.69';

  if target_prompt_count > 0 then
    if target_prompt_count = 1
      and exists (
        select 1
        from public.ai_prompts
        where version = '3.69'
          and is_active = true
          and md5(prompt_text) = v369_md5
      ) then
      return;
    end if;
    raise exception 'Cannot deploy v3.69: an unexpected v3.69 prompt already exists';
  end if;

  select version::text, prompt_text into source_prompt_version, source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if source_prompt_version <> '3.68'
    or md5(source_prompt) <> v368_md5
    or position(v368_heading in source_prompt) = 0 then
    raise exception 'Cannot deploy v3.69: active prompt must be verified v3.68 (%), found version % md5 %', v368_md5, source_prompt_version, md5(source_prompt);
  end if;

  next_prompt := source_prompt;
  next_prompt := replace(next_prompt, v368_heading, v369_heading);
  next_prompt := replace(next_prompt,
    '| Detailed flat-backed edible artwork | `edible_2d_complex` | `edible_fondant` | main topper only | C2A |',
    '| Detailed multi-component flat edible artwork | `edible_2d_complex` | `edible_fondant` | main topper only | C2A |');
  next_prompt := replace(next_prompt,
    '| Simple flat edible shape as the sole focal decoration | `edible_2d_shapes` | `edible_fondant` | main topper | C5 |',
    '| Simple flat edible shape or coherent focal shape group | `edible_2d_shapes` | `edible_fondant` | main topper | C5 |');
  next_prompt := replace(next_prompt,
    $old$### EDIBLE 2D COMPLEX ARTWORK — FLAT-BACKED OR SHALLOW RELIEF

Use `edible_2d_complex` for detailed handmade edible artwork made from fondant
or gumpaste when the design is flat-backed, attached flush to a cake surface,
lying flat on the cake top, or assembled from shallow layered pieces without
freestanding all-around body depth.

This is a focal `main_toppers` type. It may be used for dominant complex 2D
artwork on either the cake top or cake side. Do not place
`edible_2d_complex` in `support_elements`.

Strong visual cues include:
- a fictional, cartoon, gaming, or stylized character face built from multiple
  hand-cut or modeled edible layers
- detailed eyes, expression, hair, headphones, clothing, accessories, outlines,
  or other coordinated features on one flat-backed plaque
- matte or satin fondant/gumpaste surfaces with visible cut edges or shallow
  stacked layers
- one coordinated focal composition that sits flush against the icing rather
  than standing as a figure that can be viewed from all sides

Apply this precedence before using `edible_3d_complex`:
1. Clearly printed artwork remains `printout`, `edible_photo_top`,
   `edible_photo_side`, or `edible_photo_print` according to material and
   placement.
2. A recognizable human or pet likeness in unsupported detailed relief remains
   governed by `UNSUPPORTED SEMI-3D PORTRAIT RELIEF TO EDIBLE PHOTO TOP` and
   becomes `edible_photo_top`.
3. A logo, wordmark, brand name, or decorative brand lettering remains
   `edible_logo_2d`.
4. Plain stars, dots, hearts, leaves, geometric pieces, and other simple flat
   cut shapes remain `edible_2d_shapes` when one shape or a coherent focal
   group of flat toppers is the dominant decoration, emitted in
   `main_toppers`. All other flat pieces remain `edible_2d_support`, emitted
   in `support_elements` at every size.
5. Detailed handmade flat-backed or shallow-relief fictional characters,
   faces, animals, and objects use `edible_2d_complex`.
6. Only a genuinely freestanding hand-sculpted figure or object with visible
   all-around body depth may use `edible_3d_complex`.

Treat one coordinated character plaque as one item with `quantity: 1`. Do not
itemize its hair, face, eyes, mouth, headphones, clothing, accessories, or
individual edible layers as separate decorations.

Roblox example:
- layered fondant Roblox character face with hair and headphones lying flat on
  the cake top -> one `edible_2d_complex`, `material: "edible_fondant"`,
  `classification: "hero"`, `size: "large"`, `quantity: 1`
- separate red fondant ROBLOX wordmark on the cake side -> one
  `edible_logo_2d`, not `edible_2d_complex`, not `edible_lego_bricks`
- a glossy printed Roblox character image -> `printout` or an edible photo type
- a freestanding fully sculpted Roblox figurine with visible side and body
  depth -> `edible_3d_complex`

Size `edible_2d_complex` by surface span, not by the 3D figure height table.
Measure the artwork's longest visible span and divide it by the matching visible
span of the cake surface it occupies. On the top, compare with the visible cake
top diameter or width. On a side, compare a horizontal design with the visible
tier width and a vertical design with the visible tier height.

| Size | Artwork span across the relevant cake surface |
|------|------------------------------------------------|
| `small` | under 20% |
| `medium` | 20% to under 50% |
| `large` | 50% or greater |$old$,
    $new$### EDIBLE 2D COMPLEX ARTWORK — FLAT-BACKED OR SHALLOW RELIEF

Use `edible_2d_complex` only for one detailed, composed handmade edible artwork
made from visibly distinct fondant or gumpaste components that together create
a recognizable character, face, animal, object, or intricate non-logo design.
The composition may be flat-backed, attached flush to a cake surface, lying
flat on the cake top, or assembled from shallow layered pieces without
freestanding all-around body depth; flat placement alone does not establish
complexity.

A single simple cut motif, or a repeated/focal group of identical simple motifs
such as stars, hearts, circles, leaves, or geometric shapes, is never
`edible_2d_complex`. Large span, multiple colors, a flat back, shallow relief,
or an upright support stick does not add components or make a simple motif
complex. Use `edible_2d_shapes` for a focal shape or coherent focal group, and
`edible_2d_support` for other flat accents. A readable logo, wordmark, or brand
design remains `edible_logo_2d` under its dedicated rule.

This is a focal `main_toppers` type. It may be used for dominant complex 2D
artwork on either the cake top or cake side. Do not place
`edible_2d_complex` in `support_elements`.

Strong visual cues include:
- a fictional, cartoon, gaming, or stylized character face built from multiple
  hand-cut or modeled edible layers
- detailed eyes, expression, hair, headphones, clothing, accessories, outlines,
  or other coordinated features on one flat-backed plaque
- visibly separate facial, anatomical, clothing, accessory, outline, or other
  coordinated components that must be assembled into the composed subject
- matte or satin fondant/gumpaste surfaces with visible cut edges or shallow
  stacked layers as evidence of those distinct components
- one coordinated focal composition that sits flush against the icing rather
  than standing as a figure that can be viewed from all sides

Apply this precedence before using `edible_3d_complex`:
1. Clearly printed artwork remains `printout`, `edible_photo_top`,
   `edible_photo_side`, or `edible_photo_print` according to material and
   placement.
2. A recognizable human or pet likeness in unsupported detailed relief remains
   governed by `UNSUPPORTED SEMI-3D PORTRAIT RELIEF TO EDIBLE PHOTO TOP` and
   becomes `edible_photo_top`.
3. A logo, wordmark, brand name, or decorative brand lettering remains
   `edible_logo_2d`.
4. Plain stars, dots, hearts, leaves, geometric pieces, and other simple flat
   cut shapes remain `edible_2d_shapes` when one shape or a coherent focal
   group of flat toppers is the dominant decoration, emitted in
   `main_toppers`. All other flat pieces remain `edible_2d_support`, emitted
   in `support_elements` at every size.
5. Detailed multi-component flat-backed or shallow-relief fictional characters,
   faces, animals, and non-logo objects use `edible_2d_complex`.
6. Only a genuinely freestanding hand-sculpted figure or object with visible
   all-around body depth may use `edible_3d_complex`.

Treat one coordinated character plaque as one item with `quantity: 1`. Do not
itemize its hair, face, eyes, mouth, headphones, clothing, accessories, or
individual edible layers as separate decorations.

Roblox example:
- layered fondant Roblox character face with hair and headphones lying flat on
  the cake top -> one `edible_2d_complex`, `material: "edible_fondant"`,
  `classification: "hero"`, `size: "large"`, `quantity: 1`
- separate red fondant ROBLOX wordmark on the cake side -> one
  `edible_logo_2d`, not `edible_2d_complex`, not `edible_lego_bricks`
- a glossy printed Roblox character image -> `printout` or an edible photo type
- a freestanding fully sculpted Roblox figurine with visible side and body
  depth -> `edible_3d_complex`

Size `edible_2d_complex` by surface span, not by the 3D figure height table.
Measure the artwork's longest visible span and divide it by the matching visible
span of the cake surface it occupies. On the top, compare with the visible cake
top diameter or width. On a side, compare a horizontal design with the visible
tier width and a vertical design with the visible tier height.

| Size | Artwork span across the relevant cake surface |
|------|------------------------------------------------|
| `small` | under 20% |
| `medium` | 20% to under 50% |
| `large` | 50% or greater |$new$);
  next_prompt := replace(next_prompt,
    'Detailed flat-backed artwork',
    'Detailed multi-component flat-backed artwork');

  if md5(next_prompt) <> v369_md5
    or position(v369_heading in next_prompt) = 0
    or position(v368_heading in next_prompt) <> 0
    or position('A single simple cut motif' in next_prompt) = 0
    or position('Detailed flat-backed artwork' in next_prompt) <> 0 then
    raise exception 'Cannot deploy v3.69: flat 2D composition boundary did not produce the verified prompt';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.69',
    next_prompt,
    true,
    'v3.69 — Require multi-component composed flat artwork for edible_2d_complex; keep simple focal shape groups in edible_2d_shapes.',
    now()
  );
end;
$migration$;

commit;
