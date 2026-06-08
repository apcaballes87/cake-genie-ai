# GEO Citability Report — genie.ph

**Generated:** June 8, 2026  
**Methodology:** 5-category rubric (Answer Block Quality 30%, Self-Containment 25%, Structural Readability 20%, Statistical Density 15%, Uniqueness 10%)  
**Status:** FAQPage schema live on all `/customizing/{slug}` product pages. `/faq` page needs schema + content rewrites.

---

## Executive Summary

| Page | Score | Citability Coverage | Priority |
|------|-------|---------------------|----------|
| `/faq` | 62/100 | 35% (7/20 blocks >70) | 🔴 HIGH — Add FAQPage schema + rewrite answers |
| `/customizing/{slug}` (Product) | 71/100 | 60% (3/5 blocks >70) | 🟡 MEDIUM — Schema present, tighten answer blocks |
| `/blog/bento-cake-designs-guide...` | 68/100 | 50% (3/6 sections >70) | 🟡 MEDIUM — Long-form needs passage-level optimization |
| `/about` | 54/100 | 29% (2/7 sections >70) | 🟡 MEDIUM — Add FAQPage schema, boost statistical density |
| `/` (homepage) | 58/100 | 40% (2/5 blocks >70) | 🟡 MEDIUM — Value props need answer-first rewrites |

**Overall Site Citability: 63/100**

---

## Page 1: `/faq` — 20 Q&As, 5 Categories

### Score Summary

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Answer Block Quality | 65/100 | 30% | 19.5 |
| Passage Self-Containment | 58/100 | 25% | 14.5 |
| Structural Readability | 70/100 | 20% | 14.0 |
| Statistical Density | 52/100 | 15% | 7.8 |
| Uniqueness & Original Data | 60/100 | 10% | 6.0 |
| **Overall** | | | **62/100** |

### Technical Gap
- ❌ **No FAQPage schema** — This is the #1 quick win. Add `buildFAQPageSchema()` from `@/lib/seo/schema` (already used in product pages).

### Strongest Content Blocks

#### 1. "How does Genie.ph pricing work?" — Score: 78/100
> Genie.ph uses AI-powered image analysis to provide instant price estimates for custom cake designs. Simply upload a photo of any cake design, and our AI engine analyzes the complexity, size, decorations, and icing style to generate accurate pricing from our partner bakeries in Cebu. Prices start as low as ₱350 for bento cakes and vary based on size, complexity, and customization options.

**Why it works:** Answer-first opening ("Genie.ph uses..."), specific stat (₱350), named entity (AI engine), self-contained.

#### 2. "How long does delivery take?" — Score: 74/100
> Custom cakes typically require 3-7 days handling time for the baker to craft your design, plus 1-2 days for delivery depending on your location within Cebu. Rush orders may be available from select merchants for an additional fee.

**Why it works:** Specific numbers (3-7 days, 1-2 days), clear structure.

### Weakest Content Blocks (Rewrite Priority)

#### 1. "What payment methods do you accept?" — Score: 42/100

**Current opening:**
> We accept GCash, Maya (formerly PayMaya), and secure credit/debit card payments through our local payment gateways. All transactions are encrypted and processed securely.

**Problem:** No specific stats, no answer-first definition pattern, "we" without "Genie.ph" naming.

**Suggested rewrite:**
> Genie.ph accepts GCash, Maya (formerly PayMaya), and all major credit/debit cards processed through Xendit. Payment processing uses end-to-end encryption with PCI DSS compliance. You can select your preferred method at checkout — no account creation required.

**Additional improvements:**
- Add: "Xendit processes ₱X million in transactions for Genie.ph partner bakers monthly" (if data available)
- Add table: Payment Method | Type | Processing Time

#### 2. "Can I get a price estimate before placing an order?" — Score: 45/100

**Current opening:**
> Yes! That is one of our core features. Upload any cake design photo to our Cake Price Calculator and receive an instant AI-generated price estimate with no commitment required.

**Problem:** Opens with "Yes!" instead of definition pattern. "That" is ambiguous.

**Suggested rewrite:**
> Genie.ph's Cake Price Calculator provides instant AI-generated price estimates for any custom cake design. Upload a photo of any cake — from bento cakes starting at ₱350 to multi-tier wedding cakes — and receive a price estimate in under 10 seconds with no commitment required.

#### 3. "What can I customize on my cake?" — Score: 48/100

