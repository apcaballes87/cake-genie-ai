# AI Assistant Context File

> **⚠️ IMPORTANT FOR AI ASSISTANTS**: Read this file before making any changes to this codebase.
> This file contains critical project-specific configurations and decisions that should NOT be changed
> based on outdated training data.

---

## 🚨 Critical Configuration: Google Gemini AI

### Current Setup (as of April 2026)

| Configuration | Value | DO NOT CHANGE TO |
| :--- | :--- | :--- |
| **SDK Package** | `@google/genai` | `@google/generative-ai` (old) |
| **SDK Version** | `^1.38.0` or later | Any version below 1.38.0 |
| **Server-side Auth** | Vertex AI + Workload Identity Federation (WIF) | JSON service account keys or Gemini API keys in API routes |
| **Vertex Location** | `global` for preview Gemini models | `us-central1` for Gemini 3 preview routes |
| **Model Name** | `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite-image` | `gemini-3.1-flash-lite-preview`, `gemini-2.0-flash`, `gemini-1.5-pro`, etc. |
| **Thinking Config** | `thinkingLevel: ThinkingLevel.MINIMAL/LOW/MEDIUM/HIGH` | `thinkingBudget`, `includeThoughts` |
| **Thinking Config (`thinkingLevel`)**:

- Supported for `gemini-3.5-flash-lite`; use `LOW` for the current high-volume analysis routes
- Image models use their own modality-specific configuration

### Why This Matters

1. **Gemini 3 models** use `thinkingLevel` (not `thinkingBudget`)
2. **Gemini 2.5 models** use `thinkingBudget` (deprecated for our use case)
3. The `includeThoughts: true` pattern is **incorrect** for Gemini 3
4. **Production API routes** authenticate through Vertex AI using WIF, not static keys
5. **Preview Gemini models** can fail on regional endpoints unless routed through `global`
6. **Gemini 3.5 Flash-Lite** is GA and requires removing `temperature`, `top_p`, and `top_k` from requests

### Authentication Path (Server Routes)

- Shared server-side client: `src/lib/ai/client.ts`
- Runtime credentials source: `GOOGLE_CREDENTIALS_JSON`
- OIDC subject token source: `VERCEL_OIDC_TOKEN`, written to `/tmp/vercel-oidc-token.txt`
- Vertex project selector: `VERTEX_AI_PROJECT`
- Vertex location selector: `VERTEX_AI_LOCATION`, defaulting to `global`
- Do **not** commit loose `credentials.json` files for deployment
- Some one-off scripts still use direct Gemini API keys; do not copy that pattern into API routes or shared server code

### Correct Import Statement

```typescript
import { GoogleGenAI, Modality, Type, ThinkingLevel } from "@google/genai";
```

### Correct thinkingConfig Pattern

```typescript
config: {
    // ... other config
    thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,  // or MINIMAL, MEDIUM, HIGH
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
| Vertex AI Client | `src/lib/ai/client.ts` | Shared Vertex AI auth + client initialization |
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
| 2026-04-25 | Added Vertex AI + WIF auth guidance | Prevent assistants from reintroducing static keys or regional preview routing |
| 2026-04-25 | Documented `global` location default for preview models | Avoid 404s on regional endpoints |
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
4. **DO** verify `GOOGLE_CREDENTIALS_JSON`, `VERCEL_OIDC_TOKEN`, `VERTEX_AI_PROJECT`, and `VERTEX_AI_LOCATION` are configured correctly
5. **DO** check this file for current correct configuration

---

## 📚 External Documentation

- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini Thinking Documentation](https://ai.google.dev/gemini-api/docs/thinking)
- [@google/genai npm package](https://www.npmjs.com/package/@google/genai)
- [Vertex AI WIF Migration Report](./docs/vertex-ai-wif-migration.md)

---

*Last updated: 2026-07-24*
*This file should be updated whenever critical configurations change.*
