# GEO Audit Report: Genie.ph

**Audit Date:** March 29, 2026
**URL:** https://genie.ph
**Business Type:** E-commerce + Local Service Marketplace (Custom Cake Ordering)
**Pages Analyzed:** 18 core + 20 blog + product/bakery samples
**Auditor:** GEO-SEO Claude

---

## Executive Summary

**Overall GEO Score: 62/100 (Fair)**

Genie.ph has a strong technical foundation for AI visibility — all 7 major AI crawlers are explicitly allowed, an llms.txt file exists, and the site runs on Next.js with SSR. However, the site is held back by weak brand authority (virtually no third-party mentions on platforms AI models cite), missing schema opportunities (no FAQPage despite excellent FAQ content), and content E-E-A-T gaps (no named human authors). A critical canonical URL mismatch across 8,648+ product pages needs immediate attention.

### Score Breakdown

| Category | Score | Weight | Weighted Score |
|---|---|---|---|
| AI Citability & Visibility | 63/100 | 25% | 15.8 |
| Brand Authority Signals | 38/100 | 20% | 7.6 |
| Content E-E-A-T | 57/100 | 20% | 11.4 |
| Technical GEO | 77/100 | 15% | 11.6 |
| Schema & Structured Data | 74/100 | 10% | 7.4 |
| Platform Optimization | 52/100 | 10% | 5.2 |
| **Overall GEO Score** | | | **59 → 62/100** |

*Score adjusted upward +3 for having llms.txt (rare for businesses this size) and best-in-class AI crawler access.*

---

## Critical Issues (Fix Immediately)

### 1. Canonical URL Mismatch on /customizing/ Pages
**Severity:** CRITICAL | **Impact:** ~8,648 product pages
**Issue:** Sitemap URLs contain `-cake-` in the slug (e.g., `floral-birthday-white-1-tier-cake-3f0f`) but the page's canonical tag omits it (`floral-birthday-white-1-tier-3f0f`). Both URLs return HTTP 200 with no redirect. Google treats these as conflicting canonicals, which could suppress indexing of your entire product catalog.
**Fix:** Determine which slug pattern is canonical, implement 301 redirects from the non-canonical form, and align sitemap generation with the canonical URL.

---

## High Priority Issues (Fix Within 1 Week)

### 2. No Named Human Author on Any Content Page
**Issue:** All 20 blog posts use `"author": {"@type": "Organization", "name": "Genie.ph"}`. No named person appears as an author anywhere despite founder Alan Paris Caballes being mentioned on /about with a startup award.
**Fix:** Create an author profile for Alan Paris Caballes. Add `Person` schema with name, url, and credentials to all blog posts. Display visible bylines.

### 3. Missing Security Headers
**Issue:** No Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, or Permissions-Policy headers. This is significant for a marketplace handling payments (GCash, Maya, credit cards).
**Fix:** Add security headers in `next.config.ts`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 4. `user-scalable=no` in Viewport Meta Tag
**Issue:** Disables pinch-to-zoom across the entire site — WCAG 1.4.4 violation and Google mobile usability failure.
**Fix:** Remove `maximum-scale=1, user-scalable=no` from the viewport meta tag. One-line fix.

### 5. /customizing/ Pages Not Cached at CDN
**Issue:** Product pages return `cache-control: private, no-cache, no-store`. Every crawl request hits the origin server. With 8,648+ pages and multiple AI crawlers, this is a performance and crawl budget risk.
**Fix:** Enable ISR (Incremental Static Regeneration) with `revalidate` on the `/customizing/[slug]` route.

### 6. Brand Authority Gap (38/100)
**Issue:** Virtually no third-party web presence. No Reddit threads, no Wikipedia/Wikidata mentions, no press coverage, no LinkedIn company page. AI models weight independent corroboration heavily when deciding whether to cite a brand.
**Fix:** See recommendations section for a multi-channel brand authority plan.

---

## Medium Priority Issues (Fix Within 1 Month)

### 7. No FAQPage Schema on /faq
The FAQ page has 16 well-structured Q&A blocks but only carries generic LocalBusiness schema. *Note: FAQPage rich results were restricted by Google in Aug 2023, but the schema still helps AI systems identify authoritative Q&A content for AI Overviews and ChatGPT citations.*

### 8. Blog Markdown Rendering Bug
Blog posts (e.g., `/blog/custom-cake-cebu-guide-2026`) render raw markdown characters (`# Heading`, `**bold**`) as visible text instead of HTML elements. Crawlers see `<p># Where to Order...</p>` instead of proper `<h1>` tags.

### 9. Bakery Schema Has Null Fields
Shop pages (`/shop/goldilocks`, `/shop/suisse-cottage`) output `streetAddress: null`, `telephone: null` in JSON-LD. Null values are worse than omitting properties — they trigger Rich Results validation warnings.

### 10. llms.txt Missing Key Stats
The llms.txt file doesn't include: "7,000+ designs in catalog," rush order capability, the Startup Innovation Summit award, or a last-updated timestamp.

