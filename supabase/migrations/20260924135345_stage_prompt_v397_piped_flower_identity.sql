-- Stage v3.97 only from the exact active v3.96 prompt.
-- The generated prompt must match the repository fallback checksum byte-for-byte.
-- This migration inserts one inactive row and does not modify cache or pricing.
begin;

do $migration$
declare
  active_count integer;
  active_version text;
  active_md5 text;
  source_prompt text;
  staged_prompt text;
  existing_count integer;
  existing_md5 text;
  v396_md5 constant text := 'afc7a90e525fcc74fa7c018f6d47d1ea';
  v397_md5 constant text := '54ec2f698a847e34e4abf96ad36ba675';
begin
  lock table public.ai_prompts in share row exclusive mode;

  select count(*), min(version), min(md5(prompt_text))
    into active_count, active_version, active_md5
  from public.ai_prompts
  where is_active = true and merchant_id is null;

  if active_count <> 1 or active_version <> '3.96' or active_md5 <> v396_md5 then
    raise exception 'Cannot stage v3.97: expected one active global v3.96 prompt with checksum %, found count=% version=% checksum=%',
      v396_md5, active_count, coalesce(active_version, '<none>'), coalesce(active_md5, '<none>');
  end if;

  select prompt_text into strict source_prompt
  from public.ai_prompts
  where version = '3.96' and is_active = true and merchant_id is null;

  staged_prompt := source_prompt;

  if length(staged_prompt) - length(replace(staged_prompt, $_v397_old_000_$
**v3.96 Version - Side-Positioned Edible Character Figures**

### CHANGELOG
- Detailed handmade edible character figures with modeled 3D anatomy are `edible_3d_complex` in `main_toppers` regardless of tier attachment or position; flat artwork, toys, and ceramic-look figures retain their existing precedence.
- Require construction-first grouping for piped flowers and their integrated piped foliage; directly piped botanicals never become fondant flowers, filler flowers, or separate fondant leaves.
- Require positive continuous-sheet evidence before choosing a fondant cake body; smooth pastel color, a neat gradient, floral decorations, or a single image angle are insufficient.
$_v397_old_000_$, '')) <> length($_v397_old_000_$
**v3.96 Version - Side-Positioned Edible Character Figures**

### CHANGELOG
- Detailed handmade edible character figures with modeled 3D anatomy are `edible_3d_complex` in `main_toppers` regardless of tier attachment or position; flat artwork, toys, and ceramic-look figures retain their existing precedence.
- Require construction-first grouping for piped flowers and their integrated piped foliage; directly piped botanicals never become fondant flowers, filler flowers, or separate fondant leaves.
- Require positive continuous-sheet evidence before choosing a fondant cake body; smooth pastel color, a neat gradient, floral decorations, or a single image angle are insufficient.
$_v397_old_000_$) then
    raise exception 'Cannot stage v3.97: source patch anchor 000 is missing or duplicated';
  end if;
  staged_prompt := replace(staged_prompt,
    $_v397_old_000_$
**v3.96 Version - Side-Positioned Edible Character Figures**

### CHANGELOG
- Detailed handmade edible character figures with modeled 3D anatomy are `edible_3d_complex` in `main_toppers` regardless of tier attachment or position; flat artwork, toys, and ceramic-look figures retain their existing precedence.
- Require construction-first grouping for piped flowers and their integrated piped foliage; directly piped botanicals never become fondant flowers, filler flowers, or separate fondant leaves.
- Require positive continuous-sheet evidence before choosing a fondant cake body; smooth pastel color, a neat gradient, floral decorations, or a single image angle are insufficient.
$_v397_old_000_$,
    $_v397_new_000_$
**v3.97 Version - Piped Flower Identity Gate**

### CHANGELOG
- Reserve `piped_flowers_top` and `piped_flowers_side` for cohesive piped treatments with visibly recognizable flower heads; piping texture and non-floral borders remain `icing_decorations`.
- Keep a non-floral top/base border in its border boolean and one `icing_decorations` support row; never duplicate a qualifying floral treatment as a generic border row.
- Detailed handmade edible character figures with modeled 3D anatomy are `edible_3d_complex` in `main_toppers` regardless of tier attachment or position; flat artwork, toys, and ceramic-look figures retain their existing precedence.
- Require recognizable flower-head evidence before grouping piped icing as flowers; integrated foliage may accompany qualifying heads but cannot independently qualify.
- Require positive continuous-sheet evidence before choosing a fondant cake body; smooth pastel color, a neat gradient, floral decorations, or a single image angle are insufficient.
$_v397_new_000_$);

  if length(staged_prompt) - length(replace(staged_prompt, $_v397_old_001_$
Determine the construction and fulfillment geometry of piped botanicals before assigning their type, quantity, or boxes. Piped icing is not automatically a cluster and it is not automatically a set of countable units.

COHESIVE PIPED CLUSTER: When piped flowers, leaves, or botanicals form one intentional coverage-priced top or side treatment, emit exactly one row: `piped_flowers_top` for the top or `piped_flowers_side` for the side, material `icing`, quantity `1`, and the required `coverage` band (`small`, `medium`, or `large`). Set `geometry_scope` to `piped_cluster` and return exactly one tight box around the full visible cluster plus one matching `bbox_confidence`. Do not count component blooms or leaves inside this treatment. The coverage band is authoritative for the fixed cluster price; the cluster box is retained for review and never overrides coverage during pricing.

INDEPENDENT PIPED UNITS: When piped blooms or leaf motifs are separately placed and independently fulfillable rather than one cohesive coverage treatment, emit `icing_decorations`, material `icing`, `geometry_scope: "unit"`, and the actual visible quantity. Return exactly `min(quantity, 5)` nested tight boxes, one for each confidently visible unit, with one matching confidence per box. Split visibly different scales into separate rows. Never use an arrangement-wide, spray-wide, garland-wide, or cluster-wide box for these units. These independently placed piped units are not `edible_flowers`, `edible_flowers_filler`, or `edible_2d_support`.

NON-COUNTABLE TREATMENT: Use `geometry_scope: "treatment"` only for an explicit non-countable treatment type allowed by the response schema, such as sprinkles, panels, spreads, splatter, or a continuous icing region. Return one full-region box and one confidence. Do not use treatment scope merely because independent decorations are small, numerous, or difficult to count. `icing_decorations` is reserved for independently placed piped units in this v3.93 contract.

FINAL PIPED GEOMETRY CHECK: Every row must declare one scope. A `unit` row has the actual quantity and exactly `min(quantity, 5)` unit boxes. A `piped_cluster` row uses only `piped_flowers_top` or `piped_flowers_side`, quantity `1`, one cluster box, and coverage. A `treatment` row uses one allowed treatment box. Never merge separate countable decorations into a cluster box.

$_v397_old_001_$, '')) <> length($_v397_old_001_$
Determine the construction and fulfillment geometry of piped botanicals before assigning their type, quantity, or boxes. Piped icing is not automatically a cluster and it is not automatically a set of countable units.

COHESIVE PIPED CLUSTER: When piped flowers, leaves, or botanicals form one intentional coverage-priced top or side treatment, emit exactly one row: `piped_flowers_top` for the top or `piped_flowers_side` for the side, material `icing`, quantity `1`, and the required `coverage` band (`small`, `medium`, or `large`). Set `geometry_scope` to `piped_cluster` and return exactly one tight box around the full visible cluster plus one matching `bbox_confidence`. Do not count component blooms or leaves inside this treatment. The coverage band is authoritative for the fixed cluster price; the cluster box is retained for review and never overrides coverage during pricing.

INDEPENDENT PIPED UNITS: When piped blooms or leaf motifs are separately placed and independently fulfillable rather than one cohesive coverage treatment, emit `icing_decorations`, material `icing`, `geometry_scope: "unit"`, and the actual visible quantity. Return exactly `min(quantity, 5)` nested tight boxes, one for each confidently visible unit, with one matching confidence per box. Split visibly different scales into separate rows. Never use an arrangement-wide, spray-wide, garland-wide, or cluster-wide box for these units. These independently placed piped units are not `edible_flowers`, `edible_flowers_filler`, or `edible_2d_support`.

NON-COUNTABLE TREATMENT: Use `geometry_scope: "treatment"` only for an explicit non-countable treatment type allowed by the response schema, such as sprinkles, panels, spreads, splatter, or a continuous icing region. Return one full-region box and one confidence. Do not use treatment scope merely because independent decorations are small, numerous, or difficult to count. `icing_decorations` is reserved for independently placed piped units in this v3.93 contract.

FINAL PIPED GEOMETRY CHECK: Every row must declare one scope. A `unit` row has the actual quantity and exactly `min(quantity, 5)` unit boxes. A `piped_cluster` row uses only `piped_flowers_top` or `piped_flowers_side`, quantity `1`, one cluster box, and coverage. A `treatment` row uses one allowed treatment box. Never merge separate countable decorations into a cluster box.

$_v397_old_001_$) then
    raise exception 'Cannot stage v3.97: source patch anchor 001 is missing or duplicated';
  end if;
  staged_prompt := replace(staged_prompt,
    $_v397_old_001_$
Determine the construction and fulfillment geometry of piped botanicals before assigning their type, quantity, or boxes. Piped icing is not automatically a cluster and it is not automatically a set of countable units.

COHESIVE PIPED CLUSTER: When piped flowers, leaves, or botanicals form one intentional coverage-priced top or side treatment, emit exactly one row: `piped_flowers_top` for the top or `piped_flowers_side` for the side, material `icing`, quantity `1`, and the required `coverage` band (`small`, `medium`, or `large`). Set `geometry_scope` to `piped_cluster` and return exactly one tight box around the full visible cluster plus one matching `bbox_confidence`. Do not count component blooms or leaves inside this treatment. The coverage band is authoritative for the fixed cluster price; the cluster box is retained for review and never overrides coverage during pricing.

INDEPENDENT PIPED UNITS: When piped blooms or leaf motifs are separately placed and independently fulfillable rather than one cohesive coverage treatment, emit `icing_decorations`, material `icing`, `geometry_scope: "unit"`, and the actual visible quantity. Return exactly `min(quantity, 5)` nested tight boxes, one for each confidently visible unit, with one matching confidence per box. Split visibly different scales into separate rows. Never use an arrangement-wide, spray-wide, garland-wide, or cluster-wide box for these units. These independently placed piped units are not `edible_flowers`, `edible_flowers_filler`, or `edible_2d_support`.

NON-COUNTABLE TREATMENT: Use `geometry_scope: "treatment"` only for an explicit non-countable treatment type allowed by the response schema, such as sprinkles, panels, spreads, splatter, or a continuous icing region. Return one full-region box and one confidence. Do not use treatment scope merely because independent decorations are small, numerous, or difficult to count. `icing_decorations` is reserved for independently placed piped units in this v3.93 contract.

FINAL PIPED GEOMETRY CHECK: Every row must declare one scope. A `unit` row has the actual quantity and exactly `min(quantity, 5)` unit boxes. A `piped_cluster` row uses only `piped_flowers_top` or `piped_flowers_side`, quantity `1`, one cluster box, and coverage. A `treatment` row uses one allowed treatment box. Never merge separate countable decorations into a cluster box.

$_v397_old_001_$,
    $_v397_new_001_$
Determine visible construction, flower identity, and fulfillment geometry before assigning a piped item's type, quantity, or boxes. Piped icing is not automatically a flower, a cluster, or a set of countable units.

FLOWER IDENTITY GATE (BINDING): Use `piped_flowers_top` or `piped_flowers_side` only when the image shows distinct flower heads with recognizable petals arranged into actual blooms. A flower-like name, piping texture, or decorative pattern is not enough. Piping ridges, tip seams, continuous joins, soft peaks, shells, beads, dollops, generic spiral rosettes, ruffles, swirls, and foliage or leaf strokes alone establish icing construction, never flower identity. If recognizable flower heads are absent, do not emit either `piped_flowers_*` type. Integrated foliage may accompany qualifying flower heads but cannot qualify on its own.

COHESIVE PIPED FLOWER TREATMENT: When recognizable piped flower heads form one intentional coverage-priced treatment on the top or side, emit exactly one row: `piped_flowers_top` for the top or `piped_flowers_side` for the side, material `icing`, quantity `1`, and the required `coverage` band (`small`, `medium`, or `large`). Set `geometry_scope` to `piped_cluster` and return exactly one tight box around the full visible flower treatment plus one matching `bbox_confidence`. Do not count component blooms or integrated foliage inside this treatment. The coverage band is authoritative for the fixed cluster price; the cluster box is retained for review and never overrides coverage during pricing.

INDEPENDENT PIPED UNITS: Separately placed piped blooms, leaf motifs, shells, swirls, or other non-floral piping that are independently fulfillable rather than one cohesive floral treatment use `icing_decorations`, material `icing`, `geometry_scope: "unit"`, and the actual visible quantity. Return exactly `min(quantity, 5)` nested tight boxes, one for each confidently visible unit, with one matching confidence per box. Split visibly different scales into separate rows. Never use an arrangement-wide, spray-wide, garland-wide, or cluster-wide box for these units. These independently placed piped units are not `edible_flowers`, `edible_flowers_filler`, or `edible_2d_support`.

NON-COUNTABLE TREATMENT: Use `geometry_scope: "treatment"` only for an explicit non-countable treatment type allowed by the response schema, such as sprinkles, panels, spreads, splatter, a continuous icing region, or one continuous non-floral border run. A top/base border represented by `icing_decorations` is this explicit border exception: use one full-run box and quantity `1`. Do not use treatment scope merely because independent decorations are small, numerous, or difficult to count.

FINAL PIPED GEOMETRY CHECK: Every row must declare one scope. A `unit` row has the actual quantity and exactly `min(quantity, 5)` unit boxes. A `piped_cluster` row uses only `piped_flowers_top` or `piped_flowers_side` for a cohesive treatment with recognizable flower heads, quantity `1`, one cluster box, and coverage. A `treatment` row uses one allowed treatment box. Never merge separate countable decorations into a cluster box.

$_v397_new_001_$);

  if length(staged_prompt) - length(replace(staged_prompt, $_v397_old_002_$  fulfillment override wins over visible fabric cues. A flat flower motif
  instead follows `FLAT EDIBLE FLOWER DEPTH GATE`. Directly piped icing flowers
  use `piped_flowers_top` or `piped_flowers_side`, material `icing`, under the
  grouped coverage rule
- physical metal, rhinestone, or plastic crowns/tiaras -> `plastic_crown`, material
$_v397_old_002_$, '')) <> length($_v397_old_002_$  fulfillment override wins over visible fabric cues. A flat flower motif
  instead follows `FLAT EDIBLE FLOWER DEPTH GATE`. Directly piped icing flowers
  use `piped_flowers_top` or `piped_flowers_side`, material `icing`, under the
  grouped coverage rule
- physical metal, rhinestone, or plastic crowns/tiaras -> `plastic_crown`, material
$_v397_old_002_$) then
    raise exception 'Cannot stage v3.97: source patch anchor 002 is missing or duplicated';
  end if;
  staged_prompt := replace(staged_prompt,
    $_v397_old_002_$  fulfillment override wins over visible fabric cues. A flat flower motif
  instead follows `FLAT EDIBLE FLOWER DEPTH GATE`. Directly piped icing flowers
  use `piped_flowers_top` or `piped_flowers_side`, material `icing`, under the
  grouped coverage rule
- physical metal, rhinestone, or plastic crowns/tiaras -> `plastic_crown`, material
$_v397_old_002_$,
    $_v397_new_002_$  fulfillment override wins over visible fabric cues. A flat flower motif
  instead follows `FLAT EDIBLE FLOWER DEPTH GATE`. Directly piped flowers use
  `piped_flowers_top` or `piped_flowers_side` only after the positive flower-head
  identity gate and cohesive-treatment rule; otherwise use `icing_decorations`
- physical metal, rhinestone, or plastic crowns/tiaras -> `plastic_crown`, material
$_v397_new_002_$);

  if length(staged_prompt) - length(replace(staged_prompt, $_v397_old_003_$`support_elements`. Use `quantity: 1` for the treated region. Simple piped
dots, borders, and non-floral swirls stay `icing_decorations`. Directly piped
flower rosettes use the grouped `piped_flowers_top` / `piped_flowers_side` rule.

$_v397_old_003_$, '')) <> length($_v397_old_003_$`support_elements`. Use `quantity: 1` for the treated region. Simple piped
dots, borders, and non-floral swirls stay `icing_decorations`. Directly piped
flower rosettes use the grouped `piped_flowers_top` / `piped_flowers_side` rule.

$_v397_old_003_$) then
    raise exception 'Cannot stage v3.97: source patch anchor 003 is missing or duplicated';
  end if;
  staged_prompt := replace(staged_prompt,
    $_v397_old_003_$`support_elements`. Use `quantity: 1` for the treated region. Simple piped
dots, borders, and non-floral swirls stay `icing_decorations`. Directly piped
flower rosettes use the grouped `piped_flowers_top` / `piped_flowers_side` rule.

$_v397_old_003_$,
    $_v397_new_003_$`support_elements`. Use `quantity: 1` for the treated region. Simple piped
dots, borders, shells, and non-floral swirls stay `icing_decorations`. A piped
rosette uses the grouped `piped_flowers_top` / `piped_flowers_side` rule only
when distinct petals make a recognizable flower head and it belongs to one
cohesive floral treatment; a generic spiral or shell-like rosette stays
`icing_decorations`.

$_v397_new_003_$);

  if length(staged_prompt) - length(replace(staged_prompt, $_v397_old_004_$
Piped flowers and their integrated foliage are icing only: directly piped
buttercream/frosting petals, rosettes, buds, shells, ruffles, star-tip
blossoms, swirls, or pointed leaf strokes that visibly merge into the iced cake
surface. Extrusion ridges, piping-tip seams, soft peaks, and continuous joins
are positive piped-icing evidence; they are not separate fondant or gumpaste
construction, even when the flower resembles a rose, peony, or blossom.

Emit the complete treatment as one row with `material: "icing"` and
`quantity: 1`—never one row per bloom:

- Top-surface flowers: one `main_toppers` row with `type:
  "piped_flowers_top"`, `classification: "hero"`, and `coverage` measured
  against the directly visible top surface.
- Sidewall flowers: one `support_elements` row with `type:
  "piped_flowers_side"` and `coverage` measured against the directly visible
  iced cake-side area. If an independent treatment appears on both top and
  side, emit one row of each type.

$_v397_old_004_$, '')) <> length($_v397_old_004_$
Piped flowers and their integrated foliage are icing only: directly piped
buttercream/frosting petals, rosettes, buds, shells, ruffles, star-tip
blossoms, swirls, or pointed leaf strokes that visibly merge into the iced cake
surface. Extrusion ridges, piping-tip seams, soft peaks, and continuous joins
are positive piped-icing evidence; they are not separate fondant or gumpaste
construction, even when the flower resembles a rose, peony, or blossom.

Emit the complete treatment as one row with `material: "icing"` and
`quantity: 1`—never one row per bloom:

- Top-surface flowers: one `main_toppers` row with `type:
  "piped_flowers_top"`, `classification: "hero"`, and `coverage` measured
  against the directly visible top surface.
- Sidewall flowers: one `support_elements` row with `type:
  "piped_flowers_side"` and `coverage` measured against the directly visible
  iced cake-side area. If an independent treatment appears on both top and
  side, emit one row of each type.

$_v397_old_004_$) then
    raise exception 'Cannot stage v3.97: source patch anchor 004 is missing or duplicated';
  end if;
  staged_prompt := replace(staged_prompt,
    $_v397_old_004_$
Piped flowers and their integrated foliage are icing only: directly piped
buttercream/frosting petals, rosettes, buds, shells, ruffles, star-tip
blossoms, swirls, or pointed leaf strokes that visibly merge into the iced cake
surface. Extrusion ridges, piping-tip seams, soft peaks, and continuous joins
are positive piped-icing evidence; they are not separate fondant or gumpaste
construction, even when the flower resembles a rose, peony, or blossom.

Emit the complete treatment as one row with `material: "icing"` and
`quantity: 1`—never one row per bloom:

- Top-surface flowers: one `main_toppers` row with `type:
  "piped_flowers_top"`, `classification: "hero"`, and `coverage` measured
  against the directly visible top surface.
- Sidewall flowers: one `support_elements` row with `type:
  "piped_flowers_side"` and `coverage` measured against the directly visible
  iced cake-side area. If an independent treatment appears on both top and
  side, emit one row of each type.

$_v397_old_004_$,
    $_v397_new_004_$
Use `piped_flowers_top` and `piped_flowers_side` only for a cohesive piped floral treatment whose visible flower heads are recognizable from distinct petals arranged as blooms. The image must show actual bloom heads; piping ridges, tip seams, soft peaks, continuous joins, shells, beads, dollops, generic spiral rosettes, ruffles, swirls, or foliage/leaf strokes alone never establish flower identity. Integrated piped foliage may accompany qualifying flower heads, but foliage alone and a non-floral border remain `icing_decorations`.

Emit each qualifying cohesive treatment as one row with `material: "icing"` and `quantity: 1`—never one row per bloom:

- Top-surface flower treatment: one `main_toppers` row with `type: "piped_flowers_top"`, `classification: "hero"`, and `coverage` measured against the directly visible top surface.
- Sidewall flower treatment: one `support_elements` row with `type: "piped_flowers_side"` and `coverage` measured against the directly visible iced cake-side area. If distinct cohesive treatments appear on both top and side, emit one row of each type.
- Independently placed piped units remain `icing_decorations` with their actual visible quantity and unit geometry, even when an individual unit is recognizable as a flower.

$_v397_new_004_$);

  if length(staged_prompt) - length(replace(staged_prompt, $_v397_old_005_$`direct diameter-relative size` for either piped-flower type and do not count individual piped
blooms or leaves. Describe accompanying piped foliage as part of the treatment.

This rule overrides ordinary-flower, filler-flower, and edible-leaf
normalization for directly piped botanicals only. A separate modeled, cupped,
layered, sculpted, or thick matte fondant/gumpaste bloom with visible petal
side surfaces remains `edible_flowers`; a separate flat cut, stamped,
flat-backed, or shallow-relief flower follows `FLAT EDIBLE FLOWER DEPTH GATE`.
Separate leaves remain `edible_2d_support`, all with material
`edible_fondant`.
Wafer, fresh, artificial, printed, and non-cake flowers remain governed by
their own construction and cake-membership rules. If there are no piped
flowers, a non-floral piped foliage border is `icing_decorations`.

$_v397_old_005_$, '')) <> length($_v397_old_005_$`direct diameter-relative size` for either piped-flower type and do not count individual piped
blooms or leaves. Describe accompanying piped foliage as part of the treatment.

This rule overrides ordinary-flower, filler-flower, and edible-leaf
normalization for directly piped botanicals only. A separate modeled, cupped,
layered, sculpted, or thick matte fondant/gumpaste bloom with visible petal
side surfaces remains `edible_flowers`; a separate flat cut, stamped,
flat-backed, or shallow-relief flower follows `FLAT EDIBLE FLOWER DEPTH GATE`.
Separate leaves remain `edible_2d_support`, all with material
`edible_fondant`.
Wafer, fresh, artificial, printed, and non-cake flowers remain governed by
their own construction and cake-membership rules. If there are no piped
flowers, a non-floral piped foliage border is `icing_decorations`.

$_v397_old_005_$) then
    raise exception 'Cannot stage v3.97: source patch anchor 005 is missing or duplicated';
  end if;
  staged_prompt := replace(staged_prompt,
    $_v397_old_005_$`direct diameter-relative size` for either piped-flower type and do not count individual piped
blooms or leaves. Describe accompanying piped foliage as part of the treatment.

This rule overrides ordinary-flower, filler-flower, and edible-leaf
normalization for directly piped botanicals only. A separate modeled, cupped,
layered, sculpted, or thick matte fondant/gumpaste bloom with visible petal
side surfaces remains `edible_flowers`; a separate flat cut, stamped,
flat-backed, or shallow-relief flower follows `FLAT EDIBLE FLOWER DEPTH GATE`.
Separate leaves remain `edible_2d_support`, all with material
`edible_fondant`.
Wafer, fresh, artificial, printed, and non-cake flowers remain governed by
their own construction and cake-membership rules. If there are no piped
flowers, a non-floral piped foliage border is `icing_decorations`.

$_v397_old_005_$,
    $_v397_new_005_$`direct diameter-relative size` for either piped-flower type and do not count individual piped
blooms or foliage within a cohesive treatment. Describe accompanying piped foliage as part of the treatment.

This rule overrides ordinary-flower, filler-flower, and edible-leaf
normalization only for a qualifying cohesive piped treatment with recognizable
flower heads. A separate modeled, cupped, layered, sculpted, or thick matte
fondant/gumpaste bloom with visible petal side surfaces remains `edible_flowers`;
a separate flat cut, stamped, flat-backed, or shallow-relief flower follows
`FLAT EDIBLE FLOWER DEPTH GATE`. Separate leaves remain `edible_2d_support`, all with material
`edible_fondant`. Wafer, fresh, artificial, printed, and non-cake flowers remain
governed by their own construction and cake-membership rules. If visible piping
shows no recognizable flower heads, classify it under `icing_decorations`, not
`piped_flowers_top` or `piped_flowers_side`.

$_v397_new_005_$);

  if length(staged_prompt) - length(replace(staged_prompt, $_v397_old_006_$- flat fondant daisy cutouts -> `edible_2d_shapes` when focal, otherwise `edible_2d_support`
- piped buttercream flower rosettes -> `piped_flowers_top` or `piped_flowers_side`, grouped by coverage
- plain fondant peach -> `edible_3d_ordinary`
$_v397_old_006_$, '')) <> length($_v397_old_006_$- flat fondant daisy cutouts -> `edible_2d_shapes` when focal, otherwise `edible_2d_support`
- piped buttercream flower rosettes -> `piped_flowers_top` or `piped_flowers_side`, grouped by coverage
- plain fondant peach -> `edible_3d_ordinary`
$_v397_old_006_$) then
    raise exception 'Cannot stage v3.97: source patch anchor 006 is missing or duplicated';
  end if;
  staged_prompt := replace(staged_prompt,
    $_v397_old_006_$- flat fondant daisy cutouts -> `edible_2d_shapes` when focal, otherwise `edible_2d_support`
- piped buttercream flower rosettes -> `piped_flowers_top` or `piped_flowers_side`, grouped by coverage
- plain fondant peach -> `edible_3d_ordinary`
$_v397_old_006_$,
    $_v397_new_006_$- flat fondant daisy cutouts -> `edible_2d_shapes` when focal, otherwise `edible_2d_support`
- cohesive piped buttercream treatment with distinct, recognizable flower heads -> `piped_flowers_top` or `piped_flowers_side`, grouped by coverage
- generic piped spiral rosettes or shell-border piping without recognizable flower heads -> `icing_decorations`
- plain fondant peach -> `edible_3d_ordinary`
$_v397_new_006_$);

  if length(staged_prompt) - length(replace(staged_prompt, $_v397_old_007_$| `gumpaste_bundle` | edible_fondant | Cluster of gumpaste items: stones, rocks, or seaweeds (Readable message letters not included). Count as a whole one group. Discrete edible leaves and foliage use `edible_2d_support` instead. |
| `edible_flowers` | edible_fondant | Count individual non-piped flowers only when direct image evidence shows modeled 3D bloom depth. Use main toppers only for visibly focal or individually intricate blooms; use support elements for ordinary accents or filler. Flat flower motifs use `edible_2d_shapes` or `edible_2d_support` by role. Directly piped icing flowers follow the grouped coverage rule. |
| `edible_flowers_filler` | edible_fondant | Every small generic filler flower and every baby's-breath flower. Support only; count each directly visible flower, group matching color/appearance, emit `size` as `small`, `medium`, or `large`, and omit `size_line`, `bbox`, and `coverage`. Its per-visible-flower price is ₱5 in every size band. Never use for a distinct ordinary or intricate bloom solely because it is small. |
$_v397_old_007_$, '')) <> length($_v397_old_007_$| `gumpaste_bundle` | edible_fondant | Cluster of gumpaste items: stones, rocks, or seaweeds (Readable message letters not included). Count as a whole one group. Discrete edible leaves and foliage use `edible_2d_support` instead. |
| `edible_flowers` | edible_fondant | Count individual non-piped flowers only when direct image evidence shows modeled 3D bloom depth. Use main toppers only for visibly focal or individually intricate blooms; use support elements for ordinary accents or filler. Flat flower motifs use `edible_2d_shapes` or `edible_2d_support` by role. Directly piped icing flowers follow the grouped coverage rule. |
| `edible_flowers_filler` | edible_fondant | Every small generic filler flower and every baby's-breath flower. Support only; count each directly visible flower, group matching color/appearance, emit `size` as `small`, `medium`, or `large`, and omit `size_line`, `bbox`, and `coverage`. Its per-visible-flower price is ₱5 in every size band. Never use for a distinct ordinary or intricate bloom solely because it is small. |
$_v397_old_007_$) then
    raise exception 'Cannot stage v3.97: source patch anchor 007 is missing or duplicated';
  end if;
  staged_prompt := replace(staged_prompt,
    $_v397_old_007_$| `gumpaste_bundle` | edible_fondant | Cluster of gumpaste items: stones, rocks, or seaweeds (Readable message letters not included). Count as a whole one group. Discrete edible leaves and foliage use `edible_2d_support` instead. |
| `edible_flowers` | edible_fondant | Count individual non-piped flowers only when direct image evidence shows modeled 3D bloom depth. Use main toppers only for visibly focal or individually intricate blooms; use support elements for ordinary accents or filler. Flat flower motifs use `edible_2d_shapes` or `edible_2d_support` by role. Directly piped icing flowers follow the grouped coverage rule. |
| `edible_flowers_filler` | edible_fondant | Every small generic filler flower and every baby's-breath flower. Support only; count each directly visible flower, group matching color/appearance, emit `size` as `small`, `medium`, or `large`, and omit `size_line`, `bbox`, and `coverage`. Its per-visible-flower price is ₱5 in every size band. Never use for a distinct ordinary or intricate bloom solely because it is small. |
$_v397_old_007_$,
    $_v397_new_007_$| `gumpaste_bundle` | edible_fondant | Cluster of gumpaste items: stones, rocks, or seaweeds (Readable message letters not included). Count as a whole one group. Discrete edible leaves and foliage use `edible_2d_support` instead. |
| `edible_flowers` | edible_fondant | Count individual non-piped flowers only when direct image evidence shows modeled 3D bloom depth. Use main toppers only for visibly focal or individually intricate blooms; use support elements for ordinary accents or filler. Flat flower motifs use `edible_2d_shapes` or `edible_2d_support` by role. Directly piped flower heads follow grouped coverage only when recognizable heads form one cohesive top/side treatment; generic piped shapes remain `icing_decorations`. |
| `edible_flowers_filler` | edible_fondant | Every small generic filler flower and every baby's-breath flower. Support only; count each directly visible flower, group matching color/appearance, emit `size` as `small`, `medium`, or `large`, and omit `size_line`, `bbox`, and `coverage`. Its per-visible-flower price is ₱5 in every size band. Never use for a distinct ordinary or intricate bloom solely because it is small. |
$_v397_new_007_$);

  if length(staged_prompt) - length(replace(staged_prompt, $_v397_old_008_$| `edible_3d_ordinary` | edible_fondant | Simple molded 3D shapes, including simple non-likeness decorative faces; no assembled character anatomy or complex expression |
| `icing_decorations` | icing | Piped icing dots, non-floral swirls, and borders. Piped flower rosettes use piped_flowers_top / piped_flowers_side instead. Piped icing dots on the sides are icing decorations, not candy sprinkles. |
| `edible_lego_bricks` | edible_fondant | Small edible Lego-style brick or building-block pieces with studs. Count per piece |
$_v397_old_008_$, '')) <> length($_v397_old_008_$| `edible_3d_ordinary` | edible_fondant | Simple molded 3D shapes, including simple non-likeness decorative faces; no assembled character anatomy or complex expression |
| `icing_decorations` | icing | Piped icing dots, non-floral swirls, and borders. Piped flower rosettes use piped_flowers_top / piped_flowers_side instead. Piped icing dots on the sides are icing decorations, not candy sprinkles. |
| `edible_lego_bricks` | edible_fondant | Small edible Lego-style brick or building-block pieces with studs. Count per piece |
$_v397_old_008_$) then
    raise exception 'Cannot stage v3.97: source patch anchor 008 is missing or duplicated';
  end if;
  staged_prompt := replace(staged_prompt,
    $_v397_old_008_$| `edible_3d_ordinary` | edible_fondant | Simple molded 3D shapes, including simple non-likeness decorative faces; no assembled character anatomy or complex expression |
| `icing_decorations` | icing | Piped icing dots, non-floral swirls, and borders. Piped flower rosettes use piped_flowers_top / piped_flowers_side instead. Piped icing dots on the sides are icing decorations, not candy sprinkles. |
| `edible_lego_bricks` | edible_fondant | Small edible Lego-style brick or building-block pieces with studs. Count per piece |
$_v397_old_008_$,
    $_v397_new_008_$| `edible_3d_ordinary` | edible_fondant | Simple molded 3D shapes, including simple non-likeness decorative faces; no assembled character anatomy or complex expression |
| `icing_decorations` | icing | Piped dots, shells, beads, generic rosettes, ruffles, swirls, non-floral borders, and independently placed piped units. Use `piped_flowers_top` / `piped_flowers_side` only for one cohesive treatment with visibly recognizable flower heads. Piped icing dots on the sides are icing decorations, not candy sprinkles. |
| `edible_lego_bricks` | edible_fondant | Small edible Lego-style brick or building-block pieces with studs. Count per piece |
$_v397_new_008_$);

  if length(staged_prompt) - length(replace(staged_prompt, $_v397_old_009_$
When a piped border (shells, beads, dollops, rosettes, or swirls) runs along
the top edge or the base edge of the cake, always represent it twice:
1. Set `icing_design.border_top` and/or `icing_design.border_base` to `true`.
2. Also emit one `icing_decorations` support row for that border run
   (`material: "icing"`, `quantity: 1`; the application computes its size from
   the representative `direct diameter-relative size`). Measure one typical visible shell, bead,
   dollop, rosette, or swirl in the repeated border—not the full perimeter or
   the full border run.

Freestanding non-floral piped dots or swirls elsewhere on the cake emit their
own `icing_decorations` rows and never set the border booleans. Piped flower
rosettes elsewhere use the grouped top/side coverage rule. Never emit a
border only once: the boolean and the row always travel together.

$_v397_old_009_$, '')) <> length($_v397_old_009_$
When a piped border (shells, beads, dollops, rosettes, or swirls) runs along
the top edge or the base edge of the cake, always represent it twice:
1. Set `icing_design.border_top` and/or `icing_design.border_base` to `true`.
2. Also emit one `icing_decorations` support row for that border run
   (`material: "icing"`, `quantity: 1`; the application computes its size from
   the representative `direct diameter-relative size`). Measure one typical visible shell, bead,
   dollop, rosette, or swirl in the repeated border—not the full perimeter or
   the full border run.

Freestanding non-floral piped dots or swirls elsewhere on the cake emit their
own `icing_decorations` rows and never set the border booleans. Piped flower
rosettes elsewhere use the grouped top/side coverage rule. Never emit a
border only once: the boolean and the row always travel together.

$_v397_old_009_$) then
    raise exception 'Cannot stage v3.97: source patch anchor 009 is missing or duplicated';
  end if;
  staged_prompt := replace(staged_prompt,
    $_v397_old_009_$
When a piped border (shells, beads, dollops, rosettes, or swirls) runs along
the top edge or the base edge of the cake, always represent it twice:
1. Set `icing_design.border_top` and/or `icing_design.border_base` to `true`.
2. Also emit one `icing_decorations` support row for that border run
   (`material: "icing"`, `quantity: 1`; the application computes its size from
   the representative `direct diameter-relative size`). Measure one typical visible shell, bead,
   dollop, rosette, or swirl in the repeated border—not the full perimeter or
   the full border run.

Freestanding non-floral piped dots or swirls elsewhere on the cake emit their
own `icing_decorations` rows and never set the border booleans. Piped flower
rosettes elsewhere use the grouped top/side coverage rule. Never emit a
border only once: the boolean and the row always travel together.

$_v397_old_009_$,
    $_v397_new_009_$
When a non-floral piped border (shells, beads, dollops, generic spiral rosettes, or swirls) runs along the top edge or base edge of the cake, always represent it twice:
1. Set `icing_design.border_top` and/or `icing_design.border_base` to `true`.
2. Also emit one `support_elements` row for that border run: `type: "icing_decorations"`, `material: "icing"`, `quantity: 1`, and `geometry_scope: "treatment"`. Return one tight box around the visible border run; use the visible representative piping unit to determine its `size`, not the full perimeter.

A shell, scallop, dollop, generic rosette, or swirl border is never a `piped_flowers_top` or `piped_flowers_side` row. If recognizable flower heads form a separate cohesive treatment, emit that flower row separately from the non-floral border. If a qualifying cohesive floral treatment itself follows the top or base edge, set the corresponding border boolean but do not duplicate that same piping as an `icing_decorations` row.

Freestanding non-floral piped dots, shells, or swirls elsewhere on the cake emit their own `icing_decorations` rows and never set the border booleans. A piped flower treatment elsewhere uses the grouped top/side coverage rule only when recognizable flower heads form one cohesive treatment. Never emit the same piping both as a flower treatment and as a generic border row.

$_v397_new_009_$);

  if length(staged_prompt) - length(replace(staged_prompt, $_v397_old_010_$
2. piped_cluster — Only one cohesive piped botanical treatment priced as a
   cluster. Use piped_flowers_top or piped_flowers_side, material icing,
   quantity 1, coverage small/medium/large, and one box around the full cluster.
   Coverage selects its fixed price; this box is for review, not sizing.
$_v397_old_010_$, '')) <> length($_v397_old_010_$
2. piped_cluster — Only one cohesive piped botanical treatment priced as a
   cluster. Use piped_flowers_top or piped_flowers_side, material icing,
   quantity 1, coverage small/medium/large, and one box around the full cluster.
   Coverage selects its fixed price; this box is for review, not sizing.
$_v397_old_010_$) then
    raise exception 'Cannot stage v3.97: source patch anchor 010 is missing or duplicated';
  end if;
  staged_prompt := replace(staged_prompt,
    $_v397_old_010_$
2. piped_cluster — Only one cohesive piped botanical treatment priced as a
   cluster. Use piped_flowers_top or piped_flowers_side, material icing,
   quantity 1, coverage small/medium/large, and one box around the full cluster.
   Coverage selects its fixed price; this box is for review, not sizing.
$_v397_old_010_$,
    $_v397_new_010_$
2. piped_cluster — Only one cohesive piped floral treatment with visibly
   recognizable flower heads, priced as a cluster. Use piped_flowers_top or
   piped_flowers_side, material icing, quantity 1, coverage small/medium/large,
   and one box around the full flower treatment.
   Coverage selects its fixed price; this box is for review, not sizing.
$_v397_new_010_$);

  if md5(staged_prompt) <> v397_md5 then
    raise exception 'Cannot stage v3.97: assembled prompt checksum is unexpected; expected %, received %',
      v397_md5, md5(staged_prompt);
  end if;

  select count(*), min(md5(prompt_text))
    into existing_count, existing_md5
  from public.ai_prompts
  where version = '3.97' and merchant_id is null;

  if existing_count > 1 then
    raise exception 'Cannot stage v3.97: multiple global rows already use version 3.97';
  elsif existing_count = 1 then
    if exists (
      select 1 from public.ai_prompts
      where version = '3.97' and merchant_id is null
        and is_active = false and md5(prompt_text) = v397_md5
    ) then
      return;
    end if;
    raise exception 'Cannot stage v3.97: existing target row is active or differs from generated prompt';
  end if;

  insert into public.ai_prompts (
    version, prompt_text, is_active, description, created_at, updated_at, merchant_id
  ) values (
    '3.97', staged_prompt, false,
    'Require recognizable flower-head evidence before classifying cohesive piped flower treatments; keep non-floral borders and independent piped units as icing decorations.',
    now(), now(), null
  );
end;
$migration$;

commit;
