begin;

do $$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  sphere_protocol constant text := $sphere$### Protocol 5: THE "SPHERE" CHECK (Fondant vs Plastic)
- IF a ball/sphere is perfectly smooth, rigid, and highly reflective or
  mirror-like, first establish plastic construction. Use `plastic_ball` for one
  dominant focal sphere or physical 3D balloon in `main_toppers`. Use
  `plastic_ball_regular` for repeated, background, or supporting plastic
  spheres in `support_elements`.
- IF ball/sphere has minor imperfections, matte or satiny finish, or looks hand-rolled → IT IS "edible_3d_ordinary" (Fondant).$sphere$;
  sugar_pearl_precedence constant text := $precedence$### TINY SUGAR PEARLS / BEADS / NONPAREILS — `sprinkles` PRECEDENCE (REQUIRED)

Before applying the generic SPHERE CHECK, classify any **tiny or xsmall,
scattered or repeated** sugar pearls, sugar beads, pearl beads, nonpareils, or
other sprinkle-scale round decorations as exactly one `support_elements` item
with `type: "sprinkles"`, `material: "candy"`, and `quantity: 1` for the
overall scatter application. This is a fulfillment classification override:
it applies even when the tiny pieces look matte, satiny, hand-rolled, or like
fondant.

Do NOT emit these tiny scattered/repeated pearls or beads as
`edible_3d_ordinary`, `plastic_ball_regular`, `premium_sprinkles`, or separate
per-piece rows. Use `edible_3d_ordinary` only for a substantial individual
fondant/gumpaste ball or other molded 3D decoration, not sprinkle-scale pearl
or bead accents.$precedence$;
  original_sprinkles_row constant text := $row$| `sprinkles` | candy | Normal Sprinkles: long rainbow/colored sprinkles, single color sprinkles, or round metallic/pearl sprinkles covering less than 50% of the icing surface. |$row$;
  replacement_sprinkles_row constant text := $replacement_row$| `sprinkles` | candy | Normal sprinkles, including long rainbow/colored sprinkles, single-color sprinkles, and every tiny/xsmall scattered or repeated sugar pearl, sugar bead, pearl bead, or nonpareil. Use quantity 1 for one overall scatter application. |$replacement_row$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.43: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true;

  if md5(source_prompt) <> 'faf2964f0231afef05ff6e10377b6406' then
    raise exception 'Cannot create ai_prompts v3.43: active prompt does not match the v3.42 baseline';
  end if;

  if exists (select 1 from public.ai_prompts where version = '3.43') then
    raise exception 'Cannot create ai_prompts v3.43: version 3.43 already exists';
  end if;

  if position(sphere_protocol in source_prompt) = 0
    or position(original_sprinkles_row in source_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.43: expected v3.42 sugar-pearl anchors were not found';
  end if;

  next_prompt := replace(
    source_prompt,
    '**v3.42 Version - All Flowers Are Edible**',
    '**v3.43 Version - Tiny Sugar Pearls Are Sprinkles**'
  );
  next_prompt := replace(
    next_prompt,
    sphere_protocol,
    sugar_pearl_precedence || E'\n\n' || sphere_protocol
  );
  next_prompt := replace(next_prompt, original_sprinkles_row, replacement_sprinkles_row);

  if position('**v3.43 Version - Tiny Sugar Pearls Are Sprinkles**' in next_prompt) = 0
    or position('TINY SUGAR PEARLS / BEADS / NONPAREILS — `sprinkles` PRECEDENCE (REQUIRED)' in next_prompt) = 0
    or position('`type: "sprinkles"`, `material: "candy"`, and `quantity: 1`' in next_prompt) = 0
    or position('every tiny/xsmall scattered or repeated sugar pearl' in next_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.43: strict sugar-pearl rule was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.43',
    next_prompt,
    true,
    'v3.43 — Tiny/xsmall scattered sugar pearls, beads, and nonpareils are grouped candy sprinkles, never per-piece fondant spheres.',
    now()
  );
end;
$$;

commit;