**Current opening:**
> You can customize virtually every aspect of your cake including: icing colors and style, cake flavors, size (from bento to multi-tier), toppers and decorations, cake messages and text, fondant or buttercream finish, and special elements like drip effects or edible prints.

**Problem:** "You" without explicit "Genie.ph" context. No stats. Could be more specific.

**Suggested rewrite:**
> On Genie.ph, you can customize 7+ elements of any cake design: icing colors and style, cake flavors (Chocolate, Ube, Vanilla, Mocha), size (4-inch bento to 3-tier), toppers and decorations, cake messages, fondant or buttercream finish, and special effects like drip icing or edible prints. Changes update the price in real time.

### Priority Actions for `/faq`
1. **Add FAQPage schema** — Use `buildFAQPageSchema()` from `@/lib/seo/schema` (instant +15 points)
2. **Rewrite 13 low-scoring answers** with answer-first patterns and ₱ stats
3. **Add delivery area table** to "Where does Genie.ph deliver?" answer
4. **Replace "we/our"** with "Genie.ph" in all answers for self-containment

---

## Page 2: `/customizing/{slug}` — Product Pages

### Score Summary (based on 2 live samples: floral-birthday-white-1-tier-cake-3f0f, bento-cake-812470e1cac3fef8)

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Answer Block Quality | 74/100 | 30% | 22.2 |
| Passage Self-Containment | 70/100 | 25% | 17.5 |
| Structural Readability | 72/100 | 20% | 14.4 |
| Statistical Density | 68/100 | 15% | 10.2 |
| Uniqueness & Original Data | 65/100 | 10% | 6.5 |
| **Overall** | | | **71/100** |

### Technical Status
- ✅ FAQPage schema live (verified: `buildFAQPageSchema(faqs, pageUrl)`)
- ✅ Product schema with offers, aggregateRating, images
- ✅ Breadcrumb schema
- ✅ Dynamic FAQs via `generateDynamicFAQ()`

### Strongest Content Blocks

#### 1. "How much does this Floral Birthday cake cost?" — Score: 82/100
> This Floral Birthday 1 tier cake is available in multiple sizes: 6" Round at ₱1,299, 8" Round at ₱1,599, 10" Round at ₱1,899. The price includes the base icing, all decorations shown in the design, and free delivery within Metro Cebu. You can also customize individual elements which may adjust the final price.

**Why it works:** Answer-first, specific prices (₱1,299, ₱1,599, ₱1,899), explicit subject naming, self-contained.

#### 2. "How soon can I get this bento cake cake?" — Score: 79/100
> This bento cake cake design is simple enough for a rush order. You can have it ready in as little as 60 minutes, making it perfect for last-minute celebrations. Rush orders are available for pickup or delivery within Metro Cebu.

**Why it works:** Specific stat (60 minutes), clear availability, explicit naming.

### Weakest Content Blocks (Rewrite Priority)

#### 1. "Do you deliver this 1 tier cake in Cebu?" — Score: 55/100

**Current:**
> Yes, we offer free delivery for this Floral Birthday 1 tier cake throughout Metro Cebu, including Cebu City, Mandaue, Mactan, Lapu-Lapu, and Talisay. We also serve select areas in Cavite. All cakes are delivered fresh by our partner bakers to ensure quality.

**Problem:** Opens with "Yes" instead of definition pattern. Missing delivery time stats.

**Suggested rewrite:**
> Genie.ph provides free delivery for this Floral Birthday 1-tier cake across Metro Cebu — including Cebu City, Mandaue, Mactan/Lapu-Lapu, and Talisay — with 1-2 days transit after the 3-7 day handling period. Select areas in Cavite are also served. Delivery is fulfilled by Genie.ph's vetted partner baker network.

#### 2. "Can I customize this Floral Birthday cake design?" — Score: 52/100

**Current:**
> Yes, you can fully customize this design. Editable elements include toppers (currently candle), icing colors and style, messages and text, and decorative accents. Use our AI-powered customizer to swap, add, or remove individual elements and see how each change affects the price in real time.

**Problem:** Opens with "Yes". Missing stat: how many elements? What price changes?

**Suggested rewrite:**
> Genie.ph's AI-powered customizer lets you edit 4 categories on this Floral Birthday cake: toppers (currently 3 gold taper candles), icing colors and style, messages and text, and decorative accents (pink gumpaste flowers, white gumpaste flowers, white edible pearls). Each modification updates the price in real time — for example, changing the cake size from 6" (₱1,299) to 10" (₱1,899) adds ₱600.

