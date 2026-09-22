-- Stage v3.93 from the verified active v3.92 prompt.
-- This migration never changes the active prompt. Run the paired activation
-- migration only after the compatible application release is available.
begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  source_prompt text;
  staged_prompt text;
  existing_prompt_count integer;
  block_start integer;
  block_end integer;
  v392_md5 constant text := '06d2be8fd8e0429ed8721cd09e132931';
  piped_header constant text := '### PIPED BOTANICAL TREATMENT — CONSTRUCTION PRECEDENCE (BINDING)';
  next_header constant text := '### FLAT EDIBLE FLOWER DEPTH GATE (BINDING)';
begin
  select count(*), min(version::text), min(prompt_text)
  into active_prompt_count, active_prompt_version, source_prompt
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 or active_prompt_version <> '3.92' then
    raise exception 'Cannot stage v3.93: expected exactly one active v3.92 prompt, found count=% version=%', active_prompt_count, coalesce(active_prompt_version, '<none>');
  end if;

  if md5(source_prompt) <> v392_md5 then
    raise exception 'Cannot stage v3.93: active v3.92 prompt checksum is unexpected';
  end if;

  block_start := strpos(source_prompt, piped_header);
  block_end := strpos(source_prompt, next_header);
  if block_start = 0 or block_end <= block_start then
    raise exception 'Cannot stage v3.93: expected v3.92 piped-botanical block boundaries were not found';
  end if;

  staged_prompt := left(source_prompt, block_start - 1)
    || $v393_piped_scope$
### PIPED BOTANICAL TREATMENT — CONSTRUCTION AND GEOMETRY SCOPE (BINDING)

Determine the construction and fulfillment geometry of piped botanicals before assigning their type, quantity, or boxes. Piped icing is not automatically a cluster and it is not automatically a set of countable units.

COHESIVE PIPED CLUSTER: When piped flowers, leaves, or botanicals form one intentional coverage-priced top or side treatment, emit exactly one row: `piped_flowers_top` for the top or `piped_flowers_side` for the side, material `icing`, quantity `1`, and the required `coverage` band (`small`, `medium`, or `large`). Set `geometry_scope` to `piped_cluster` and return exactly one tight box around the full visible cluster plus one matching `bbox_confidence`. Do not count component blooms or leaves inside this treatment. The coverage band is authoritative for the fixed cluster price; the cluster box is retained for review and never overrides coverage during pricing.

INDEPENDENT PIPED UNITS: When piped blooms or leaf motifs are separately placed and independently fulfillable rather than one cohesive coverage treatment, emit `icing_decorations`, material `icing`, `geometry_scope: "unit"`, and the actual visible quantity. Return exactly `min(quantity, 5)` nested tight boxes, one for each confidently visible unit, with one matching confidence per box. Split visibly different scales into separate rows. Never use an arrangement-wide, spray-wide, garland-wide, or cluster-wide box for these units. These independently placed piped units are not `edible_flowers`, `edible_flowers_filler`, or `edible_2d_support`.

NON-COUNTABLE TREATMENT: Use `geometry_scope: "treatment"` only for an explicit non-countable treatment type allowed by the response schema, such as sprinkles, panels, spreads, splatter, or a continuous icing region. Return one full-region box and one confidence. Do not use treatment scope merely because independent decorations are small, numerous, or difficult to count. `icing_decorations` is reserved for independently placed piped units in this v3.93 contract.

FINAL PIPED GEOMETRY CHECK: Every row must declare one scope. A `unit` row has the actual quantity and exactly `min(quantity, 5)` unit boxes. A `piped_cluster` row uses only `piped_flowers_top` or `piped_flowers_side`, quantity `1`, one cluster box, and coverage. A `treatment` row uses one allowed treatment box. Never merge separate countable decorations into a cluster box.

$v393_piped_scope$
    || substring(source_prompt from block_end);

  -- The v3.92 geometry addendum also contained this generic carve-out later
  -- in the prompt. Remove it from the v3.93 bytes entirely: piped clusters
  -- are now an explicit scope, never an exception to discrete-unit geometry.
  staged_prompt := replace(
    staged_prompt,
    'Do not create one box covering the entire repeated arrangement unless the row represents one intentional continuous treatment such as piping, a drip, or a border.',
    'A discrete row never receives one box covering an entire repeated arrangement.'
  );

  if md5(staged_prompt) = md5(source_prompt) then
    raise exception 'Cannot stage v3.93: generated prompt is unchanged';
  end if;

  select count(*) into existing_prompt_count
  from public.ai_prompts
  where version = '3.93';

  if existing_prompt_count > 1 then
    raise exception 'Cannot stage v3.93: expected zero or one existing row, found %', existing_prompt_count;
  end if;

  if existing_prompt_count = 1 then
    if exists (
      select 1 from public.ai_prompts
      where version = '3.93'
        and is_active = false
        and prompt_text = staged_prompt
    ) then
      return;
    end if;
    if exists (
      select 1 from public.ai_prompts
      where version = '3.93'
        and is_active = false
        and prompt_text like '%### PIPED BOTANICAL TREATMENT — CONSTRUCTION AND GEOMETRY SCOPE (BINDING)%'
    ) then
      update public.ai_prompts
      set prompt_text = staged_prompt,
          description = 'Split clustered piped geometry from independently placed piped units; v2 scope contract',
          updated_at = now()
      where version = '3.93' and is_active = false;
      return;
    end if;
    raise exception 'Cannot stage v3.93: existing row does not match generated prompt';
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description, created_at, updated_at)
  values (
    '3.93', staged_prompt, false,
    'Split clustered piped geometry from independently placed piped units; v2 scope contract',
    now(), now()
  );
end;
$migration$;

commit;
