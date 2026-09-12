-- Stage v3.81 from the compatible, already-staged v3.80 prompt.
-- Do not alter the active v3.79 prompt or any cache row.

begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  source_prompt text;
  target_prompt text;
  target_prompt_count integer;
  v379_md5 constant text := '46c8c1a10be208eeb3d7fa1166140922';
  v380_md5 constant text := 'e29c1a0551f62796664efa0d8f70ce05';
  v381_md5 constant text := 'fa06f26eb0eac43e4dfe7aa314c56a3c';
  v380_heading constant text := '**v3.79 Version - Flower Inventory and Combed Soft Icing**';
  v381_heading constant text := '**v3.81 Version - Piped-Band Tier Evidence**';
  vintage_checkpoint constant text := $checkpoint$**Vintage round cake checkpoint:** A round cake with a piped numeral or message
on a recessed top, plus piped swags, shell borders, ruffles, buttercream
garlands, flowers, or pearl borders around its top, side, or base, remains
`1 Tier` when its outer cake wall is one continuous body. Those features are
decoration, not an upper cake body. A readable numeral changes the cake type to
`Rectangle` only when the edible cake body itself is cut, carved, or assembled
as that numeral; piped or iced text on a round cake does not.$checkpoint$;
  piped_band_override constant text := $override$**Piped-band non-structural override (required):** Piped shells, swags,
garlands, ruffles, pearl borders, and buttercream bands may protrude beyond a
cake wall, but they are never evidence of a cake-body shoulder, ledge, step,
bottom edge, or footprint change. A structural shoulder or ledge must be a
visible transition in the iced cake body itself, beyond the outermost piping.
Do not classify a cake as multi-tier from a horizontal piped band.

This does not prohibit a same-footprint stacked cake: count it only when a
separate substantial upper cake sidewall and a distinct cake-to-cake bottom
edge are directly visible. Do not substitute the outer edge, shadow, or
protrusion of piped icing for either cake-body boundary.$override$;
begin
  select count(*), min(version::text)
  into active_prompt_count, active_prompt_version
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 or active_prompt_version <> '3.79' then
    raise exception 'Cannot stage v3.81: expected exactly one active v3.79 prompt, found count=% version=%',
      active_prompt_count, coalesce(active_prompt_version, '<none>');
  end if;

  if not exists (
    select 1 from public.ai_prompts
    where is_active = true and version = '3.79' and md5(prompt_text) = v379_md5
  ) then
    raise exception 'Cannot stage v3.81: active v3.79 prompt checksum is unexpected';
  end if;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.81';

  if target_prompt_count > 0 then
    if target_prompt_count = 1 and exists (
      select 1 from public.ai_prompts
      where version = '3.81' and is_active = false and md5(prompt_text) = v381_md5
    ) then
      return;
    end if;
    raise exception 'Cannot stage v3.81: an unexpected v3.81 prompt already exists';
  end if;

  select prompt_text into source_prompt
  from public.ai_prompts
  where version = '3.80' and is_active = false
  for update;

  if source_prompt is null or md5(source_prompt) <> v380_md5 then
    raise exception 'Cannot stage v3.81: staged v3.80 prompt checksum is unexpected';
  end if;

  if position(v380_heading in source_prompt) = 0
    or position(vintage_checkpoint in source_prompt) = 0 then
    raise exception 'Cannot stage v3.81: staged v3.80 prompt is missing expected tier anchors';
  end if;

  target_prompt := replace(
    replace(source_prompt, v380_heading, v381_heading),
    vintage_checkpoint,
    vintage_checkpoint || E'\n\n' || piped_band_override
  );

  if md5(target_prompt) <> v381_md5 then
    raise exception 'Cannot stage v3.81: generated prompt checksum is unexpected';
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.81',
    target_prompt,
    false,
    'v3.81 — Prevent piped bands, swags, and shell borders from being treated as cake-tier boundaries.',
    now()
  );
end;
$migration$;

commit;
