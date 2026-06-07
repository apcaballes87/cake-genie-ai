# Gemini Agent Instructions & SDK Context

> **⚠️ CRITICAL FOR GEMINI-POWERED AGENTS**: This file combines the strict Google Gemini AI SDK implementation guidelines for this repository with the expected Workflow Orchestration and Task Management patterns. Always read and strictly follow this context.

---

## 🚨 Critical Gemini SDK Configuration (DO NOT VIOLATE)

This project uses the official modern `@google/genai` SDK (version `^1.38.0` or later). Outdated patterns or SDK packages will break the build or production runtime.

| Configuration | Value | DO NOT CHANGE TO |
| :--- | :--- | :--- |
| **SDK Package** | `@google/genai` | `@google/generative-ai` (outdated) |
| **SDK Version** | `^1.38.0` or later | Versions below 1.38.0 |
| **Server-side Auth** | Vertex AI + Workload Identity Federation (WIF) | JSON service account keys or Gemini API keys in API routes |
| **Vertex Location** | `global` for preview Gemini models | `us-central1` for Gemini 3 preview routes |
| **Model Name** | `gemini-3.1-flash-lite-preview`, `gemini-3-pro-image-preview` | `gemini-2.0-flash`, `gemini-1.5-pro`, etc. |
| **Thinking Config** | `thinkingLevel: ThinkingLevel.MINIMAL/LOW/MEDIUM/HIGH` | `thinkingBudget`, `includeThoughts` |

### Key API & Import Requirements

1. **Import Statement**:

   ```typescript
   import { GoogleGenAI, Modality, Type, ThinkingLevel } from "@google/genai";
   ```

2. **Thinking Config (`thinkingLevel`)**:
   - **REQUIRED** for `gemini-3.1-flash-lite-preview`
   - **NOT SUPPORTED** for `gemini-3-pro-image-preview`

   ```typescript
   config: {
       thinkingConfig: {
           thinkingLevel: ThinkingLevel.LOW, // or MINIMAL, MEDIUM, HIGH
       },
   }
   ```

3. **❌ WRONG PATTERNS (DO NOT USE)**:

   ```typescript
   // WRONG: Old thinkingBudget (for Gemini 2.5 only)
   thinkingConfig: { thinkingBudget: 1024 }

   // WRONG: includeThoughts pattern
   thinkingConfig: { includeThoughts: true }

   // WRONG: Outdated model names
   model: "gemini-2.0-flash" | "gemini-1.5-pro"
   ```

4. **💡 Prompt Caching & DB Prompt Management (ai_prompts)**:
   - **CRITICAL**: Whenever you update or edit `ai_prompts` (the AI analysis prompt), **never just update the text in-place without changing the version**. You must **always** update the `version` column to a new version (e.g. from `3.11` to `3.12`) or insert a **new active row** with the new version.
   - **Why**: Google Vertex AI uses `cachedContent` based on the display name `genie-cake-analysis-prompt-v{version}` (replacing dots with hyphens). Reusing an existing version name will cause Vertex AI to reuse the old cached context, ignoring your prompt changes completely. Changing the version forces it to build a new context cache.

---

## 🔄 Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update tasks/lessons.md with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes -- don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests -- then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

---

## 📋 Task Management
1. Plan First: Write plan to tasks/todo.md with checkable items
2. Verify Plan: Check in before starting implementation
3. Track Progress: Mark items complete as you go
4. Explain Changes: High-level summary at each step
5. Document Results: Add review section to tasks/todo.md
6. Capture Lessons: Update tasks/lessons.md after corrections

---

## 🧠 Core Principles
- Simplicity First: Make every change as simple as possible. Impact minimal code.
- No Laziness: Find root causes. No temporary fixes. Senior developer standards.
- Minimal Impact: Only touch what's necessary. No side effects with new bugs.

---

## 🎨 Landing Page Branding And Color Rules

- Treat the homepage and landing-style pages as a soft, premium, reassuring brand system, not a loud multicolor marketplace.
- Keep the base look aligned with the shared Genie tokens in `src/app/globals.css`. That file is the source of truth for `--genie-primary`, `--genie-primary-strong`, `--genie-accent`, `--genie-soft`, `--genie-soft-border`, `genie-page-bg`, `genie-btn-primary`, `genie-btn-secondary`, `genie-icon-button`, and `genie-link`.
- Default page surfaces should stay light and airy: white, off-white, soft lavender, blush, and the existing `genie-page-bg` gradient. Do not switch landing pages to dark themes or saturated flat backgrounds unless the user explicitly asks.
- Primary text should stay dark neutral ink/slate (`text-gray-900`, `text-slate-900`, `text-black`) for trust and readability. Supporting copy should stay muted neutral (`text-slate-500`, `text-gray-600`). Do not make long paragraphs purple or pink.
- Purple is the main brand accent. Use it for primary CTA buttons, highlighted headline words, links, focus states, icon emphasis, and selected states.
- Pink is a supporting accent only. Use it sparingly in gradients, background glow, or secondary decorative emphasis. Do not let pink replace purple as the main action color.
- Green and blue are semantic colors, not brand-default accents. Reserve them for meaning such as rush availability, same-day delivery, success, verified states, or logistics badges.
- Buttons should prefer the shared utilities over ad hoc color classes:
  - Use `genie-btn-primary` for the main action on a section.
  - Use `genie-btn-secondary` for secondary actions.
  - Use `genie-icon-button` for circular or icon-only controls.
