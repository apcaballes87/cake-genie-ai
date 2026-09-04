-- Require positive cake-body construction evidence before classifying decorative
-- banding, recessed tops, or tapering silhouettes as multiple tiers. This does
-- not update historical cache rows, products, pricing rules, or schemas.

begin;

do $migration$
declare
  source_prompt_version text;
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  v370_md5 constant text := 'e5d69eeaac907ff5bec3079f5808c60d';
  v371_md5 constant text := 'd8fc11d901ff4866fa1bab5cbde7b6d3';
  v370_heading constant text := '**v3.70 Version - Cardstock Material Evidence Gate**';
  v371_heading constant text := '**v3.71 Version - Positive Cake-Tier Construction Evidence**';
  tier_anchor constant text := '### CAKE TIER VS TOPPER PLATFORM / PEDESTAL';
  tier_replacement constant text := $rule$### DECORATIVE BANDING IS NOT A CAKE TIER (REQUIRED)

Assign `2 Tier`, `2 Tier Fondant`, `3 Tier`, or `3 Tier Fondant` only with
positive evidence of separate cake bodies. For every proposed upper cake body,
the image must visibly show all of the following:

1. a substantial, separately visible vertical cake sidewall and lower/bottom
   edge for that upper body, not just icing or decoration;
2. a visibly wider lower cake body beneath it; and
3. an exposed horizontal shoulder or ledge of the lower cake where the upper
   body sits.

Do not infer an upper tier from decorative banding or silhouette alone. Piping,
shells, swags, ruffles, borders, flowers, ribbons, bows, shadows, a tapering
or curved cake sidewall, a concave/recessed top, a high frosting rim, or a
smaller inner top plane are decoration or one continuous cake body, not a
separate tier. A heart, round, vintage, Lambeth, or any other shaped cake stays
one tier when its outer cake sidewall is continuous from its base to the top,
even when piping frames a recessed centre.

If the image does not resolve all three positive upper-tier cues, default to
the applicable one-body cake type. Do not use a `2 Tier` or `3 Tier` type.

### CAKE TIER VS TOPPER PLATFORM / PEDESTAL$rule$;
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
    or position(v370_heading in source_prompt) = 0
    or position(tier_anchor in source_prompt) = 0 then
    raise exception 'Cannot deploy v3.71: active prompt must be verified v3.70 (%), found version % md5 %', v370_md5, source_prompt_version, md5(source_prompt);
  end if;

  next_prompt := replace(source_prompt, v370_heading, v371_heading);
  next_prompt := replace(next_prompt, tier_anchor, tier_replacement);

  if md5(next_prompt) <> v371_md5
    or position(v371_heading in next_prompt) = 0
    or position(v370_heading in next_prompt) <> 0
    or position('### DECORATIVE BANDING IS NOT A CAKE TIER (REQUIRED)' in next_prompt) = 0
    or position('substantial, separately visible vertical cake sidewall and lower/bottom' in next_prompt) = 0
    or position('a concave/recessed top, a high frosting rim' in next_prompt) = 0
    or position('If the image does not resolve all three positive upper-tier cues' in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.71: tier-evidence prompt assembly did not match the verified fallback source';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.71',
    next_prompt,
    true,
    'v3.71 — Require separate cake-body sidewall, bottom edge, and shoulder evidence before classifying decorative banding as a multi-tier cake.',
    now()
  );
end;
$migration$;

commit;
