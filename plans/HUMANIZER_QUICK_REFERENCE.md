# Humanizer Quick Reference Guide

## Overview

Humanizer is already set up in your project to make AI-generated blog content sound more natural and human-written. It follows the Kilo Code skills format from <https://kilo.ai/docs/customize/skills>

## Skill Structure

The skill follows the Kilo Code SKILL.md format with YAML frontmatter:

```yaml
---
name: humanizer
version: 2.2.0
description: |
  Remove signs of AI-generated writing from text...
allowed-tools:
  - Read
  - Write
  - Edit
  ...
---
```

## Files

- **Skill File**: [`.agent/skills/humanizer/SKILL.md`](.agent/skills/humanizer/SKILL.md)
- **Blog Writer Agent**: [`.agent/skills/agents/blog-writer.md`](.agent/skills/agents/blog-writer.md)

---

## How to Use It

### Simply Ask for a Blog Post

When you want a new blog post, tell me:
> "Create a blog post about [topic]"

I will automatically:

1. Write SEO-optimized content
2. Apply the humanizer skill to remove AI patterns
3. Do a final audit pass
4. Present the humanized content

---

## What Humanizer Fixes (24 Patterns)

### 1. Significance Inflation

**AI tell**: "marking a pivotal moment", "underscores its importance"
**Fix**: Remove puffery, state facts simply

### 2. Promotional Language  

**AI tell**: "breathtaking region", "nestled within"
**Fix**: Use plain, honest descriptions

### 3. AI Vocabulary Words

**AI tell**: "Additionally", "crucial", "showcase", "testament", "leverage"
**Fix**: Use simple words: "also", "important", "show", "proof", "use"

### 4. Em Dash Overuse

**AI tell**: Multiple em dashes (—) in sentences
**Fix**: Use commas, periods, or simpler constructions

### 5. Rule of Three

**AI tell**: Lists of three with similar structure
**Fix**: Vary the list items naturally

### 6. Vague Attributions

**AI tell**: "Experts believe", "researchers say", "many people think"
**Fix**: Be specific about who said what

### 7. Generic Positive Conclusions

**AI tell**: "Overall, this is a great choice", "highly recommended"
**Fix**: Give specific, honest conclusions

---

## Example Transformation

### Before (AI-written)
>
> "The baptismal cake represents a pivotal moment in a child's spiritual journey. This significant milestone deserves a cake that showcases the importance of this sacred occasion. Additionally, choosing the right design is crucial for capturing this memorable experience."

### After (Humanized)
>
> "A baptismal cake marks a special day. Here's how to pick one that fits your celebration without overspending."

---

## No Setup Required

Humanizer doesn't need:

- Python packages
- API keys
- External services

It's built into the AI's instructions. Just ask for a blog!

---

## Want a Blog Now?

Just tell me what topic you want, for example:

- "Create a blog about baptismal cake ideas in Cebu"
- "Write a blog about custom cake pricing in the Philippines"
- "Make a blog post about birthday cake trends 2026"

I'll generate humanized content automatically.
