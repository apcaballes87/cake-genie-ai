begin;

do $$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  flower_counting_anchor constant text := $anchor$and do not use `subtype: "flower_cluster"` as a substitute for the individual
flower count.$anchor$;
  flower_fulfillment_rule constant text := $rule$#### VISIBLE FLOWER UNIT BOUNDARY AND BAKERY FULFILLMENT IDENTITY

The boundary and fulfillment normalization in this subsection applies only
when the PEONY-STYLE TOP SET OVERRIDE signature below is satisfied. Outside
that signature, keep using the general per-bloom rule above: touching flowers
with independently bounded outer petals remain separate pieces, and genuinely
mixed flower identities remain separate product rows.

A physical flower piece is one complete or substantially visible bloom with
one continuous outer petal boundary. Inner petal whorls, spiral centers, and
overlapped petal sections belong to that same bloom. Do not split one ruffled
or partially overlapped flower into extra small pieces merely because more than
one inner petal cup or apparent center is visible. When adjacent petal cups
share one continuous outer flower silhouette and do not each have independently
bounded outer petals, count the shared silhouette as one flower piece and size
the full shared bloom face.

Use bakery fulfillment identity rather than strict botanical taxonomy. In a
dense monochrome top arrangement where a dominant ruffled peony-like flower is
combined with rose-like spiral flowers made from the same material, normalize
all of those top flowers to the dominant peony fulfillment identity. Do not
split otherwise matching pink flowers into separate rose and peony product rows
only because their petal centers look different.

##### PEONY-STYLE TOP SET OVERRIDE (HIGHEST FLOWER-COUNTING PRIORITY)

Recognize this repeatable bakery construction: a tight monochrome pink top
arrangement with one oversized ruffled bloom, two full adjacent spiral blooms,
and smaller overlapping petal cups or bud-like detail at one edge. When this
construction is visible, treat it as one standardized peony-style top set for
fulfillment and pricing, regardless of strict botanical appearance.

For this construction, output exactly these two `main_toppers` flower rows:
- `edible_flowers`, `edible_fondant`, `hero`, `large`, quantity `3`, described
  as three large pink peony flowers on top
- `edible_flowers`, `edible_fondant`, `hero`, `medium`, quantity `1`, described
  as one medium pink peony flower on top

The small overlapping edge petal cups are fulfilled together as that one medium
peony piece; do not emit them as multiple small roses. This construction rule
overrides generic per-bloom counting, borderline C3 size inference, and
appearance-based rose-versus-peony grouping. These two rows exhaust the entire
top arrangement. Do not represent any part of that top arrangement in another
row in either array. A support flower row may include only flowers attached
below the top rim on the cake side; its description must not say top or top
edge. Those side flowers remain separate pieces and are not included in the top
quantities.$rule$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.46: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.46';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.46'
        and is_active = true
        and md5(prompt_text) = 'd7a3acdfe12888528e983e6f14e52495'
    ) then
      raise exception 'Cannot record ai_prompts v3.46: an unexpected v3.46 row already exists';
    end if;
    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> 'c5b2386049bb9fa59f6651aa5ff7e6b2' then
    raise exception 'Cannot create ai_prompts v3.46: active prompt does not match the v3.45 baseline';
  end if;

  if position('**v3.45 Version - Individual Flower Piece Counting**' in source_prompt) = 0
    or position(flower_counting_anchor in source_prompt) = 0
    or position('three large pink peonies and one medium pink peony' in source_prompt) = 0
    or position('TINY SUGAR PEARLS / BEADS / NONPAREILS — `sprinkles` PRECEDENCE (REQUIRED)' in source_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.46: expected v3.45 flower/sprinkle anchors were not found';
  end if;

  next_prompt := replace(
    source_prompt,
    '**v3.45 Version - Individual Flower Piece Counting**',
    '**v3.46 Version - Flower Fulfillment Unit Boundaries**'
  );
  next_prompt := replace(
    next_prompt,
    flower_counting_anchor,
    flower_counting_anchor || E'\n\n' || flower_fulfillment_rule
  );

  if position('**v3.46 Version - Flower Fulfillment Unit Boundaries**' in next_prompt) = 0
    or position('VISIBLE FLOWER UNIT BOUNDARY AND BAKERY FULFILLMENT IDENTITY' in next_prompt) = 0
    or position('PEONY-STYLE TOP SET OVERRIDE (HIGHEST FLOWER-COUNTING PRIORITY)' in next_prompt) = 0
    or position('output exactly these two `main_toppers` flower rows' in next_prompt) = 0
    or position('quantity `3`, described' in next_prompt) = 0
    or position('quantity `1`, described' in next_prompt) = 0
    or position('These two rows exhaust the entire' in next_prompt) = 0
    or position('below the top rim on the cake side' in next_prompt) = 0
    or position('Tiny/xsmall scattered or repeated sugar pearls, sugar beads,' in next_prompt) = 0
    or md5(next_prompt) <> 'd7a3acdfe12888528e983e6f14e52495' then
    raise exception 'Cannot create ai_prompts v3.46: flower-fulfillment rule was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.46',
    next_prompt,
    true,
    'v3.46 — Normalize the repeatable pink peony-style top set to three large and one medium fulfillment pieces while preserving separate side flowers.',
    now()
  );
end;
$$;

commit;
