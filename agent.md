# Agent Guidelines & Workflow Orchestration

> **⚠️ IMPORTANT FOR AI AGENTS**: This file defines your core behavioral guidelines, workflow orchestration patterns, task management steps, and engineering principles. Read and adhere to these rules strictly at all times.

---

## 🎯 Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Maintain Senior Developer/Staff Engineer standards.
- **Minimal Impact**: Only touch what's necessary. Avoid introducing side effects or new bugs.

---

## 🔄 Workflow Orchestration

### 1. Plan Mode Default
- **Enter Plan Mode** for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, **STOP and re-plan immediately**.
- Use plan mode for **verification steps**, not just building.
- Write detailed specs upfront to reduce ambiguity.

### 2. Subagent Strategy
- **Use subagents liberally** to keep the main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- For complex problems, throw more compute at them via subagents.
- **One task per subagent** for focused execution.

### 3. Self-Improvement Loop
- After **ANY correction** from the user: update `tasks/lessons.md` with the pattern.
- Write rules for yourself that prevent the same mistake from happening again.
- **Ruthlessly iterate** on these lessons until the mistake rate drops to zero.
- Review these lessons at the start of each session for the relevant project.

### 4. Verification Before Done
- **Never mark a task complete** without proving it works.
- Diff behavior between `main` and your changes when relevant.
- Ask yourself: *"Would a staff engineer approve this?"*
- Run tests, check logs, and demonstrate correctness with clear evidence.

### 5. Demand Elegance (Balanced)
- For non-trivial changes: **pause and ask**, *"Is there a more elegant way?"*
- If a fix feels hacky: *"Knowing everything I know now, implement the elegant solution."*
- Skip this for simple, obvious fixes — **do not over-engineer**.
- Challenge your own work thoroughly before presenting it.

### 6. Autonomous Bug Fixing
- When given a bug report: **just fix it**. Do not ask for hand-holding.
- Point directly at logs, errors, or failing tests — then resolve them.
- **Zero context switching** should be required from the user.
- Go fix failing CI/CD or build tests without being told how.

---

## 📋 Task Management Workflow

Follow this checklist for managing your tasks:

1. **Plan First**: Write your implementation plan to `tasks/todo.md` with clear, checkable items.
2. **Verify Plan**: Check in and obtain user approval before starting implementation.
3. **Track Progress**: Mark items complete (`[x]`) or in-progress (`[/]`) as you go.
4. **Explain Changes**: Provide a high-level summary at each step of the way.
5. **Document Results**: Add a thorough review section to `tasks/todo.md` upon completion.
6. **Capture Lessons**: Update `tasks/lessons.md` immediately after any corrections.

---

## 💻 Coding Environment & Implementation Rules

### Coding Stack
- **Languages**: ReactJS, NextJS, JavaScript, TypeScript, TailwindCSS, HTML, CSS.

### Implementation Guidelines
- **Modern UI/UX**: Always use Tailwind classes for styling HTML elements; avoid raw CSS or tags.
- **Dynamic CSS Classes**: Use `"class:"` instead of the ternary operator in class tags whenever possible.
- **Readability**: Focus on clean, readable, and DRY (Don't Repeat Yourself) code over micro-optimizations.
- **Naming Conventions**: Use highly descriptive variable and function/const names. Event handler functions must start with the `"handle"` prefix (e.g., `handleClick`, `handleKeyDown`).
- **Control Flow**: Use **early returns** whenever possible to make code highly readable and eliminate deep nesting.
- **Accessibility (a11y)**: Implement full accessibility on interactive elements (e.g., tags should have `tabindex="0"`, `aria-label`, `onClick`, `onKeyDown`, etc.).
- **Function Syntax**: Define components and functions using `const` arrow functions (e.g., `const toggle = () => {}`) and always define types for props/variables.

---

## 🔍 Reference Files

Before starting, make sure to cross-reference specialized workspace guidelines:
- **UI Stability**: [.agent/rules/regression_prevention.md](file:///Users/apcaballes/genieph-nextjs/.agent/rules/regression_prevention.md)
- **GA4 Access (Genie.ph)**: [.agent/rules/ga4-access.md](file:///Users/apcaballes/genieph-nextjs/.agent/rules/ga4-access.md) — verified working snippets, quirks, and project-specific filters
- **AI/Gemini Context**: [AI_CONTEXT.md](file:///Users/apcaballes/genieph-nextjs/AI_CONTEXT.md)
- **The Humanizer**: [the-humanizer.md](file:///Users/apcaballes/genieph-nextjs/the-humanizer.md)
