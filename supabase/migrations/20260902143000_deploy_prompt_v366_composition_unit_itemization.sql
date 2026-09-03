-- Deploy prompt v3.66. Decide one composition unit before applying
-- per-piece itemization to messages and physical cake design elements.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  v365_md5 constant text := 'c6f1d67700acc6d9814abe2ccfa9f41b';
  v366_md5 constant text := 'a37abb5928730aece207088ae76dc23f';
  v365_heading constant text := '**v3.65 Version - Wafer-Paper Strip and Piped-Ruffle Reconciliation**';
  v366_heading constant text := '**v3.66 Version - Composition Unit Before Itemization**';
  primary_object_heading constant text := $anchor$### ONE PRIMARY PRICED OBJECT PER ROW — DESCRIPTION/TYPE CONSISTENCY (REQUIRED)$anchor$;
  composition_replacement constant text := $anchor$### COMPOSITION UNIT BEFORE ITEMIZATION (HIGHEST PRECEDENCE)

Before selecting `main_toppers`, `support_elements`, `cake_messages`, type,
size, `group_id`, or quantity, decide the smallest independently fulfillable
design unit from the complete visible arrangement—not from the number of
separate outlines.

A **single composition** is one deliberate readable or visual design whose
parts only make sense together: a word, phrase, name, age treatment, brand
wordmark, plaque artwork, layered icon, or coordinated panel. It remains one
composition even when its letters, layers, strokes, icons, or other components
are visibly separate or unconnected.

For one composition:
1. Use exactly one canonical representation. A message/name/greeting/phrase
   gets one `cake_messages` row containing the complete text. A separately
   priceable carrier or design piece gets one physical topper/support row.
2. A physical composition row has `quantity: 1`, one `group_id`, and a size
   based on the full composition span—not the span of each letter, icon, or
   component.
3. Do not also emit the same composition's letters, icons, strokes, or
   attached parts as separate `main_toppers` or `support_elements` rows.
4. A connected carrier still gets one physical row plus one `cake_messages`
   row when its readable text is customer-editable.

Count components separately only when each is an independently fulfillable
decoration with its own identity after removal: for example, separate flowers,
stars, balloons, figurines, or building blocks. Group visually identical
independent pieces into one row with their actual count, and size each
independent piece individually. Do not treat proximity, matching color, or a
shared theme alone as evidence of one composition.

This composition decision overrides later per-piece support itemization rules.

### ONE PRIMARY PRICED OBJECT PER ROW — DESCRIPTION/TYPE CONSISTENCY (REQUIRED)$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.66: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.66';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.66'
        and is_active = true
        and md5(prompt_text) = v366_md5
    ) then
      raise exception 'Cannot record ai_prompts v3.66: an unexpected v3.66 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> v365_md5
    or position(v365_heading in source_prompt) = 0
    or position(primary_object_heading in source_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.66: active prompt must be the verified v3.65 baseline';
  end if;

  next_prompt := replace(source_prompt, v365_heading, v366_heading);
  next_prompt := replace(next_prompt, primary_object_heading, composition_replacement);

  if position(v366_heading in next_prompt) = 0
    or position('### COMPOSITION UNIT BEFORE ITEMIZATION (HIGHEST PRECEDENCE)' in next_prompt) = 0
    or position('This composition decision overrides later per-piece support itemization rules.' in next_prompt) = 0
    or md5(next_prompt) <> v366_md5 then
    raise exception 'Cannot create ai_prompts v3.66: prompt assembly did not match the verified fallback source';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.66',
    next_prompt,
    true,
    'v3.66 — Decide one composition unit before per-piece itemization of messages and cake design elements.',
    now()
  );
end;
$migration$;

commit;
