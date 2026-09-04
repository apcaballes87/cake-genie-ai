-- Preserve the live v3.71 composite-reference exception while requiring direct
-- cake-body construction evidence for multi-tier classification. This does not
-- update historical cache rows, products, pricing rules, or schemas.

begin;

do $migration$
declare
  source_prompt_version text;
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  v371_md5 constant text := 'c7bb91f19c8cc4b2f6943086da76fce3';
  v372_md5 constant text := '5a6c1c6441cf8ea71dd935427af8531b';
  v371_heading constant text := '**v3.71 Version - Intentional Composite Cake References**';
  v372_heading constant text := '**v3.72 Version - Intentional Composite References and Positive Cake-Tier Evidence**';
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
    raise exception 'Cannot deploy v3.72: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.72';

  if target_prompt_count > 0 then
    if target_prompt_count = 1
      and exists (
        select 1
        from public.ai_prompts
        where version = '3.72'
          and is_active = true
          and md5(prompt_text) = v372_md5
      ) then
      return;
    end if;
    raise exception 'Cannot deploy v3.72: an unexpected v3.72 prompt already exists';
  end if;

  select version::text, prompt_text into source_prompt_version, source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if source_prompt_version <> '3.71'
    or md5(source_prompt) <> v371_md5
    or position(v371_heading in source_prompt) = 0
    or position(tier_anchor in source_prompt) = 0 then
    raise exception 'Cannot deploy v3.72: active prompt must be verified v3.71 (%), found version % md5 %', v371_md5, source_prompt_version, md5(source_prompt);
  end if;

  next_prompt := replace(source_prompt, v371_heading, v372_heading);
  next_prompt := replace(next_prompt, tier_anchor, tier_replacement);

  if md5(next_prompt) <> v372_md5
    or position(v372_heading in next_prompt) = 0
    or position(v371_heading in next_prompt) <> 0
    or position('**Intentional composite-reference exception to `multiple_cakes`' in next_prompt) = 0
    or position('### DECORATIVE BANDING IS NOT A CAKE TIER (REQUIRED)' in next_prompt) = 0
    or position('substantial, separately visible vertical cake sidewall and lower/bottom' in next_prompt) = 0
    or position('a concave/recessed top, a high frosting rim' in next_prompt) = 0
    or position('If the image does not resolve all three positive upper-tier cues' in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.72: composite and tier-evidence prompt assembly did not match the verified fallback source';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.72',
    next_prompt,
    true,
    'v3.72 — Preserve intentional composite references while requiring separate cake-body sidewall, bottom edge, and shoulder evidence before classifying decorative banding as a multi-tier cake.',
    now()
  );
end;
$migration$;

commit;
