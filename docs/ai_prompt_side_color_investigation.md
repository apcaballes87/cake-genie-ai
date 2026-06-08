# Investigation Prompt: Why the AI Skips `side` Color in Cake Analyses

**Use this prompt against an LLM (Claude, GPT-4, Gemini) to diagnose and propose a fix for the issue where the cake analysis pipeline generates `analysis_json->'icing_design'->'colors'->'side'` inconsistently — sometimes omitting it entirely or only populating `top`.**

---

## Context (paste this into the LLM)

We run a custom AI vision analysis on user-uploaded cake photos. The prompt (current version: `v3.4`, see `supabase/migrations/insert_prompt_v3.4.sql`) asks the model to emit a JSON `icing_design.colors` object with six keys: `side`, `top`, `borderTop`, `borderBase`, `drip`, `gumpasteBaseBoardColor`. In production, a significant fraction of cached rows either have only `top` populated, or have no `side` value at all:

```jsonc
// Healthy row — all six keys present
"colors": { "side": "#FFC0CB", "top": "#FFC0CB", "borderTop": "#FFFFFF", "borderBase": "#FFFFFF", "drip": null, "gumpasteBaseBoardColor": "#FFFFFF" }

// Buggy row — `side` missing
"colors": { "top": "#FFC0CB" }
```

We just made `icing_colors` a searchable, swatch-filterable column on the public search page, and `side` is now the **only** color used for filtering (because `side` is what a customer sees on a typical hero/marketing photo of a cake). When `side` is missing, the row is excluded from every color swatch result, which is causing visible under-coverage in search.

## The current CATEGORY 5 section of the prompt

```
## CATEGORY 5: ICING DESIGN & TEXTURE
Determine Base Material & Texture:
1. FONDANT: Matte finish, draped look, rounded top edges, distinct from cake board.
2. SOFT ICING (Buttercream/Boiled): Glossy/Greasy sheen, sharp top edges possible, spatula marks visible.
3. GANACHE: Semi-matte chocolate chocolate finish, very smooth.
4. NAKED CAKE: Cake layers visible, scant icing.

JSON STRUCTURE
{
  "base": "soft_icing|fondant|naked",
  "texture": "smooth|rustic_swirl|spatula_painted|rosette_texture|vintage_piping|ribbed|semi_naked",
  "color_type": "single|gradient_2|gradient_3|abstract",
  "colors": {
    "side": "#HEX",
    "top": "#HEX",
    "borderTop": "#HEX",
    "borderBase": "#HEX",
    "drip": "#HEX",
    "gumpasteBaseBoardColor": "#HEX"
  },
  "border_top": true|false,
  "border_base": true|false,
  "drip": true|false,
  "gumpasteBaseBoard": true|false
}
```

The CATEGORY 5 instructional paragraph only talks about **material and texture**. Color is only mentioned via the JSON structure example. The `side` key is buried in a list of six, in alphabetical order, with no emphasis on why it matters.

## Your task

Produce a structured diagnosis and a concrete fix:

### 1. Root cause analysis
Identify the specific weaknesses in CATEGORY 5 that cause the model to skip `side`. Consider at minimum:
- **Salience / signal-to-noise**: Is `side` presented as equally important as `top`, or does the prompt implicitly privilege `top` (e.g., by mentioning it first, by giving a worked example with `top` only, by saying "the icing on top is…")?
- **Coercion vs. instruction**: Does the prompt tell the model `side` is *required*, or merely *available*?
- **Empty-value handling**: When the model sees a cake photographed from above, does the prompt tell it what to do for `side` (e.g., default to the visible lateral icing, or carry over from `top`)?
- **Positional bias**: The model often keys off whatever is in the JSON example. If the example has only `top` populated in training, the model will mimic that. Are the JSON example values complete?
- **Language ambiguity**: Does the word "side" carry the meaning we want (the vertical icing band around the tier), or could the model interpret it as "borderTop" or "borderBase"?

### 2. Concrete rewrite
Produce a new CATEGORY 5 section (200-400 words) that:
- States plainly that `side` is the **dominant** color and the **customer-facing** color.
- Says `side` is **mandatory** in every successful analysis — the analysis is invalid without it.
- Gives an explicit defaulting rule when the side is occluded (e.g., "if the side is fully occluded by a topper, fall back to the color of the visible lateral icing band; if genuinely not visible, use the same hex as `top`").
- Reorders the JSON example so `side` is presented with a clear non-null value, not last or first-by-alphabet.
- Adds a "Colors: palette only" style guard, plus a one-line "side is required" reminder in the final checklist.
- Keeps the existing material/texture protocol intact.

### 3. Test cases
Write 3-5 short test prompts (image-description style, no real images needed) where a buggy v3.4 model would likely skip `side` but the proposed rewrite would force it. Examples might be:
- Top-down photo of a cake where the side is barely visible
- Bento cake with a heavy topper covering most of the side
- 2-tier cake where the photo crops the top tier
- Naked cake with visible sponge and minimal icing

For each, show what v3.4 might emit and what the new prompt should emit.

### 4. Migration plan
Suggest how to roll out the new prompt without breaking the 13,770 cached rows:
- A: Versioned prompt (v3.5) and a one-shot backfill of `icing_colors` from `analysis_json->'top'` (or a heuristic) for rows missing `side`.
- B: Re-run analysis on the affected subset.
- C: Leave history alone, only enforce the new rule going forward.

For each, estimate the tradeoffs (cost, accuracy, indexing/UX impact).

---

**Output format**: Numbered sections, no preamble, concrete and brief.
