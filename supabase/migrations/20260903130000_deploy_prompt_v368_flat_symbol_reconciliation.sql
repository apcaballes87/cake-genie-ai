-- Resolve the flat-symbol versus ordinary-3D contradiction without changing
-- pricing rules, cached analyses, carts, or orders.

begin;

do $migration$
declare
  source_prompt_version text;
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  v367_md5 constant text := '4d49dc39935f23075a380111ef5d114f';
  v368_md5 constant text := '5eca029210ecc50deec4f3a909785e77';
  v367_heading constant text := '**v3.67 Version - Three-Band Sizing and Pricing Compatibility**';
  v368_heading constant text := '**v3.68 Version - Flat Symbol Construction and Role Reconciliation**';
begin
  select count(*) into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot deploy v3.68: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.68';

  if target_prompt_count > 0 then
    if target_prompt_count = 1
      and exists (
        select 1
        from public.ai_prompts
        where version = '3.68'
          and is_active = true
          and md5(prompt_text) = v368_md5
      ) then
      return;
    end if;
    raise exception 'Cannot deploy v3.68: an unexpected v3.68 prompt already exists';
  end if;

  select version::text, prompt_text into source_prompt_version, source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if source_prompt_version <> '3.67'
    or md5(source_prompt) <> v367_md5
    or position(v367_heading in source_prompt) = 0 then
    raise exception 'Cannot deploy v3.68: active prompt must be verified v3.67 (%), found version % md5 %', v367_md5, source_prompt_version, md5(source_prompt);
  end if;

  next_prompt := source_prompt;
  next_prompt := replace(next_prompt, v367_heading, v368_heading);
  next_prompt := replace(next_prompt,
    '| Simple molded edible form, including a simple molded face | `edible_3d_ordinary` | `edible_fondant` | main or support by role | C1 |',
    '| Simple visibly volumetric molded edible form, including a simple molded face | `edible_3d_ordinary` | `edible_fondant` | main or support by role | C1 |');
  next_prompt := replace(next_prompt,
    $old$4. Plain stars, dots, hearts, leaves, geometric pieces, and other simple flat
   cut shapes remain `edible_2d_shapes` (only when one such shape is the sole
   focal decoration, emitted in `main_toppers`) or `edible_2d_support` (all
   other cases, emitted in `support_elements` at every size).$old$,
    $new$4. Plain stars, dots, hearts, leaves, geometric pieces, and other simple flat
   cut shapes remain `edible_2d_shapes` when one shape or a coherent focal
   group of flat toppers is the dominant decoration, emitted in
   `main_toppers`. All other flat pieces remain `edible_2d_support`, emitted
   in `support_elements` at every size.$new$);
  next_prompt := replace(next_prompt,
    $old$Facial features, multiple colors, metallic accents, or an irregular outline
alone are not enough for `edible_3d_complex`. A simple molded smiley, sun,
moon, icon, medallion, or other non-likeness decorative face remains
`edible_3d_ordinary`. Detailed flat-backed artwork uses$old$,
    $new$Facial features, multiple colors, metallic accents, or an irregular outline
alone are not enough for `edible_3d_complex`. A simple visibly volumetric
molded smiley, sun, moon, icon, medallion, or other non-likeness decorative
face remains `edible_3d_ordinary`. Detailed flat-backed artwork uses$new$);
  next_prompt := replace(next_prompt,
    $old$#### MOLDED CELESTIAL / SYMBOL TOPPERS

Do NOT classify a topper as `edible_3d_complex` only because it has a face,
expression, ridges, embossed details, or decorative surface texture.

If the item appears to be made from a mold, cutter, stamp, or shallow relief
shape, classify it as `edible_3d_ordinary`, even if it has simple facial
features.

Common `edible_3d_ordinary` molded items include:
- sun faces
- moon faces
- stars
- shells
- crosses
- hearts
- molded fondant clouds
- bows
- plaques
- medallions
- mermaid tails
- simple molded animal or icon forms with flat-stamped or shallow faces and no modeled expression (a freestanding animal-head set with modeled ears, eyes, and mouth stays `edible_3d_complex` above)

Use `edible_3d_complex` only when the item is a freestanding all-around
sculpture requiring clear hand-sculpted character work, such as a detailed
full body, limbs, clothing, pose, multi-part anatomy, expressive character
modeling, or non-repeating custom sculpture.

For celestial toppers:
- molded sun with face = `edible_3d_ordinary`
- molded moon with face = `edible_3d_ordinary`
- molded stars = `edible_3d_ordinary` or `edible_2d_support` depending depth or placement
- only a fully sculpted sun or moon character figure with body, limbs, or pose should be `edible_3d_complex`
- Facial features are only one signal of complexity; they do not override
  evidence that the item is molded, stamped, flat-backed, shallow-relief, or a
  simple repeated decorative shape.$old$,
    $new$#### VOLUMETRIC CELESTIAL / SYMBOL TOPPERS

Do NOT classify a topper as `edible_3d_complex` only because it has a face,
expression, ridges, embossed details, or decorative surface texture.

Use `edible_3d_ordinary` for a simple non-flower symbol only when direct image
evidence shows independent modeled volume: a rounded or domed form with
distinct side surfaces, or an all-around shape whose depth is more than the
thin edge of a cut piece. A mold name, cutter, stamp, shallow relief, apparent
shadow, or support stick alone does not establish that volume.

A thin planar, cut, stamped, flat-backed, or shallow-relief star, heart, sun,
moon, shell, cross, plaque, medallion, or other simple symbol remains 2D even
when mounted upright on a stick. Use `edible_2d_shapes` for one flat focal
shape or a coherent focal group of flat toppers; otherwise use
`edible_2d_support`. Detailed flat-backed artwork continues to use
`edible_2d_complex`.

For a genuinely volumetric simple symbol, use `edible_3d_ordinary`; examples
include a domed sun or moon face, a rounded molded fondant cloud, a thick bow,
or a visibly all-around simple icon. A fully sculpted sun or moon character
with body, limbs, or pose remains `edible_3d_complex`.$new$);
  next_prompt := replace(next_prompt,
    $old$Classify as `edible_3d_ordinary` if ALL of these are true:
- NO assembled full character anatomy with multiple body parts. An isolated$old$,
    $new$Classify as `edible_3d_ordinary` if ALL of these are true:
- Direct image evidence shows independent modeled volume rather than a thin,
  planar, cut, stamped, or shallow-relief piece.
- NO assembled full character anatomy with multiple body parts. An isolated$new$);
  next_prompt := replace(next_prompt,
    '- Simple shapes, bows, balls, basic items, and simple molded non-likeness faces → **edible_3d_ordinary**',
    '- Visibly volumetric simple shapes, bows, balls, basic items, and simple molded non-likeness faces → **edible_3d_ordinary**');

  if md5(next_prompt) <> v368_md5
    or position(v368_heading in next_prompt) = 0
    or position('#### MOLDED CELESTIAL / SYMBOL TOPPERS' in next_prompt) <> 0
    or position('support stick alone does not establish that volume' in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.68: flat-symbol reconciliation did not produce the verified prompt';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.68',
    next_prompt,
    true,
    'v3.68 — Reconcile flat edible symbols with visibly volumetric ordinary 3D forms and focal-topper roles.',
    now()
  );
end;
$migration$;

commit;
