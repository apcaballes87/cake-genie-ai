-- Deploy prompt v3.49. Multi-ball plastic balloon clusters are priced as the
-- individual support balls that compose them, never as one aggregate hero.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_matrix_rows constant text := $anchor$| One dominant focal plastic sphere or 3D balloon | `plastic_ball` | `plastic` | main topper | C4 |
| Repeated or background plastic sphere | `plastic_ball_regular` | `plastic` | support element | C4 |$anchor$;
  new_matrix_rows constant text := $anchor$| One isolated dominant plastic sphere or 3D balloon | `plastic_ball` | `plastic` | main topper | C4 |
| Each ball in a multi-ball plastic balloon cluster, bouquet, arch, or garland | `plastic_ball_regular` | `plastic` | support element | C4 |$anchor$;
  old_sphere_protocol constant text := $anchor$### Protocol 5: THE "SPHERE" CHECK (Fondant vs Plastic)
- IF a ball/sphere is perfectly smooth, rigid, and highly reflective or
  mirror-like, first establish plastic construction. Use `plastic_ball` for one
  dominant focal sphere or physical 3D balloon in `main_toppers`. Use
  `plastic_ball_regular` for repeated, background, or supporting plastic
  spheres in `support_elements`.$anchor$;
  new_sphere_protocol constant text := $anchor$### Protocol 5: THE "SPHERE" CHECK (Fondant vs Plastic)
- IF a ball/sphere is perfectly smooth, rigid, and highly reflective or
  mirror-like, first establish plastic construction. Use `plastic_ball` only
  for exactly one isolated dominant focal sphere or physical 3D balloon in
  `main_toppers`.

### INDIVIDUAL PLASTIC BALLOON CLUSTER UNITS (REQUIRED)

A cluster, bouquet, arch, or garland of two or more separately visible plastic
balls or physical 3D balloons is never one `plastic_ball` hero, even when it is
the focal topper. Emit its balls only as `plastic_ball_regular` rows in
`support_elements`. Count every separately visible physical ball as one
quantity unit, split rows by visibly different color or size, and use the
actual visible count for each row. Never emit a multi-ball cluster as one
`plastic_ball` item or with `quantity: 1`. Do not invent balls hidden from view.

Use `plastic_ball_regular` for repeated, background, or supporting plastic
spheres in `support_elements`.$anchor$;
  old_support_row constant text := $anchor$| `plastic_ball_regular` | plastic | Round smooth plastic spheres (gold, silver, colored). Count individually |$anchor$;
  new_support_row constant text := $anchor$| `plastic_ball_regular` | plastic | Round smooth plastic spheres (gold, silver, colored). A multi-ball cluster, bouquet, arch, or garland uses support rows only: count every separately visible ball individually, split by visible color or size, never use one cluster row with quantity 1, and do not invent hidden balls. |$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.49: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.49';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.49'
        and is_active = true
        and md5(prompt_text) = '3ea5f728f7b5373128389fa64fbec6be'
    ) then
      raise exception 'Cannot record ai_prompts v3.49: an unexpected v3.49 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> 'ec97bd2220713f89edba76d2626bf7e8' then
    raise exception 'Cannot create ai_prompts v3.49: active prompt does not match the v3.48 baseline';
  end if;

  if position('**v3.48 Version - Conditioned Wafer Paper Wave Fulfillment**' in source_prompt) = 0
    or position(old_matrix_rows in source_prompt) = 0
    or position(old_sphere_protocol in source_prompt) = 0
    or position(old_support_row in source_prompt) = 0
    or position('INDIVIDUAL PLASTIC BALLOON CLUSTER UNITS (REQUIRED)' in source_prompt) <> 0 then
    raise exception 'Cannot create ai_prompts v3.49: expected v3.48 plastic-ball anchors were not found';
  end if;

  next_prompt := replace(
    source_prompt,
    '**v3.48 Version - Conditioned Wafer Paper Wave Fulfillment**',
    '**v3.49 Version - Individual Plastic Balloon Cluster Units**'
  );
  next_prompt := replace(next_prompt, old_matrix_rows, new_matrix_rows);
  next_prompt := replace(next_prompt, old_sphere_protocol, new_sphere_protocol);
  next_prompt := replace(next_prompt, old_support_row, new_support_row);

  if position('INDIVIDUAL PLASTIC BALLOON CLUSTER UNITS (REQUIRED)' in next_prompt) = 0
    or position('Count every separately visible physical ball as one' in next_prompt) = 0
    or position('Never emit a multi-ball cluster as one' in next_prompt) = 0
    or position(new_matrix_rows in next_prompt) = 0
    or position(new_support_row in next_prompt) = 0
    or md5(next_prompt) <> '3ea5f728f7b5373128389fa64fbec6be' then
    raise exception 'Cannot create ai_prompts v3.49: individual plastic balloon rule was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.49',
    next_prompt,
    true,
    'v3.49 — Count multi-ball plastic balloon clusters as individual plastic_ball_regular support units.',
    now()
  );
end;
$migration$;

commit;