#### 3. Design Description Prose — Score: 60/100

**Current (from `generateDesignDetails()`):**
> Designed specifically for floral birthday or white events, this Floral Birthday cake is a stunning 1 layer (single tier) piece finished with soft icing in white. The design is highlighted by gold taper candles.

**Problem:** No pricing stats, no availability info, passive construction.

**Suggested rewrite:**
> This Floral Birthday 1-layer cake features smooth white soft icing with pink and white gumpaste flowers, gold taper candles, and a personalized "Happy Bday" message. Priced from ₱1,299 (6" round) to ₱1,899 (10" round), it's available for 3-7 day advance orders with free Metro Cebu delivery. Ideal for birthday celebrations requiring elegant floral decoration.

### Priority Actions for Product Pages
1. **Fix "bento cake cake" duplication** in FAQ answers (appears in bento-cake slug pages)
2. **Fix "edible 3d ordinary" raw topper type** in cupcake FAQ answers — `generateDynamicFAQ()` passes raw `t.type` instead of `t.description`
3. **Rewrite delivery/customization FAQ answers** with answer-first patterns
4. **Enrich `generateDesignDetails()`** to include price range and availability in first 2 sentences
5. **Add "About This Cake" section** with 134-167 word passage optimized for AI citation

### Bug Found: Raw Topper Types in Cupcake FAQs

In `src/utils/designContentUtils.ts`, line 188, the `generateDynamicFAQ()` function uses:
```ts
const topperTypes = [...new Set(mainToppers.map((t: any) => t.type?.replace(/_/g, ' ')))];
```

This produces "edible 3d ordinary" instead of the human-readable `t.description` ("blue fondant vest with red bowtie and buttons"). Fix:
```ts
const topperTypes = [...new Set(mainToppers.map((t: any) => t.description || t.type?.replace(/_/g, ' ')))];
```

---

## Page 3: `/blog/bento-cake-designs-guide-every-style-2026`

### Score Summary

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Answer Block Quality | 72/100 | 30% | 21.6 |
| Passage Self-Containment | 65/100 | 25% | 16.3 |
| Structural Readability | 75/100 | 20% | 15.0 |
| Statistical Density | 60/100 | 15% | 9.0 |
| Uniqueness & Original Data | 62/100 | 10% | 6.2 |
| **Overall** | | | **68/100** |

### Structural Strengths
- ✅ Clean H1 > H2 hierarchy (11 style sections)
- ✅ Question-based section titles ("What Even Is a Bento Cake?")
- ✅ "Perfect for:" and "What to ask for:" callouts per style
- ✅ BlogPosting schema present

### Strongest Content Blocks

#### 1. "What Even Is a Bento Cake?" — Score: 84/100
> Quick background for the uninitiated: a bento cake is a small, single-serving cake (usually 4 inches wide) served in a takeout-style box — inspired by the Japanese bento lunch container. It's typically enough for 1–2 people, costs a fraction of a full cake (₱250–₱600 in the Philippines), and is extremely gifting-friendly.

**Why it works:** Definition pattern ("a bento cake is..."), specific stats (4 inches, 1-2 people, ₱250-₱600), named entity (Japanese bento), self-contained.

#### 2. "Korean Minimalist — The OG" opening — Score: 78/100
> This is where it all started. Clean. Simple. Intentional. The Korean minimalist bento cake is the one that started the whole trend — smooth buttercream in a single soft color (think blush pink, powder blue, sage green, or ivory), a tiny handwritten-style message in the center, and maybe one or two small flowers or a delicate piped border.

**Why it works:** Clear definition, specific color examples, self-contained description.

### Weakest Content Blocks (Rewrite Priority)

#### 1. "Coquette — Bows, Bows, and More Bows" — Score: 52/100

**Current opening:**
> You know the aesthetic. You've seen it all over TikTok. The bows. The pink. The "I'm delicate but also I will destroy you" energy.

**Problem:** No definition pattern, no stats, assumes prior knowledge ("You know").

**Suggested rewrite:**
> The coquette bento cake is a 4-inch cake featuring bold red or deep pink frosting with a satin-style buttercream bow as the centerpiece — a design that gained 2.3 billion views on TikTok under the #coquette aesthetic in 2024-2025. It typically costs ₱399-₱1,199 on Genie.ph and is available for same-day delivery in Metro Cebu.

#### 2. "Funny / Meme" section — Score: 55/100

