-- Stage v3.91 without changing the verified v3.90 prompt, cache rows, or pricing.
begin;

do $migration$
declare
  active_count integer;
  source_version text;
  source_prompt text;
  next_prompt text;
  v390_md5 constant text := 'ac7f65da35135d3d4e42e90b7c82e655';
  v391_md5 constant text := 'fede0545b650c86737631e714bd918ee';
begin
  lock table public.ai_prompts in share row exclusive mode;

  select count(*) into active_count
  from public.ai_prompts
  where is_active = true;
  if active_count <> 1 then
    raise exception 'Cannot stage v3.91: expected exactly one active prompt, found %', active_count;
  end if;

  select version, prompt_text into source_version, source_prompt
  from public.ai_prompts
  where is_active = true;
  if source_version <> '3.90' or md5(source_prompt) <> v390_md5 then
    raise exception 'Cannot stage v3.91: verified active v3.90 source is required';
  end if;

  if exists (select 1 from public.ai_prompts where version = '3.91') then
    raise exception 'Cannot stage v3.91: target version already exists';
  end if;

  next_prompt := source_prompt;

  if position($old$**v3.90 Version - Piped Botanical Construction and Soft-Icing Evidence**$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: version-title anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$**v3.90 Version - Piped Botanical Construction and Soft-Icing Evidence**$old$,
    $new$**v3.91 Version - One-Color Object and Flat-Flower Gates**$new$);

  if position($old$- Normalize every discrete edible fondant/gumpaste leaf or foliage piece to a small `edible_2d_support` support row.$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: changelog anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$- Normalize every discrete edible fondant/gumpaste leaf or foliage piece to a small `edible_2d_support` support row.$old$,
    $new$- Normalize every discrete edible fondant/gumpaste leaf or foliage piece to a small `edible_2d_support` support row.
- A one-color, non-character edible 3D object—including a standalone fondant/gumpaste dress or garment—cannot be `edible_3d_complex`; it remains `edible_3d_ordinary` unless direct image evidence proves a complete human or animal figure.
- A non-piped fondant/gumpaste flower without direct modeled bloom depth is a flat edible shape, not `edible_flowers`.$new$);

  if position($old$The nearest non-qualifying construction is a separately placed
fondant/gumpaste botanical piece: smooth or thick matte petals/leaves, visibly
cut, molded, or sculpted edges, a self-contained body, or a clear
separation/shadow from the iced surface. Only those separate pieces use
`edible_flowers` or `edible_2d_support` with `material: "edible_fondant"`.
If there are no piped flowers, a non-floral piped foliage border remains
`icing_decorations` rather than a piped-flower row.

This construction gate is before and overrides ordinary-flower,
filler-flower, and edible-leaf normalization. It does not change a separate
fondant/gumpaste botanical piece into icing merely because it is next to piped
icing.$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: flat-flower construction anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$The nearest non-qualifying construction is a separately placed
fondant/gumpaste botanical piece: smooth or thick matte petals/leaves, visibly
cut, molded, or sculpted edges, a self-contained body, or a clear
separation/shadow from the iced surface. Only those separate pieces use
`edible_flowers` or `edible_2d_support` with `material: "edible_fondant"`.
If there are no piped flowers, a non-floral piped foliage border remains
`icing_decorations` rather than a piped-flower row.

This construction gate is before and overrides ordinary-flower,
filler-flower, and edible-leaf normalization. It does not change a separate
fondant/gumpaste botanical piece into icing merely because it is next to piped
icing.$old$,
    $new$The nearest non-qualifying construction is a separately placed
fondant/gumpaste botanical piece: smooth or thick matte petals/leaves, visibly
cut, molded, or sculpted edges, a self-contained body, or a clear
separation/shadow from the iced surface. Apply the flat-flower depth gate to a
separate flower before choosing `edible_flowers`; separate leaves use
`edible_2d_support` with `material: "edible_fondant"`.
If there are no piped flowers, a non-floral piped foliage border remains
`icing_decorations` rather than a piped-flower row.

This construction gate is before and overrides ordinary-flower,
filler-flower, and edible-leaf normalization. It does not change a separate
fondant/gumpaste botanical piece into icing merely because it is next to piped
icing.

### FLAT EDIBLE FLOWER DEPTH GATE (BINDING)

After `PIPED BOTANICAL TREATMENT — CONSTRUCTION PRECEDENCE` has failed,
classify a non-piped flower by direct bloom depth. Use `edible_flowers` only
when the image shows an independently modeled, cupped, layered, or sculpted
bloom with visible petal side surfaces and a self-contained 3D flower body.

When petals are planar, thin, cut, stamped, flat-backed, or shallow-relief,
the flower is a flat edible shape—not `edible_flowers`—even if it has a yellow
center, several petal layers, a natural flower name, or a slight cast shadow.
Use `edible_2d_shapes` for a focal flat flower or a focal group on the top;
use `edible_2d_support` for non-focal flat flower accents on the side or among
other support decoration. Keep `material: "edible_fondant"`, count the direct
visible flat flowers, and group only matching visible appearance and color.

A flat daisy with a yellow center is `edible_2d_shapes` when it is a focal top
motif. Do not infer modeled bloom depth from theme, color, flower identity, or
an unsupported description. This gate does not replace the dedicated
`edible_flowers_filler` normalization for small generic filler flowers and
baby's-breath after their named rule applies.$new$);

  if position($old$- every flower-shaped decoration, including fresh-looking, natural, silk,
  cloth, fabric-textured, artificial, or realistic flowers ->
  `edible_flowers`, material `edible_fondant`; this named flower fulfillment
  override wins over visible fabric cues. Directly piped icing flowers use
  `piped_flowers_top` or `piped_flowers_side`, material `icing`, under the
  grouped coverage rule$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: flower-normalization anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$- every flower-shaped decoration, including fresh-looking, natural, silk,
  cloth, fabric-textured, artificial, or realistic flowers ->
  `edible_flowers`, material `edible_fondant`; this named flower fulfillment
  override wins over visible fabric cues. Directly piped icing flowers use
  `piped_flowers_top` or `piped_flowers_side`, material `icing`, under the
  grouped coverage rule$old$,
    $new$- every visibly three-dimensional flower-shaped decoration, including
  fresh-looking, natural, silk, cloth, fabric-textured, artificial, or realistic
  flowers -> `edible_flowers`, material `edible_fondant`; this named flower
  fulfillment override wins over visible fabric cues. A flat flower motif
  instead follows `FLAT EDIBLE FLOWER DEPTH GATE`. Directly piped icing flowers
  use `piped_flowers_top` or `piped_flowers_side`, material `icing`, under the
  grouped coverage rule$new$);

  if position($old$| Fondant/gumpaste flower | `edible_flowers` | `edible_fondant` | intricate/focal: main; otherwise support | representative `direct diameter-relative size` |$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: flower-matrix anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$| Fondant/gumpaste flower | `edible_flowers` | `edible_fondant` | intricate/focal: main; otherwise support | representative `direct diameter-relative size` |$old$,
    $new$| Visibly 3D fondant/gumpaste flower with modeled bloom depth | `edible_flowers` | `edible_fondant` | intricate/focal: main; otherwise support | representative `direct diameter-relative size` |
| Flat fondant/gumpaste flower cutout or shallow-relief motif | `edible_2d_shapes` / `edible_2d_support` | `edible_fondant` | focal main / non-focal support | representative `direct diameter-relative size` |$new$);

  if position($old$- Never output the type `artificial_flowers`; it exists only for legacy rows.
  Every cake-member flower that fails the construction gate is `edible_flowers`
  under this override. Piped botanical treatments use the grouped top/side
  coverage rule below.$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: flower-protocol anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$- Never output the type `artificial_flowers`; it exists only for legacy rows.
  Every cake-member flower that fails the construction gate is `edible_flowers`
  under this override. Piped botanical treatments use the grouped top/side
  coverage rule below.$old$,
    $new$- Never output the type `artificial_flowers`; it exists only for legacy rows.
  Every cake-member flower that fails the piped construction gate must next
  pass `FLAT EDIBLE FLOWER DEPTH GATE` before it may be `edible_flowers` under
  this override. Piped botanical treatments use the grouped top/side coverage
  rule below.$new$);

  if position($old$This rule overrides ordinary-flower, filler-flower, and edible-leaf
normalization for directly piped botanicals only. Separate molded, cut,
sculpted, or thick matte fondant/gumpaste petals and leaves—with a
self-contained body or clear separation/shadow from the iced surface—remain
`edible_flowers` or `edible_2d_support` with `material: "edible_fondant"`.$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: piped-flower depth anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$This rule overrides ordinary-flower, filler-flower, and edible-leaf
normalization for directly piped botanicals only. Separate molded, cut,
sculpted, or thick matte fondant/gumpaste petals and leaves—with a
self-contained body or clear separation/shadow from the iced surface—remain
`edible_flowers` or `edible_2d_support` with `material: "edible_fondant"`.$old$,
    $new$This rule overrides ordinary-flower, filler-flower, and edible-leaf
normalization for directly piped botanicals only. A separate modeled, cupped,
layered, sculpted, or thick matte fondant/gumpaste bloom with visible petal
side surfaces remains `edible_flowers`; a separate flat cut, stamped,
flat-backed, or shallow-relief flower follows `FLAT EDIBLE FLOWER DEPTH GATE`.
Separate leaves remain `edible_2d_support`, all with material
`edible_fondant`.$new$);

  if position($old$Before applying this rule, apply `PIPED BOTANICAL TREATMENT — CONSTRUCTION
PRECEDENCE`. If a cake-member item is visibly a flower, blossom, rose, bud,
daisy, orchid, petal cluster, or floral accent and fails that gate, classify it
as `edible_flowers`. A discrete edible leaf or foliage piece is never a flower
for this rule: apply `EDIBLE LEAF AND FOLIAGE NORMALIZATION` instead.$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: flower-type precedence anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$Before applying this rule, apply `PIPED BOTANICAL TREATMENT — CONSTRUCTION
PRECEDENCE`. If a cake-member item is visibly a flower, blossom, rose, bud,
daisy, orchid, petal cluster, or floral accent and fails that gate, classify it
as `edible_flowers`. A discrete edible leaf or foliage piece is never a flower
for this rule: apply `EDIBLE LEAF AND FOLIAGE NORMALIZATION` instead.$old$,
    $new$Before applying this rule, apply `PIPED BOTANICAL TREATMENT — CONSTRUCTION
PRECEDENCE` and `FLAT EDIBLE FLOWER DEPTH GATE`. If a cake-member item is a
visibly three-dimensional flower, blossom, rose, bud, daisy, orchid, petal
cluster, or floral accent after both gates, classify it as `edible_flowers`.
A flat flower uses `edible_2d_shapes` or `edible_2d_support` by role. A
discrete edible leaf or foliage piece is never a flower for this rule: apply
`EDIBLE LEAF AND FOLIAGE NORMALIZATION` instead.$new$);

  if position($old$- small gold fondant flowers on a mahjong cake -> `edible_flowers`
- simple molded rose -> `edible_flowers`
- tiny fondant blossoms -> `edible_flowers`$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: flower examples anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$- small gold fondant flowers on a mahjong cake -> `edible_flowers`
- simple molded rose -> `edible_flowers`
- tiny fondant blossoms -> `edible_flowers`$old$,
    $new$- small gold modeled fondant flowers with visible petal sidewalls on a mahjong cake -> `edible_flowers`
- simple molded rose with visible bloom depth -> `edible_flowers`
- flat fondant daisy cutouts -> `edible_2d_shapes` when focal, otherwise `edible_2d_support`$new$);

  if position($old$- Do NOT include flowers here; use `edible_flowers`$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: ordinary-3d flower anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$- Do NOT include flowers here; use `edible_flowers`$old$,
    $new$- Do NOT include flowers here; use `edible_flowers` for visibly 3D blooms and
  `edible_2d_shapes` / `edible_2d_support` for flat flower motifs$new$);

  if position($old$- Ordinary/filler edible flowers (edible_flowers); focal or individually intricate flowers are hero/main toppers$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: support-flower summary anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$- Ordinary/filler edible flowers (edible_flowers); focal or individually intricate flowers are hero/main toppers$old$,
    $new$- Ordinary/filler 3D edible flowers (`edible_flowers`); focal or individually intricate 3D flowers are hero/main toppers. Non-focal flat flower accents are `edible_2d_support`.$new$);

  if position($old$| `edible_flowers` | edible_fondant | Count individual non-piped flowers, including fresh-looking and artificial flowers fulfilled as edible. Use main toppers only for visibly focal or individually intricate blooms; use support elements for ordinary accents or filler. Directly piped icing flowers follow the grouped coverage rule. |$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: support-flower table anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$| `edible_flowers` | edible_fondant | Count individual non-piped flowers, including fresh-looking and artificial flowers fulfilled as edible. Use main toppers only for visibly focal or individually intricate blooms; use support elements for ordinary accents or filler. Directly piped icing flowers follow the grouped coverage rule. |$old$,
    $new$| `edible_flowers` | edible_fondant | Count individual non-piped flowers only when direct image evidence shows modeled 3D bloom depth. Use main toppers only for visibly focal or individually intricate blooms; use support elements for ordinary accents or filler. Flat flower motifs use `edible_2d_shapes` or `edible_2d_support` by role. Directly piped icing flowers follow the grouped coverage rule. |$new$);

  if position($old$- Fondant flowers → `edible_flowers`, grouped by visible identity and appearance$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: unicorn-flower example anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$- Fondant flowers → `edible_flowers`, grouped by visible identity and appearance$old$,
    $new$- Visibly 3D fondant flowers → `edible_flowers`, grouped by visible identity and appearance; flat fondant flower motifs → `edible_2d_shapes` or `edible_2d_support` by role$new$);

  if position($old$#### FREESTANDING FIGURE PLACEMENT OVERRIDE (REQUIRED)$old$ in next_prompt) = 0 then
    raise exception 'Cannot stage v3.91: complex-figure placement anchor is missing';
  end if;
  next_prompt := replace(next_prompt,
    $old$#### FREESTANDING FIGURE PLACEMENT OVERRIDE (REQUIRED)$old$,
    $new$#### ONE-COLOR NON-CHARACTER OBJECT GATE (BINDING)

For a non-character edible 3D object, one visibly distinct color is a
disqualifier for `edible_3d_complex`. Use `edible_3d_ordinary` when direct
image evidence shows a one-color molded object, even if it has ruffles, folds,
flowing fabric, surface texture, or an occasion-specific theme. Multiple colors
are not by themselves enough to establish complexity.

A standalone fondant/gumpaste dress, gown, skirt, shirt, robe, or similar
garment is a non-character object unless the image visibly shows it attached to
a complete freestanding human/character figure with recognizable anatomy such
as a head, torso, arms, legs, face, or pose. Do not infer a bride, person, or
figurine from a bridal/wedding theme, nearby text, a topper name, or a flowing
dress description. A one-color standalone garment MUST be
`edible_3d_ordinary`, never `edible_3d_complex`.

This gate does not downgrade a genuinely complete freestanding human or animal
figure with visible all-around depth and modeled anatomy. Those figure rules
remain governed by their positive anatomy, expression, clothing, and pose
evidence; color alone neither promotes nor downgrades them.

#### FREESTANDING FIGURE PLACEMENT OVERRIDE (REQUIRED)$new$);

  if md5(next_prompt) <> v391_md5 then
    raise exception 'Cannot stage v3.91: assembled prompt checksum is unexpected';
  end if;

  insert into public.ai_prompts (version, prompt_text, is_active, description)
  values (
    '3.91',
    next_prompt,
    false,
    'One-color non-character object and flat-flower depth gates; standalone garments and flat flower motifs remain ordinary/2D unless direct construction evidence qualifies them.'
  );
end;
$migration$;

commit;
