-- Deploy prompt v3.65. Preserve all v3.64 rules while distinguishing
-- separately attached vertical wafer-paper sheets from piped icing ruffles.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  v364_md5 constant text := '534ba678ce22d28baa3ea97a2dc35cfc';
  v365_md5 constant text := 'c6f1d67700acc6d9814abe2ccfa9f41b';
  v364_heading constant text := '**v3.64 Version - Slab Cake, Bento Montage, and Flower Row Reconciliation**';
  v365_heading constant text := '**v3.65 Version - Wafer-Paper Strip and Piped-Ruffle Reconciliation**';
  wafer_checkpoint_anchor constant text := $anchor$predominantly full-height side-wrap architecture around a tier.

Do not infer this type from white color, generic words such as wave, ruffle,
$anchor$;
  wafer_checkpoint_replacement constant text := $anchor$predominantly full-height side-wrap architecture around a tier.

**Paper-strip versus piped-ruffle decision (mandatory):** A verified wafer
wrap is made from separate, paper-thin, predominantly full-height **vertical
sheets**. Each sheet must read as an attached paper plane with traceable cut
side boundaries and a loose unsupported outer edge. Do not treat a short,
ridged, shell-like, fan-like, rosette-like, or stacked ruffle as a sheet.
Anything extruded through a pastry tip, including white or vertically arranged
piped ruffles, is `icing_decorations` with material `icing`, never
`edible_photo_side_wave`. This construction decision overrides a guessed
material name or any wafer/wave wording in generated copy.

Do not infer this type from white color, generic words such as wave, ruffle,
$anchor$;
  wafer_forensics_anchor constant text := $anchor$visible.

Emit exactly one `support_elements` row for the whole conditioned wafer-paper
$anchor$;
  wafer_forensics_replacement constant text := $anchor$visible.

Piped ruffle bands are not wafer-paper strips: buttercream extrusion leaves
short ridges, shells, fans, rosettes, or stacked swirls rather than separate
paper-thin vertical planes. Emit those as `icing_decorations` with material
`icing`, even if the piping is white, wavy, repeated around the perimeter, or
visually resembles a ruffle curtain. Never rewrite piped texture as separate
wafer sheets to satisfy this rule.

Emit exactly one `support_elements` row for the whole conditioned wafer-paper
$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.65: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.65';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.65'
        and is_active = true
        and md5(prompt_text) = v365_md5
    ) then
      raise exception 'Cannot record ai_prompts v3.65: an unexpected v3.65 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> v364_md5
    or position(v364_heading in source_prompt) = 0
    or position(wafer_checkpoint_anchor in source_prompt) = 0
    or position(wafer_forensics_anchor in source_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.65: active prompt must be the verified v3.64 baseline';
  end if;

  next_prompt := replace(source_prompt, v364_heading, v365_heading);
  next_prompt := replace(next_prompt, wafer_checkpoint_anchor, wafer_checkpoint_replacement);
  next_prompt := replace(next_prompt, wafer_forensics_anchor, wafer_forensics_replacement);

  if position(v365_heading in next_prompt) = 0
    or position('**Paper-strip versus piped-ruffle decision (mandatory):**' in next_prompt) = 0
    or position('Piped ruffle bands are not wafer-paper strips:' in next_prompt) = 0
    or md5(next_prompt) <> v365_md5 then
    raise exception 'Cannot create ai_prompts v3.65: prompt assembly did not match the verified fallback source';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.65',
    next_prompt,
    true,
    'v3.65 — Require separate vertical wafer-paper sheets and classify piped ruffles as icing decorations.',
    now()
  );
end;
$migration$;

commit;
