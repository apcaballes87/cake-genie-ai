-- Deploy v3.67 only after collapsing six-band pricing to small/medium/large.
-- This migration intentionally never updates cached analyses, carts, or orders.

begin;

do $migration$
declare
  source_prompt_version text;
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  legacy_rule_count integer;
  v366_md5 constant text := '0a3708bf78fb23c9f0020c09c2e6e40b';
  v367_md5 constant text := '4d49dc39935f23075a380111ef5d114f';
  v366_heading constant text := '**v3.66 Version - Composition Unit Before Itemization**';
  v367_heading constant text := '**v3.67 Version - Three-Band Sizing and Pricing Compatibility**';
begin
  select count(*) into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot deploy v3.67: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.67';

  if target_prompt_count > 0 then
    if target_prompt_count = 1
      and exists (
        select 1 from public.ai_prompts
        where version = '3.67' and is_active = true and md5(prompt_text) = v367_md5
      )
      and not exists (
        select 1 from public.pricing_rules
        where is_active = true and btrim(size) in ('tiny', 'xsmall', 'xlarge')
      ) then
      return;
    end if;
    raise exception 'Cannot deploy v3.67: an unexpected v3.67 prompt or legacy active pricing remains';
  end if;

  select version::text, prompt_text into source_prompt_version, source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if source_prompt_version <> '3.66'
    or md5(source_prompt) <> v366_md5
    or position(v366_heading in source_prompt) = 0 then
    raise exception 'Cannot deploy v3.67: active prompt must be verified v3.66 (%), found version % md5 %', v366_md5, source_prompt_version, md5(source_prompt);
  end if;

  -- Fixed-size/descriptive rules stay untouched. Only rows in a legacy band
  -- must have an exact suffix before they can be collapsed into a new key.
  if exists (
    select 1
    from public.pricing_rules
    where is_active = true
      and btrim(size) in ('tiny', 'xsmall', 'xlarge')
      and item_key !~* '_(tiny|xsmall|small|medium|large|xlarge)$'
  ) then
    raise exception 'Cannot deploy v3.67: active legacy-size pricing rule lacks an exact size-suffixed item_key';
  end if;

  create temporary table _three_band_families on commit drop as
  select
    merchant_id,
    category,
    item_type,
    regexp_replace(item_key, '_(tiny|xsmall|small|medium|large|xlarge)$', '', 'i') as key_prefix
  from public.pricing_rules
  where is_active = true
    and btrim(size) in ('tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge')
  group by merchant_id, category, item_type,
    regexp_replace(item_key, '_(tiny|xsmall|small|medium|large|xlarge)$', '', 'i')
  having bool_or(btrim(size) in ('tiny', 'xsmall', 'xlarge'));

  create temporary table _three_band_sources on commit drop as
  select
    rule.rule_id,
    rule.item_key,
    rule.item_type,
    rule.classification,
    rule.size,
    rule.coverage,
    rule.description,
    rule.price,
    rule.quantity_rule,
    rule.multiplier_rule,
    rule.special_conditions,
    rule.category,
    rule.sub_item_type,
    rule.merchant_id,
    btrim(rule.size) as source_size,
    regexp_replace(rule.item_key, '_(tiny|xsmall|small|medium|large|xlarge)$', '', 'i') as key_prefix
  from public.pricing_rules as rule
  join _three_band_families as family
    on family.merchant_id is not distinct from rule.merchant_id
   and family.category is not distinct from rule.category
   and family.item_type = rule.item_type
   and family.key_prefix = regexp_replace(rule.item_key, '_(tiny|xsmall|small|medium|large|xlarge)$', '', 'i')
  where rule.is_active = true
    and btrim(rule.size) in ('tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge');

  create temporary table _three_band_targets on commit drop as
  select
    family.merchant_id,
    family.category,
    family.item_type,
    family.key_prefix,
    mapping.canonical_size,
    mapping.high_source_size
  from _three_band_families as family
  cross join (
    values
      ('small'::text, 'tiny'::text, 'xsmall'::text),
      ('medium'::text, 'small'::text, 'medium'::text),
      ('large'::text, 'large'::text, 'xlarge'::text)
  ) as mapping(canonical_size, low_source_size, high_source_size)
  where exists (
    select 1
    from _three_band_sources as source
    where source.merchant_id is not distinct from family.merchant_id
      and source.category is not distinct from family.category
      and source.item_type = family.item_type
      and source.key_prefix = family.key_prefix
      and source.source_size in (mapping.low_source_size, mapping.high_source_size)
  );

  -- A merchant may omit the higher band only when the same global family has
  -- it. In that case no merchant canonical rule is inserted, so normal global
  -- fallback remains authoritative instead of freezing a copied global price.
  if exists (
    select 1
    from _three_band_targets as target
    where not exists (
      select 1 from _three_band_sources as local_source
      where local_source.merchant_id is not distinct from target.merchant_id
        and local_source.category is not distinct from target.category
        and local_source.item_type = target.item_type
        and local_source.key_prefix = target.key_prefix
        and local_source.source_size = target.high_source_size
    )
    and (
      target.merchant_id is null
      or not exists (
        select 1 from _three_band_sources as global_source
        where global_source.merchant_id is null
          and global_source.category is not distinct from target.category
          and global_source.item_type = target.item_type
          and global_source.key_prefix = target.key_prefix
          and global_source.source_size = target.high_source_size
      )
    )
  ) then
    raise exception 'Cannot deploy v3.67: a required canonical price band has no higher-band local or global source';
  end if;

  create temporary table _three_band_outputs on commit drop as
  select
    target.canonical_size,
    source.item_type,
    source.classification,
    source.coverage,
    source.description,
    source.price,
    source.quantity_rule,
    source.multiplier_rule,
    source.special_conditions,
    source.category,
    source.sub_item_type,
    source.merchant_id,
    source.key_prefix
  from _three_band_targets as target
  join _three_band_sources as source
    on source.merchant_id is not distinct from target.merchant_id
   and source.category is not distinct from target.category
   and source.item_type = target.item_type
   and source.key_prefix = target.key_prefix
   and source.source_size = target.high_source_size;

  update public.pricing_rules
  set is_active = false,
      updated_at = now()
  where rule_id in (select rule_id from _three_band_sources);

  insert into public.pricing_rules (
    item_key,
    item_type,
    classification,
    size,
    coverage,
    description,
    price,
    is_active,
    quantity_rule,
    multiplier_rule,
    special_conditions,
    category,
    sub_item_type,
    merchant_id
  )
  select
    key_prefix || '_' || canonical_size,
    item_type,
    classification,
    canonical_size,
    coverage,
    description,
    price,
    true,
    quantity_rule,
    multiplier_rule,
    special_conditions,
    category,
    sub_item_type,
    merchant_id
  from _three_band_outputs;

  select count(*) into legacy_rule_count
  from public.pricing_rules
  where is_active = true
    and btrim(size) in ('tiny', 'xsmall', 'xlarge');

  if legacy_rule_count <> 0 then
    raise exception 'Cannot deploy v3.67: % active legacy size rules remain after collapse', legacy_rule_count;
  end if;

  next_prompt := source_prompt;
  next_prompt := replace(next_prompt, v366_heading, v367_heading);
  next_prompt := replace(next_prompt,
    '| Fondant/gumpaste flower | `edible_flowers` | `edible_fondant` | support for tiny/xsmall/small; main for medium or larger | C3 |',
    '| Fondant/gumpaste flower | `edible_flowers` | `edible_fondant` | `small` is support; `medium`/`large` are main toppers | C3 |');
  next_prompt := replace(next_prompt,
    $old$| `tiny` | under 10% |
| `xsmall` | 10% to under 20% |
| `small` | 20% to under 35% |
| `medium` | 35% to under 50% |
| `large` | 50% to under 75% |
| `xlarge` | 75% or greater |$old$,
    $new$| `small` | under 20% |
| `medium` | 20% to under 50% |
| `large` | 50% or greater |$new$);
  next_prompt := replace(next_prompt,
    $old$Before applying the generic SPHERE CHECK, classify any **tiny or xsmall,
scattered or repeated** sugar pearls, sugar beads, pearl beads, nonpareils, or
other sprinkle-scale round decorations as exactly one `support_elements` item
with `type: "sprinkles"`, `material: "candy"`, and `quantity: 1` for the
overall scatter application. This is a fulfillment classification override:$old$,
    $new$Before applying the generic SPHERE CHECK, classify any **tiny,
scattered or repeated** sugar pearls, sugar beads, pearl beads, nonpareils, or
other sprinkle-scale round decorations as exactly one `support_elements` item
with `type: "sprinkles"`, `material: "candy"`, and `quantity: 1` for the
overall scatter application and emitted `size: "small"`. This is a fulfillment classification override:$new$);
  next_prompt := replace(next_prompt,
    $old$Flower placement: `edible_flowers` blooms sized `tiny`, `xsmall`, or `small`
are always emitted in `support_elements` at every size, mirroring
`edible_2d_support`; the hero criteria never promote them to `main_toppers`.
Only `medium`, `large`, or `xlarge` blooms may appear in `main_toppers`.$old$,
    $new$Flower placement: `edible_flowers` blooms sized `small` are always emitted in
`support_elements`, mirroring `edible_2d_support`; the hero criteria never
promote them to `main_toppers`. Only `medium` or `large` blooms may appear in
`main_toppers`.$new$);
  next_prompt := replace(next_prompt,
    'support rules. Tiny/xsmall scattered or repeated sugar pearls, sugar beads,',
    'support rules. Tiny scattered or repeated sugar pearls, sugar beads,');
  next_prompt := replace(next_prompt,
    'Eyes and nose are usually `tiny` or `small`; tongue can be `small` or `medium`; bow can be `small` or `medium`.',
    'Eyes and nose are usually `small`; tongue can be `small` or `medium`; bow can be `small` or `medium`.');
  next_prompt := replace(next_prompt,
    '# UNIFIED SIZING FRAMEWORK v1.0 FOR TOPPER SIZES',
    '# UNIFIED SIZING FRAMEWORK v3.67 FOR TOPPER SIZES');
  next_prompt := replace(next_prompt,
    $old$The general C1-C5 families share one six-band ratio scale, but each family uses
a different primary measurement axis: figure height, flat-topper longest
dimension, flower diameter, sphere diameter, or flat-support longest
dimension. C2A artwork, toys, candles, and panels retain their dedicated
threshold tables. **Always use the correct measurement axis and the correct
table for the final type.**$old$,
    $new$All sizing output uses only `small`, `medium`, or `large`. C1, C2, C4, and C5
share one three-band ratio scale; C3 flower diameter, C2A artwork surface span,
toys, candles, and panels retain their dedicated threshold tables. **Always use
the correct measurement axis and the correct table for the final type.**$new$);
  next_prompt := replace(next_prompt,
    $old$| `tiny` | under 0.10 |
| `xsmall` | 0.10 to under 0.50 |
| `small` | 0.50 to under 0.80 |
| `medium` | 0.80 to under 1.10 |
| `large` | 1.10 to under 1.40 |
| `xlarge` | 1.40 or greater |

Miniature molded army men, miniature soldiers, and similarly scaled mini action
figures that are each at least 0.10 and less than 0.50 of the reference-tier
height are `xsmall`, even when many pieces together form a prominent scene.
Toys below 0.10 remain `tiny`.$old$,
    $new$| `small` | under 0.50 |
| `medium` | 0.50 to under 1.10 |
| `large` | 1.10 or greater |

Miniature molded army men, miniature soldiers, and similarly scaled mini action
figures below 0.50 of the reference-tier height are `small`, even when many
pieces together form a prominent scene.$new$);
  next_prompt := replace(next_prompt,
    $old$| `tiny` | **< 0.10** | looks like a small pearl or beads on the tier |
| `xsmall` | **0.10 to < 0.30** | Barely noticeable accent, smaller than a golf ball on the tier |
| `small` | **0.30 to < 0.50** | Clearly visible but not dominant; a small animal head or mini figurine |
| `medium` | **0.50 to < 0.90** | Prominent — a full animal figure, character, or fist-sized topper |
| `large` | **0.90 to < 1.20** | Dominates the tier or extends slightly above the cake top |
| `xlarge` | **≥ 1.20** | Dominates the tier or extends far above the cake top |

**Removal test:** If this figure were removed, would there be a **large obvious gap**? → `medium`, `large`, or `xlarge`. A **small gap**? → `tiny`, `xsmall`, or `small`.$old$,
    $new$| `small` | **< 0.30** | Accent or small figure, including a tiny visible decoration |
| `medium` | **0.30 to < 0.90** | Prominent figure, character, or fist-sized topper |
| `large` | **≥ 0.90** | Dominates the tier or extends above the cake top |

**Removal test:** If this figure were removed, would there be a **large obvious gap**? → `medium` or `large`. A **small gap**? → `small`.$new$);
  next_prompt := replace(next_prompt,
    'Flat toppers use the same canonical six ratio bands as C1, but PD is the',
    'Flat toppers use the same canonical three ratio bands as C1, but PD is the');
  next_prompt := replace(next_prompt,
    $old$| `tiny` | **< 0.10** | coins size tiny cutout |
| `xsmall` | **0.10 to < 0.30** | Mini flag, super small, small printed accent |
| `small` | **0.30 to < 0.40** | Small character cutout, printed number, photo |
| `medium` | **0.40 to < 0.80** | Prominent standee, character display, banner |
| `large` | **0.80 to < 1.20** | Almost as tall as the tier itself or a little taller, dominant backdrop piece |
| `xlarge` | **≥ 1.20** | Much taller than the tier itself and possibly bigger than the cake |$old$,
    $new$| `small` | **< 0.30** | Small printed accent or cutout |
| `medium` | **0.30 to < 0.90** | Prominent standee, character display, banner |
| `large` | **≥ 0.90** | Dominant backdrop piece |$new$);
  next_prompt := replace(next_prompt,
    $old$| `tiny` | **< 0.10** | Rosette, bud, or tiny filler (piped icing rosette size) |
| `xsmall` | **0.10 to < 0.30** | Smaller than the standard individual flower, coin-sized daisy |
| `small` | **0.30 to < 0.50** | Standard individual flower, small rose or daisy |
| `medium` | **0.50 to < 0.80** | Full bloom — garden rose, open peony, sunflower |
| `large` | **0.80 to < 1.00** | Big statement flower, covers a large area of the tier |
| `xlarge` | **≥ 1.00** | Oversized flower, covers almost all of the tier area |$old$,
    $new$| `small` | **< 0.30** | Rosette, bud, tiny filler, or coin-sized daisy |
| `medium` | **0.30 to < 0.80** | Full bloom — garden rose, open peony, sunflower |
| `large` | **≥ 0.80** | Big statement or oversized flower |$new$);
  next_prompt := replace(next_prompt,
    $old$| `tiny` | **< 0.10** | Pearl, small sugar bead |
| `xsmall` | **0.10 to < 0.30** | Small to big coin |
| `small` | **0.30 to < 0.50** | Big coin to ping-pong ball |
| `medium` | **0.50 to < 0.90** | Tennis-ball equivalent on the cake |
| `large` | **0.90 to < 1.20** | Large decorative sphere, dominates the space |
| `xlarge` | **≥ 1.20** | Very large decorative sphere, as big as the cake |$old$,
    $new$| `small` | **< 0.30** | Pearl, sugar bead, or small sphere |
| `medium` | **0.30 to < 0.90** | Big coin to tennis-ball equivalent |
| `large` | **≥ 0.90** | Large decorative sphere that dominates the space |$new$);
  next_prompt := replace(next_prompt,
    $old$| `tiny` | **< 0.10** | Confetti dots, mini stars, sprinkle-scale items |
| `xsmall` | **0.10 to < 0.30** | Visible flat shapes — extra small |
| `small` | **0.30 to < 0.50** | Visible flat shapes — small stars, hearts, leaves |
| `medium` | **0.50 to < 0.90** | Medium flat shapes on the cake side or top |
| `large` | **0.90 to < 1.20** | Large flat supporting accent |
| `xlarge` | **≥ 1.20** | Oversized flat supporting accent |$old$,
    $new$| `small` | **< 0.30** | Confetti dots, mini stars, and small flat shapes |
| `medium` | **0.30 to < 0.90** | Medium flat shapes on the cake side or top |
| `large` | **≥ 0.90** | Large or oversized flat supporting accent |$new$);
  next_prompt := replace(next_prompt,
    $old$| `tiny` | **< 0.15** | Short stubby number candle |
| `small` | **0.15 to < 0.35** | Standard birthday candles |
| `medium` | **0.35 to < 0.60** | Tall taper candles |
| `large` | **≥ 0.60** | Extra-long decorative candles |$old$,
    $new$| `small` | **< 0.15** | Short stubby number candle |
| `medium` | **0.15 to < 0.60** | Standard birthday or tall taper candle |
| `large` | **≥ 0.60** | Extra-long decorative candle |$new$);
  next_prompt := replace(next_prompt,
    $old$| Family | `tiny` | `xsmall` | `small` | `medium` | `large` | `xlarge` |
|--------|--------|----------|---------|----------|---------|----------|
| C1 edible 3D | <0.10 | 0.10 to <0.30 | 0.30 to <0.50 | 0.50 to <0.90 | 0.90 to <1.20 | ≥1.20 |
| C2 flat toppers | <0.10 | 0.10 to <0.30 | 0.30 to <0.50 | 0.50 to <0.90 | 0.90 to <1.20 | ≥1.20 |
| C3 flowers | <0.10 | 0.10 to <0.30 | 0.30 to <0.50 | 0.50 to <0.80 | 0.80 to <1.00 | ≥1.00 |
| C4 spheres/balls | <0.10 | 0.10 to <0.30 | 0.30 to <0.50 | 0.50 to <0.90 | 0.90 to <1.20 | ≥1.20 |
| C5 edible 2D support | <0.10 | 0.10 to <0.30 | 0.30 to <0.50 | 0.50 to <0.90 | 0.90 to <1.20 | ≥1.20 |

Special tables remain authoritative: C2A uses surface-span percentages, toys
use the toy-specific six bands, C6 candles use four height bands, and C7$old$,
    $new$| Family | `small` | `medium` | `large` |
|--------|---------|----------|---------|
| C1 edible 3D | <0.30 | 0.30 to <0.90 | ≥0.90 |
| C2 flat toppers | <0.30 | 0.30 to <0.90 | ≥0.90 |
| C3 flowers | <0.30 | 0.30 to <0.80 | ≥0.80 |
| C4 spheres/balls | <0.30 | 0.30 to <0.90 | ≥0.90 |
| C5 edible 2D support | <0.30 | 0.30 to <0.90 | ≥0.90 |

Special tables remain authoritative: C2A uses surface-span percentages, toys
use their three bands, C6 candles use three height bands, and C7$new$);
  next_prompt := replace(next_prompt, '"size": "tiny|xsmall|small|medium|large|xlarge"', '"size": "small|medium|large"');
  next_prompt := replace(next_prompt,
    '- tiny, xsmall, and small sized edible flowers (edible_flowers)',
    '- small edible flowers (edible_flowers); medium and large flowers are hero/main toppers');
  next_prompt := replace(next_prompt,
    '| `edible_flowers` | edible_fondant | Count individual flowers. Sizes: tiny, xsmall, small, medium, large, xlarge. tiny/xsmall/small = always support |',
    '| `edible_flowers` | edible_fondant | Count individual flowers. `small` = support; `medium`/`large` = hero main toppers |');
  next_prompt := replace(next_prompt,
    '| `chocolates` | candy | subtype: "ferrero", "oreo", "kisses", "m&ms"; coverage: tiny/small/medium/large |',
    '| `chocolates` | candy | subtype: "ferrero", "oreo", "kisses", "m&ms"; coverage: small/medium/large |');
  next_prompt := replace(next_prompt,
    '| `edible_photo_side` | waferpaper | Full edible image side panel or wrap covering a cake side. Size by side coverage: tiny (narrow strip), small (<40%), medium (40% to <80%), large (≥80%). Use quantity 1 per covered side region |',
    '| `edible_photo_side` | waferpaper | Full edible image side panel or wrap covering a cake side. Size by side coverage: small (<40%, including a narrow strip), medium (40% to <80%), large (≥80%). Use quantity 1 per covered side region |');
  next_prompt := replace(next_prompt,
    '| `sprinkles` | candy | Normal sprinkles, including long rainbow/colored sprinkles, single-color sprinkles, and every tiny/xsmall scattered or repeated sugar pearl, sugar bead, pearl bead, or nonpareil. Use quantity 1 for one overall scatter application. |',
    '| `sprinkles` | candy | Normal sprinkles, including long rainbow/colored sprinkles, single-color sprinkles, and every tiny scattered or repeated sugar pearl, sugar bead, pearl bead, or nonpareil. Emit the scatter application as `small`; use quantity 1. |');
  next_prompt := replace(next_prompt,
    '| `edible_2d_support` | edible_fondant | Flat 2D gumpaste shapes (stars, dots, confetti, leaves) in any six-band size. Always support; count and price per piece |',
    '| `edible_2d_support` | edible_fondant | Flat 2D gumpaste shapes (stars, dots, confetti, leaves) in any small/medium/large size. Always support; count and price per piece |');
  next_prompt := replace(next_prompt,
    '| `icing_decorations` | icing | Piped icing elements such as dots, rosettes, swirls, and borders. Piped icing dots on the sides covering less than 50% of the icing surface are icing decorations, not candy sprinkles. Usually tiny/small at the top, sides, or base. |',
    '| `icing_decorations` | icing | Piped icing elements such as dots, rosettes, swirls, and borders. Piped icing dots on the sides covering less than 50% of the icing surface are icing decorations, not candy sprinkles. Usually `small` at the top, sides, or base. |');
  next_prompt := replace(next_prompt, '"size": "xlarge",', '"size": "large",');
  next_prompt := replace(next_prompt, '"size": "xsmall",', '"size": "small",');
  next_prompt := replace(next_prompt,
    '- Simple fondant stars around → `edible_2d_support`, `tiny`, support',
    '- Simple fondant stars around → `edible_2d_support`, `small`, support');
  next_prompt := replace(next_prompt,
    '- Example: 5 tiny stars in a cluster → each star is `tiny`, quantity = 5. Do NOT call the cluster `medium`.',
    '- Example: 5 tiny stars in a cluster → each star is `small`, quantity = 5. Do NOT call the cluster `medium`.');

  if md5(next_prompt) <> v367_md5
    or position(v367_heading in next_prompt) = 0
    or position('"size": "small|medium|large"' in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.67: assembled prompt does not match the verified v3.67 fallback';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.67',
    next_prompt,
    true,
    'v3.67 — Collapse AI sizing and price rules to small, medium, and large using the former higher source band.',
    now()
  );
end;
$migration$;

commit;
