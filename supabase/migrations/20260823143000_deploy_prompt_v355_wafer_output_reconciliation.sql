-- Deploy prompt v3.55. Reconcile verified wafer-paper construction with the
-- structured support row, and make the intricate-flower visual fallback clear.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_heading constant text := '**v3.54 Version - Evidence-Gated Wafer Waves and Intricate Flowers**';
  new_heading constant text := '**v3.55 Version - Evidence-Gated Wafer Waves, Intricate Flowers, and Output Reconciliation**';
  old_wafer_checkpoint_tail constant text := $anchor$borders, piped swags, isolated side accents, or continuous icing texture. If
all four cues are not directly visible, omit `edible_photo_side_wave`.

### GLOBAL ITEM CLASSIFICATION PIPELINE — CONSTRUCTION → MATERIAL → TYPE → DESCRIPTION$anchor$;
  new_wafer_checkpoint_tail constant text := $anchor$borders, piped swags, isolated side accents, or continuous icing texture. If
all four cues are not directly visible, omit `edible_photo_side_wave`.

**Output reconciliation:** Never use `wafer paper` or `wafer-paper` in a tag,
`alt_text`, `seo_description`, or item description unless you first verified
all four direct-image cues above and emitted the matching
`edible_photo_side_wave` support row. Conversely, when all four cues are
visible, emit that row with its tier quantity before writing the SEO fields; do
not describe a verified wafer-paper side wrap only as icing or SEO prose.

### GLOBAL ITEM CLASSIFICATION PIPELINE — CONSTRUCTION → MATERIAL → TYPE → DESCRIPTION$anchor$;
  old_wafer_reference_tail constant text := $anchor$wavy edges and visible separation from the iced side—even when the sheets are
white and unprinted.

Emit exactly one `support_elements` row for the whole conditioned wafer-paper$anchor$;
  new_wafer_reference_tail constant text := $anchor$wavy edges and visible separation from the iced side—even when the sheets are
white and unprinted.

In the correct white reference style, the wrap can read as a dense curtain of
many parallel narrow white upright ruffled sheets around the tier; identify the
separate free sheet edges rather than treating the repeated vertical ripples as
continuous icing grooves. This is still valid only when all four checkpoint
cues are directly visible.

Emit exactly one `support_elements` row for the whole conditioned wafer-paper$anchor$;
  old_intricate_tail constant text := $anchor$piped buttercream rosettes. Count and size each visible bloom independently;
do not merge intricate blooms with smaller support flowers.

### FLOWER PIECE COUNTING AND SIZE PRECEDENCE (BOTH MAIN AND SUPPORT — REQUIRED)$anchor$;
  new_intricate_tail constant text := $anchor$piped buttercream rosettes. Count and size each visible bloom independently;
do not merge intricate blooms with smaller support flowers.

When a distinct cake-member bloom visibly has layered sculpted petals or a
defined flower center but its cultivar is uncertain, apply this rule rather
than defaulting it to a generic small flower merely because it sits in a
cluster. Do not use that fallback for visibly simple, flat, tiny, or piped
flowers.

### FLOWER PIECE COUNTING AND SIZE PRECEDENCE (BOTH MAIN AND SUPPORT — REQUIRED)$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.55: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.55';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.55'
        and is_active = true
        and md5(prompt_text) = '60078bd99205397259224b6f933fc3b6'
    ) then
      raise exception 'Cannot record ai_prompts v3.55: an unexpected v3.55 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> 'e4ecfda7bb7bd32c2193475a5f95e112' then
    raise exception 'Cannot create ai_prompts v3.55: active prompt does not match the v3.54 baseline';
  end if;

  if position(old_heading in source_prompt) = 0
    or position(old_wafer_checkpoint_tail in source_prompt) = 0
    or position(old_wafer_reference_tail in source_prompt) = 0
    or position(old_intricate_tail in source_prompt) = 0
    or position('Output reconciliation:' in source_prompt) <> 0 then
    raise exception 'Cannot create ai_prompts v3.55: expected v3.54 anchors were not found';
  end if;

  next_prompt := replace(source_prompt, old_heading, new_heading);
  next_prompt := replace(next_prompt, old_wafer_checkpoint_tail, new_wafer_checkpoint_tail);
  next_prompt := replace(next_prompt, old_wafer_reference_tail, new_wafer_reference_tail);
  next_prompt := replace(next_prompt, old_intricate_tail, new_intricate_tail);

  if position('Output reconciliation:' in next_prompt) = 0
    or position('dense curtain of' in next_prompt) = 0
    or position('cultivar is uncertain' in next_prompt) = 0
    or md5(next_prompt) <> '60078bd99205397259224b6f933fc3b6' then
    raise exception 'Cannot create ai_prompts v3.55: output reconciliation was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.55',
    next_prompt,
    true,
    'v3.55 — Reconcile verified wafer-paper wave copy with its support row and clarify the intricate layered-flower fallback.',
    now()
  );
end;
$migration$;

commit;
