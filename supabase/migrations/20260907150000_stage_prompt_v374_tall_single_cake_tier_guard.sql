-- Stage v3.74 Tall Single-Cake Tier Guard without changing the active prompt.
-- The replacement is limited
-- to the tier-counting block and does not update cached analyses, products,
-- pricing rules, or schemas.

begin;

do $migration$
declare
  source_prompt_version text;
  source_prompt text;
  next_prompt text;
  tier_start integer;
  tier_end integer;
  active_prompt_count integer;
  target_prompt_count integer;
  v373_md5 constant text := '723880c54943a81680941dd32edbb5d2';
  v374_md5 constant text := 'a9129171141ce260312f10ff52b353fa';
  v373_heading constant text := '**v3.73 Version - Analysis Only; Deferred Product Copy**';
  v374_heading constant text := '**v3.74 Version - Analysis Only; Deferred Product Copy**';
  tier_anchor constant text := '### DECORATIVE BANDING IS NOT A CAKE TIER (REQUIRED)';
  tier_end_anchor constant text := '### CAKE TIER VS TOPPER PLATFORM / PEDESTAL';
  tier_replacement constant text := $rule$### DECORATIVE BANDING IS NOT A CAKE TIER (REQUIRED)

**Physical cake-body test (authoritative):** Count tiers by physically distinct,
substantial cake bodies stacked above one another—not by the number of visible
horizontal zones, rings, layers, outlines, or decorative breaks. Before assigning
a multi-tier type, mentally trace each proposed body: it must have its own
substantial sidewall and bottom edge and be visibly stacked on another cake body.
A meaningful change in diameter/footprint that exposes a shoulder, ledge, or step
is the strongest normal visual evidence of that construction, but it is not the
only possible evidence; same-footprint stacked bodies may be counted only when
their separate substantial cake bodies are otherwise clearly visible.

**CRITICAL — TALL SINGLE-CAKE RULE:** A tall, double-barrel, or extended-height
single cake remains `1 Tier` when its decorative zones belong to one continuous
cake body of substantially the same diameter/footprint. Multiple horizontal
decorative bands, recessed icing sections, piped rows, ruffles, borders, grooves,
color changes, or visually separated design zones do not create another tier.
Do not count internal cake layers, icing seams, a recessed middle band, or a
decorative top/side section as a separate cake body.

**Common false `2 Tier` pattern:** A tall cylindrical vintage, Lambeth, or other
cake may have an upper side section, a deep recessed band, and a lower side
section that visually look stacked. If the outer cake silhouette/sidewall remains
substantially continuous and there is no smaller substantial cake body visibly
stacked above a larger one, classify it as `1 Tier`.

Assign `2 Tier`, `2 Tier Fondant`, `3 Tier`, or `3 Tier Fondant` only when the image
provides positive evidence of the required separate cake bodies. For each proposed
upper tier, verify:

1. a substantial, separately visible upper cake sidewall and lower/bottom edge,
   not just icing or decoration; and
2. a separate stacked relationship to the cake body below, normally shown by a
   meaningful footprint/diameter transition with an exposed horizontal shoulder,
   ledge, or step.

Piping, shells, swags, ruffles, borders, flowers, ribbons, bows, shadows,
tapering or curved sidewalls, concave/recessed tops, high frosting rims, smaller
inner top planes, and color or texture changes are not tier evidence by
themselves. A heart, round, vintage, Lambeth, or any other shaped cake stays one
tier when it is one continuous cake body, even when piping frames a recessed
centre.

If a physically distinct substantial cake body is not clearly resolved, default
to the applicable one-body cake type. Do not use a `2 Tier` or `3 Tier` type.
$rule$;
begin
  select count(*) into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.74';

  if target_prompt_count > 0 then
    if target_prompt_count = 1
      and exists (
        select 1
        from public.ai_prompts
        where version = '3.74'
          and md5(prompt_text) = v374_md5
      ) then
      return;
    end if;
    raise exception 'Cannot stage v3.74: an unexpected v3.74 prompt already exists';
  end if;

  if active_prompt_count <> 1 then
    raise exception 'Cannot stage v3.74: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select version::text, prompt_text into source_prompt_version, source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if source_prompt_version <> '3.73'
    or md5(source_prompt) <> v373_md5
    or position(v373_heading in source_prompt) = 0
    or position(tier_anchor in source_prompt) = 0
    or position(tier_end_anchor in source_prompt) = 0 then
    raise exception 'Cannot stage v3.74: active prompt must be verified v3.73 (%), found version % md5 %', v373_md5, source_prompt_version, md5(source_prompt);
  end if;

  next_prompt := replace(source_prompt, v373_heading, v374_heading);
  tier_start := position(tier_anchor in next_prompt);
  tier_end := position(tier_end_anchor in next_prompt);

  if tier_start = 0 or tier_end <= tier_start then
    raise exception 'Cannot stage v3.74: tier-counting block boundaries were not found';
  end if;

  next_prompt := left(next_prompt, tier_start - 1)
    || tier_replacement
    || E'\n\n'
    || substring(next_prompt from tier_end);

  if md5(next_prompt) <> v374_md5
    or position(v374_heading in next_prompt) = 0
    or position(v373_heading in next_prompt) <> 0
    or position('**CRITICAL — TALL SINGLE-CAKE RULE:**' in next_prompt) = 0
    or position('same-footprint stacked bodies' in next_prompt) = 0
    or position('If a physically distinct substantial cake body is not clearly resolved' in next_prompt) = 0 then
    raise exception 'Cannot stage v3.74: tier-guard prompt assembly did not match the verified source';
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.74',
    next_prompt,
    false,
    'v3.74 — Distinguish tall single cakes with decorative bands from physically distinct stacked cake bodies.',
    now()
  );
end;
$migration$;

commit;
