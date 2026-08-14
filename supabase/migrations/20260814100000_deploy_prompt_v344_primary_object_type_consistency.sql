begin;

do $$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  reconcile_anchor constant text := $anchor$6. **Reconcile before emitting JSON.**
   Compare each item's visible construction, description, material, and type.
   The image evidence is authoritative. If any field conflicts, return to the
   image and correct whichever output fields disagree with the supported
   construction. Do not preserve an incompatible classification by deleting or
   softening an accurate construction cue, and do not let unsupported
   description wording override the image.$anchor$;
  primary_object_rule constant text := $rule$### ONE PRIMARY PRICED OBJECT PER ROW — DESCRIPTION/TYPE CONSISTENCY (REQUIRED)

Each `main_toppers` or `support_elements` row must represent exactly one primary
priced object. Begin `description` with that primary object, and make its
structured `type` and `material` match that object. This is a pre-emission
consistency check; visible image evidence and named fulfillment normalizations
remain authoritative.

Treat object wording after `with`, `topped with`, `covered in`, `covered with`,
`decorated with`, `finished with`, or `featuring` as secondary to the primary
object before the connector. Examples:
- `colorful sprinkles scattered on top` -> `sprinkles`, material `candy`
- `fondant donut with sprinkles` -> `edible_3d_ordinary`, material
  `edible_fondant`, not `sprinkles`
- `meringue kisses with sprinkles` -> `meringue`, material `candy`, not
  `sprinkles`
- `piped icing dollops topped with sprinkles` -> `icing_decorations`, material
  `icing`, not `sprinkles`

If the secondary garnish is independently priced or countable, emit it as its
own row. Never combine two independently priced objects in one row.$rule$;
  invalid_icing_sprinkles_row constant text := $invalid$| `icing sprinkles` | candy | dot sprinkles on the sides covering less than 50% of the icing surface. |$invalid$;
  original_icing_decorations_row constant text := $original$| `icing_decorations` | icing | Piped icing elements (rosettes, swirls, borders) - tiny/small, usually at top, sides, or base |$original$;
  replacement_icing_decorations_row constant text := $replacement$| `icing_decorations` | icing | Piped icing elements such as dots, rosettes, swirls, and borders. Piped icing dots on the sides covering less than 50% of the icing surface are icing decorations, not candy sprinkles. Usually tiny/small at the top, sides, or base. |$replacement$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.44: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.44';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.44'
        and is_active = true
        and md5(prompt_text) = 'c80520a8bc4ccc110f8cc687db34390e'
    ) then
      raise exception 'Cannot record ai_prompts v3.44: an unexpected v3.44 row already exists';
    end if;
    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> '46a32fe561fc7a1e102466f4469b12b0' then
    raise exception 'Cannot create ai_prompts v3.44: active prompt does not match the v3.43 baseline';
  end if;

  if position(reconcile_anchor in source_prompt) = 0
    or position(invalid_icing_sprinkles_row in source_prompt) = 0
    or position(original_icing_decorations_row in source_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.44: expected v3.43 description/type anchors were not found';
  end if;

  next_prompt := replace(
    source_prompt,
    '**v3.43 Version - Tiny Sugar Pearls Are Sprinkles**',
    '**v3.44 Version - Primary Object Description-to-Type Consistency**'
  );
  next_prompt := replace(
    next_prompt,
    reconcile_anchor,
    reconcile_anchor || E'\n\n' || primary_object_rule
  );
  next_prompt := replace(next_prompt, invalid_icing_sprinkles_row || E'\n', '');
  next_prompt := replace(
    next_prompt,
    original_icing_decorations_row,
    replacement_icing_decorations_row
  );

  if position('**v3.44 Version - Primary Object Description-to-Type Consistency**' in next_prompt) = 0
    or position('ONE PRIMARY PRICED OBJECT PER ROW — DESCRIPTION/TYPE CONSISTENCY (REQUIRED)' in next_prompt) = 0
    or position('`colorful sprinkles scattered on top` -> `sprinkles`, material `candy`' in next_prompt) = 0
    or position('independently priced or countable' in next_prompt) = 0
    or position(invalid_icing_sprinkles_row in next_prompt) <> 0
    or position(replacement_icing_decorations_row in next_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.44: primary-object consistency rule was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.44',
    next_prompt,
    true,
    'v3.44 — Require one primary priced object per row and align descriptions with canonical type/material fields.',
    now()
  );
end;
$$;

commit;
