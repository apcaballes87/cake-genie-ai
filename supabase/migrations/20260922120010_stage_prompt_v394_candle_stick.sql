-- Stage v3.94 from the verified inactive v3.93 prompt.
-- This migration never changes the active prompt. It is intentionally guarded
-- by the v3.92/v3.93 checksums from the approved release plan.
begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  active_prompt_md5 text;
  source_prompt text;
  source_prompt_md5 text;
  staged_prompt text;
  existing_prompt_count integer;
  block_start integer;
  block_end integer;
  v392_md5 constant text := '06d2be8fd8e0429ed8721cd09e132931';
  v393_md5 constant text := '601c8d0c91dcea7f97f039c04f815ad9';
  candle_header constant text := '### CANDLES ARE ALWAYS CANDLE TYPE';
  candle_next_header constant text := '### ICING TECHNIQUE DECORATION TYPES';
begin
  select count(*), min(version::text), min(md5(prompt_text))
  into active_prompt_count, active_prompt_version, active_prompt_md5
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1
     or active_prompt_version <> '3.92'
     or active_prompt_md5 <> v392_md5 then
    raise exception 'Cannot stage v3.94: expected exactly one active v3.92 prompt with checksum %, found count=% version=% checksum=%', v392_md5, active_prompt_count, coalesce(active_prompt_version, '<none>'), coalesce(active_prompt_md5, '<none>');
  end if;

  select count(*), min(prompt_text), min(md5(prompt_text))
  into existing_prompt_count, source_prompt, source_prompt_md5
  from public.ai_prompts
  where version = '3.93'
    and is_active = false;

  if existing_prompt_count <> 1 or source_prompt_md5 <> v393_md5 then
    raise exception 'Cannot stage v3.94: expected exactly one inactive v3.93 prompt with checksum %, found count=% checksum=%', v393_md5, existing_prompt_count, coalesce(source_prompt_md5, '<none>');
  end if;

  staged_prompt := source_prompt;

  staged_prompt := replace(
    staged_prompt,
    '   - wax object with a wick -> material `wax` and type `candle`',
    '   - plain, straight cylindrical wax stick candle -> material `wax` and type' || E'\n' ||
    '     `candle_stick`' || E'\n' ||
    '   - number, heart, spiral, taper, novelty, sculpted, or otherwise shaped wax' || E'\n' ||
    '     candle -> material `wax` and type `candle`'
  );

  staged_prompt := replace(
    staged_prompt,
    '| Wax object with visible wick | `candle` | `wax` | main topper | representative `direct diameter-relative size` |',
    '| Plain, straight cylindrical stick candle with visible wick | `candle_stick` | `wax` | main topper | representative `direct diameter-relative size` |' || E'\n' ||
    '| Number, heart, spiral, taper, novelty, sculpted, or otherwise shaped candle with visible wick | `candle` | `wax` | main topper | representative `direct diameter-relative size` |'
  );

  block_start := strpos(staged_prompt, candle_header);
  block_end := strpos(staged_prompt, candle_next_header);
  if block_start = 0 or block_end <= block_start then
    raise exception 'Cannot stage v3.94: expected v3.93 candle section boundaries were not found';
  end if;

  staged_prompt := left(staged_prompt, block_start - 1)
    || $v394_candle$
### CANDLE AND CANDLE STICK CLASSIFICATION

Use `candle_stick` only for a plain, straight cylindrical wax candle, including
ordinary birthday stick candles. A `candle_stick` quantity is the number of
individual sticks.

Use `candle` for number candles, heart candles, spiral candles, taper candles,
novelty candles, sculpted candles, shaped candles, and any other candle that is
not a plain straight cylindrical stick. Do not use `candle_stick` for a candle holder,
candle stand, or any non-candle support object.

Both `candle_stick` and `candle` use material `wax`, are countable individual
main toppers, and use `main_toppers` only. Use `classification: "hero"` only
when the candle arrangement is the dominant focal point of the whole design;
otherwise use `classification: "support"`. Group visually similar candles
together with quantity.

Do NOT classify candles or candle sticks as `edible_3d_ordinary`,
`edible_3d_complex`, `toy`, `gumpaste`, or fondant.

$v394_candle$
    || substring(staged_prompt from block_end);

  staged_prompt := replace(
    staged_prompt,
    '"type": "candle|toy|plastic_crown|edible_crown|cardstock|edible_photo_top|edible_logo_2d|edible_2d_complex|printout|edible_2d_shapes|edible_flowers|piped_flowers_top|edible_3d_ordinary|edible_3d_complex|figurine|icing_decorations|icing_doodle|icing_doodle_intricate_top|icing_palette_knife|icing_brush_stroke|icing_splatter|icing_minimalist_spread|meringue_pop|plastic_ball"',
    '"type": "candle_stick|candle|toy|plastic_crown|edible_crown|cardstock|edible_photo_top|edible_logo_2d|edible_2d_complex|printout|edible_2d_shapes|edible_flowers|piped_flowers_top|edible_3d_ordinary|edible_3d_complex|figurine|icing_decorations|icing_doodle|icing_doodle_intricate_top|icing_palette_knife|icing_brush_stroke|icing_splatter|icing_minimalist_spread|meringue_pop|plastic_ball"'
  );

  if staged_prompt = source_prompt
     or strpos(staged_prompt, '`candle_stick`') = 0
     or strpos(staged_prompt, 'candle_stick|candle|toy') = 0
     or strpos(staged_prompt, 'CANDLE AND CANDLE STICK CLASSIFICATION') = 0
     or strpos(staged_prompt, 'Do not use `candle_stick` for a candle holder') = 0 then
    raise exception 'Cannot stage v3.94: candle split was not applied to the verified v3.93 prompt';
  end if;

  select count(*) into existing_prompt_count
  from public.ai_prompts
  where version = '3.94';

  if existing_prompt_count > 1 then
    raise exception 'Cannot stage v3.94: expected zero or one existing row, found %', existing_prompt_count;
  end if;

  if existing_prompt_count = 1 then
    if exists (
      select 1 from public.ai_prompts
      where version = '3.94'
        and is_active = false
        and prompt_text = staged_prompt
    ) then
      return;
    end if;
    raise exception 'Cannot stage v3.94: existing row does not match generated prompt';
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description, created_at, updated_at)
  values (
    '3.94', staged_prompt, false,
    'Split plain candle sticks from shaped candles; preserve v3.93 geometry contract',
    now(), now()
  );
end;
$migration$;

commit;
