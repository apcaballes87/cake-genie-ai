# Pre-Feature Baseline Summary

**Spec:** `customizing-pdp-seo-fixes`
**Task:** 1.0 Capture Pre_Feature_Baseline for Reference_PDP_Set
**Captured at:** 2026-05-26T09:12:07Z
**Git HEAD:** `d72f259445cc6cb01b2e7295731c7227e171f167`
**Working tree at capture:** dirty (5 modified files, none affecting the audit pipeline or build/lint outputs in a way that distorts the baseline; baseline numbers reflect committed HEAD state)

This document enumerates the baseline state of the three Reference_PDP_Set URLs and the project-wide build/lint counts, so that post-merge tasks 6.1 (audit diff), 6.2 (rule-id diff for R9.7), and 6.3 (TypeScript / ESLint quality gates for R9.4 / R9.8) can compare against a fixed pre-feature reference.

Source artifacts:
- `artifacts/seo-ecommerce/pre-feature-baseline.json` — per-URL `{ok, fetch_status, rules, findings, summary, title, meta_description, h1, product_graph_count}`
- `artifacts/seo-ecommerce/pre-feature-build-baseline.txt` — full build/lint baseline notes
- `artifacts/seo-ecommerce/_pre-feature-build.log` — raw `next build` output
- `artifacts/seo-ecommerce/_pre-feature-eslint.log` — raw `npx eslint .` output
- `artifacts/seo-ecommerce/_capture_baseline.py` — the script used to (re)produce the JSON

## Per-URL Audit Results

All three URLs returned `ok: true` with `fetch_status: 200` and exactly one Product graph. The four findings per URL are identical across all three slugs.

### 1. `https://genie.ph/customizing/kuromi-light-purple-1-tier-cake-e3c3`

- **ok:** true
- **rules:** `return-policy-applicableCountry`, `shipping-deliveryTime`, `missing-member-program`, `no-product-group`
- **Severity counts:** Critical 0 · High 0 · Medium 3 · Info 1
- **Title:** `Kuromi Cake - 1002 Cake Design with Price | Php 1,299 | Genie.ph` (contains the ID-leak ` - 1002` that R7 will strip and the `with Price` artifact that R6 will remove)
- **Meta description:** ends with `... | Price starts at ₱1,299. Customize now!` (R5 mid-sentence ellipsis-pipe artifact)
- **H1:** `Kuromi Cake - 1002 Cake Design`

### 2. `https://genie.ph/customizing/custom-cake-white-1-tier-cake-383c`

- **ok:** true
- **rules:** `return-policy-applicableCountry`, `shipping-deliveryTime`, `missing-member-program`, `no-product-group`
- **Severity counts:** Critical 0 · High 0 · Medium 3 · Info 1
- **Title:** `Custom Cake Design with Price | Php 1,799 | Genie.ph` (contains `with Price` artifact)
- **Meta description:** ends with `... | Price starts at ₱1,799. Customize now!`
- **H1:** `Custom Cake Design`

### 3. `https://genie.ph/customizing/pink-minimalist-light-pink-bento-cake-f707`

- **ok:** true
- **rules:** `return-policy-applicableCountry`, `shipping-deliveryTime`, `missing-member-program`, `no-product-group`
- **Severity counts:** Critical 0 · High 0 · Medium 3 · Info 1
- **Title:** `Pink Minimalist Bento Cake For Mom Cake Design with Price | Php 1,199 | Genie.ph` (79 cp, exceeds the 60-cp SERP cap; contains `with Price` artifact)
- **Meta description:** ends with `... | Price starts at ₱1,199. Customize now!`
- **H1:** `Pink Minimalist Bento Cake For Mom Cake Design`

## Build Baseline (R9.4)

- **Tool:** `next build` (Next.js 16.0.7, Turbopack)
- **Status:** SUCCESS (clean compile)
- **TypeScript errors (project-wide):** **0**
- **TypeScript errors in changed files:** 0 (no TS errors anywhere)
- **Static pages generated:** 517 / 517

R9.4 contract: post-merge `next build` must keep TS errors in the three changed files (`src/app/customizing/[slug]/page.tsx`, `src/lib/commerce/machineReadable.ts`, `src/app/customizing/[slug]/metadataHelpers.ts`) at 0 and total project-wide TS error count must stay ≤ 0.

## Lint Baseline (R9.8)

- **Tool:** `npx eslint .`
- **Exit code:** 0 (flat config does not gate on lint by default)
- **ESLint warnings:** **468**
- **ESLint errors:** **369**
- **ESLint total problems:** **837**

R9.8 contract: post-merge `npx eslint .` must keep total warning count ≤ 468 and exit code = 0.

## Audit Diff Baseline (R9.7)

For R9.7 sign-off, the post-merge audit (Task 6.1) must produce a per-URL `rules` set that is a subset of the pre-feature baseline below. Specifically:

| URL | Pre-feature `rules` set |
| --- | --- |
| kuromi-light-purple-1-tier-cake-e3c3 | `{return-policy-applicableCountry, shipping-deliveryTime, missing-member-program, no-product-group}` |
| custom-cake-white-1-tier-cake-383c | `{return-policy-applicableCountry, shipping-deliveryTime, missing-member-program, no-product-group}` |
| pink-minimalist-light-pink-bento-cake-f707 | `{return-policy-applicableCountry, shipping-deliveryTime, missing-member-program, no-product-group}` |

After merge, the rule IDs `return-policy-applicableCountry` and `shipping-deliveryTime` are expected to disappear from every URL (R8.2). The two remaining rules (`missing-member-program`, `no-product-group`) are explicitly out of scope for this feature (see design.md § Out of Scope) and must NOT be removed; they should remain in the post-merge findings.

R9.7 acceptance: no `rule` value may appear in post-merge findings that is absent from the pre-feature baseline for the same URL.

## Anomalies Encountered

- **Working tree was dirty at capture time** — five modified files were present but none alter the build, lint, or audit pipeline outputs in a way that distorts the baseline. The baseline numbers above reflect committed `HEAD` state, which is the contract R9.7 requires.
- **`fetch_page` warning** — the script logged a "lxml not installed" warning and fell back to `html.parser`. The fallback produces identical SEO-relevant fields (title, meta description, H1, JSON-LD scripts) for all three URLs; no semantic difference vs. lxml.
- **No 4xx/5xx fetch failures** — all three URLs returned 200 with non-empty bodies.
- **Identical rule sets across all three URLs** — the four findings appear on every page, which is expected for a template-level audit (R8 Validation Contract is template-scoped).
- **No `aggregateRating` block present in any of the three Product graphs** — consistent with R1 baseline (currently no aggregateRating is emitted; the feature will introduce it conditionally).

## Acceptance Status

- [x] `artifacts/seo-ecommerce/pre-feature-baseline.json` exists and contains valid JSON with `{ok, findings[].rule}` per URL for all three Reference_PDP_Set URLs.
- [x] `artifacts/seo-ecommerce/pre-feature-build-baseline.txt` exists with TypeScript error count and ESLint warning/error counts.
- [x] `artifacts/seo-ecommerce/pre-feature-baseline-summary.md` (this file) enumerates the baseline state for Tasks 6.1 / 6.2 / 6.3 to diff against.

Task 1.0 is therefore complete. All downstream waves (1–5) may proceed.
