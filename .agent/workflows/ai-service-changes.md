---
description: Check before modifying AI/Gemini service code
---

# AI Service Modification Workflow

## Before Making Any Changes to AI-Related Code

### Step 1: Read the AI Context File

// turbo

```bash
cat AI_CONTEXT.md
```

Read through this file completely. It contains:

- Current SDK versions and model names
- Correct API patterns for Gemini 3
- Things that should NOT be changed

### Step 2: Verify Current Configuration

// turbo
Check the current Gemini SDK version:

```bash
grep "@google/genai" package.json
```

### Step 3: Check Current Model Usage

// turbo

```bash
grep -n "gemini-" src/services/geminiService.ts | head -10
```

### Step 4: Verify thinkingConfig Pattern

// turbo

```bash
grep -n "thinkingLevel" src/services/geminiService.ts
```

## Critical Rules

1. **DO NOT** change `gemini-3-flash-preview` to older models like `gemini-2.0-flash`
2. **DO NOT** use `thinkingBudget` - use `thinkingLevel` for Gemini 3
3. **DO NOT** use `includeThoughts: true` - it's incorrect for Gemini 3
4. **DO** use the `ThinkingLevel` enum from `@google/genai`

## After Making Changes

### Step 5: Verify TypeScript Compiles

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

### Step 6: Update AI_CONTEXT.md if Needed

If you made configuration changes, update the AI_CONTEXT.md file with:

- New model names
- New SDK versions
- New API patterns
- Add entry to the Change Log section
