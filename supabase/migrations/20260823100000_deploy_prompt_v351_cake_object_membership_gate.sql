-- Deploy prompt v3.51. Exclude objects that are only photo-scene/staging props
-- before any item-specific fulfillment, material, or quantity rule is applied.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_heading constant text := '**v3.50 Version - Directly Visible Plastic Balloon Tally**';
  new_heading constant text := '**v3.51 Version - Cake-Object Membership Gate**';
  flower_heading constant text := $anchor$### Protocol 4: THE "FLOWER" CHECK (Required Edible Flower Fulfillment Rule)$anchor$;
  membership_gate constant text := $anchor$### CAKE-OBJECT MEMBERSHIP GATE (REQUIRED BEFORE EVERY ITEM RULE)

Before emitting, classifying, or counting any `main_toppers`,
`support_elements`, `cake_messages`, or icing detail, first determine whether
the visible object is physically part of the cake product.

Output an item only when direct image evidence shows it is on, inserted into,
attached to, printed/piped/molded onto, wrapped around, or deliberately resting
on the cake or its cake board as part of the cake design.

Never output or count scene/staging objects that are merely behind, beside,
under, surrounding, reflected near, or photographed with the cake. This
includes background flower arrangements, bouquets, balloon props, vases,
tables, cake stands, plates, cloth, packaging, walls, backdrop panels, signs,
shadows, reflections, camera/UI artifacts, and other photo props.

Visual proximity, matching color, 2D overlap, or a decorative photo composition
is not evidence of cake membership. If attachment to the cake or cake board is
not clearly established, exclude the object. Apply this gate before every
object-specific type, material, placement, and quantity rule.

### Protocol 4: THE "FLOWER" CHECK (Required Edible Flower Fulfillment Rule)$anchor$;
  old_flower_intro constant text := $anchor$- Genie.ph fulfills every visible flower as edible because non-edible flowers
  are not safe or hygienic for our food workflow.$anchor$;
  new_flower_intro constant text := $anchor$- Genie.ph fulfills every cake-member flower as edible because non-edible flowers
  are not safe or hygienic for our food workflow.$anchor$;
  old_flower_override constant text := $anchor$  Every visible flower is `edible_flowers` under this override.$anchor$;
  new_flower_override constant text := $anchor$  Every cake-member flower is `edible_flowers` under this override.$anchor$;
  old_flower_type constant text := $anchor$If an item is visibly a flower, blossom, rose, bud, daisy, orchid, petal cluster,
or floral accent, classify it as `edible_flowers` unless it is clearly piped
icing.$anchor$;
  new_flower_type constant text := $anchor$If a cake-member item is visibly a flower, blossom, rose, bud, daisy, orchid,
petal cluster, or floral accent, classify it as `edible_flowers` unless it is
clearly piped icing.$anchor$;
  old_flower_counting constant text := $anchor$A bouquet, cluster, spray, or arrangement describes placement only. It is not
one flower and must never be used as the quantity unit. Count each clearly
visible bloom or flower head as one physical flower piece, including blooms
that touch or overlap. Count only visible blooms; do not infer fully hidden
flowers.

Size every visible bloom independently by bloom-face diameter using C3. Group
only flowers with the same flower identity, type, material, size, color, and
appearance, then set `quantity` to the visible piece count. Different sizes or
appearances require separate rows. Never output multiple visible blooms as one
`edible_flowers` cluster, bouquet, spray, or arrangement with `quantity: 1`,
and do not use `subtype: "flower_cluster"` as a substitute for the individual
flower count.$anchor$;
  new_flower_counting constant text := $anchor$A bouquet, cluster, spray, or arrangement describes placement only. It is not
one flower and must never be used as the quantity unit. Count each clearly
visible cake-member bloom or flower head as one physical flower piece, including
blooms that touch or overlap. Count only visible cake-member blooms; do not
infer fully hidden flowers.

Size every visible cake-member bloom independently by bloom-face diameter using
C3. Group only flowers with the same flower identity, type, material, size,
color, and appearance, then set `quantity` to the visible piece count. Different
sizes or appearances require separate rows. Never output multiple visible
cake-member blooms as one `edible_flowers` cluster, bouquet, spray, or
arrangement with `quantity: 1`, and do not use `subtype: "flower_cluster"` as a
substitute for the individual flower count.$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.51: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.51';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.51'
        and is_active = true
        and md5(prompt_text) = '65b412039b6da3e7d3ffbd2047846bf2'
    ) then
      raise exception 'Cannot record ai_prompts v3.51: an unexpected v3.51 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> '70ff7569b22661d9d6e1edcbf398c977' then
    raise exception 'Cannot create ai_prompts v3.51: active prompt does not match the v3.50 baseline';
  end if;

  if position(old_heading in source_prompt) = 0
    or position(flower_heading in source_prompt) = 0
    or position(old_flower_intro in source_prompt) = 0
    or position(old_flower_override in source_prompt) = 0
    or position(old_flower_type in source_prompt) = 0
    or position(old_flower_counting in source_prompt) = 0
    or position('CAKE-OBJECT MEMBERSHIP GATE' in source_prompt) <> 0 then
    raise exception 'Cannot create ai_prompts v3.51: expected v3.50 flower anchors were not found';
  end if;

  next_prompt := replace(source_prompt, old_heading, new_heading);
  next_prompt := replace(next_prompt, flower_heading, membership_gate);
  next_prompt := replace(next_prompt, old_flower_intro, new_flower_intro);
  next_prompt := replace(next_prompt, old_flower_override, new_flower_override);
  next_prompt := replace(next_prompt, old_flower_type, new_flower_type);
  next_prompt := replace(next_prompt, old_flower_counting, new_flower_counting);

  if position('CAKE-OBJECT MEMBERSHIP GATE (REQUIRED BEFORE EVERY ITEM RULE)' in next_prompt) = 0
    or position('Visual proximity, matching color, 2D overlap' in next_prompt) = 0
    or position('Every cake-member flower is `edible_flowers` under this override.' in next_prompt) = 0
    or position(new_flower_counting in next_prompt) = 0
    or md5(next_prompt) <> '65b412039b6da3e7d3ffbd2047846bf2' then
    raise exception 'Cannot create ai_prompts v3.51: cake-object membership rule was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.51',
    next_prompt,
    true,
    'v3.51 — Require cake-object membership before classifying or pricing any visible item.',
    now()
  );
end;
$migration$;

commit;
