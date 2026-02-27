# Developer Task: Fix SEO Issues on genie.ph (Next.js App Router)

## Project Context
- **Framework**: Next.js 14+ (App Router)
- **Working directory**: `/home/user/cake-genie-ai`
- **Branch**: `claude/fix-genie-seo-issues-teWWn` — develop and push all changes here
- **Live site**: https://genie.ph

---

## Background
An SEO audit on the live site found the following issues. They are listed below in **priority order** — fix them top to bottom. Each section includes the exact file, the exact problem, and step-by-step instructions.

---

## Fix 1 — HIGH PRIORITY: Add FAQ Schema to Homepage
**File**: `src/app/page.tsx`

### Problem
The `/faq` page already has full `FAQPage` JSON-LD schema. The **homepage** (`/`) has none. Google can show rich FAQ snippets for the homepage directly in search results — this is a fast, high-impact win for AI readiness and click-through rate.

### Steps

1. Open `src/app/page.tsx`.

2. Add a new `HomepageFAQSchema` component **above** the existing `WebSiteSchema` function:

```tsx
function HomepageFAQSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How does Genie.ph work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Upload any cake design photo, customize it with our AI-powered editor, and get instant pricing from the best local cakeshops and homebakers in Cebu. Order online in minutes with secure payment via GCash, Maya, or card.',
        },
      },
      {
        '@type': 'Question',
        name: 'How much do custom cakes cost on Genie.ph?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Prices start as low as ₱350 for bento cakes. Standard round cakes start from ₱800 and up depending on size, design complexity, and the baker you choose. Use our free Cake Price Calculator for an instant AI estimate.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does Genie.ph deliver in Cebu?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes! Genie.ph delivers throughout Metro Cebu including Cebu City, Mandaue, Lapu-Lapu (Mactan), Talisay, and select surrounding areas. Delivery coverage depends on your chosen baker.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I upload my own cake design photo?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Absolutely! Upload any cake photo or inspiration image and our AI analyzes it, breaks it into customizable components — icing style, toppers, colors, and messages — then generates accurate pricing from vetted local bakers.',
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

3. Inside the `return ()` block of the `Home` async function, render `<HomepageFAQSchema />` **alongside** the existing `<WebSiteSchema />`:

```tsx
return (
  <>
    <WebSiteSchema />
    <HomepageFAQSchema />
    <LandingClient ...>
      ...
    </LandingClient>
  </>
);
```

---

## Fix 2 — HIGH PRIORITY: Verify & Fix Homepage Meta Description
**Files**: `src/app/page.tsx` and `src/app/layout.tsx`

### Problem
The SEO audit reported the homepage meta description at **118 characters** — just below the 120-character minimum. Google may truncate or rewrite descriptions that are too short. The target is **120–160 characters**.

### Steps

1. Open `src/app/page.tsx`.

2. Find the `metadata` export at the top. The current `description` is:
   > `"Upload any cake design, customize with AI and get instant pricing from the best cakeshops and homebakers in Cebu. Order your custom cake online today!"`

3. Count the length with: `echo -n "your description here" | wc -c`

4. If it is under 120 characters, update it. The target description (already 150 chars and optimized for keywords + CTA) is:
   > `"Upload any cake design, customize with AI, and get instant pricing from top cakeshops and homebakers in Cebu. Order your perfect custom cake online today!"`

5. Update the matching `openGraph.description` in the same `metadata` object to the same new string.

6. Open `src/app/layout.tsx` and apply the same check and update to the `description` field in the root-level `metadata` export (this is the fallback for all other pages).

---

## Fix 3 — MEDIUM PRIORITY: Fix Image Dimensions to Prevent CLS (Layout Shift)
**Files**: `src/components/ProductCard.tsx`, `src/components/landing/PopularDesigns.tsx`, `src/app/blog/[slug]/BlogContent.tsx`, `src/app/cart/CartClient.tsx`

### Problem
42 out of 67 images are missing explicit `width`/`height` attributes (or aspect ratio hints), causing **Cumulative Layout Shift (CLS)** — the browser can't reserve vertical space before the image loads, so content jumps when images appear.

### Steps

#### A. `src/components/ProductCard.tsx` (line ~80)
Find the `<LazyImage>` inside the `CardContent` block. It currently uses:
```tsx
width={0}
height={0}
style={{ width: '100%', height: 'auto' }}
```
Add an `aspectRatio` hint so the browser reserves space before the image loads. Change to:
```tsx
width={0}
height={0}
style={{ width: '100%', height: 'auto', aspectRatio: '3/4' }}
```
> Rationale: Most cake photos are portrait-orientation (~3:4). This single change eliminates CLS for the entire product grid.

#### B. `src/components/landing/PopularDesigns.tsx`
Find the `<LazyImage>` inside the masonry grid. It currently uses:
```tsx
width={0}
height={0}
sizes="..."
style={{ width: '100%', height: 'auto' }}
```
Apply the same fix — add `aspectRatio: '3/4'` to the `style` prop:
```tsx
style={{ width: '100%', height: 'auto', aspectRatio: '3/4' }}
```

#### C. `src/app/blog/[slug]/BlogContent.tsx` (line ~30)
Find the regex replacement that converts markdown `![alt](src)` into an `<img>` tag. It currently outputs:
```html
<img src="$2" alt="$1" class="w-full h-auto rounded-xl my-8 shadow-md border border-purple-100" loading="lazy" />
```
Add explicit width/height attributes to prevent CLS on blog images:
```html
<img src="$2" alt="$1" width="800" height="600" class="w-full h-auto rounded-xl my-8 shadow-md border border-purple-100" loading="lazy" />
```

#### D. `src/app/cart/CartClient.tsx` (line ~1662)
Find the raw `<img>` tag for payment method logos. It currently has no `width`/`height`. The element already has class `h-10 w-16` — add matching explicit attributes:
```tsx
<img
  key={method.name}
  src={method.logoUrl}
  alt={method.name}
  title={method.name}
  width={64}
  height={40}
  className="h-10 w-16 object-contain rounded-md bg-white p-1 border border-slate-200 shadow-sm"
