# GEO Citability Continuation Prompt

## Context
We've implemented FAQPage schema across all ~13,000 `/customizing/{slug}` product pages on genie.ph (ecommerce custom cake marketplace in Cebu, Philippines). Now we need to **score and rewrite the FAQ/content blocks for AI quotability** using the geo-citability methodology.

## Current State
- **FAQPage schema**: Live on all product pages (5 dynamic Q&As per design)
- **Product schema**: Complete with offers, aggregateRating, images
- **Blog content**: 20+ posts by Alan Caballes (author schema present)
- **FAQ page** (`/faq`): 20+ Q&As in `<details>` elements, no FAQPage schema yet
- **Homepage**: Landing page with value props, reviews, trust signals

## Task
Analyze key pages for **AI citability** using the 5-category rubric (Answer Block Quality 30%, Self-Containment 25%, Structural Readability 20%, Statistical Density 15%, Uniqueness 10%). Generate rewrite suggestions for low-scoring blocks.

## Pages to Analyze (Priority Order)
1. **`/faq`** - 20 Q&As across 5 categories (Ordering, Customization, Delivery, About, Refunds)
2. **`/customizing/{slug}`** - Product pages with dynamic FAQs (sample 3: floral-birthday-white-1-tier-cake-3f0f, cute-cupcakes-white-cupcakes-306f, bento-cake-812470e1cac3fef8)
3. **`/blog/bento-cake-designs-guide-every-style-2026`** - Top blog post (4000+ words, 11 bento cake styles)
4. **`/about`** - Company story, founder, awards, trust signals
5. **`/` (homepage)** - Value props, reviews, CTAs

## Methodology
For each page:
1. Extract main content blocks (by H2/H3 headings)
2. Score each block on 5 categories (0-100)
3. Calculate weighted overall score
4. Identify top 3 strongest blocks, bottom 3 needing rewrites
5. Provide specific rewrite suggestions with answer-first patterns, statistics, self-contained phrasing

## Output Format
Generate `GEO-CITABILITY-REPORT.md` with:
- Executive summary with overall scores per page
- Per-page score breakdown tables
- Strongest/weakest content blocks with quoted passages
- Specific rewrite suggestions (before/after)
- Quick wins (formatting, statistics, structure changes)
- Priority action list

## Key Optimization Targets
- **Answer-first openings**: "X is..." / "X refers to..." in first 1-2 sentences
- **Self-containment**: No pronouns requiring context, explicit subject naming
- **Statistical density**: 3-5 specific stats per 500 words (prices ₱, days, percentages, counts)
- **Structure**: Question-based H2/H3, short paragraphs (2-4 sentences), tables for comparisons
- **Optimal citation length**: 134-167 word passages

## Example Rewrite Pattern
**Before (low citability):**
> "If you're wondering about delivery times, it varies by location and baker availability. Most orders take several days."

**After (high citability):**
> "Genie.ph delivers custom cakes across Metro Cebu in 3-7 days handling time plus 1-2 days transit. Rush orders (60-minute prep) are available for simple designs like bento cakes. Delivery is free within Cebu City; ₱50-₱150 for Mandaue, Lapu-Lapu, Talisay."

## Files to Reference
- `/src/app/faq/page.tsx` - FAQ page component
- `/src/app/customizing/[slug]/page.tsx` - Product page with `generateDynamicFAQ()`
- `/src/utils/designContentUtils.ts` - `generateDynamicFAQ()` and `generateDesignDetails()`
- `/src/app/blog/bento-cake-designs-guide-every-style-2026` - Blog post
- `/src/app/about/page.tsx` - About page
- `/src/app/page.tsx` - Homepage

## Deliverable
Markdown report with scores, findings, and rewrite-ready suggestions that can be implemented directly in the content utilities and components.