# Genie.ph AIO/GEO Audit Sprint

Date: 2026-06-29

## Purpose

This read-only audit plan tracks Genie.ph against the three AI citation layers: retrieval, source preference, and final selection. Thread statistics from the deno/Tailblazer summary are treated as strategic input, not independently verified facts.

## Layer 1: Retrieval

Track whether Genie.ph appears in the top 20 on Google and Bing for:

- custom cakes Cebu
- cake delivery Cebu
- same-day cake delivery Cebu
- birthday cake Cebu
- bento cake Cebu
- best cake shops Cebu
- custom cake price Cebu

Record for each keyword:

- Google rank and landing URL
- Bing rank and landing URL
- indexed page title and meta description
- whether the ranking page has visible answer-first copy
- whether the ranking page has schema for WebPage, Breadcrumb, FAQ, Product, CollectionPage, or LocalBusiness as applicable
- whether the ranking page exposes current pricing, delivery, review, or design-count data in plain HTML

## Layer 2: Source Preference

Run manual checks in ChatGPT, Perplexity, Claude, and Google AI interfaces for vendor-shortlist prompts such as:

- best custom cake shops in Cebu
- where can I order a birthday cake in Cebu online
- same day cake delivery Cebu
- bento cake delivery Cebu
- custom cake price Cebu

Record whether Genie.ph is:

- cited with a URL
- mentioned without a citation
- absent
- described accurately
- paired with outdated pricing, delivery, or trust facts

## Layer 3: Selection

Track selection signals that influence whether Genie.ph is picked from the candidate set:

- unlinked brand mentions: `Genie.ph`, `Genie Cebu Cakes`, and `Genie Philippines`
- branded anchor text using `Genie.ph`
- refreshed owned pages within the last 60-90 days
- answer-first paragraphs on high-intent templates
- visible proof points: review count, starting price, Metro Cebu delivery, secure checkout, Startup Innovation Summit award, and support channels

Do not automate posting to Reddit, Quora, YouTube, or forums. Automation should only monitor, draft, and report. Human review is required before any community participation.

## Current Owned-Surface Status

- Homepage: has LocalBusiness/FAQ schema, key facts, reviews, and an answer-first Genie.ph facts block.
- Local SEO pages: have WebPage, Service, Breadcrumb, FAQ schema, visible FAQ, pricing cards, coverage areas, and answer-first copy.
- Collections: have CollectionPage, ItemList, Breadcrumb, FAQ schema, visible collection FAQ, answer-first copy, and real design counts.
- Blog posts: have BlogPosting/Breadcrumb schema, related design modules, answer summary, and published/reviewed dates.
- `public/llms.txt`: exposes AI-agent guidance, key facts, route map, and current audit priorities.

## Manual External Footprint Tracker

Create a simple sheet with these columns before using paid APIs:

- source URL
- platform type: Reddit, Quora, YouTube, article, directory, review, partner, news
- mention type: linked, unlinked, branded anchor, non-branded anchor
- exact brand text
- topic/query supported
- sentiment: positive, neutral, negative, spam risk
- date found
- action needed

Potential assets for human-reviewed seeding:

- Cebu cake ordering guide answer
- bento cake delivery answer
- same-day cake delivery caveats
- one-minute Genie.ph demo video transcript
- customer review snippets
- baker/marketplace proof points
- comparison snippets versus social media ordering and traditional bakeries

## Verification Checklist

- Fetch raw HTML for `/`, `/cake-delivery-cebu`, `/birthday-cake-delivery-cebu-city`, `/collections/bento-cake`, `/blog/custom-cake-cebu-guide-2026`, `/faq`, and `/llms.txt`.
- Confirm the answer-first text appears without client interaction where the route is server-rendered.
- Confirm JSON-LD is present and does not contain raw provider internals or private data.
- Run focused tests for changed templates.
- Run `npm run build` before shipping.