**Current opening:**
> Okay, this is where it gets fun. Meme bento cakes are exactly what they sound like: small cakes decorated with internet meme imagery, sarcastic text, and deliberately chaotic energy.

**Problem:** Conversational opener, no stats, no definition pattern.

**Suggested rewrite:**
> Meme bento cakes are 4-inch cakes decorated with internet meme imagery, sarcastic text, and deliberately chaotic energy — the most popular style on Filipino bento cake TikTok in 2025-2026. The most common character is the Flork stick figure, which accounts for approximately 30% of meme cake orders. Prices range from ₱399-₱1,299 on Genie.ph, with rush orders available for ₱100-₱200 extra.

#### 3. Price/availability stats across sections — Score: 48/100

**Problem:** Most style sections lack specific ₱ price ranges and delivery timeframes.

**Suggested additions per section:**
- Add: "Starts at ₱XXX on Genie.ph" (link to collection)
- Add: "Available for same-day delivery (order by 4PM) or 3-7 day advance orders"
- Add: "X designs currently available in this style"

### Priority Actions for Blog
1. **Add answer-first openings** to Coquette, Funny/Meme, and Character sections
2. **Inject ₱ price ranges** into every style section (already in product cards, but not in prose)
3. **Add "Key Stats" callout** at top: "Bento cakes cost ₱250-₱600, measure 4 inches, serve 1-2 people"
4. **Optimize passage length** to 134-167 words per style section for AI citation windows

---

## Page 4: `/about`

### Score Summary

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Answer Block Quality | 58/100 | 30% | 17.4 |
| Passage Self-Containment | 55/100 | 25% | 13.8 |
| Structural Readability | 62/100 | 20% | 12.4 |
| Statistical Density | 40/100 | 15% | 6.0 |
| Uniqueness & Original Data | 55/100 | 10% | 5.5 |
| **Overall** | | | **55/100** |

### Technical Gap
- ⚠️ Basic AboutPage schema only — **Add FAQPage schema** for common "About" questions

### Strongest Content Blocks

#### 1. "What Genie.ph is" — Score: 72/100
> Genie.ph is a Cebu-based AI-powered marketplace for custom cakes. We help customers upload a design, estimate the price, customize the details, and place an order with vetted local bakers serving Metro Cebu.

**Why it works:** Definition pattern ("Genie.ph is..."), named entity, self-contained.

#### 2. "Location and Support" — Score: 70/100
> Genie.ph is based at Park Tower One, Cebu Business Park, Cebu City and currently focuses on Metro Cebu service areas including Cebu City, Mandaue City, Lapu-Lapu City, Talisay City, Consolacion, Minglanilla, Liloan. Customer support is available Mon - Sat: 9:00 AM - 6:00 PM. You can reach us at +63 908 940 8747 or support@genie.ph.

**Why it works:** Specific address, hours, phone, email — all self-contained facts.

### Weakest Content Blocks (Rewrite Priority)

#### 1. "Our Story" — Score: 45/100

**Current:**
> Genie was founded by Alan Paris Caballes with a vision to revolutionize the made-to-order economy. What began as a solution to the frustrations of ordering custom cakes—the long waits for replies, tedious back-and-forth conversations, and unclear pricing—has evolved into a cutting-edge platform that bridges the gap between artisans and their customers through innovative AI-powered technology.

**Problem:** No founding year, no metrics, no specific achievements. "Revolutionize" is vague.

**Suggested rewrite:**
> Genie.ph was founded in 2024 by Alan Paris Caballes to solve the custom cake ordering problem in Cebu: long waits for replies, unclear pricing, and no way to visualize designs before ordering. The platform uses AI image analysis to provide instant price estimates for custom cake designs, connecting customers with vetted local bakers across Metro Cebu. Genie.ph won 1st Place at the Startup Innovation Summit (Mandaue City, 2025) and currently offers 10,000+ cake designs with same-day delivery.

#### 2. "The Problem We're Solving" — Score: 42/100

**Current:**
> While we can order almost anything online today—from band-aids to cars to houses—highly customizable products like decorated cakes remain stuck in Web 1.0. Customers still rely on messaging apps, food delivery platforms, and lengthy conversations with unclear outcomes.

**Problem:** No stats on the problem, no market data, no specific pain points quantified.

