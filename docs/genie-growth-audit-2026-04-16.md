# Genie.ph Growth Audit
## Conversion + Sales Review

Date: April 16, 2026

Prepared from:
- Google Analytics 4 property `properties/510070439`
- Google Search Console property `sc-domain:genie.ph`
- Live-site review of `https://genie.ph/`
- Codebase review of analytics + funnel instrumentation

---

# 1. Executive Summary

- Traffic is growing very fast. GA sessions rose from `2,943` to `6,235` in the last 28-day comparison window (`+112%`).
- Search visibility is compounding. GSC shows `3,591` clicks and `237,755` impressions in the last 90 days, with average position improving to `5.6`.
- One SEO article is carrying acquisition: `/blog/jollibee-vs-mcdonalds-kids-party-packages-2026`.
- The on-site behavior that looks most like buying happens in `search -> customizing -> cart`, not on the blog.
- That `search -> customizing -> cart` path refers to Genie’s internal search flow, not Google Images.
- Google Images is sending some design-led discovery traffic, but it is not yet showing a measurable purchase signal in GA.
- Clarity shows the audience is strongly mobile and Cebu-heavy, with concentrated dead clicks on the top blog post and some friction in cart/customizer.
- Revenue exists, but source attribution is currently dirty. Purchases are being credited to referral sources like `cakesandmemories.com` and `checkout.xendit.co`, which strongly suggests attribution leakage.
- The biggest growth opportunity is not “more traffic.” It is turning the huge informational traffic pool into commercial intent and fixing measurement so we can see what actually drives sales.

---

# 2. What Changed Recently

Comparison window:
- Current: `March 19, 2026` to `April 15, 2026`
- Previous: `February 19, 2026` to `March 18, 2026`

Topline GA:

| Metric | Current | Previous | Change |
| --- | ---: | ---: | ---: |
| Sessions | 6,235 | 2,943 | +112% |
| Users | 5,260 | 2,113 | +149% |
| Engaged sessions | 1,937 | 1,463 | +32% |
| Page views | 9,609 | 6,527 | +47% |
| Purchases | 7 | 4 | +75% |
| Purchase revenue | ₱6,593 | ₱782 | +743% |

Interpretation:
- Volume is up much faster than engagement quality.
- Revenue is up, but source attribution is not trustworthy enough yet to say exactly which acquisition source caused the lift.

---

# 3. Where Customers Are Coming From

GA session mix, current 28 days:

| Channel | Sessions | Share | Engaged Sessions | Engaged Rate |
| --- | ---: | ---: | ---: | ---: |
| Direct | 2,896 | 46.4% | 305 | 10.5% |
| Organic Search | 2,580 | 41.4% | 1,235 | 47.9% |
| Referral | 422 | 6.8% | 295 | 69.9% |
| Organic Social | 254 | 4.1% | 93 | 36.6% |
| Unassigned | 58 | 0.9% | 9 | 15.5% |
| Paid Social | 24 | 0.4% | 0 | 0.0% |

Important nuance:
- `Direct` is the biggest traffic bucket, but it is very low quality.
- `Organic Search` is the strongest scaled acquisition source by far.
- `Referral` looks unusually strong because it contains attribution pollution from `checkout.xendit.co`, `cakesandmemories.com`, and internal/self-referral behavior.
- AI and assistant traffic is already appearing: `chatgpt.com`, `gemini.google.com`, and `perplexity` are present, but still small.

What this means:
- Real top-of-funnel growth is coming from Google.
- Real buyer intent seems more likely to be coming from branded/direct, product exploration, and partner/referral flows.
- Current “source to sale” reporting cannot yet be trusted for budget decisions.

---

# 4. What Search Is Doing

GSC, last 28 days:

Top search pages:

| Page | Clicks | Impressions | CTR | Avg Position |
| --- | ---: | ---: | ---: | ---: |
| `/blog/jollibee-vs-mcdonalds-kids-party-packages-2026` | 1,536 | 61,633 | 2.49% | 4.1 |
| `/blog/how-to-get-marriage-license-metro-cebu` | 132 | 4,845 | 2.72% | 3.7 |
| `/blog/red-ribbon-vs-goldilocks-birthday-cake-2026` | 40 | 7,091 | 0.56% | 4.6 |
| `/` | 28 | 420 | 6.67% | 10.8 |
| `/blog/best-play-areas-kids-birthday-parties-metro-cebu-2026` | 23 | 641 | 3.59% | 7.0 |

