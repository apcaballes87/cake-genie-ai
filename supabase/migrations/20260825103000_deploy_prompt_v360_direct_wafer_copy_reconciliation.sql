-- Deploy prompt v3.60. Require literal copy reconciliation when the strict
-- direct-evidence wafer-paper side-wave type is absent.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_heading constant text := '**v3.59 Version - Direct Wafer-Sheet Identification**';
  new_heading constant text := '**v3.60 Version - Direct Wafer-Sheet and Copy Reconciliation**';
  old_output_reconciliation constant text := $anchor$**Output reconciliation:** Never use `wafer paper` or `wafer-paper` in a tag,
`alt_text`, `seo_description`, or item description unless you first verified
all four direct-image cues above and emitted the matching
`edible_photo_side_wave` support row. Conversely, when all four cues are
visible, emit that row with its tier quantity before writing the SEO fields; do
not describe a verified wafer-paper side wrap only as icing or SEO prose.$anchor$;
  new_output_reconciliation constant text := $anchor$**Output reconciliation:** Never use `wafer paper` or `wafer-paper` in a tag,
`alt_text`, `seo_description`, or item description unless you first verified
all four direct-image cues above and emitted the matching
`edible_photo_side_wave` support row. Conversely, when all four cues are
visible, emit that row with its tier quantity before writing the SEO fields; do
not describe a verified wafer-paper side wrap only as icing or SEO prose.

**Final literal wafer check:** After all structured rows and copy are drafted,
if there is no `edible_photo_side_wave` support row, `wafer`, `wafer paper`,
and `wafer-paper` are prohibited in `tags`, `alt_text`, `seo_description`, and
every item description. Remove those words rather than describing a failed-gate
ruffle as wafer paper. This check is mandatory even when the model considered
and then omitted the wafer-wave type.$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.60: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.60';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.60'
        and is_active = true
        and md5(prompt_text) = '2138fbe4b74fefe239280a1f226c24cf'
    ) then
      raise exception 'Cannot record ai_prompts v3.60: an unexpected v3.60 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> 'b587e7da644bc528136c1a1eb9f88613' then
    raise exception 'Cannot create ai_prompts v3.60: active prompt does not match the v3.59 baseline';
  end if;

  if position(old_heading in source_prompt) = 0
    or position(old_output_reconciliation in source_prompt) = 0
    or position('Final literal wafer check' in source_prompt) <> 0 then
    raise exception 'Cannot create ai_prompts v3.60: expected v3.59 wafer-copy anchors were not found';
  end if;

  next_prompt := replace(source_prompt, old_heading, new_heading);
  next_prompt := replace(next_prompt, old_output_reconciliation, new_output_reconciliation);

  if position(new_heading in next_prompt) = 0
    or position('Final literal wafer check' in next_prompt) = 0
    or position('wafer-paper` are prohibited' in next_prompt) = 0
    or md5(next_prompt) <> '2138fbe4b74fefe239280a1f226c24cf' then
    raise exception 'Cannot create ai_prompts v3.60: wafer copy reconciliation was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.60',
    next_prompt,
    true,
    'v3.60 — Require direct wafer-sheet evidence and prohibit wafer wording when no matching support row exists.',
    now()
  );
end;
$migration$;

commit;
