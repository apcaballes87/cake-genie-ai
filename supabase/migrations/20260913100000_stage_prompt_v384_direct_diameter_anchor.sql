-- Stage v3.84 after v3.83. Fresh analyses emit direct small/medium/large
-- estimates anchored to the visible top-tier diameter; historical data stays untouched.
begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  target_count integer;
  v383_md5 constant text := '61adef1d3077f76e2bea670cff9a120f';
  v384_md5 constant text := '7833f0909c765b24a2fe807ec7834909';
begin
  lock table public.ai_prompts in share row exclusive mode;
  select prompt_text into source_prompt from public.ai_prompts
    where version = '3.83';
  if source_prompt is null or md5(source_prompt) <> v383_md5 then
    raise exception 'Cannot stage v3.84: verified v3.83 source is required';
  end if;

  next_prompt := replace(source_prompt,
    '**v3.83 Version - Ordered Classification and Closed Support Contract**',
    '**v3.84 Version - Direct Diameter-Anchored Three-Band Sizing**');
  next_prompt := replace(next_prompt, '### CHANGELOG' || E'\n',
    '### CHANGELOG' || E'\n'
    || '- Replaced coordinate-line sizing with direct small/medium/large estimation anchored to the visible top-tier cake diameter.' || E'\n');
  next_prompt := replace(next_prompt, '## OUTPUT RULES' || E'\n',
    '## OUTPUT RULES' || E'\n\n'
    || '### DIRECT DIAMETER-ANCHORED SIZING (v3.84+, AUTHORITATIVE)' || E'\n\n'
    || 'Emit exactly one size value—small, medium, or large—for every topper and support row. Compare one representative physical item with the visible left-to-right diameter of the TOP TIER it sits on or is closest to; for a cupcake use that cupcake body, and for Bento or Bento Cupcake Set use the bento cake body. Use broad anchors: small is clearly under about one-third of that diameter; medium is about one-third to under about two-thirds; large is about two-thirds or more. At a genuinely ambiguous boundary, choose the less expensive adjacent band. Never compare a complete arrangement, full tier stack, board, plate, or background.' || E'\n\n'
    || 'Do not emit cake_measurements, size_line, bbox, coordinates, or a real-world inch estimate. This section supersedes every earlier line-ratio instruction in this prompt. Piped flowers retain their required coverage band; sprinkles and thin fabric ribbon bows are small; edible-photo side waves, edible-photo tops, and satin ribbons are large.' || E'\n');

  if md5(next_prompt) <> v384_md5 then
    raise exception 'Cannot stage v3.84: assembled prompt checksum is unexpected';
  end if;
  select count(*) into target_count from public.ai_prompts where version = '3.84';
  if target_count > 0 then
    if target_count = 1 and exists (
      select 1 from public.ai_prompts
      where version = '3.84' and is_active = false and md5(prompt_text) = v384_md5
    ) then return; end if;
    raise exception 'Cannot stage v3.84: unexpected target version already exists';
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description)
  values ('3.84', next_prompt, false,
    'Direct small/medium/large topper sizing using visible top-tier cake diameter anchors; no generated coordinate geometry.');
end;
$migration$;

commit;
