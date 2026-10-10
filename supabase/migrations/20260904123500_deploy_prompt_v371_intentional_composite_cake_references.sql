-- Accept only explicit composite source images that specify one new cake design.
-- This changes neither pricing rules nor historical cache rows.

begin;

do $migration$
declare
  source_prompt_version text;
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  v370_md5 constant text := 'e5d69eeaac907ff5bec3079f5808c60d';
  v371_md5 constant text := 'c7bb91f19c8cc4b2f6943086da76fce3';
  v370_heading constant text := '**v3.70 Version - Cardstock Material Evidence Gate**';
  v371_heading constant text := '**v3.71 Version - Intentional Composite Cake References**';
begin
  select count(*) into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot deploy v3.71: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.71';

  if target_prompt_count > 0 then
    if target_prompt_count = 1
      and exists (
        select 1
        from public.ai_prompts
        where version = '3.71'
          and is_active = true
          and md5(prompt_text) = v371_md5
      ) then
      return;
    end if;
    raise exception 'Cannot deploy v3.71: an unexpected v3.71 prompt already exists';
  end if;

  select version::text, prompt_text into source_prompt_version, source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if source_prompt_version <> '3.70'
    or md5(source_prompt) <> v370_md5
    or position(v370_heading in source_prompt) = 0 then
    raise exception 'Cannot deploy v3.71: active prompt must be verified v3.70 (%), found version % md5 %', v370_md5, source_prompt_version, md5(source_prompt);
  end if;

  next_prompt := source_prompt;
  next_prompt := replace(next_prompt, v370_heading, v371_heading);
  next_prompt := replace(next_prompt,
    $old$**Note on portraits, selfies, and receipts:** If the main subject is a payment receipt or payment screenshot, classify as `payment_receipt`. If the main subject is a person, pet, selfie, or portrait of humans with no cake or cupcakes present, classify as `selfie`. If the main subject is any other non-food object or scene, classify as `not_a_cake`. Do NOT describe, classify, or price it as a cake.

**Cupcake and set exceptions to `multiple_cakes`:** A tray, box, or close-up of
individual cupcakes with no larger cake is one accepted `Cupcake` design, not
`multiple_cakes`. Exactly one bento cake plus five cupcakes in holders inside
the same box is one accepted `Bento Cupcake Set`, not `multiple_cakes`.
Separate primary cakes or separate primary boxes still require
`multiple_cakes`.$old$,
    $new$**Note on portraits, selfies, and receipts:** If the main subject is a payment receipt or payment screenshot, classify as `payment_receipt`. If the main subject is a person, pet, selfie, or portrait of humans with no cake or cupcakes present, classify as `selfie`. If the main subject is any other non-food object or scene, classify as `not_a_cake`. Do NOT describe, classify, or price it as a cake.

**Intentional composite-reference exception to `multiple_cakes` (apply before
that rejection and before tier counting):** A clean split, stitch, or collage
of two or more cake source images can intentionally specify **one new cake
design**. A visible hard seam, changed background, lighting, angle, crop, or
separate source photo does not itself make the design `multiple_cakes`.

Accept it as one cake only when the source sections unambiguously describe one
physically coherent target construction, rather than merely sharing a theme or
color. Use these two allowed composite patterns:

1. **Stacked tier design:** vertically arranged source sections deliberately
   supply a base tier plus one or two substantial upper cake bodies. Treat the
   assembled result as `2 Tier` or `3 Tier` according to those intended cake
   bodies, even though the source photographs do not share a continuous side
   wall or shadow. Preserve the distinct visible design of each section on its
   intended tier. A shallow disc, pedestal, or topper platform remains a
   non-tier under the normal tier rule.
2. **Split-half / two-in-one design:** adjoining left/right, front/back, or
   clearly complementary halves deliberately make one cake body with two
   different faces or themes. Treat it as one cake, normally `1 Tier`, and
   include the distinct visible design features from both halves. Do not count
   the halves as cakes or tiers unless the composite also directly specifies
   stacked substantial cake bodies.

Do not invent a join, hidden decoration, or material evidence that is absent
from the source sections. Reject `multiple_cakes` when full cakes are merely
shown as separate alternatives, a comparison/before-after/grid, separate
orders or boxes, or an arbitrary collage whose sections cannot be explained as
one stacked or split-half target cake. A seam or matching theme alone is never
enough to merge unrelated cakes.

**Cupcake and set exceptions to `multiple_cakes`:** A tray, box, or close-up of
individual cupcakes with no larger cake is one accepted `Cupcake` design, not
`multiple_cakes`. Exactly one bento cake plus five cupcakes in holders inside
the same box is one accepted `Bento Cupcake Set`, not `multiple_cakes`.
Separate primary cakes or separate primary boxes still require
`multiple_cakes`.$new$);

  if md5(next_prompt) <> v371_md5
    or position(v371_heading in next_prompt) = 0
    or position(v370_heading in next_prompt) <> 0
    or position('Intentional composite-reference exception to `multiple_cakes`' in next_prompt) = 0
    or position('Split-half / two-in-one design' in next_prompt) = 0
    or position('A seam or matching theme alone is never' in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.71: intentional composite cake reference rule did not produce the verified prompt';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.71',
    next_prompt,
    true,
    'v3.71 — Accept intentional stitched tier and split-half cake references while rejecting unrelated multiple-cake collages.',
    now()
  );
end;
$migration$;

commit;
