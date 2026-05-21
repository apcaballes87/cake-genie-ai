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
| **Model Name** | `gemini-3-flash-preview`, `gemini-3-pro-image-preview` | `gemini-2.0-flash`, `gemini-1.5-pro`, etc. |
| **Thinking Config** | `thinkingLevel: ThinkingLevel.LOW/MEDIUM/HIGH` | `thinkingBudget`, `includeThoughts` |

### Key API & Import Requirements

1. **Import Statement**:

   ```typescript
   import { GoogleGenAI, Modality, Type, ThinkingLevel } from "@google/genai";
   ```

2. **Thinking Config (`thinkingLevel`)**:
   - **REQUIRED** for `gemini-3-flash-preview`
   - **NOT SUPPORTED** for `gemini-3-pro-image-preview`

   ```typescript
   config: {
       thinkingConfig: {
           thinkingLevel: ThinkingLevel.LOW, // or MEDIUM, HIGH, MINIMAL
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

## 💻 Coding Stack & Implementation Rules

- **Languages**: ReactJS, NextJS, JavaScript, TypeScript, TailwindCSS, HTML, CSS.
- **Styling**: Always use Tailwind classes; avoid raw CSS or HTML tag styling.
- **Naming Prefix**: Prefix event handlers with `"handle"` (e.g., `handleClick`).
- **Readability**: Prioritize clean, descriptive variable names and early returns.
- **Accessibility**: Provide standard interactive attributes (`tabindex="0"`, `aria-label`, keypress handler) for non-native interactive elements.