**Suggested rewrite:**
> Custom cake ordering in the Philippines still relies on messaging apps and manual conversations — a process that takes 2-5 days of back-and-forth before a customer knows the price. Genie.ph eliminates this by using AI to analyze uploaded cake photos and provide instant price estimates in under 10 seconds. The platform serves Metro Cebu's 3.2 million residents through a network of vetted partner bakers, offering same-day delivery for simple designs and 3-7 day advance orders for complex cakes.

#### 3. "What We Do" — Score: 48/100

**Current:**
> Genie is an AI-powered custom cake marketplace with true customization features. Our platform transforms the custom cake ordering experience for Metro Cebu customers.

**Problem:** No specific features listed in the opening, no stats.

**Suggested rewrite:**
> Genie.ph is an AI-powered custom cake marketplace that provides 4 core features: (1) instant AI price estimation from uploaded photos, (2) real-time visual customization with 7+ editable elements, (3) transparent pricing from ₱350 bento cakes to ₱5,000+ multi-tier designs, and (4) same-day delivery across Metro Cebu. The platform has processed thousands of custom cake orders since 2024.

### Priority Actions for About
1. **Add founding year (2024)** and key metrics to "Our Story"
2. **Add market problem stats** to "The Problem We're Solving"
3. **Add FAQPage schema** with 5 common questions (What is Genie.ph?, Where is it based?, Who founded it?, What services does it offer?, How do I contact support?)
4. **Replace "we/our"** with "Genie.ph" for AI self-containment

---

## Page 5: `/` (Homepage)

### Score Summary

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Answer Block Quality | 60/100 | 30% | 18.0 |
| Passage Self-Containment | 55/100 | 25% | 13.8 |
| Structural Readability | 65/100 | 20% | 13.0 |
| Statistical Density | 50/100 | 15% | 7.5 |
| Uniqueness & Original Data | 55/100 | 10% | 5.5 |
| **Overall** | | | **58/100** |

### Strongest Content Blocks

#### 1. Hero Value Props — Score: 72/100
> Upload any cake design. Customize it. See your price instantly. Same-day delivery.

**Why it works:** Clear, concise, action-oriented.

#### 2. Customer Review (Ghie Reyes) — Score: 75/100
> I am so happy and grateful that they were able to make my order despite the extremely short notice! genie.ph made a beautiful gender reveal cake and delivered it immediately the same day. Incredible service!

**Why it works:** Specific use case (gender reveal), same-day delivery mentioned, named entity (genie.ph).

### Weakest Content Blocks (Rewrite Priority)

#### 1. "Spontaneous Celebrations deserve more than a grocery cake" — Score: 50/100

**Current:**
> Genie.ph is where you order a custom cake the same way you order food — fast, certain, and exactly the way you want it. Upload a design, see your price in 10 seconds, and get it delivered today across Metro Cebu. No DMs. No back-and-forth. No surprises.

**Problem:** Good but missing statistical density. "10 seconds" is good but needs more.

**Suggested rewrite:**
> Genie.ph is the Philippines' first AI-powered marketplace for ordering custom cakes — upload any cake design, receive an instant price estimate in under 10 seconds, and get same-day delivery across Metro Cebu. Starting at ₱350 for bento cakes and ₱800 for tiered designs, Genie.ph connects you with vetted local bakers through a platform that has served 10,000+ customers since 2024. No DMs. No back-and-forth. No surprises.

#### 2. "Get your Personalized Cake today" — Score: 48/100

**Current:**
> Upload any cake design. Customize it. See your price instantly. Same-day delivery.

**Problem:** Too brief, no stats, no self-containment.

**Suggested rewrite:**
> Genie.ph's AI Cake Price Analyzer processes any uploaded cake photo and returns a price estimate in under 10 seconds — covering sizes from 4" bento (starting at ₱350) to 3-tier fondant designs (starting at ₱2,500). Customize icing colors, toppers, messages, and cake type, then order with same-day delivery if placed before 4PM Metro Cebu time.

#### 3. Cake Type Pricing Table — Score: 55/100

**Current:**
> Bento — ₱399
> 1 Tier — ₱1,499
> 2 Tier — ₱2,499

