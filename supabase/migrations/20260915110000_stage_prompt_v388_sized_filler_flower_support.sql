-- Stage a sized filler/baby's-breath support type. This leaves the current
-- v3.86 prompt active until the compatible application release is deployed.
begin;

do $migration$
declare
  active_count integer;
  generic_filler_rule_count integer;
  sized_filler_rule_count integer;
  source_version text;
  source_prompt text;
  next_prompt text;
  v386_md5 constant text := '64542a47d0e7f19b51db22a6209ed0e4';
  v388_md5 constant text := 'c4afb9b84576b1c37501e9a56fd379f6';
  genie_merchant_id constant uuid := 'd29d384c-3265-4d96-9637-86888a8f649d';
begin
  lock table public.ai_prompts in share row exclusive mode;
  lock table public.pricing_rules in share row exclusive mode;

  select count(*) into active_count from public.ai_prompts where is_active = true;
  if active_count <> 1 then
    raise exception 'Cannot stage v3.88: expected exactly one active prompt, found %', active_count;
  end if;

  select version, prompt_text into source_version, source_prompt
  from public.ai_prompts
  where is_active = true;

  if source_version <> '3.86' or md5(source_prompt) <> v386_md5 then
    raise exception 'Cannot stage v3.88: verified active v3.86 source is required';
  end if;

  if exists (select 1 from public.ai_prompts where version = '3.88') then
    raise exception 'Cannot stage v3.88: target version already exists';
  end if;

  select count(*) into generic_filler_rule_count
  from public.pricing_rules
  where item_key = 'edible_flowers_filler'
    and item_type = 'edible_flowers_filler'
    and classification = 'support'
    and size is null
    and price = 5
    and category = 'support_element'
    and quantity_rule = 'per_piece'
    and merchant_id = genie_merchant_id
    and is_active = true;
  if generic_filler_rule_count <> 1 then
    raise exception 'Cannot stage v3.88: expected exactly one active generic ₱5 filler rule, found %', generic_filler_rule_count;
  end if;

  select count(*) into sized_filler_rule_count
  from public.pricing_rules
  where item_key in (
      'edible_flowers_filler_small',
      'edible_flowers_filler_medium',
      'edible_flowers_filler_large'
    )
    and merchant_id = genie_merchant_id
    and is_active = true;
  if sized_filler_rule_count <> 0 then
    raise exception 'Cannot stage v3.88: active sized filler rules already exist';
  end if;

  next_prompt := source_prompt;

  if position($v388_title_old$**v3.86 Version - Edible Leaf Support Normalization**

### CHANGELOG
- Normalize every discrete edible fondant/gumpaste leaf or foliage piece to a small `edible_2d_support` support row.$v388_title_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.88: title/changelog anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v388_title_old$**v3.86 Version - Edible Leaf Support Normalization**

### CHANGELOG
- Normalize every discrete edible fondant/gumpaste leaf or foliage piece to a small `edible_2d_support` support row.$v388_title_old$,
    $v388_title_new$**v3.88 Version - Sized Filler Flower Support Normalization**

### CHANGELOG
- Added a direct-diameter-sized, per-piece filler-flower type for small filler and baby's-breath flowers; every size band has the same per-piece price.
- Normalize every discrete edible fondant/gumpaste leaf or foliage piece to a small `edible_2d_support` support row.$v388_title_new$);

  if position($v388_leaf_anchor$edible leaf piece.$v388_leaf_anchor$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.88: leaf-normalization anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v388_leaf_anchor$edible leaf piece.$v388_leaf_anchor$,
    $v388_filler_block$edible leaf piece.

### FILLER FLOWER AND BABY'S-BREATH NORMALIZATION (BINDING)

A small, generic filler flower or any baby's-breath flower is always an
`edible_flowers_filler` row in `support_elements` with material
`edible_fondant`. Count every directly visible flower and group only matching
visible appearance and color. This includes small white filler flowers mixed
into floral arrangements, individual white baby's-breath flowers in a
cascading side spray, edible white filler flowers on a side, and edible white
and pink filler flowers on a top.

`edible_flowers_filler` must emit exactly one direct-diameter `size`: `small`,
`medium`, or `large`. Omit `size_line`, `bbox`, and `coverage` regardless of
the apparent physical scale or placement. It is never a main topper or
`edible_flowers`; its price remains ₱5 per visible flower in every size band.
This rule overrides ordinary-flower, intricate-flower, role, direct diameter,
and grouping rules. Do not use it for a distinct ordinary or intricate bloom
merely because that bloom is small.$v388_filler_block$);

  if position($v388_matrix_old$| Flat edible shape used as an accent | `edible_2d_support` | `edible_fondant` | support element | representative `direct diameter-relative size` |$v388_matrix_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.88: canonical matrix anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v388_matrix_old$| Flat edible shape used as an accent | `edible_2d_support` | `edible_fondant` | support element | representative `direct diameter-relative size` |$v388_matrix_old$,
    $v388_matrix_new$| Flat edible shape used as an accent | `edible_2d_support` | `edible_fondant` | support element | representative `direct diameter-relative size` |
| Small generic filler flower or any baby's-breath flower | `edible_flowers_filler` | `edible_fondant` | support element only | direct diameter-relative size; ₱5 per visible flower in every band |$v388_matrix_new$);

  if position($v388_flower_old$If a cake-member item is visibly a flower, blossom, rose, bud, daisy, orchid,
petal cluster, or floral accent, classify it as `edible_flowers` unless it is
clearly piped icing. A discrete edible leaf or foliage piece is never a flower
for this rule: apply `EDIBLE LEAF AND FOLIAGE NORMALIZATION` instead.$v388_flower_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.88: flower precedence anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v388_flower_old$If a cake-member item is visibly a flower, blossom, rose, bud, daisy, orchid,
petal cluster, or floral accent, classify it as `edible_flowers` unless it is
clearly piped icing. A discrete edible leaf or foliage piece is never a flower
for this rule: apply `EDIBLE LEAF AND FOLIAGE NORMALIZATION` instead.$v388_flower_old$,
    $v388_flower_new$If a cake-member item is visibly a flower, blossom, rose, bud, daisy, orchid,
petal cluster, or floral accent, classify it as `edible_flowers` unless it is
clearly piped icing. A discrete edible leaf or foliage piece is never a flower
for this rule: apply `EDIBLE LEAF AND FOLIAGE NORMALIZATION` instead.

Before applying this ordinary-flower rule, classify every small generic filler
flower and every baby's-breath flower as `edible_flowers_filler` in
`support_elements`, with material `edible_fondant`, its visible per-flower
quantity, one direct-diameter `size`, and no `size_line`, `bbox`, or `coverage`.$v388_flower_new$);

  if position($v388_intricate_old$do not merge intricate blooms with smaller support flowers.$v388_intricate_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.88: intricate-flower anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v388_intricate_old$do not merge intricate blooms with smaller support flowers.$v388_intricate_old$,
    $v388_intricate_new$do not merge intricate blooms with smaller support flowers.

Generic filler flowers and baby's-breath flowers are not merely excluded from
hero promotion: they must use `edible_flowers_filler` under `FILLER FLOWER AND
BABY'S-BREATH NORMALIZATION`.$v388_intricate_new$);

  if position($v388_support_old$- Ordinary/filler edible flowers (edible_flowers); focal or individually intricate flowers are hero/main toppers$v388_support_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.88: support-category anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v388_support_old$- Ordinary/filler edible flowers (edible_flowers); focal or individually intricate flowers are hero/main toppers$v388_support_old$,
    $v388_support_new$- Ordinary/filler edible flowers (edible_flowers); focal or individually intricate flowers are hero/main toppers
- Small generic filler flowers and all baby's-breath flowers (`edible_flowers_filler`, per visible flower, direct-diameter size)$v388_support_new$);

  if position($v388_support_enum_old$"type": "gumpaste_panel|gumpaste_bundle|edible_flowers|piped_flowers_side|isomalt|chocolates|marshmallows|edible_lollipops|edible_photo_side_wave|edible_photo_side|edible_photo_print|sprinkles|premium_sprinkles|macarons|meringue|edible_2d_support|edible_3d_ordinary|icing_decorations|edible_lego_bricks|icing_doodle|icing_doodle_intricate_side|icing_palette_knife|icing_brush_stroke|icing_splatter|icing_minimalist_spread|plastic_ball_regular|thin_fabric_ribbon_bows|satin_ribbon"$v388_support_enum_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.88: support enum anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v388_support_enum_old$"type": "gumpaste_panel|gumpaste_bundle|edible_flowers|piped_flowers_side|isomalt|chocolates|marshmallows|edible_lollipops|edible_photo_side_wave|edible_photo_side|edible_photo_print|sprinkles|premium_sprinkles|macarons|meringue|edible_2d_support|edible_3d_ordinary|icing_decorations|edible_lego_bricks|icing_doodle|icing_doodle_intricate_side|icing_palette_knife|icing_brush_stroke|icing_splatter|icing_minimalist_spread|plastic_ball_regular|thin_fabric_ribbon_bows|satin_ribbon"$v388_support_enum_old$,
    $v388_support_enum_new$"type": "gumpaste_panel|gumpaste_bundle|edible_flowers|edible_flowers_filler|piped_flowers_side|isomalt|chocolates|marshmallows|edible_lollipops|edible_photo_side_wave|edible_photo_side|edible_photo_print|sprinkles|premium_sprinkles|macarons|meringue|edible_2d_support|edible_3d_ordinary|icing_decorations|edible_lego_bricks|icing_doodle|icing_doodle_intricate_side|icing_palette_knife|icing_brush_stroke|icing_splatter|icing_minimalist_spread|plastic_ball_regular|thin_fabric_ribbon_bows|satin_ribbon"$v388_support_enum_new$);

  if position($v388_support_notes_old$| `edible_flowers` | edible_fondant | Count individual non-piped flowers, including fresh-looking and artificial flowers fulfilled as edible. Use main toppers only for visibly focal or individually intricate blooms; use support elements for ordinary accents or filler. Directly piped icing flowers follow the grouped coverage rule. |$v388_support_notes_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.88: edible-flowers note anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v388_support_notes_old$| `edible_flowers` | edible_fondant | Count individual non-piped flowers, including fresh-looking and artificial flowers fulfilled as edible. Use main toppers only for visibly focal or individually intricate blooms; use support elements for ordinary accents or filler. Directly piped icing flowers follow the grouped coverage rule. |$v388_support_notes_old$,
    $v388_support_notes_new$| `edible_flowers` | edible_fondant | Count individual non-piped flowers, including fresh-looking and artificial flowers fulfilled as edible. Use main toppers only for visibly focal or individually intricate blooms; use support elements for ordinary accents or filler. Directly piped icing flowers follow the grouped coverage rule. |
| `edible_flowers_filler` | edible_fondant | Every small generic filler flower and every baby's-breath flower. Support only; count each directly visible flower, group matching color/appearance, emit `size` as `small`, `medium`, or `large`, and omit `size_line`, `bbox`, and `coverage`. Its per-visible-flower price is ₱5 in every size band. Never use for a distinct ordinary or intricate bloom solely because it is small. |$v388_support_notes_new$);

  if position($v388_checklist_old$✅ Every discrete edible leaf/foliage piece = `edible_2d_support`, support, `small`$v388_checklist_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.88: final-checklist anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v388_checklist_old$✅ Every discrete edible leaf/foliage piece = `edible_2d_support`, support, `small`$v388_checklist_old$,
    $v388_checklist_new$✅ Every discrete edible leaf/foliage piece = `edible_2d_support`, support, `small`
✅ Every small generic filler or baby's-breath flower = `edible_flowers_filler`, support, per piece, direct-diameter size; ₱5 in every band$v388_checklist_new$);

  if position($v388_direct_size_old$✅ Application-owned direct diameter-anchor sizing; the model does not emit element sizes$v388_direct_size_old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.88: direct-size checklist anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $v388_direct_size_old$✅ Application-owned direct diameter-anchor sizing; the model does not emit element sizes$v388_direct_size_old$,
    $v388_direct_size_new$✅ Direct diameter-anchor sizing; emit one `small`, `medium`, or `large` size for every topper and support row$v388_direct_size_new$);

  if md5(next_prompt) <> v388_md5 then
    raise exception 'Cannot stage v3.88: assembled prompt checksum is unexpected';
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description)
  values (
    '3.88',
    next_prompt,
    false,
    'Small generic filler and baby’s-breath flowers are sized edible_flowers_filler support rows with the same ₱5 per-piece price in every size band.'
  );

  insert into public.pricing_rules (
    item_key, item_type, classification, size, description, price, category,
    quantity_rule, multiplier_rule, special_conditions, merchant_id, is_active
  ) values
    (
      'edible_flowers_filler_small', 'edible_flowers_filler', 'support', 'small',
      'Small filler and baby’s-breath edible flowers, priced per visible piece.',
      5, 'support_element', 'per_piece', null,
      '{"allowance_eligible": false}'::jsonb, genie_merchant_id, true
    ),
    (
      'edible_flowers_filler_medium', 'edible_flowers_filler', 'support', 'medium',
      'Medium filler and baby’s-breath edible flowers, priced per visible piece.',
      5, 'support_element', 'per_piece', null,
      '{"allowance_eligible": false}'::jsonb, genie_merchant_id, true
    ),
    (
      'edible_flowers_filler_large', 'edible_flowers_filler', 'support', 'large',
      'Large filler and baby’s-breath edible flowers, priced per visible piece.',
      5, 'support_element', 'per_piece', null,
      '{"allowance_eligible": false}'::jsonb, genie_merchant_id, true
    );
end;
$migration$;

commit;
