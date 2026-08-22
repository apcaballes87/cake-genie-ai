-- Deploy prompt v3.50. Require a direct visual tally so a multi-ball cluster
-- cannot be priced from an inflated or assumed quantity.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_cluster_tail constant text := $anchor$actual visible count for each row. Never emit a multi-ball cluster as one
`plastic_ball` item or with `quantity: 1`. Do not invent balls hidden from view.$anchor$;
  new_cluster_tail constant text := $anchor$actual visible count for each row. Never emit a multi-ball cluster as one
`plastic_ball` item or with `quantity: 1`. Do not invent balls hidden from view.

Before setting a cluster quantity, make a one-to-one direct visual tally: count
each clearly distinguishable ball outline once. A partially occluded ball counts
only when it remains independently identifiable; a fully hidden ball counts
zero. Quantity is a direct observed tally, never a round estimate, a
size/coverage band, or an assumed bouquet/stock count. Do not round up, inflate,
or assume a dense cluster contains unseen balls.$anchor$;
  old_support_row constant text := $anchor$| `plastic_ball_regular` | plastic | Round smooth plastic spheres (gold, silver, colored). A multi-ball cluster, bouquet, arch, or garland uses support rows only: count every separately visible ball individually, split by visible color or size, never use one cluster row with quantity 1, and do not invent hidden balls. |$anchor$;
  new_support_row constant text := $anchor$| `plastic_ball_regular` | plastic | Round smooth plastic spheres (gold, silver, colored). A multi-ball cluster, bouquet, arch, or garland uses support rows only: make a one-to-one direct visual tally of separately visible ball outlines, split by visible color or size, never use one cluster row with quantity 1, and never round, inflate, or invent hidden balls. |$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.50: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.50';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.50'
        and is_active = true
        and md5(prompt_text) = '70ff7569b22661d9d6e1edcbf398c977'
    ) then
      raise exception 'Cannot record ai_prompts v3.50: an unexpected v3.50 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> '3ea5f728f7b5373128389fa64fbec6be' then
    raise exception 'Cannot create ai_prompts v3.50: active prompt does not match the v3.49 baseline';
  end if;

  if position('**v3.49 Version - Individual Plastic Balloon Cluster Units**' in source_prompt) = 0
    or position(old_cluster_tail in source_prompt) = 0
    or position(old_support_row in source_prompt) = 0
    or position('one-to-one direct visual tally' in source_prompt) <> 0 then
    raise exception 'Cannot create ai_prompts v3.50: expected v3.49 balloon-count anchors were not found';
  end if;

  next_prompt := replace(
    source_prompt,
    '**v3.49 Version - Individual Plastic Balloon Cluster Units**',
    '**v3.50 Version - Directly Visible Plastic Balloon Tally**'
  );
  next_prompt := replace(next_prompt, old_cluster_tail, new_cluster_tail);
  next_prompt := replace(next_prompt, old_support_row, new_support_row);

  if position('Before setting a cluster quantity, make a one-to-one direct visual tally' in next_prompt) = 0
    or position('Quantity is a direct observed tally, never a round estimate' in next_prompt) = 0
    or position('Do not round up, inflate,' in next_prompt) = 0
    or position(new_support_row in next_prompt) = 0
    or md5(next_prompt) <> '70ff7569b22661d9d6e1edcbf398c977' then
    raise exception 'Cannot create ai_prompts v3.50: direct balloon tally rule was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.50',
    next_prompt,
    true,
    'v3.50 — Require a directly visible one-to-one tally for multi-ball plastic balloon clusters.',
    now()
  );
end;
$migration$;

commit;
