# GEO Platform Optimization Report — Genie.ph
Date: March 29, 2026

## Overall Platform Readiness
- **Combined GEO Score: 52/100**
- Status: Moderate — Strong technical foundations, significant gaps in entity authority and community presence

---

## Platform Scores

| Platform | Score | Status |
|---|---|---|
| Google AI Overviews | 62/100 | Moderate |
| ChatGPT Web Search | 32/100 | Weak |
| Perplexity AI | 35/100 | Weak |
| Google Gemini | 58/100 | Moderate |
| Bing Copilot | 73/100 | Strong |

---

## Platform Details

---

### 1. Google AI Overviews — 62/100 (Moderate)

**How the score was calculated:**

| Criterion | Points Available | Score | Notes |
|---|---|---|---|
| Ranks in top 10 for target queries | 20 | 10 | Niche local market (Cebu custom cakes). Likely ranking well locally but no verified top-10 data for broad PH queries. Estimated top 20. |
| Question-based headings present | 10 | 8 | Blog post has 5+ question-style H3s ("How much is a custom cake in Cebu?", "Can I order a custom cake online?", etc.). FAQ uses category H2s, not question H2s. |
| Direct answers after headings | 15 | 9 | FAQ answers are immediate and direct (strong). Blog post intro is narrative, not answer-first. About page has no Q&A structure at all. |
| Tables present for comparison data | 10 | 10 | Pricing table on blog post is well-structured (Cake Type / Price / Best For). Comparison pages exist at /compare/ slugs. |
| Lists for processes/features | 10 | 8 | FAQ uses paragraph answers inside `<details>` elements. Blog uses ordered lists for steps. About page uses bullet-style feature lists. |
| FAQ section with 5+ questions | 10 | 10 | /faq has 16 questions across 5 categories. Blog post has 5 inline FAQ questions with H3 headings. |
| Statistics with citations | 10 | 4 | Pricing data present (₱350 bento, ₱700-₱1,200 for 6" cake). No third-party cited statistics. No market size figures or external source attribution. |
| Publication/updated date visible | 5 | 5 | Blog post shows "March 6, 2026" visibly. BlogPosting schema has `datePublished` and `dateModified`. |
| Author byline with credentials | 5 | 3 | Blog shows author as "Genie.ph" (Organization), not a named individual. No author bio page. No personal credentials. |
| Clean URL + heading hierarchy | 5 | 5 | Clean URL structure. H1 > H2 > H3 hierarchy followed correctly across all three pages reviewed. |

**Strengths:**
- Excellent FAQ coverage on /faq (16 questions, 5 categories, 847 words of answer content)
- Pricing table in blog post is AIO-citation-ready
- Visible publish dates with schema support
- Blog post FAQ section with 5 H3-level questions is directly extractable
- Clean URL structure and heading hierarchy

**Gaps:**
- Author is "Genie.ph" org — no named human author with credentials, which weakens E-E-A-T for competitive queries
- FAQ answers rendered inside `<details>/<summary>` accordion HTML — crawlers can read this, but collapsed content may receive lower crawl weight
- No third-party statistics or external citations in any content
- About page (425 words) is thin and entirely narrative — no Q&A format, no data points
- No HowTo structured content (correctly deprecated, but visual step-by-step content for "how to order" could still help AIO extraction)

---

### 2. ChatGPT Web Search — 32/100 (Weak)

**How the score was calculated:**

| Criterion | Points Available | Score | Notes |
|---|---|---|---|
| Wikipedia article exists and is accurate | 20 | 0 | No Wikipedia article found for Genie.ph. API confirmed "missing." |
| Wikidata entity with 5+ properties | 10 | 0 | No Wikidata entity detected. No @id linking to Wikidata in schema. |
| Bing index coverage of key pages | 10 | 7 | Sitemap submitted. IndexNow active for Bing. Good technical setup, but coverage unknown without Bing WMT verification status. |
| Reddit brand mentions (positive) | 10 | 3 | No confirmed Reddit presence. Philippine cake/food subreddits (r/Philippines, r/phclassifieds, r/CebuCity) not actively utilized. Minor organic mentions may exist but not confirmed. |
| YouTube channel with relevant content | 10 | 7 | YouTube channel @genieph linked in sameAs. Channel is listed in llms.txt. Activity level unknown — no view/subscriber data available. Score assumes "present but sparse." |
| Authoritative backlinks (.edu, .gov, press) | 15 | 5 | Award from Mandaue City / MIPTAC (government-organized event) is a strong PR signal but likely not a direct backlink. No .edu or major press coverage confirmed. |
| Entity consistency across platforms | 10 | 8 | Facebook, Instagram, TikTok, YouTube all listed in sameAs schema. Business address consistent. Founding story present on /about. Minor gap: no LinkedIn listed in sameAs. |
| Content comprehensiveness (2000+ words) | 10 | 7 | Blog post is 2,956 words — qualifies. FAQ is 847 words. About page is 425 words — too thin. Only ~1 of 3 key pages meets the 2,000-word threshold. |
| Bing Webmaster Tools configured | 5 | 5 | Pinterest domain verify tag (`p:domain_verify`) detected. IndexNow implemented with Bing as an endpoint. Strong Bing technical signal. |

**Strengths:**
- Bing technical infrastructure is solid (IndexNow, sitemap index, clean robots.txt with GPTBot Allow)
- Entity consistency across Facebook, Instagram, TikTok, YouTube in schema sameAs
- Startup award from MIPTAC/MCCI is a real-world authority signal
- llms.txt is well-written and helps AI systems understand site structure

**Gaps:**
- No Wikipedia article — the single highest-impact gap for ChatGPT citations
- No Wikidata entity — removes the brand from ChatGPT's entity recognition layer entirely
- No LinkedIn presence in sameAs schema — LinkedIn is indexed heavily by Bing/ChatGPT
- About page at 425 words is too thin to serve as a canonical entity description
- No press coverage from major Philippine outlets (Rappler, Inquirer, BusinessWorld) confirmed

---

### 3. Perplexity AI — 35/100 (Weak)

**How the score was calculated:**

| Criterion | Points Available | Score | Notes |
|---|---|---|---|
| Active Reddit presence in relevant subreddits | 20 | 3 | No confirmed Reddit brand presence. r/CebuCity, r/Philippines, r/phclassifieds are high-relevance. Perplexity's #1 signal is absent. |
| Forum/community mentions (HN, SO, Quora) | 10 | 2 | No confirmed Quora answers, HN discussions, or Stack-equivalent food/startup forums detected. |
| Content freshness (updated within 6 months) | 10 | 10 | Blog post dated March 6, 2026. Sitemap shows core sitemap updated March 29, 2026. Very fresh. |
| Original research/data published | 15 | 8 | Pricing data (₱350–₱8,000+ tiers) is original and specific. Cebu delivery coverage map is original. No formal research studies, surveys, or published datasets. |
| YouTube content with transcripts | 10 | 4 | YouTube channel present. No transcript or chapter timestamp data accessible. Perplexity cites YouTube heavily — active video production would significantly boost score. |
| Quotable, standalone paragraphs | 10 | 8 | Blog post has several strong standalone paragraphs: "Prices start as low as ₱350 for bento cakes..." and "Custom cakes typically require 3-7 days handling time..." are quotable. |
| Multi-source claim validation | 10 | 4 | Claims like pricing ranges are internally sourced only. No cross-referencing to bakery association data, government pricing indices, or third-party reviews. |
| Discussion-generating content | 10 | 4 | Blog content is practical and helpful but written from a brand perspective. Not structured to invite debate or community sharing. No contrarian angles or original data releases. |
| Wikipedia/Wikidata presence | 5 | 0 | Absent (see ChatGPT section). |

**Strengths:**
- Best fresh content score of all platforms — active blog with March 2026 post
- Original pricing data for Cebu custom cakes is genuinely useful and quotable
- Robots.txt explicitly allows PerplexityBot with full site access
- llms.txt helps Perplexity understand content structure and service scope

**Gaps:**
- Zero Reddit community presence — Perplexity's most heavily-weighted signal
- No forum participation on Quora, HN, or Philippine food/business communities
- YouTube videos likely exist but no transcripts or chapters mean Perplexity cannot extract specific claims
- All pricing claims are self-asserted — no third-party bakery data, market research, or government references
- Content is written as brand copy rather than community-shareable thought leadership

---

### 4. Google Gemini — 58/100 (Moderate)

**How the score was calculated:**

| Criterion | Points Available | Score | Notes |
|---|---|---|---|
| Google Knowledge Panel exists | 15 | 8 | LocalBusiness schema with `@id`, `geo`, `address`, `telephone`, and sameAs is fully implemented. Knowledge Panel likely partial — no Wikidata/Wikipedia anchor. GBP signals are present but panel completeness unverified. |
| Google Business Profile complete | 10 | 7 | Address, phone, email confirmed in schema. No evidence of active GBP posts, Q&A section management, or photo uploads managed via GBP dashboard. Assumed "basic" profile. |
| YouTube channel with topic-relevant content | 20 | 8 | YouTube channel @genieph confirmed in sameAs. No chapter timestamps or transcript data available. Gemini weights YouTube most heavily — activity level is critical but unknown. |
| Schema.org structured data implemented | 15 | 13 | Excellent schema coverage: LocalBusiness (homepage/all pages), AboutPage, Organization with sameAs, BlogPosting, BreadcrumbList, Product (with AggregateOffer, ShippingDetails, ReturnPolicy, ImageObject licensing). FAQPage correctly intentionally disabled. |
| Google ecosystem presence (Scholar, News, Maps) | 10 | 3 | No Google News publisher registration detected. No Google Scholar presence. Google Maps likely matches GBP (assumed). Only 1 of 3 ecosystem signals confirmed. |
| Image optimization (alt text, filenames) | 10 | 6 | ImageObject schema with `creditText`, `copyrightHolder`, `license`, and `acquireLicensePage` is implemented on product pages. Alt text patterns present. Next.js `images: unoptimized: true` flag means no Next.js image optimization pipeline — images served as-is from Supabase. |
| E-E-A-T signals (author pages, about, editorial) | 10 | 7 | About page has: founder name (Alan Paris Caballes), mission/vision statements, award recognition (MIPTAC/MCCI 1st place), business permits (BIR, DTI). Gap: no individual author bio page, no editorial policy, author on blog is "Genie.ph" org not a named person. |
| Google Merchant Center (e-commerce applicable) | 5 | 3 | Product schema with AggregateOffer, priceValidUntil, ShippingDetails, and ReturnPolicy is GMC-compatible. No direct confirmation that products are submitted to Google Merchant Center feed. Structured data alone does not substitute for a GMC account. |
| Multi-modal content (text + images + video) | 5 | 3 | Blog content has text and images. No video embedded in blog posts or FAQ. Related product images shown at end of blog posts. |

**Strengths:**
- Best schema implementation of any competitor in the niche — Product schema with full merchant details, shipping, return policy, and image licensing is enterprise-level
- LocalBusiness with GeoCoordinates and full PostalAddress supports Gemini's local query handling
- Real-world E-E-A-T signal: documented government-organized award (MIPTAC/MCCI)
- sameAs array correctly links to YouTube, which Gemini weights most
- robots.txt explicitly allows Google-Extended

**Gaps:**
- No Google Merchant Center feed confirmed — Gemini references product data directly from GMC for shopping queries
- YouTube activity level unknown — if the channel is inactive, this heavily penalizes Gemini score
- No Google News registration — limits coverage for timely queries like "cake trends Cebu 2026"
- Author entity for blog posts is an Organization, not a Person — Gemini prefers named human authors for expertise signals
- `images: unoptimized: true` in Next.js config means no automatic WebP/AVIF serving or responsive sizes — potential Core Web Vitals impact

---

### 5. Bing Copilot — 73/100 (Strong)

**How the score was calculated:**

| Criterion | Points Available | Score | Notes |
|---|---|---|---|
| Bing Webmaster Tools verified + sitemap | 15 | 12 | Pinterest domain verify tag confirmed (`p:domain_verify: 0a26251bc18b086ea69d8022ef9eeb05`). Sitemap index with 9+ sub-sitemaps submitted. BWT likely configured — deducting 3 for unconfirmed verification status. |
| IndexNow protocol implemented | 15 | 15 | Full IndexNow implementation: key file at `/{key}.txt`, API route at `/api/indexnow`, submits to both `www.bing.com/indexnow` and `search.yandex.ru/indexnow`. Triggers on content publish/update. Best-in-class. |
| Bing index coverage of key pages | 10 | 7 | Sitemap architecture is comprehensive (core, bakeries, products, blog, designs, customized-cakes). IndexNow ensures rapid updates. Some dynamic content may have crawl gaps. |
| LinkedIn company page (complete) | 10 | 3 | No LinkedIn URL in sameAs schema. No LinkedIn evidence found in codebase. LinkedIn is a strong Bing Copilot signal — this is a notable gap. |
| GitHub presence (if applicable) | 5 | 0 | Not applicable for a local services marketplace. N/A scored as 0 per rubric. |
| Meta descriptions optimized | 10 | 9 | All three pages reviewed have keyword-rich, well-crafted meta descriptions. About: "AI-powered custom cake marketplace in Cebu." FAQ: "pricing, delivery, customization options." Blog: "pricing lists to the best cake shops in Metro Cebu." |
| Social media engagement signals | 10 | 7 | Facebook, Instagram, TikTok, YouTube all active. Bing weights social signals more than Google. Active multi-platform presence is positive. Exact engagement metrics unknown. |
| Exact-match keywords in titles/headings | 10 | 9 | "Custom cakes Cebu," "custom cake Cebu," "cake shops in Cebu," "order custom cakes in Cebu" all appear in H1/H2 headings and page titles. Strong literal keyword matching. |
| Page load speed < 2 seconds | 10 | 6 | Next.js SSR/SSG architecture is inherently fast. However, `images: unoptimized: true` bypasses Next.js image optimization — large Supabase-hosted images could impact LCP. Estimated < 4s, not confirmed < 2s. |
| Bing Places configured (if local) | 5 | 5 | Local business schema with address, phone, GeoCoordinates. Bing Places for Business assumed active given GBP-level data in schema. |

**Strengths:**
- IndexNow is fully implemented — this is Bing Copilot's #1 technical signal and Genie.ph has it production-ready
- Meta descriptions are some of the best across all pages reviewed
- Exact keyword matching in headings is well-executed
- robots.txt explicitly allows OAI-SearchBot and Bytespider (Bing-adjacent crawlers)
- Sitemap index with 9 sub-sitemaps provides comprehensive crawl coverage

**Gaps:**
- No LinkedIn company page — the highest-impact missing signal for Bing Copilot
- Image pipeline disabled (unoptimized: true) — could hurt page speed score, affecting Copilot preference
- No IndexNow submission confirmed to Google's IndexNow endpoint (only Bing and Yandex currently)
- Social engagement metrics not verifiable — high follower counts would amplify the social signal

---

## Key Findings Summary

### Strengths Across All Platforms
1. **Exemplary schema implementation** — Product, LocalBusiness, BlogPosting, BreadcrumbList, Organization with sameAs are all correctly coded with no deprecated or mis-applied types
2. **IndexNow is production-ready** — Real-time Bing indexing with proper key file, API route, and multi-endpoint submission
3. **llms.txt is well-crafted** — Provides AI crawlers with clear site structure, service areas, and technical context
4. **AI crawler access is fully open** — GPTBot, ClaudeBot, PerplexityBot, Google-Extended, OAI-SearchBot all explicitly allowed
5. **Fresh, comprehensive blog content** — 2026-dated guide at 2,956 words with pricing table, FAQ section, and local market specificity
6. **Real E-E-A-T anchor** — Government-recognized award (MIPTAC/MCCI Startup Innovation Summit) is a legitimate authority signal

### Critical Gaps Across All Platforms
1. **No Wikipedia article** — The single most impactful gap. Blocks ChatGPT citations, weakens Gemini Knowledge Graph presence, reduces Perplexity source confidence
2. **No community presence** — Zero Reddit, Quora, or forum activity blocks Perplexity's primary signal and reduces ChatGPT's entity validation
3. **No LinkedIn** — Missing from sameAs schema and no profile confirmed, hurting both Bing Copilot and ChatGPT entity graphs
4. **Author is an Organization, not a Person** — All blog posts attributed to "Genie.ph" org rather than named human authors, limiting E-E-A-T for competitive content queries
5. **No external citations or third-party data** — Pricing claims are internally sourced. No references to DOLE statistics, Philippine bakery association data, or external market research reduces multi-source validation

---

## Prioritized Action Plan

### Quick Wins — This Week

1. **Create a LinkedIn Company Page for Genie.ph**
   - Add URL `https://www.linkedin.com/company/genie-ph` to the `sameAs` array in all LocalBusiness and Organization schemas
   - This immediately improves both Bing Copilot (LinkedIn indexed by Bing) and ChatGPT entity graphs
   - Post the award achievement and company story as the first content

2. **Add named author bylines to blog posts**
   - Change `author: { @type: "Organization", name: "Genie.ph" }` to `author: { @type: "Person", name: "Alan Paris Caballes", url: "https://genie.ph/about" }` in BlogPostingSchema
   - Add a visible "Written by Alan Paris Caballes, Founder" line to each blog post UI
   - This improves Google AIO E-E-A-T and Gemini author entity signals with zero new content required

3. **Expand the About page to 1,500+ words**
   - Current: 425 words. Target: 1,500 words minimum
   - Add: founding year, number of partner bakers, cities served, technology stack description, team bios, full award details with citation to MIPTAC/MCCI
   - This creates a canonical entity page that ChatGPT and Gemini can use for entity grounding

4. **Add third-party citations to the blog post and FAQ**
   - Reference: Philippine Statistics Authority food service data, DTI MSME reports, or DOST AI adoption statistics
   - Even one external citation per page signals to Perplexity and ChatGPT that claims are externally validated

### Medium-Term — This Month

5. **Create a Wikidata entity for Genie.ph**
   - Go to wikidata.org and create an item with: instance of (online marketplace), country (Philippines), founded (year), official website, headquarters (Cebu City), sameAs links to all social channels
   - This is the fastest path to entering ChatGPT's entity recognition layer without needing Wikipedia notability
   - Wikidata Q-items do not require notability — any verifiable entity can be added

6. **Begin Reddit community engagement**
   - Target subreddits: r/CebuCity, r/Philippines, r/phclassifieds, r/mommyph, r/PinoyFood
   - Strategy: Answer questions about custom cake ordering, event planning, and local bakeries — not promotional, purely helpful
   - One helpful Reddit thread about "how to find a custom cake in Cebu" can generate Perplexity citations within weeks

7. **Enable YouTube video transcripts and add chapter timestamps**
   - For all existing YouTube videos, add manual closed captions and chapter timestamps in descriptions
   - Example chapters: "0:00 What is Genie.ph", "1:30 How to upload a design", "3:00 Pricing explained"
   - Gemini and Perplexity can then extract and cite specific video segments

8. **Fix image optimization pipeline**
   - Remove or conditionally apply `images: unoptimized: true` in next.config.ts — currently bypasses all Next.js image processing
   - Implement a Cloudflare Image Resizing or imgproxy solution since Supabase quota is exceeded
   - Target sub-2-second LCP to improve both Bing Copilot and Google AIO page preference scores

### Strategic — This Quarter

9. **Build a Wikipedia article for Genie.ph**
   - Prerequisite: Secure press coverage from 2-3 notable Philippine outlets (Rappler, BusinessWorld, Inquirer.net, or CNN Philippines)
   - The MIPTAC/MCCI award is a strong notability anchor — pitch the award story to technology and startup reporters
   - Once press coverage exists, create a Wikipedia draft at Draft:Genie.ph citing those sources
   - This is the single action with the highest cross-platform impact (affects ChatGPT +20pts, Perplexity +5pts, Gemini +7pts)

10. **Publish original market research**
    - Conduct and publish a "State of Custom Cakes in Cebu" annual report with: average order values by event type, most popular designs by quarter, baker response time benchmarks, and delivery coverage statistics
    - This original data becomes a primary source that Perplexity, ChatGPT, and Google AIO will cite when answering "custom cake Cebu" queries
    - Distribution: press release to local media, thread on r/CebuCity, LinkedIn post, blog post
    - Target: 3-5 media pickups, which then qualify as Wikipedia references
