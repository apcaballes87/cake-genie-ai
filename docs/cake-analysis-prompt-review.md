# Cake analysis prompt review

Before merging a prompt patch, the author must answer:

> Does this rule claim precedence over another rule? If so, where does it get inserted into the master OUTPUT ORDER list?

- Reject a patch that introduces an independent highest-precedence claim. Register the rule in OUTPUT ORDER and add the matching step reference to its section.
- Repair the existing conflicting rule and its summaries before adding another exception. Review rejection and membership gates when adding a new accepted arrangement.
- Keep prompt enums, generated schema, allowed thickness matrix, and category-specific pricing compatible. A valid enum without a pricing rule is not a priced feature.
- Check that each support enum value has a table row, each table value is in the enum, and readable messages are not charged again as support pieces.
- Keep real-world size estimates distinct from normalized `cake_measurements.diameter` geometry. Maintain one thickness-ownership explanation.
- Require focused contract/route/pricing checks. Record fresh image evaluation separately; static prompt assertions are not model-behavior evidence.

Use a higher version only after the complete patch list is incorporated. Keep a short 3–5 bullet changelog at the top. Preserve prior prompt versions and use separate guarded staging and activation transactions. Verify compatible deployment and all required prices before activation.

## v3.83 review decisions

- Baseline: live v3.82, prompt ID 90, MD5 `b7ef36a5e817946699cf875f3e2e96f4`.
- Premium sprinkles use Option A: existing rule 180 is support-only, ₱100. No pricing rule was changed.
- Multi-tier ratios over 2.0 use the tallest allowed value: soft icing `5 in`, Fondant `6 in`. Slab and small fixed-height types retain their matrix values. This corrects the punch list's assumption that every multi-tier type tops out at `5 in`.
- The closed support enum also includes `piped_flowers_side` and `icing_doodle`. `gumpaste_letters` remains exclusively a `cake_messages` type and is not accepted as a support type.
- Cupcake add-on itemization is deferred. Exactly five same-box cupcakes still select `Bento Cupcake Set`; another same-box count still selects `Bento`. In both cases, companion cupcakes and decorations located exclusively on them are omitted from `main_toppers` and `support_elements`. There is no `cupcake_topper` type or pricing rule in v3.83.
- Both item skeletons expose conditional `coverage`; the strict runtime contract requires it only for the corresponding piped-flower type and rejects it on other rows.
- Rejected output omits accepted-image geometry. Accepted geometry now defines round, non-round, number-shaped, bento, and representative-cupcake reference lines; icing-border sizing uses one representative motif.
- Source migration stages an inactive row only. It has not been applied. Production activation, cache repair, and publishing are separate actions.

## Image evaluation

The repository has 21 JSON regression fixtures, 16 with direct image URLs, plus a local Cinnamoroll cake image. These are existing cases, not a verified held-out set. The requested number-cake, bento counts 3/4/6, stylized real-person portrait, flat/molded rainbow, and actual composite images need a curated manifest before the full approximately 20-image evaluation can be claimed.

For paired evaluation, pin both prompt files and one model/schema configuration. Generate directly without context-cache creation or application cache routes; save raw JSON and field diffs locally. Separate schema compliance, inventory/classification changes, geometry, and price changes. A single model sample cannot establish stability.

`scripts/evaluate-cake-prompt-pair.ts` implements local-image paired evaluation with raw output and recursive field diffs. Run it with `node --import tsx`, `--before`, `--after`, `--manifest`, and a new `--out` directory. The manifest is an array of `{ "id": "case-name", "imagePath": "/absolute/path/image.webp" }`; `--dry-run` validates inputs without provider calls. Both versions use the same current schema and system instruction, so this measures a master-prompt change, not two complete deployed application versions. Arrays are compared by index; no pricing or postprocessing is applied.

The one-image Cinnamoroll smoke comparison was attempted but failed before generation: local Vertex impersonation lacks `iam.serviceAccounts.getAccessToken`. The provider produced no before/after JSON. Error evidence is at `/private/tmp/genie-v383-paired-smoke-network/error.json`. Full held-out inference remains unperformed.