/>
```

---

## Fix 4 — MEDIUM PRIORITY: Audit Render-Blocking Scripts
**File**: `src/app/layout.tsx`

### Problem
The audit detected **1 render-blocking script in `<head>`**. This delays First Contentful Paint (FCP).

### Steps

1. Run this command to check for any blocking scripts:
   ```bash
   grep -rn "beforeInteractive\|<script " src/app/layout.tsx src/app/page.tsx
   ```

2. Confirm that ALL `<Script>` components in `layout.tsx` use `strategy="lazyOnload"` or `strategy="afterInteractive"`. The current scripts (Microsoft Clarity and Google Analytics) already use `strategy="lazyOnload"` — **no change needed for these**.

3. The `OrganizationSchema` component renders a raw `<script type="application/ld+json">` directly inside `<body>`. This is correct and does **not** block rendering. Confirm it stays in `<body>`, not moved to `<head>`.

4. If the grep in step 1 reveals any `strategy="beforeInteractive"` or plain `<script src="...">` tags anywhere in layout files, move them to use Next.js `<Script strategy="lazyOnload">` instead.

5. Check `src/components/TawkToChat.tsx` — the current implementation defers loading until user interaction (scroll/mousemove/touchstart/keydown). This is already optimal; **no change needed**.

---

## Fix 5 — ALREADY RESOLVED: Referrer-Policy Header
**File**: `next.config.ts`

The `Referrer-Policy: strict-origin-when-cross-origin` header is **already configured** in `next.config.ts` inside the `async headers()` function. **No action needed.** The audit likely ran against an older deployment.

---

## Fix 6 — LOW PRIORITY: HTML Size & Text-to-HTML Ratio
**File**: `src/app/LandingClient.tsx`

### Problem
The HTML payload is 342KB and the text-to-HTML ratio is 2% (target: 25%+). The large `LandingClient.tsx` (~50KB of source) is a client-side React component with dense Tailwind class strings.

### Steps (quick wins only — do not refactor the component)

1. Open `src/app/LandingClient.tsx` and scan for any commented-out code blocks (lines starting with `{/*` or `//`). Remove dead code that is no longer used.

2. Check if any large data objects (e.g., `quickLinks`, `occasionLinks`, `cakeStyles` arrays defined inline in the file) contain unused entries. Remove any entries that are never rendered.

3. Do **not** attempt to restructure the component, split it, or move logic out — that would be over-engineering. The primary gains come from the higher-priority fixes above.

---

## Fix 7 — LOW PRIORITY: Script Count
**Status**: Partially inherent to Next.js architecture

### Problem
33 total scripts detected. Most are Next.js code-split chunks (unavoidable with App Router).

### Steps (verification only — no code changes expected)

1. Confirm `TawkToChat` only injects its script on user interaction — it already does. ✓
2. Confirm GA + Clarity use `strategy="lazyOnload"` — they already do. ✓
3. No action needed. The script count is largely a Next.js code-splitting artifact.

---

## Git Instructions

```bash
# Make sure you're on the right branch
git checkout claude/fix-genie-seo-issues-teWWn

# After each fix, commit individually with a clear message, e.g.:
git add src/app/page.tsx
git commit -m "seo: add FAQ schema to homepage for rich snippets"

git add src/app/page.tsx src/app/layout.tsx
git commit -m "seo: verify and update meta description to 120-160 chars"

git add src/components/ProductCard.tsx src/components/landing/PopularDesigns.tsx src/app/blog/[slug]/BlogContent.tsx src/app/cart/CartClient.tsx
git commit -m "seo: add aspect ratio and width/height hints to fix CLS on images"

# Push when done
git push -u origin claude/fix-genie-seo-issues-teWWn
```

---

## Priority Summary

| # | Issue | File(s) | Action |
|---|-------|---------|--------|
| 1 | FAQ schema on homepage | `src/app/page.tsx` | Add `HomepageFAQSchema` component |
| 2 | Meta description too short | `src/app/page.tsx`, `src/app/layout.tsx` | Verify 120–160 chars; update if needed |
| 3 | Image CLS (missing dimensions) | `ProductCard.tsx`, `PopularDesigns.tsx`, `BlogContent.tsx`, `CartClient.tsx` | Add `aspectRatio` style + `width`/`height` |
| 4 | Render-blocking script audit | `src/app/layout.tsx` | Verify no `beforeInteractive` scripts exist |
| 5 | Referrer-Policy header | `next.config.ts` | **Already fixed — no action** |
| 6 | HTML size / text ratio | `LandingClient.tsx` | Remove dead/commented-out code only |
| 7 | Script count (33) | Various | **No action — Next.js artifact** |
