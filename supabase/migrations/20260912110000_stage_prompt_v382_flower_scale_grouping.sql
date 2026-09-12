-- Stage v3.82 from the live v3.81 prompt without changing historical rows.
-- This migration changes only the ordinary edible-flower grouping/measurement
-- decision boundary; it does not alter pricing rules or cached analyses.

begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  source_prompt text;
  target_prompt text;
  target_prompt_count integer;
  v381_md5 constant text := 'fa06f26eb0eac43e4dfe7aa314c56a3c';
  v382_md5 constant text := 'b7ef36a5e817946699cf875f3e2e96f4';
  v381_heading constant text := '**v3.81 Version - Piped-Band Tier Evidence**';
  v382_heading constant text := '**v3.82 Version - Flower Scale-Grouping**';
  old_flower_grouping constant text := $old_rule$The application sizes every visible cake-member bloom independently from its
representative size_line. Group only flowers with the same flower identity, type,
material, color, and appearance, then set `quantity` to the visible piece count.
Different appearances require separate rows. Before emitting any flower row,$old_rule$;
  new_flower_grouping constant text := $new_rule$The application sizes each emitted flower row from that row's representative
`size_line`. Group only flowers with the same flower identity, type, material,
color, and appearance, then set `quantity` to the visible piece count. Different
appearances require separate rows. A clearly different apparent bloom scale is a
different appearance: when distinct scale groups are visibly separable and each
has a clearly visible representative bloom, emit separate rows. Each row's
`size_line` must measure one typical bloom from its own group, never the largest
or another outlier bloom and never an arrangement-wide span. When scale groups
cannot be reliably separated, retain one row and measure a typical clearly visible
bloom. Use neutral group-ID suffixes such as `size_1` and `size_2` when needed;
do not emit a model size label. Before emitting any flower row,$new_rule$;
begin
  select count(*), min(version::text)
  into active_prompt_count, active_prompt_version
  from public.ai_prompts
  where is_active = true;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.82';

  if target_prompt_count > 0 then
    if target_prompt_count = 1 and exists (
      select 1 from public.ai_prompts
      where version = '3.82' and md5(prompt_text) = v382_md5
    ) then
      return;
    end if;
    raise exception 'Cannot stage v3.82: an unexpected v3.82 prompt already exists';
  end if;

  if active_prompt_count <> 1 or active_prompt_version <> '3.81' then
    raise exception 'Cannot stage v3.82: expected exactly one active v3.81 prompt, found count=% version=%',
      active_prompt_count, coalesce(active_prompt_version, '<none>');
  end if;

  select prompt_text into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if source_prompt is null or md5(source_prompt) <> v381_md5 then
    raise exception 'Cannot stage v3.82: active v3.81 prompt checksum is unexpected';
  end if;

  if position(v381_heading in source_prompt) = 0
    or position(old_flower_grouping in source_prompt) = 0
    or position('PIPED ICING FLOWERS — GROUPED COVERAGE PRICING' in source_prompt) = 0 then
    raise exception 'Cannot stage v3.82: active v3.81 prompt is missing expected flower anchors';
  end if;

  target_prompt := replace(
    replace(source_prompt, v381_heading, v382_heading),
    old_flower_grouping,
    new_flower_grouping
  );

  if md5(target_prompt) <> v382_md5 then
    raise exception 'Cannot stage v3.82: generated prompt checksum is unexpected';
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.82',
    target_prompt,
    false,
    'v3.82 — Split visibly separable edible-flower scale groups and measure one typical bloom per row.',
    now()
  );
end;
$migration$;

commit;
