-- Stage v3.98 from the exact active v3.97 prompt.
-- The resulting body must match the repository fallback checksum byte-for-byte.
-- This migration inserts an inactive row and leaves cache and pricing unchanged.
begin;

do $migration$
declare
  active_count integer;
  active_version text;
  active_md5 text;
  source_prompt text;
  staged_prompt text;
  old_parts text[] := array[
    $v398old0$
**v3.97 Version - Piped Flower Identity Gate**
$v398old0$,
    $v398old1$
- Preserve the white-only wafer-paper side-wave gate: ivory, cream, beige, tan, colored, printed, blurred, or ambiguous side treatments fail closed.
$v398old1$,
    $v398old2$
Emit it only when the image directly shows **all** of these construction cues
on a cake side: (1) individually distinguishable thin paper sheets or strips,
(2) those sheets adhered upright and visibly separate from the iced side,
(3) loose/free wavy, ruffled, or pleated sheet edges, (4) a repeated,
predominantly full-height side-wrap architecture around a tier, and (5)
visibly white, unprinted sheets. Ivory, cream, beige, tan, colored, printed,
patterned, blurred, or ambiguous sheets fail this type.
$v398old2$,
    $v398old3$
wrap is made from separate, paper-thin, predominantly full-height **vertical
sheets**. Each sheet must read as an attached paper plane with traceable cut
side boundaries and a loose unsupported outer edge. Do not treat a short,
ridged, shell-like, fan-like, rosette-like, or stacked ruffle as a sheet.
$v398old3$,
    $v398old4$
Count a sheet cue only when its narrow sheet face and a free outer sheet edge
can be traced as part of the same separately attached strip. A scalloped fold,
shadow line, overlap boundary, or edge of a cupped petal is not a paper-sheet
boundary. Never promote a dense ruffle mass to this type by rewriting its
contours as thin strips or loose/free sheet edges.
$v398old4$,
    $v398old5$
of repeated, individually distinguishable thin upright sheets with loose/free
wavy edges and visible separation from the iced side. The sheets themselves
$v398old5$,
    $v398old6$
vertical ripples alone are not evidence: the image must still resolve each
traceable narrow sheet face with its own free outer edge and separate attachment
against the iced side. Do not convert scalloped folds, shadows, overlaps, or
cupped/overlapping petal edges in a dense ruffle mass into wafer-sheet
boundaries. This is still valid only when all five checkpoint cues are directly
visible.
$v398old6$,
    $v398old7$
| `edible_photo_side_wave` | waferpaper | White, unprinted conditioned wafer-paper strips shaped into loose upright waves around a cake side. Require all five direct cues: separately visible thin strips, upright separate attachment, loose/free wavy edges, repeated predominantly full-height wrap, and visibly white/unprinted sheets. Ivory, cream, beige, tan, colored, printed, blurred, or ambiguous treatments are not this type. Determine quantity from the number of directly visible cake tiers bearing the verified wave—not the cake's total tier count: 1 covered tier -> 1, 2 -> 3, 3 -> 4. A 2 Tier or 3 Tier cake with waves on one tier uses 1. Do not count individual ripples or infer hidden coverage. |
$v398old7$
  ];
  new_parts text[] := array[
    $v398new0$
**v3.98 Version - Representative Wafer-Wave Evidence**
$v398new0$,
    $v398new1$
- Preserve the white-only wafer-paper side-wave gate: ivory, cream, beige, tan, colored, printed, blurred, or ambiguous side treatments fail closed.
- Accept a dense white wafer-paper wave curtain when at least two representative strips show thin sheet faces, loose unsupported edges, and separate upright attachment, even if neighboring boundaries merge at image resolution; retain piping and petal exclusions.
$v398new1$,
    $v398new2$
Emit it only when the image directly shows **all five** construction cues on a
cake side: (1) at least two representative thin paper-sheet faces with loose,
unsupported outer edges, (2) those representative sheets upright and separately
attached from the icing, (3) loose/free wavy, ruffled, or pleated sheet edges,
(4) a repeated, predominantly full-height side-wrap around a tier, and (5)
visibly white, unprinted sheets. In a dense repeated curtain, neighboring sheet
boundaries may merge at image resolution; do not require every strip to be
individually traceable. Ivory, cream, beige, tan, colored, printed, patterned,
blurred, or ambiguous sheets fail this type.
$v398new2$,
    $v398new3$
wrap is made from repeated, separate, paper-thin, predominantly full-height
**vertical sheets**. At least two representative strips must read as attached
paper planes with narrow sheet faces and loose unsupported outer edges. Other
strip boundaries may merge in a dense curtain; do not require every strip to
have traceable cut side boundaries. Do not treat a short, ridged, shell-like,
fan-like, rosette-like, or stacked ruffle as a sheet.
$v398new3$,
    $v398new4$
Count the sheet cue only when at least two representative strips each show a
narrow sheet face and a free outer edge belonging to a separately attached
strip. A scalloped fold, shadow line, overlap boundary, or edge of a cupped
petal is not a paper-sheet boundary. A dense curtain qualifies when those
representative strips establish the repeated sheet construction, even if other
strip boundaries merge at image resolution. Never promote a dense ruffle mass
by rewriting petal, shadow, or piped contours as paper sheets.
$v398new4$,
    $v398new5$
of repeated thin upright sheets with loose/free wavy edges and visible
separation from the iced side. At least two representative strips must resolve
as narrow sheet faces with loose unsupported edges and separate attachment;
neighboring boundaries may merge in a dense curtain. The sheets themselves
$v398new5$,
    $v398new6$
vertical ripples alone are not evidence: at least two representative strips
must show a thin sheet face, free wavy edge, and separate attachment against
the iced side, together with the repeated full-height wrap and white/unprinted
surface. Neighboring boundaries may merge at image resolution. Do not convert
scalloped folds, shadows, overlaps, or cupped/overlapping petal edges in a dense
ruffle mass into wafer-sheet boundaries.
$v398new6$,
    $v398new7$
| `edible_photo_side_wave` | waferpaper | White, unprinted conditioned wafer-paper strips shaped into loose upright waves around a cake side. Require at least two representative thin sheet faces with free wavy edges and separate upright attachment, plus a repeated predominantly full-height wrap and visibly white/unprinted paper; neighboring strip boundaries may merge in a dense curtain. Ivory, cream, beige, tan, colored, printed, blurred, or ambiguous treatments are not this type. Determine quantity from the number of directly visible cake tiers bearing the verified wave—not the cake's total tier count: 1 covered tier -> 1, 2 -> 3, 3 -> 4. A 2 Tier or 3 Tier cake with waves on one tier uses 1. Do not count individual ripples or infer hidden coverage. Piped ridges and broad cupped flower-petal ruffles remain excluded. |
$v398new7$
  ];
  existing_count integer;
  existing_md5 text;
  existing_active boolean;
  patch_index integer;
  v397_md5 constant text := '54ec2f698a847e34e4abf96ad36ba675';
  v398_md5 constant text := '328f9f964322447c648def85a1682ed5';
