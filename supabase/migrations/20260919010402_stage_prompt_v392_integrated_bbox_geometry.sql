-- Stage, but do not activate, the v3.92 integrated one-pass geometry prompt.
-- The target is derived from the verified live v3.91 bytes, then checked against
-- the same checksum as src/services/prompts/fallback-prompt.txt.

begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  source_prompt text;
  staged_prompt text;
  existing_prompt_count integer;
  v391_md5 constant text := '388e050b2c43655b289bcbe9aa7fc125';
  v392_md5 constant text := '6ff4cfe33b293eddc5861db4eccec7f8';
begin
  select count(*), min(version::text), min(prompt_text)
  into active_prompt_count, active_prompt_version, source_prompt
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 or active_prompt_version <> '3.91' then
    raise exception 'Cannot stage v3.92: expected exactly one active v3.91 prompt, found count=% version=%', active_prompt_count, coalesce(active_prompt_version, '<none>');
  end if;

  if md5(source_prompt) <> v391_md5 then
    raise exception 'Cannot stage v3.92: active v3.91 prompt checksum is unexpected';
  end if;

  staged_prompt := source_prompt || $v392_addendum$
## V3.92 INTEGRATED BOUNDING-BOX PRECEDENCE (AUTHORITATIVE)

The following v3.92 addendum overrides every earlier direct-diameter, model-owned size, cake_measurements, size_line, bbox, fixed-size, size-free filler, and coverage-to-size instruction. Preserve all existing type, material, classification, quantity, color, coverage, subtype, rejection, icing, and cake-analysis requirements when they do not conflict. The required response shape below is an outer envelope; retain existing conditional analysis fields such as coverage and subtype when applicable, but never emit model-owned size labels.

## INTEGRATED CAKE ANALYSIS + PRECISE BOUNDING-BOX GEOMETRY

Analyze the original uploaded cake image once. Return exactly one valid JSON object containing the normal cake analysis plus precise geometry for every detected main topper, support element, and cake message.

The application—not the model—will calculate topper sizes from the returned geometry. Do not estimate, infer, or return model-owned size labels.

### Geometry coordinate system

Use normalized image coordinates from 0 to 1000 with a top-left origin.

All points use [y, x] ordering.

Every box must use:

[ ymin, xmin, ymax, xmax ]

Boxes must tightly contain the visible object without padding, truncation, or guessed hidden areas.

### Cake measurement lines

Return:
```json
"cake_diameter_line": {
  "start": [y, x],
  "end": [y, x]
}
```

This must measure the widest visible horizontal span of the top-tier rim.

- Start must be the left endpoint.
- End must be the right endpoint.
- The line must be predominantly horizontal.

Return:
```json
"cake_height_line": {
  "start": [y, x],
  "end": [y, x]
}
```

This must measure the visible front-center cake wall.

- Start at the visible top FRONT edge where the top surface meets the front sidewall.
- End at the visible base edge of the cake wall.
- Do not use the rear rim, highest pixel, topper, board, plate, or background.
- The line must be predominantly vertical.
- Its x-coordinate must align with the midpoint of the cake diameter line.
- Start must have the smaller y value; end must have the larger y value.

### Analysis item geometry

Every emitted item in these arrays must contain exactly one matching `box_2d`:

- `main_toppers`
- `support_elements`
- `cake_messages`

Use the existing analysis row’s `group_id` as the stable identity for toppers and support elements. Do not use array position as identity.

Each main topper and support element must include:
```json
"box_2d": [ymin, xmin, ymax, xmax],
"bbox_confidence": 0.0
```

Each cake message must include:
```json
"box_2d": [ymin, xmin, ymax, xmax],
"bbox_confidence": 0.0
```

`bbox_confidence` must be between 0.0 and 1.0.

For repeated decorations:

- Keep them as one analysis row.
- Use one representative visible unit for `box_2d`.
- Preserve the total visible quantity in the existing `quantity` field.
- Do not create one box covering the entire repeated arrangement unless the row represents one intentional continuous treatment such as piping, a drip, or a border.

Include intentional decorations attached to or deliberately resting on:

- The cake body
- The cake top
- The cake sides
- The cake base
- The cake board

Exclude only genuine background or scene artifacts, including tables, plates, stands, backdrops, props, shadows, reflections, packaging, and unrelated objects.

### Size calculation ownership

Do not return or calculate `size`, `bbox_area`, `cake_area`, `area_ratio`, or percentage values.

The application will calculate them deterministically after validation:
```text
cake_width = abs(cake_diameter_line.end.x - cake_diameter_line.start.x)
cake_height = abs(cake_height_line.end.y - cake_height_line.start.y)

cake_area = cake_width * cake_height

bbox_width = xmax - xmin
bbox_height = ymax - ymin

bbox_area = bbox_width * bbox_height

area_ratio_percent = (bbox_area / cake_area) * 100
```

The application will assign the size of each `main_toppers` and `support_elements` row using:
```text
Small:  area_ratio_percent <= 20
Medium: area_ratio_percent > 20 and <= 70
Large:  area_ratio_percent > 70
```

Cake messages receive bounding boxes for review but do not receive topper size bands.

### Required response shape

Return exactly:
```json
{
  "analysis": {
    "cakeType": "...",
    "cakeThickness": "...",
    "main_toppers": [
      {
        "type": "...",
        "material": "...",
        "group_id": "...",
        "classification": "...",
        "quantity": 1,
        "description": "...",
        "box_2d": [ymin, xmin, ymax, xmax],
        "bbox_confidence": 0.0
      }
    ],
    "support_elements": [
      {
        "type": "...",
        "material": "...",
        "group_id": "...",
        "color": "...",
        "quantity": 1,
        "description": "...",
        "box_2d": [ymin, xmin, ymax, xmax],
        "bbox_confidence": 0.0
      }
    ],
    "cake_messages": [
      {
        "text": "...",
        "type": "...",
        "color": "...",
        "position": "...",
        "box_2d": [ymin, xmin, ymax, xmax],
        "bbox_confidence": 0.0
      }
    ],
    "icing_design": { "...": "..." },
    "keyword": "...",
    "rejection": {
      "isRejected": false,
      "reason": "",
      "message": ""
    }
  },
  "geometry": {
    "geometry_version": "integrated_bbox_v1",
    "cake_diameter_line": {
      "start": [y, x],
      "end": [y, x]
    },
    "cake_height_line": {
      "start": [y, x],
      "end": [y, x]
    }
  }
}
```

For a rejected image:

- Set `rejection.isRejected` to `true`.
- Return empty `main_toppers`, `support_elements`, and `cake_messages` arrays.
- Omit the measurement lines.
- Do not invent geometry.

Return JSON only. Do not include explanations, markdown, comments, or extra fields.
$v392_addendum$;

  if md5(staged_prompt) <> v392_md5 then
    raise exception 'Cannot stage v3.92: generated prompt checksum is unexpected';
  end if;

  select count(*) into existing_prompt_count
  from public.ai_prompts
  where version = '3.92';

  if existing_prompt_count = 1 and exists (
    select 1 from public.ai_prompts
    where version = '3.92' and is_active = false and md5(prompt_text) = v392_md5
  ) then
    return;
  end if;

  if existing_prompt_count <> 0 then
    raise exception 'Cannot stage v3.92: expected no existing v3.92 prompt or one checksum-matched inactive row, found %', existing_prompt_count;
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description)
  values (
    '3.92',
    staged_prompt,
    false,
    'Integrated bounding-box geometry; application-owned deterministic topper and support sizing.'
  );
end;
$migration$;

commit;