- When adding new landing sections, match the current hierarchy visible in `src/app/LandingClient.tsx` and `src/components/landing/*`:
  - bold dark headline
  - muted supporting copy
  - one purple-highlighted phrase or CTA
  - soft white/cream card surfaces with gentle purple borders or shadows
- Avoid introducing random one-off Tailwind colors like bright red, harsh orange, neon blue, or unrelated purple/pink shades when the shared Genie tokens already cover the need.
- If a new page is supposed to feel like the landing page, reuse the shared Genie utilities first and only add new color tokens when the existing brand system genuinely cannot express the design.

### Branding Compliance Audit Prompt

Use this prompt when reviewing any page for Genie branding color compliance:

```text
Audit this page for Genie.ph branding color compliance.

Page to review:
- [INSERT URL, ROUTE, SCREENSHOT, OR FILE PATH]

Brand rules to enforce:
- The page should feel soft, premium, light, and reassuring, not loud or overly saturated.
- Use `src/app/globals.css` as the source of truth for shared branding tokens and utilities, especially `--genie-primary`, `--genie-primary-strong`, `--genie-accent`, `genie-page-bg`, `genie-btn-primary`, `genie-btn-secondary`, `genie-icon-button`, and `genie-link`.
- Primary text should stay dark neutral ink/slate such as `text-gray-900`, `text-slate-900`, or `text-black`.
- Supporting text should stay muted neutral such as `text-slate-500` or `text-gray-600`.
- Purple is the main brand accent for primary CTAs, links, highlighted words, focus states, selected states, and icon emphasis.
- Pink is only a supporting accent and should not replace purple as the dominant action color.
- Green and blue should be semantic colors only, mainly for success, delivery, availability, rush, same-day, or verified states.
- Surfaces should stay light: white, off-white, soft lavender, blush, or the existing Genie gradient system. Avoid dark mode styling or harsh flat backgrounds unless intentionally requested.
- Prefer shared Genie utility classes over ad hoc one-off color classes whenever possible.
- Avoid random bright red, orange, neon blue, or unrelated purple/pink shades that break the Genie palette.

What to examine:
1. Page background and section surfaces
2. Headline, body, caption, and muted text colors
3. Primary, secondary, and icon-only buttons
4. Links, badges, chips, pills, borders, shadows, and focus states
5. Any status colors and whether they are semantic or misused as branding
6. Whether the page visually matches the homepage/landing brand language

Output format:
- Overall verdict: Compliant, Partially compliant, or Not compliant
- What already matches the Genie brand
- What is off-brand
- Exact colors/classes/components causing the mismatch
- Recommended fixes
- Where to fix it in the codebase

Important:
- Be strict about branding consistency.
- Do not give generic design advice.
- Tie every finding to the actual page UI and, when possible, the actual file/class/token in the repo.
- If the page is mostly compliant, still call out small off-brand accents or button treatments that should be normalized.
```

---

## 💻 Coding Stack & Implementation Rules

- **Languages**: ReactJS, NextJS, JavaScript, TypeScript, TailwindCSS, HTML, CSS.
- **Styling**: Always use Tailwind classes; avoid raw CSS or HTML tag styling.
- **Naming Prefix**: Prefix event handlers with `"handle"` (e.g., `handleClick`).
- **Readability**: Prioritize clean, descriptive variable names and early returns.
- **Accessibility**: Provide standard interactive attributes (`tabindex="0"`, `aria-label`, keypress handler) for non-native interactive elements.

---

## 📦 Vertex AI Batch Processing & Egress Prevention

To prevent catastrophic Google Cloud egress costs (the "GCS Egress Bomb") during offline batch reconciliation (e.g. processing ~1,000 cakes with large inline base64 output images):

1. **Avoid Loop Downloads in Serverless**: Never open GCS file streams (`outputFile.createReadStream()`) repeatedly inside a serverless continuation loop. Skipping lines in a multi-gigabyte file over 100+ serverless runs multiplies egress charges exponentially.
2. **Prefer Local CLI for Large Batches**: For heavy reconciliation tasks, use the dedicated local script `scripts/reconcile-batch-local.ts` via the shortcut `npm run reconcile:local`. Running it locally downloads the output JSONL file exactly once, avoiding serverless timeout splits and reducing egress fees by 98%+.
3. **Set Bucket Lifecycle Rules**: Always configure a GCS Object Lifecycle Management rule on the batch GCS bucket to delete temporary files and input/output JSONL files after 7 days to prevent long-term storage fees.