### 11. Customer Reviews Unverifiable
The 4.8/5 rating badge on the homepage has no link to Google Maps, Facebook Reviews, or any external verification source.

### 12. Empty Sitemap Shard
`sitemap-customized-cakes-9.xml` is declared in the sitemap index but contains 0 URLs.

### 13. HSTS Missing includeSubDomains
Current: `max-age=63072000`. Should be: `max-age=63072000; includeSubDomains; preload` to cover `pro.genie.ph`.

---

## Low Priority Issues (Optimize When Possible)

### 14. Missing `postalCode` in Schema
Cebu City's postal code (6000) is absent from the PostalAddress schema.

### 15. TikTok sameAs Uses HTTP
`"http://tiktok.com/@genie.ph"` should be `"https://www.tiktok.com/@genie.ph"`.

### 16. BlogPosting Emits Empty Image Array
When no blog image exists, schema outputs `"image": []` instead of omitting the property.

### 17. Priority Inflation in Sitemap
All 18 core URLs have `priority: 1.0` including `/terms`, `/privacy`, `/return-policy`.

### 18. Generic Keywords Meta Tag
Same `<meta name="keywords">` value on all pages — ignored by Google since 2009.

### 19. OG Image Dimensions on Product Pages
456x609 (portrait) instead of recommended 1200x630 for social sharing.

### 20. No `openingHours` on LocalBusiness Schema
Missing operating hours — a direct local pack ranking signal.

---

## Category Deep Dives

### AI Citability & Visibility (63/100)

**Strengths:**
- Best-in-class AI crawler access: All 7 major crawlers explicitly allowed with broader permissions than general crawlers
- llms.txt exists and is substantive — covers platform description, service areas, tech stack, social links
- FAQ page has excellent quotable answer blocks with specific peso amounts, city names, and timeframes
- Blog pricing table (Bento ₱350-₱600 through Wedding ₱5,000-₱15,000+) is highly citable

**Weaknesses:**
- Homepage content is heavily JS-rendered; AI crawlers may receive a hollow shell for the most important page
- No `speakable` markup to signal which passages are AI-quotable
- llms.txt lacks key differentiators (7,000+ designs, rush orders, award)

**Per-Page Citability:**
| Page | Score | Notes |
|---|---|---|
| /faq | 78 | Excellent Q&A structure, specific answers |
| /blog/custom-cake-cebu-guide-2026 | 76 | Strong pricing table, embedded FAQ |
| /about | 72 | Clear founder story, award claim |
| Homepage | 62 | JS rendering limits crawlable content |

### Brand Authority Signals (38/100)

| Platform | Status | AI Citation Value |
|---|---|---|
| Facebook | Active (geniephilippines) | Low |
| Instagram | Active (genie.ph) | Low |
| TikTok | Active (@genie.ph) | Low |
| YouTube | Active (@genieph) | Medium |
| Google Business Profile | Likely present | Medium |
| Reddit | No presence | None (critical gap) |
| Wikipedia/Wikidata | No presence | None (critical gap) |
| LinkedIn | No presence | None (gap for Bing Copilot) |
| Press/News coverage | None detected | None |
| Third-party review sites | None detected | None |

**Key insight:** Brand authority is almost entirely self-declared. AI models weight third-party corroboration heavily. The Startup Innovation Summit win is a real authority signal but only exists on the /about page.

### Content E-E-A-T (57/100)

| Dimension | Score |
|---|---|
| Experience | 10/25 — No customer case studies, one first-person hook in one blog post |
| Expertise | 12/25 — No named human expert on any content page |
| Authoritativeness | 11/25 — One local startup award, DTI/BIR permits, zero external citations |
| Trustworthiness | 19/25 — Strongest: HTTPS, full contact info, comprehensive legal pages |
| Topical Authority | +5 — 20 articles in 3 months, 5 developing content clusters |

**Content assets:** The Jollibee vs McDonald's comparison article has excellent structure (Quick Answer box, side-by-side table, decision tree). The custom cake pricing guide is the single most citable content asset on the site.

**Content gaps:** /how-to-order is too thin (~450 words, no examples). Blog posts are undisclosed advertorial content. No "verified as of" dates on pricing data.

### Technical GEO (77/100)

| Dimension | Score |
|---|---|
| Crawlability | 80 |
| Indexability | 82 |
| Rendering & Performance | 78 |
| Security | 62 |
| Mobile Optimization | 70 |
| AI-Specific Technical | 88 |

**Strengths:** Next.js SSR with Vercel edge caching (ISR), IndexNow implemented for Bing, comprehensive sitemap structure (19 child sitemaps), AI crawlers have broader access than general crawlers.

**Critical finding:** Canonical URL mismatch on /customizing/ pages affects ~8,648 URLs.

### Schema & Structured Data (74/100)

| Dimension | Score |
|---|---|
| Presence & Coverage | 68 |
| Completeness | 72 |
| Validation | 88 |
| GEO/AI Impact | 68 |