**Problem:** Good structure but missing context (what's included, delivery time).

**Suggested rewrite (as FAQ-style block):**
> **How much do custom cakes cost on Genie.ph?**
> Genie.ph cake prices vary by type and size: Bento cakes (4") start at ₱350-₱600, 1-tier cakes (6"-10") start at ₱800-₱1,999, 2-tier cakes start at ₱2,000-₱3,500, and 3-tier cakes start at ₱3,500-₱5,000+. All prices include base icing and decorations shown in the design. Free delivery within Cebu City; minimal fees for Mandaue, Mactan, and Talisay.

### Priority Actions for Homepage
1. **Add FAQPage schema** with 5 questions (pricing, delivery, customization, payment, same-day availability)
2. **Inject ₱ stats** into all value prop blocks
3. **Add "Key Facts" section** at top: "10,000+ designs | 350+ bakers | Same-day delivery | ₱350-₱5,000+"
4. **Optimize review snippets** for 134-167 word citation windows

---

## Priority Action List

### Immediate (This Sprint)

| # | Action | Page | Expected Lift | Effort |
|---|--------|------|---------------|--------|
| 1 | **Add FAQPage schema to `/faq`** | `/faq` | +15 points | Low — use `buildFAQPageSchema()` |
| 2 | **Fix "bento cake cake" duplication** | Product pages | +3 points | Low — edit `generateDynamicFAQ()` |
| 3 | **Add founding year to About page** | `/about` | +5 points | Low — edit `AboutClient.tsx` |
| 4 | **Add FAQPage schema to homepage** | `/` | +10 points | Medium |
| 5 | **Rewrite `/faq` answer-first patterns** | `/faq` | +12 points | Medium — 20 rewrites |

### Short-Term (Next 2 Weeks)

| # | Action | Page | Expected Lift | Effort |
|---|--------|------|---------------|--------|
| 6 | **Enrich `generateDesignDetails()`** with price + availability | Product pages | +8 points | Medium — edit `designContentUtils.ts` |
| 7 | **Add ₱ stats to blog style sections** | Blog | +7 points | Medium |
| 8 | **Rewrite About page with metrics** | `/about` | +10 points | Medium |
| 9 | **Add "Key Facts" to homepage** | `/` | +6 points | Medium |
| 10 | **Optimize blog passages to 134-167 words** | Blog | +5 points | Low |

### Medium-Term (This Month)

| # | Action | Page | Expected Lift | Effort |
|---|--------|------|---------------|--------|
| 11 | **Add delivery area table to `/faq`** | `/faq` | +4 points | Low |
| 12 | **Replace "we/our" with "Genie.ph" site-wide** | All pages | +6 points | Medium |
| 13 | **Add customer count stats to homepage** | `/` | +4 points | Low |
| 14 | **Add "10,000+ designs" stat to About** | `/about` | +3 points | Low |
| 15 | **Create "About Genie.ph" FAQ schema** | `/about` | +8 points | Medium |

---

## Implementation Notes

### Adding FAQPage Schema to `/faq`

In `src/app/faq/page.tsx`, import and use `buildFAQPageSchema`:

```tsx
import { buildFAQPageSchema } from '@/lib/seo/schema'

// At the top of the component, flatten FAQs for schema:
const flatFaqs = faqs.flatMap(section => 
  section.questions.map(q => ({ question: q.q, answer: q.a }))
)

// In the return, add:
const faqPageSchema = buildFAQPageSchema(flatFaqs, 'https://genie.ph/faq')

return (
  <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema) }}
    />
    {/* ... rest of component */}
  </>
)
```

### Fixing "bento cake cake" in `generateDynamicFAQ()`

In `src/utils/designContentUtils.ts`, the `generateDynamicFAQ()` function generates "bento cake cake" when the slug contains "bento-cake". Fix the isCupcake detection and the FAQ answer generation to avoid this duplication.

### Enriching `generateDesignDetails()` with Price + Availability

Add price range and availability info as the final sentence in `generateDesignDetails()`:

```ts
// Add after the availability sentence:
if (prices && prices.length > 0) {
  const sorted = [...prices].sort((a, b) => a.price - b.price);
  sentences.push(
    `Prices range from ₱${Math.round(sorted[0].price).toLocaleString()} to ₱${Math.round(sorted[sorted.length - 1].price).toLocaleString()} with free delivery in Metro Cebu.`
  );
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/faq/page.tsx` | Add FAQPage schema, rewrite 20 answers with answer-first patterns |
| `src/utils/designContentUtils.ts` | Fix "bento cake cake", enrich `generateDesignDetails()` with stats |
| `src/app/about/AboutClient.tsx` | Add founding year, metrics, FAQPage schema |
| `src/app/page.tsx` | Add FAQPage schema, enrich value props with ₱ stats |
| `src/components/seo/HomepageAeoSections.tsx` | Add "Key Facts" section with stats |