Top queries:

| Query | Clicks | Impressions | CTR | Avg Position |
| --- | ---: | ---: | ---: | ---: |
| `jollibee party package price list 2026` | 188 | 4,848 | 3.88% | 1.3 |
| `mcdo party package price list 2026` | 162 | 1,675 | 9.67% | 1.2 |
| `jollibee party package` | 75 | 6,160 | 1.22% | 3.9 |
| `jollibee birthday package 2026` | 66 | 2,310 | 2.86% | 1.8 |
| `jollibee party package 2026` | 53 | 2,031 | 2.61% | 1.9 |

Interpretation:
- SEO is working.
- The dominant intent is “children’s fast-food party package research,” not “I need to buy a cake right now.”
- Genie’s commercial pages are not yet winning the core money keywords like `cake delivery cebu`, `custom cake cebu`, `same day cake delivery cebu`, and `bento cake cebu`.

---

# 5. What Pages People Visit

GA landing pages, current 28 days:

| Landing Page | Sessions | Engaged Sessions | Bounce Rate | Purchases | Revenue |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/blog/jollibee-vs-mcdonalds-kids-party-packages-2026` | 1,620 | 773 | 52.3% | 0 | ₱0 |
| `/` | 421 | 241 | 42.8% | 0 | ₱0 |
| `(not set)` | 196 | 2 | 99.0% | 0 | ₱0 |
| `/blog/how-to-get-marriage-license-metro-cebu` | 189 | 75 | 60.3% | 0 | ₱0 |
| `/customizing` | 124 | 97 | 21.8% | 2 | ₱2,198 |
| `/cart` | 22 | 14 | 36.4% | 1 | ₱499 |

Most-viewed pages:

| Page | Page Views | Users | Avg Session Duration | Bounce Rate |
| --- | ---: | ---: | ---: | ---: |
| `/blog/jollibee-vs-mcdonalds-kids-party-packages-2026` | 1,784 | 1,399 | 122s | 54.1% |
| `/` | 1,435 | 438 | 192s | 33.1% |
| `/customizing` | 1,017 | 306 | 245s | 18.0% |
| `/cart` | 308 | 82 | 226s | 9.0% |
| `/coldcaking` | 230 | 84 | 239s | 55.2% |
| `/search` | 155 | 94 | 203s | 44.4% |

Interpretation:
- The blog is the biggest front door.
- The homepage is a strong second-stage persuader.
- `customizing` and `cart` are where user quality becomes meaningfully stronger.
- The funnel is there, but the content-to-commerce bridge is weak.

---

# 6. What They Are Doing On The Website

Tracked funnel-like events, current 28 days:

| Event | Count | Users | Main Place It Happens |
| --- | ---: | ---: | --- |
| `view_search_results` | 53 | 51 | `/search` |
| `start_design` | 120 | 44 | `/search` |
| `update_design` | 453 | 87 | mostly `/customizing` |
| `form_start` | 132 | 82 | `/cart`, `/creators`, `/login`, `/customizing` |
| `purchase` | 7 | 7 | `/order-confirmation` |

Behavior read:
- Users are using search.
- Users do start designing after search.
- Users spend meaningful time in the customizer and cart.
- Purchase volume exists, but the measurement between customizer/cart and purchase is under-instrumented.

Most important funnel insight:
- The product experience is probably better than the analytics makes it look.
- The reporting between `product interaction -> add to cart -> checkout -> purchase` is incomplete, which hides where the biggest leaks really are.
- The clearest buyer-like path we can currently confirm is:
- `Google/direct/referral -> Genie internal search (/search) -> customizing -> cart`

---

# 7. Second Pass: Google Images

GSC image-search window:
- `January 16, 2026` to `April 15, 2026`

Top image-search landing pages:

| Page | Image Clicks | Impressions | CTR | Avg Position |
| --- | ---: | ---: | ---: | ---: |
| `/` | 19 | 1,590 | 1.19% | 47.4 |
| `/blog/jollibee-vs-mcdonalds-kids-party-packages-2026` | 7 | 2,679 | 0.26% | 27.5 |
| `/blog/red-ribbon-vs-goldilocks-birthday-cake-2026` | 7 | 4,363 | 0.16% | 36.2 |
| `/customizing/katseye-kpop-white-1-tier-0e3f` | 6 | 1,731 | 0.35% | 29.6 |
| `/customizing/pink-minimalist-light-pink-bento-cake-f707` | 6 | 7,885 | 0.08% | 49.3 |

Top image-search queries:

| Query | Clicks |
| --- | ---: |
| `katseye cake` | 7 |
| `katseye cake design` | 4 |
| `99 nights in the forest cake` | 3 |
| `kuromi cake design` | 2 |
| `minimalist cake design` | 2 |

What this means:
- Google Images is working as a small inspiration/discovery channel, especially for theme-led and design-led searches.
- The image clicks are landing on the homepage, comparison content, and specific customizer/template pages.
- This is useful because it shows Genie already has visual-search demand for custom cake designs.

Can we say people are buying from Google Images?
- Not confidently yet.
- GSC can show image clicks, but GA does not currently break Google Images into a separate clean source bucket in this setup.
- In GA, the `google / organic` sessions landing on the image-like pages that rank in Google Images showed `0` recorded ecommerce purchases in the last 28 days.
- Current read: Google Images is helping discovery and idea generation, but it is not yet a proven sales source.

Implication:
- We should treat Google Images as top/mid-funnel demand and add stronger commercial bridges on image-attracting pages:
- clearer “customize this design now” CTA
- delivery promise near the hero image
- faster path from inspiration page to customizer/cart

---

# 8. Second Pass: Microsoft Clarity Review

Clarity review window:
- `March 19, 2026` to `April 15, 2026`

Where visitors are coming from geographically:

| City | Sessions |
| --- | ---: |
| Cebu City | 651 |
| Quezon City | 326 |
| Manila | 190 |
| Lahug | 131 |
| Makati City | 115 |

Device/browser mix:
- `Mobile Chrome`: 1,431 sessions
- `Mobile Safari`: 786 sessions
- `PC Chrome`: 819 sessions

Top entry pages in Clarity:

| Entry Page | Sessions |
| --- | ---: |
| `/blog/jollibee-vs-mcdonalds-kids-party-packages-2026` | 1,670 |
| `/` | 404 |
| `/customizing` | 297 |
| `/blog/how-to-get-marriage-license-metro-cebu` | 192 |
| `/coldcaking` | 67 |

Top friction signals:
- Dead clicks: `1,903`
- Rage clicks: `135`
- Quick backs: `397`

Top dead-click pages:

| Page | Dead Clicks |
| --- | ---: |
| `/blog/jollibee-vs-mcdonalds-kids-party-packages-2026` | 683 |
| `/blog/how-to-get-marriage-license-metro-cebu` | 239 |
| `/customizing` | 197 |
| `/` | 193 |
| `/cart` | 58 |

Top rage-click pages:

| Page | Rage Clicks |
| --- | ---: |
| `/blog/jollibee-vs-mcdonalds-kids-party-packages-2026` | 89 |
| `/` | 18 |
| `/customizing/nezuko-demon-slayer-cake-fce6` | 17 |
| `/blog/how-to-get-marriage-license-metro-cebu` | 6 |
| `/customizing` | 4 |

What session recordings suggest:
- On the Jollibee/McDo blog post, visitors keep clicking package rows, comparison cells, and text blocks as if they are interactive.
- In cart and checkout-adjacent flows, some users are clicking around pickup/contact areas and zoomed cake previews without getting feedback.
- High-intent traffic from `cakesandmemories.com` behaves much more like buyers: product/customizer entry, cart progression, then login/cart friction.

What this means:
- The biggest traffic page is informative, but it is currently absorbing clicks that should be redirected into an explicit conversion path.
- Some parts of the cart/customizer experience look tappable without responding clearly enough, especially on mobile.
- Mobile UX matters more than anything else here because the majority of real sessions are on mobile browsers.

What to fix from Clarity first:
- Add earlier, unmistakable CTA blocks on the top blog post.
- Make comparison tables/cards either clickable or visibly non-clickable.
- Reduce dead-click surfaces in cart and the customizer.
- Review login friction for users who already look ready to buy.

---

# 9. Second Pass: Commercial Local SEO Opportunities

DataForSEO local keyword read:
- Cebu City Google Ads location: `Cebu City, Central Visayas, Philippines`
- Philippines-wide labs view used as a second lens for broader demand

Best local commercial opportunities in Cebu City:

| Keyword | Cebu City Search Volume | Competition | CPC |
| --- | ---: | --- | ---: |
| `bento cake cebu` | 30 | Low | n/a |
| `cake delivery cebu` | 10 | High | 0.27 |
| `cebu cake delivery` | 10 | High | 0.27 |
| `cake delivery cebu city` | 10 | High | 0.27 |
| `birthday cake delivery cebu city` | 10 | n/a | n/a |

Broader Philippines demand check:
- `bento cake cebu`: `50` monthly searches, low competition
- `cebu cake delivery`: `30` monthly searches, high competition, CPC `0.38`
- `cake delivery cebu`: meaningful demand and clear transactional intent

Important nuance:
- `same day cake delivery cebu`
- `custom cake cebu`
- `cake design cebu`

These did not show strong exact-match keyword volume in the Cebu City pull, but they still matter commercially because they mirror how buyers think when they are close to ordering.

What this means:
- `bento cake cebu` is the cleanest SEO+conversion opportunity right now: real demand, lower competition, strong product fit.
- `cake delivery cebu` and its city/order variants are still money terms, but they are more competitive and need a stronger landing-page experience to win.
- Genie should not wait for big exact-match keyword numbers before using “same-day,” “custom,” and “cake design” language in landing pages and product modules.

Recommended page cluster to build or improve:
- `/bento-cake-cebu`
- `/cake-delivery-cebu`
- `/cake-delivery-cebu-city`
- `/birthday-cake-delivery-cebu-city`
- `/kids-party-cakes-cebu`

Each page should include:
- exact local promise: Cebu City / Metro Cebu coverage
- delivery speed and cutoff times
- pricing clarity or “starts at” guidance
- proof: reviews, completed orders, sample designs
- direct CTA into `customizing` or a prefilled search/collection page

---

# 10. What Is Working

- SEO content is clearly working. Genie is earning meaningful organic visibility fast.
- The rush-order / same-day delivery proposition is strong and easy to understand on the homepage.
- The customizer is a real asset. Users who reach it show much better engagement than generic content visitors.
- Search-to-design behavior is real. People are not just browsing, they are trying to create.
- Social proof is strong. Reviews and “verified” signals help credibility.
- `cakesandmemories.com` appears to send high-intent traffic. If this is a controlled partner property, it is worth formalizing as a deliberate acquisition channel.
- Visual search demand exists. Google Images is already surfacing design-led and themed cake pages.

---

# 11. What Is Not Working

- Acquisition is heavily concentrated in one blog post. That is a risk.
- The top SEO traffic is mostly adjacent intent, not direct cake-buying intent.
- Blog readers are not being converted aggressively enough into shoppers.
- The homepage and commercial/category pages are under-optimized for high-intent local keywords.
- Attribution is broken enough that source-to-sale reporting is unreliable.
- Dev traffic is polluting GA via `localhost:3002`.
- Self-referrals and payment-gateway referrals are polluting purchase attribution.
- There is a large `(not set)` landing-page bucket, which usually means instrumentation gaps or session-quality issues.
- The biggest traffic page is generating large amounts of dead clicks and rage clicks.
- Image-search landing pages are not yet monetized well enough to show measurable purchase signal.
- Cart/customizer mobile interactions still have friction in places where users expect clear feedback.

---

# 12. Objective Website Review

What felt strong from the live site:
- The value proposition is clear: `same-day`, `instant pricing`, `Metro Cebu`.
- The “see your price change in real time” block is one of the strongest conversion assets on the site.
- The overall offer feels differentiated from ordinary bakery sites.

What felt weak or risky:
- The biggest acquisition page puts the sales CTA too late. The strongest commercial prompt is near the end of the article.
- The customizer starts from a blank state. That is good for motivated users, but harder for first-time visitors who need guidance.
- The homepage is persuasive, but it still behaves more like a general brand page than a high-converting local landing page for commercial search.
- The site attracts broad “party planning” traffic, but the conversion path into “buy a cake now” is not forceful enough.

---

# 13. What We Should Fix First

## Priority 1: Fix Measurement

- Exclude `localhost` from GA so dev traffic stops polluting reporting.
- Exclude or properly handle self-referrals and payment referrals:
- `checkout.xendit.co`
- `genie.ph`
- `cakesandmemories.com` if it is owned by Genie or part of the same journey
- Make `add_to_cart`, `begin_checkout`, `search`, `sign_up`, and related product events flow into GA consistently.
- Mark the real funnel events as key events:
- `start_design`
- `add_to_cart`
- `begin_checkout`
- `purchase`

Status:
- I already patched two code-side issues today:
- shared analytics helpers now send real GA4 events instead of GTM-style objects
- GA no longer loads in local development

## Priority 2: Monetize The Blog Traffic

- Add a sticky or inline CTA block much earlier in the top-performing blog posts.
- Make the most-clicked comparison modules interactive or redesign them so they stop looking clickable.
- Build a dedicated landing page for `kids party cakes in Cebu` and link to it repeatedly from the Jollibee/McDo article.
- Add direct product modules inside blog posts:
- “Match this party theme with a cake”
- “Rush cakes available today”
- “Get instant price for your child’s theme”

## Priority 3: Strengthen Commercial SEO

- Create or improve landing pages targeting:
- `cake delivery cebu`
- `custom cake cebu`
- `same day cake delivery cebu`
- `bento cake cebu`
- `birthday cake delivery cebu`
- Push more internal links from informational articles into these commercial pages.

## Priority 4: Fix Mobile Friction In Product + Cart

- Review dead-click zones in `/customizing` and `/cart`.
- Make tappable elements visually obvious and give faster feedback after taps.
- Reduce login/account friction for users who already have items in cart or arrive from high-intent referral flows.

---

# 14. What We Should Double Down On

- Double down on Google organic, but bias new content toward commercial adjacency, not just informational volume.
- Double down on the customizer. It is a conversion asset, not just a feature.
- Double down on same-day / rush delivery messaging. That feels like the clearest differentiator.
- Double down on kids-party themed cake entry points because the biggest SEO winner already proves there is demand there.
- Double down on `bento cake cebu` and related local commercial landing pages because the demand is clean and the competition is relatively softer.
- Double down on local trust:
- Cebu coverage
- verified reviews
- delivery certainty
- clear payment options

Best next bets for content that can actually sell:
- “Best kids party cakes in Cebu by theme”
- “Rush birthday cakes in Cebu you can order today”
- “Jollibee theme cake ideas”
- “McDo theme cake ideas”
- “Bento cake delivery Cebu”

---

# 15. Recommended 30-Day Action Plan

Week 1:
- Fix referral exclusions and GA key-event setup
- QA the patched GA events in production
- Remove or restyle the biggest dead-click surfaces on the Jollibee/McDo article
- Add early CTA modules to the top 3 blog posts

Week 2:
- Launch one dedicated landing page for `kids party cakes in Cebu`
- Launch or improve one dedicated landing page for `bento cake cebu`
- Add product cards and “available today” modules to the Jollibee/McDo article
- Improve homepage copy for `cake delivery cebu` intent

Week 3:
- Tighten the customizer entry experience with:
- sample starting templates
- popular kids-party presets
- stronger delivery/trust reassurance beside the first CTA
- Review and fix mobile dead-click friction in `/customizing` and `/cart`

Week 4:
- Review:
- blog-to-customizer click-through rate
- image-page-to-customizer click-through rate
- customizer start rate
- add-to-cart rate
- checkout start rate
- purchase rate

Success metric for the next 30 days:
- Not just more sessions
- Higher `blog -> customizer` clicks
- Higher mobile progression from `customizing -> cart`
- Higher `customizer -> cart` progression
- Higher purchase rate from non-referral traffic

---

# 16. Bottom Line

- What is working: SEO growth, the same-day value proposition, and the customizer experience.
- What is not working: the traffic-to-commerce bridge, mobile friction on high-traffic/high-intent pages, commercial SEO focus, and analytics trustworthiness.
- What we should fix: measurement first, then dead-click/friction issues, then blog monetization, then local commercial landing pages.
- What we should double down on: same-day custom cakes, kids-party intent, internal search/customize flow, and `bento cake cebu` demand.

If the north star is higher conversion rate and more sales, the best move is:
- Keep the SEO engine running
- Point it harder at commercial intent
- Turn the winning blog traffic into shoppers
- Fix the tracking so every future decision is based on real funnel truth