**Strongest implementation:** Product schema on cake pages is production-grade — AggregateOffer, ShippingDetails, ReturnPolicy, ImageObject with licensing metadata.

**Key gaps:** No FAQPage on /faq, no CollectionPage/ItemList on /collections, no openingHours on LocalBusiness, BlogPosting uses Organization instead of Person as author.

### Platform Optimization (52/100)

| Platform | Score | Status |
|---|---|---|
| Bing Copilot | 73 | Strong — IndexNow implemented |
| Google AI Overviews | 62 | Moderate — good FAQ content, missing author signals |
| Google Gemini | 58 | Moderate — strong schema, unknown YouTube activity |
| Perplexity AI | 35 | Weak — zero Reddit presence (Perplexity's top source) |
| ChatGPT Web Search | 32 | Weak — no Wikipedia/Wikidata entity, no LinkedIn |

---

## Quick Wins (Implement This Week)

1. **Add `postalCode: "6000"` and `openingHours` to LocalBusiness schema** — 5 minutes, immediate local SEO gain
2. **Fix TikTok sameAs to HTTPS** — 1 minute change in layout.tsx
3. **Remove `user-scalable=no` from viewport** — 1 line fix, resolves Google mobile usability violation
4. **Fix BlogPosting empty image array** — change `image: []` to conditional omission in SEOSchemas.tsx
5. **Add security headers** (X-Content-Type-Options, X-Frame-Options, Permissions-Policy) — 30 minutes in next.config.ts

## 30-Day Action Plan

### Week 1: Critical Fixes & Quick Wins
- [ ] Fix canonical URL mismatch on /customizing/ pages (CRITICAL)
- [ ] Remove `user-scalable=no` from viewport meta
- [ ] Add missing security headers to next.config.ts
- [ ] Add `postalCode`, `openingHours` to LocalBusiness schema
- [ ] Fix TikTok sameAs URL to HTTPS
- [ ] Fix BlogPosting empty image array bug
- [ ] Remove empty sitemap shard (sitemap-customized-cakes-9.xml)

### Week 2: Schema & Content Improvements
- [ ] Add Person author (Alan Paris Caballes) to all blog posts with schema
- [ ] Create `/author/alan-paris-caballes` page with credentials
- [ ] Add CollectionPage + ItemList schema to /collections
- [ ] Fix Bakery schema null values (conditionally exclude missing fields)
- [ ] Update llms.txt with key stats, award, and timestamp
- [ ] Add "verified as of" notices to pricing content

### Week 3: Platform Authority Building
- [ ] Create LinkedIn company page and add to sameAs schema
- [ ] Create Wikidata entity for Genie.ph (no notability requirement)
- [ ] Begin organic Reddit engagement in r/CebuCity and r/Philippines
- [ ] Pitch Startup Innovation Summit win to CDN/SunStar Cebu for press coverage
- [ ] Link 4.8/5 review badge to verifiable external source (Google Maps or Facebook)

### Week 4: Content & Performance
- [ ] Enable ISR caching on /customizing/ pages
- [ ] Fix blog markdown rendering bug
- [ ] Expand /how-to-order to 900+ words with real order example
- [ ] Add 5-8 named customer testimonials to /about page
- [ ] Enrich About page Organization schema (foundingDate, founder, areaServed)
- [ ] Consider publishing "State of Custom Cakes in Cebu 2026" original data report

---

## Appendix: Key Files to Modify

| File | Changes Needed |
|---|---|
| `src/app/layout.tsx` | postalCode, openingHours, TikTok sameAs, security headers |
| `next.config.ts` | Security headers, HSTS includeSubDomains |
| `src/components/SEOSchemas.tsx` | Person author, fix image:[], Bakery null values |
| `src/app/collections/page.tsx` | Add CollectionPage + ItemList schema |
| `src/app/about/page.tsx` | Enrich Organization schema |
| `/customizing/[slug]` route | Fix canonical URL, enable ISR caching |
| Sitemap generation | Remove empty shard, fix URL patterns |
| `public/llms.txt` or API | Add stats, award, timestamp |
| Viewport meta | Remove user-scalable=no, maximum-scale=1 |

---

## Appendix: Platform-Specific Recommendations

### To Improve ChatGPT Visibility (+15-20 pts)
1. Create Wikidata entity
2. Create LinkedIn company page
3. Expand About page to 800+ words
4. Get one independent news article published

### To Improve Perplexity Visibility (+20-25 pts)
1. Build Reddit presence (3-5 organic threads in r/CebuCity)
2. Publish original data/research
3. Add source citations to blog content
4. Create YouTube content with chapter timestamps

### To Improve Google AI Overviews (+10-15 pts)
1. Add Person author with credentials
2. Structure more content as direct Q&A blocks
3. Add comparison tables to key pages
4. Ensure FAQ content is not hidden in `<details>` accordions

---

*Generated by GEO-SEO Claude | https://github.com/zubair-trabzada/geo-seo-claude*
