-- Deploy prompt v3.52. Price visibly separate repeated fondant/gumpaste side
-- stripes as one coverage-based panel rather than losing them as icing color.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_heading constant text := '**v3.51 Version - Cake-Object Membership Gate**';
  new_heading constant text := '**v3.52 Version - Repeated Gumpaste Side Stripes**';
  old_panel_tail constant text := $anchor$| `small` | **< 40%** of the tier's visible side surface |
| `medium` | **40% to < 80%** |
| `large` | **≥ 80%** |

---$anchor$;
  new_panel_tail constant text := $anchor$| `small` | **< 40%** of the tier's visible side surface |
| `medium` | **40% to < 80%** |
| `large` | **≥ 80%** |

### REPEATED VERTICAL GUMPASTE SIDE STRIPES

When separate opaque fondant/gumpaste vertical strips or bands repeat around a
cake side, emit one collective `gumpaste_panel` support row for the complete
stripe treatment—not one row per strip.

Use `material: "edible_fondant"`, `quantity: 1`, and size it by the combined
coverage of the tier side: `small` <40%, `medium` 40% to <80%, `large` ≥80%.
Do not classify visibly separate fondant/gumpaste strips as plain icing color.
Continuous piped, painted, or airbrushed stripes remain icing, not a
`gumpaste_panel`.

---$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.52: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.52';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.52'
        and is_active = true
        and md5(prompt_text) = 'a54fb8a8359fcd6a0147c7ccc5161b25'
    ) then
      raise exception 'Cannot record ai_prompts v3.52: an unexpected v3.52 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> '65b412039b6da3e7d3ffbd2047846bf2' then
    raise exception 'Cannot create ai_prompts v3.52: active prompt does not match the v3.51 baseline';
  end if;

  if position(old_heading in source_prompt) = 0
    or position(old_panel_tail in source_prompt) = 0
    or position('REPEATED VERTICAL GUMPASTE SIDE STRIPES' in source_prompt) <> 0 then
    raise exception 'Cannot create ai_prompts v3.52: expected v3.51 panel anchors were not found';
  end if;

  next_prompt := replace(source_prompt, old_heading, new_heading);
  next_prompt := replace(next_prompt, old_panel_tail, new_panel_tail);

  if position('REPEATED VERTICAL GUMPASTE SIDE STRIPES' in next_prompt) = 0
    or position('one collective `gumpaste_panel` support row' in next_prompt) = 0
    or position('Continuous piped, painted, or airbrushed stripes remain icing' in next_prompt) = 0
    or md5(next_prompt) <> 'a54fb8a8359fcd6a0147c7ccc5161b25' then
    raise exception 'Cannot create ai_prompts v3.52: repeated gumpaste side-stripe rule was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.52',
    next_prompt,
    true,
    'v3.52 — Classify repeated separately applied fondant/gumpaste vertical side stripes as one coverage-priced panel.',
    now()
  );
end;
$migration$;

commit;
