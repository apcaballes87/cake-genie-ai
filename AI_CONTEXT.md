# AI Assistant Context File

> **⚠️ IMPORTANT FOR AI ASSISTANTS**: Read this file before making any changes to this codebase.
> This file contains critical project-specific configurations and decisions that should NOT be changed
> based on outdated training data.

---

## 🚨 Critical Configuration: Google Gemini AI

### Current Setup (as of January 2026)

| Configuration | Value | DO NOT CHANGE TO |
| :--- | :--- | :--- |
| **SDK Package** | `@google/genai` | `@google/generative-ai` (old) |
| **SDK Version** | `^1.38.0` or later | Any version below 1.38.0 |
| **Model Name** | `gemini-3-flash-preview`, `gemini-3-pro-image-preview` | `gemini-2.0-flash`, `gemini-1.5-pro`, etc. |
| **Thinking Config** | `thinkingLevel: ThinkingLevel.LOW/MEDIUM/HIGH` | `thinkingBudget`, `includeThoughts` |
| **Thinking Config (`thinkingLevel`)**:

- REQUIRED for `gemini-3-flash-preview`
- NOT SUPPORTED for `gemini-3-pro-image-preview`

### Why This Matters

1. **Gemini 3 models** use `thinkingLevel` (not `thinkingBudget`)
2. **Gemini 2.5 models** use `thinkingBudget` (deprecated for our use case)
3. The `includeThoughts: true` pattern is **incorrect** for Gemini 3

### Correct Import Statement

```typescript
import { GoogleGenAI, Modality, Type, ThinkingLevel } from "@google/genai";
```

### Correct thinkingConfig Pattern

```typescript
config: {
    // ... other config
    thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,  // or MEDIUM, HIGH, MINIMAL
    },
}
```

### ❌ WRONG Patterns (DO NOT USE)

```typescript
// WRONG: Old thinkingBudget (for Gemini 2.5 only)
thinkingConfig: {
    thinkingBudget: 1024,
}

// WRONG: includeThoughts pattern
thinkingConfig: {
    includeThoughts: true
}

// WRONG: Old model names
model: "gemini-2.0-flash"
model: "gemini-1.5-pro"
model: "gemini-pro"
```

---

## 🔧 Service File Locations

| Service | File Path | Purpose |
| :--- | :--- | :--- |
| Gemini AI Service | `src/services/geminiService.ts` | All AI analysis functions |
| Roboflow Service | `src/services/roboflowService.ts` | Object detection |
| Pricing Service | `src/services/pricingService.database.ts` | Pricing calculations |

---

## 📦 Key Dependencies

### AI/ML Dependencies

```json
{
  "@google/genai": "^1.38.0"  // MUST be 1.38.0 or later for Gemini 3 support
}
```

### When Updating Dependencies

1. Check Google AI changelog for breaking changes
2. Test AI analysis after any SDK update
3. Update this file if API patterns change

---

## 🎯 AI Function Configuration Reference

| Function | File | ThinkingLevel | Purpose |
| :--- | :--- | :--- | :--- |
| `validateCakeImage` | geminiService.ts | LOW | Simple image classification |
| `analyzeCakeWithHybridCoordinates` | geminiService.ts | MEDIUM | Full spatial analysis |
| `analyzeCakeFeaturesOnly` | geminiService.ts | LOW | Fast feature detection |
| `enrichAnalysisWithCoordinates` | geminiService.ts | HIGH | Precise coordinate calculation |
| `generateShareableTexts` | geminiService.ts | LOW | SEO text generation |
| `editCakeImage` | geminiService.ts | N/A | Image editing (Nano Banana 2) |

---

## 📜 Change Log

| Date | Change | Reason |
| :--- | :--- | :--- |
| 2026-01-22 | Updated to `thinkingLevel` from `includeThoughts` | Gemini 3 API compatibility |
| 2026-01-22 | Updated SDK to v1.38.0 | Full Gemini 3 support |
| 2026-01-22 | Created this AI_CONTEXT.md file | Prevent AI assistants from reverting changes |

---

## 🔍 Before Making AI-Related Changes

### Checklist for AI Assistants

- [ ] Read this file completely
- [ ] Check the current SDK version in `package.json`
- [ ] Verify the model name format matches current documentation
- [ ] Use `thinkingLevel` (not `thinkingBudget`) for Gemini 3 models
- [ ] Test changes if possible before committing

### When Troubleshooting AI Analysis Issues

1. **DO NOT** downgrade to older model names
2. **DO NOT** change `thinkingLevel` to `thinkingBudget`
3. **DO** check for network/timeout issues first
4. **DO** verify API key is configured correctly
5. **DO** check this file for current correct configuration

---

## 📚 External Documentation

- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini Thinking Documentation](https://ai.google.dev/gemini-api/docs/thinking)
- [@google/genai npm package](https://www.npmjs.com/package/@google/genai)

---

*Last updated: 2026-01-22*
*This file should be updated whenever critical configurations change.*
