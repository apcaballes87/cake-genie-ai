begin;

do $$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  global_flower_rule constant text := $global$- fresh or natural-looking flowers -> `edible_flowers`, material
  `edible_fondant`, unless visible piping cues require `icing_decorations`
  with material `icing` or visible fabric cues require `artificial_flowers`$global$;
  replacement_global_flower_rule constant text := $replacement_global$- every flower-shaped decoration, including fresh-looking, natural, silk,
  cloth, fabric-textured, artificial, or realistic flowers ->
  `edible_flowers`, material `edible_fondant`; this named flower fulfillment
  override wins over visible fabric cues. Only an actual piped buttercream
  rosette with visible piping ridges and soft peaks uses
  `icing_decorations`, material `icing`$replacement_global$;
  flower_protocol constant text := $protocol$### Protocol 4: THE "FLOWER" CHECK (Edible Flower Safety Rule)

- Genie.ph does not put fresh flowers on cakes because they are not safe or hygienic for our food workflow.
- IF a flower appears fresh, natural, realistic, or edible, classify it as "edible_flowers".
- IF petals have veins, natural imperfections, brown edges, or fresh-flower styling → IT IS still "edible_flowers".
- IF petals are thick (>2mm), matte, perfectly uniform → IT IS "edible_flowers" (Gum paste).
- IF visible fabric texture or fraying threads → IT IS "artificial_flowers" (Silk/Cloth).$protocol$;
  replacement_flower_protocol constant text := $replacement_protocol$### Protocol 4: THE "FLOWER" CHECK (Required Edible Flower Fulfillment Rule)

- Genie.ph fulfills every visible flower as edible because non-edible flowers
  are not safe or hygienic for our food workflow.
- IF a flower appears fresh, natural, realistic, silk, cloth, fabric-textured,
  artificial, or edible, classify it as `edible_flowers` with material
  `edible_fondant`.
- This override includes petals with veins, natural imperfections, brown edges,
  fresh-flower styling, thick matte gum paste, visible fabric texture, or
  fraying threads.
- Do not describe a flower as fresh, silk, cloth, fabric, or non-edible. Describe
  it as an edible fondant or gumpaste flower instead.$replacement_protocol$;
  flower_measurement_row constant text := $measurement$| **Flowers** (edible_flowers, artificial) | **DIAMETER** of the bloom face |$measurement$;
  replacement_flower_measurement_row constant text := $replacement_measurement$| **Flowers** (edible_flowers) | **DIAMETER** of the bloom face |$replacement_measurement$;
  flower_sizing_header constant text := '### C3. FLOWERS — edible_flowers, artificial_flowers';
  replacement_flower_sizing_header constant text := '### C3. FLOWERS — edible_flowers';
  flower_type_rows constant text := $type_rows$| `edible_flowers` | edible_fondant | Fresh-looking, natural-looking, or realistic flowers must still be classified and priced as edible flowers. Do not output `fresh_flowers`. |
| `artificial_flowers` | non-edible | Silk/cloth flowers (not counted for pricing) |$type_rows$;
  replacement_flower_type_rows constant text := $replacement_type_rows$| `edible_flowers` | edible_fondant | Every visible flower, including fresh-looking, natural-looking, silk, cloth, fabric-textured, artificial, or realistic flowers, is fulfilled and priced as edible flowers. Only actual piped buttercream rosettes use `icing_decorations`. |$replacement_type_rows$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.42: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true;

  if md5(source_prompt) <> '0a36a992b6194c917cf6ac39666c8d47' then
    raise exception 'Cannot create ai_prompts v3.42: active prompt does not match the v3.41 baseline';
  end if;

  if exists (select 1 from public.ai_prompts where version = '3.42') then
    raise exception 'Cannot create ai_prompts v3.42: version 3.42 already exists';
  end if;

  if position(global_flower_rule in source_prompt) = 0
    or position(flower_protocol in source_prompt) = 0
    or position(flower_measurement_row in source_prompt) = 0
    or position(flower_sizing_header in source_prompt) = 0
    or position(flower_type_rows in source_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.42: expected flower baseline wording was not found';
  end if;

  next_prompt := replace(
    source_prompt,
    '**v3.41 Version - Number-Shaped Cakes and Freestanding Figures**',
    '**v3.42 Version - All Flowers Are Edible**'
  );
  next_prompt := replace(next_prompt, global_flower_rule, replacement_global_flower_rule);
  next_prompt := replace(next_prompt, flower_protocol, replacement_flower_protocol);
  next_prompt := replace(next_prompt, flower_measurement_row, replacement_flower_measurement_row);
  next_prompt := replace(next_prompt, flower_sizing_header, replacement_flower_sizing_header);
  next_prompt := replace(next_prompt, flower_type_rows, replacement_flower_type_rows);

  if position('**v3.42 Version - All Flowers Are Edible**' in next_prompt) = 0
    or position('Required Edible Flower Fulfillment Rule' in next_prompt) = 0
    or position('is fulfilled and priced as edible flowers.' in next_prompt) = 0
    or position('artificial_flowers' in next_prompt) <> 0
    or position('fresh_flowers' in next_prompt) <> 0 then
    raise exception 'Cannot create ai_prompts v3.42: flower fulfillment wording was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.42',
    next_prompt,
    true,
    'v3.42 — Every flower style is fulfilled and priced as edible_flowers; fresh_flowers and artificial_flowers are no longer generated.',
    now()
  );
end;
$$;

commit;
