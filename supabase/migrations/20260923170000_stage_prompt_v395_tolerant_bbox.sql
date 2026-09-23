-- Stage v3.95 from the exact active v3.93 prompt. This migration inserts one
-- inactive prompt row only; it does not activate a prompt or touch analysis
-- cache, SEO, or other prompt rows.
begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  active_prompt_md5 text;
  source_prompt text;
  staged_prompt text;
  existing_prompt_count integer;
  geometry_start integer;
  v393_md5 constant text := '444e8ed102fb527ea747742dd3f94e52';
  geometry_header constant text := '## INTEGRATED CAKE ANALYSIS + PRECISE BOUNDING-BOX GEOMETRY';
begin
  select count(*), min(version::text), min(md5(prompt_text)), min(prompt_text)
  into active_prompt_count, active_prompt_version, active_prompt_md5, source_prompt
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1
     or active_prompt_version <> '3.93'
     or active_prompt_md5 <> v393_md5 then
    raise exception 'Cannot stage v3.95: expected exactly one active v3.93 prompt with checksum %, found count=% version=% checksum=%',
      v393_md5, active_prompt_count, coalesce(active_prompt_version, '<none>'), coalesce(active_prompt_md5, '<none>');
  end if;

  geometry_start := strpos(source_prompt, geometry_header);
  if geometry_start = 0 then
    raise exception 'Cannot stage v3.95: integrated geometry section was not found in the verified source prompt';
  end if;

  staged_prompt := left(source_prompt, geometry_start - 1) || $v395_bbox$
## V3.95 INTEGRATED BOUNDING-BOX CONTRACT (AUTHORITATIVE)

This section replaces the earlier integrated geometry instructions in full.
Preserve all existing cake classification, construction, material, description,
quantity, color, coverage, subtype, rejection, icing, and cake-analysis rules.
Return exactly one JSON object with the required { analysis, geometry } envelope.
The geometry_version is "integrated_bbox_v2". Do not emit model-owned size,
area, ratio, legacy bbox, size_line, or cake_measurements fields.

Use normalized image coordinates from 0 to 1000 with a top-left origin. Boxes are
[ymin, xmin, ymax, xmax], tightly enclosing visible cake-member objects only.
Use [y, x] for line endpoints. The cake_diameter_line measures the visible
left-to-right top-tier rim and is predominantly horizontal. When measurable,
the cake_height_line measures the same cake body's visible front wall from its
top/front edge to bottom/front edge and is predominantly vertical. Do not
extend either measurement through hidden edges or background.

Every main_toppers and support_elements row includes geometry_scope,
box_2d as a nested array of boxes, and bbox_confidence as a nested array with
one confidence per box in matching order. Preserve each row's actual quantity
and stable group_id. Keep matching visible units in one row; do not merge a
discrete arrangement into an arrangement-wide box.

Choose exactly one scope for each topper/support row:

1. unit — Every independently fulfillable, countable decoration, including
   printouts and separately placed piped blooms or leaves. Printout always uses
   unit, never treatment. For quantities 1–5, target exactly that many distinct
   tight visible-unit boxes (1→1, 2→2, 3→3, 4→4, 5→5). For quantities 6 or
   greater, target exactly five visible-unit boxes while preserving the full
   quantity. Return every valid localized box; never omit the item, reduce its
   quantity, invent a box, or combine separate units. Keep confidences aligned.

2. piped_cluster — Only one cohesive piped botanical treatment priced as a
   cluster. Use piped_flowers_top or piped_flowers_side, material icing,
   quantity 1, coverage small/medium/large, and one box around the full cluster.
   Coverage selects its fixed price; this box is for review, not sizing.

3. treatment — Only a non-countable treated region of type gumpaste_bundle,
   gumpaste_panel, sprinkles, premium_sprinkles, icing_doodle_intricate_top,
   icing_doodle_intricate_side, icing_palette_knife, icing_brush_stroke,
   icing_splatter, icing_minimalist_spread, icing_decorations,
   edible_photo_side, edible_photo_side_wave, thin_fabric_ribbon_bows, or
   satin_ribbon. Icing decorations may use treatment only for one continuous
   icing region with material icing and quantity 1. Never use treatment for
   printout or individually countable decorations.

Cake messages use one flat box and one scalar confidence when localizable. If a
message box cannot be localized, preserve its row and return empty geometry
arrays. If a unit group's target count is short or a box/scope is invalid, keep
all valid localized boxes and the original item and quantity. Do not drop a row
because boxes span size bands. Do not emit bbox_review or parent_group_id; the
application owns review metadata, one targeted bbox-only retry, and deterministic
child identities.

The application sizes topper/support boxes using cake_area = cake_width squared,
where cake_width is the cake_diameter_line horizontal span. Small is at most 15%,
Medium is over 15% through 70%, and Large is over 70%. Fully boxed unit rows are
split by the application into homogeneous size-band rows when needed, retaining
all boxes, matching confidences, and total quantity. Partial or capped samples
are flagged for review and use the largest valid box's band. With zero valid
boxes, the application preserves prior cached size when available and flags the
row for review. Cake thickness is application-reconciled from available cake
measurement geometry and the selected cake type.

For accepted images, return the cake diameter line; return a cake height line
when measurable. For rejected images, return empty item arrays and only
geometry_version in geometry. Return JSON only.
$v395_bbox$;

  if staged_prompt = source_prompt
     or strpos(staged_prompt, 'Use one representative visible unit for `box_2d`') > 0
     or strpos(staged_prompt, '"geometry_version": "integrated_bbox_v1"') > 0
     or strpos(staged_prompt, 'quantities 1–5') = 0
     or strpos(staged_prompt, 'target exactly five visible-unit boxes') = 0
     or strpos(staged_prompt, 'application preserves prior cached size') = 0 then
    raise exception 'Cannot stage v3.95: verified prompt source was not replaced with the complete tolerant bbox contract';
  end if;

  select count(*) into existing_prompt_count
  from public.ai_prompts
  where version = '3.95';

  if existing_prompt_count > 1 then
    raise exception 'Cannot stage v3.95: expected zero or one existing row, found %', existing_prompt_count;
  end if;

  if existing_prompt_count = 1 then
    if exists (
      select 1 from public.ai_prompts
      where version = '3.95'
        and is_active = false
        and prompt_text = staged_prompt
    ) then
      return;
    end if;
    raise exception 'Cannot stage v3.95: existing row is active or differs from the generated prompt';
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description, created_at, updated_at)
  values (
    '3.95', staged_prompt, false,
    'Tolerant integrated bbox counts, local review/salvage, and mixed-size row splitting',
    now(), now()
  );
end;
$migration$;

commit;