begin
  lock table public.ai_prompts in share row exclusive mode;

  select count(*), min(version::text), min(md5(prompt_text))
    into active_count, active_version, active_md5
  from public.ai_prompts
  where is_active = true and merchant_id is null;

  if active_count <> 1 or active_version <> '3.97' or active_md5 <> v397_md5 then
    raise exception 'Cannot stage v3.98: expected one active global v3.97 prompt with checksum %, found count=% version=% checksum=%',
      v397_md5, active_count, coalesce(active_version, '<none>'), coalesce(active_md5, '<none>');
  end if;

  select prompt_text into strict source_prompt
  from public.ai_prompts
  where version = '3.97' and is_active = true and merchant_id is null;
  staged_prompt := source_prompt;

  for patch_index in 1..array_length(old_parts, 1) loop
    if length(staged_prompt) - length(replace(staged_prompt, old_parts[patch_index], '')) <> length(old_parts[patch_index]) then
      raise exception 'Cannot stage v3.98: source patch anchor % is missing or duplicated', patch_index;
    end if;
    staged_prompt := replace(staged_prompt, old_parts[patch_index], new_parts[patch_index]);
  end loop;

  if md5(staged_prompt) <> v398_md5 then
    raise exception 'Cannot stage v3.98: assembled prompt checksum mismatch; expected %, received %',
      v398_md5, md5(staged_prompt);
  end if;

  select count(*), min(md5(prompt_text)), bool_or(is_active)
    into existing_count, existing_md5, existing_active
  from public.ai_prompts
  where version = '3.98' and merchant_id is null;

  if existing_count > 0 then
    if existing_count = 1 and existing_md5 = v398_md5 and existing_active = false then
      return;
    end if;
    raise exception 'Cannot stage v3.98: an existing target version has an unexpected scope, active state, or checksum';
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description, merchant_id)
  values ('3.98', staged_prompt, false, 'Representative wafer-paper side-wave evidence', null);
end;
$migration$;

commit;
