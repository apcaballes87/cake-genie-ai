/**
 * Pure helpers used by `generateMetadata` for the `/customizing/[slug]` route
 * and by `<DesignSchema>` for SKU/MPN/AggregateRating resolution.
 *
 * This module is intentionally free of React imports and I/O so the helpers
 * can be unit-tested in isolation.
 *
 * Requirements: R1, R4, R5, R6 (see .kiro/specs/customizing-pdp-seo-fixes/requirements.md).
 */

/**
 * Minimum base price (1 Tier / 4in / 6" Round = ₱1,099) used as fallback
 * when a design has no valid cakeType or cached price.
 */
export const FALLBACK_MIN_PRICE = 1099;

/**
 * Title_Budget is `60 - len(' | Genie.ph') = 60 - 11 = 49` (R6.1).
 * The root layout `metadata.title` template appends ` | Genie.ph`, so the
 * in-route title must stay under this budget to keep the rendered `<title>`
 * within Google's ~60 cp SERP cap.
 */
export const TITLE_BUDGET = 49;

/** Allowed Price_Segment numeric upper bound (R6.4). */
const PRICE_MAX = 9_999_999;

/**
 * Truncates `text` to a maximum length at a word boundary.
 *
 * Contract (R5.1, R6.7):
 * - `result.length <= maxLength` always.
 * - NEVER appends `'...'` or `'…'`. Callers must handle their own ellipsis
 *   policy (see `optimizeMetaDescription` for the trailing-punct strip).
 * - Truncates at the last space character within `text.slice(0, maxLength)`.
 * - If no space exists in that window, falls back to `text.slice(0, maxLength)`.
 */
export function truncateToWordBoundary(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    const slice = text.slice(0, maxLength);
    const lastSpace = slice.lastIndexOf(' ');
    if (lastSpace > 0) {
        return slice.slice(0, lastSpace);
    }
    return slice;
}

/**
 * Boilerplate-sentence filter (preserved verbatim from the inline implementation
 * in `page.tsx`). Drops sentences that match well-known Genie.ph CTA / brand
 * phrases so the meta description retains only unique, descriptive prose.
 */
function filterBoilerplateSentences(descriptionText: string): string {
    const sentences = descriptionText.split(/(?<=\.)\s+/);
    const filtered = sentences.filter((sentence) => {
        const s = sentence.toLowerCase().trim();
        if (s.includes('genie.ph')) return false;
        if (s.includes('delivery in cebu') || s.includes('delivery in cavite')) return false;
        if (s.includes('order your') && s.includes('today')) return false;
        if (s.includes('order custom') && s.includes('today')) return false;
        if (s.includes('order your dream') && s.includes('today')) return false;
        if (s.includes('get instant') && s.includes('pricing')) return false;
        if (s.includes('instant ai pricing')) return false;
        return true;
    });
    return filtered.join(' ').trim();
}

/**
 * Optimizes a long source description for use as a `<meta name="description">`.
 *
 * Algorithm (R5.1–R5.6):
 * 1. Empty input → empty output.
 * 2. Strip boilerplate sentences. If <15 chars survive, fall back to trimmed input.
 * 3. Compute price-CTA suffix.
 * 4. Truncate to fit `155 - codePoint(suffix)` budget at a word boundary.
 * 5. Iteratively strip trailing `.`, `…`, and whitespace.
 * 6. If empty after strip, return suffix only (without the leading ` | `).
 * 7. If the original ended in `.` (and not `…`) and budget allows, restore one `.`.
 *
 * Postconditions:
 * - `[...result].length <= 155` (R5.4 upper bound).
 * - Result NEVER contains `'... |'`, `'… |'`, or `'.. |'` (R5.2).
 * - Result ends with `'Customize now!'` (R5.3).
 */
export function optimizeMetaDescription(
    descriptionText: string,
    price: number | null | undefined,
): string {
    // Note: even an empty/whitespace-only input flows through to the suffix-only
    // fallback (R5.6 spirit + Property 4 invariant: result always ends in 'Customize now!').

    // Step 1–2: boilerplate filter + fallback.
    let uniqueText = filterBoilerplateSentences(descriptionText ?? '');
    if (uniqueText.length < 15) {
        uniqueText = (descriptionText ?? '').trim();
    }

    // Step 3: suffix.
    // Treat unreasonable prices (≤ 0, non-finite, > PRICE_MAX) as missing so the
    // resulting suffix never blows past the 155 cp budget for very large numbers.
    const finalPrice =
        typeof price === 'number' &&
        Number.isFinite(price) &&
        price > 0 &&
        price <= PRICE_MAX
            ? Math.round(price)
            : FALLBACK_MIN_PRICE;
    const suffix = ` | Price starts at ₱${finalPrice.toLocaleString('en-US')}. Customize now!`;
    const suffixCp = [...suffix].length;

    // Step 4: truncate to code-point budget at a word boundary.
    const budget = 155 - suffixCp;
    let truncated = truncateToWordBoundary(uniqueText, budget);
    // Defensive code-point reslice in case the UTF-16 truncation produced
    // a string whose code-point count still exceeds `budget`.
    if ([...truncated].length > budget) {
        truncated = [...truncated].slice(0, budget).join('');
    }

    // Step 5: iterative trailing-punctuation strip (R5.1).
    while (truncated.length > 0) {
        const cps = [...truncated];
        const last = cps[cps.length - 1];
        if (/[.\u2026\s]/u.test(last)) {
            cps.pop();
            truncated = cps.join('');
        } else {
            break;
        }
    }

    // Step 6: empty-after-strip fallback (R5.6).
    if (truncated.length === 0) {
        return suffix.replace(/^ \| /, '');
    }

    // Step 7: restore single '.' if original ended in '.' (only `.`s in trailing run, no `…`)
    // and uniqueText already fits within budget. R5.5 limits this to the "fits" branch.
    const trailingRunMatch = uniqueText.match(/[.\u2026\s]*$/);
    const trailingRun = trailingRunMatch ? trailingRunMatch[0] : '';
    const originalEndsWithDotOnly =
        trailingRun.includes('.') && !trailingRun.includes('\u2026');
    const uniqueFitsBudget = [...uniqueText].length <= budget;
    if (originalEndsWithDotOnly && uniqueFitsBudget) {
        const candidate = `${truncated}.${suffix}`;
        if ([...candidate].length <= 155) {
            return candidate;
        }
    }

    return truncated + suffix;
}

/**
 * Builds the in-route PDP `<title>` body (the root layout template appends ` | Genie.ph`).
 *
 * Algorithm (R6.1–R6.9):
 * 1. Trim `seoTitle` and strip any trailing ` | Genie.ph` (case-insensitive).
 * 2. If empty, build from up-to-2 capitalized tags + (keywords || 'Custom') + ' Cake Design'.
 * 3. Ensure the result contains 'Cake Design' (case-insensitive); append if missing.
 * 4. Append ' | Php X,XXX' iff price is finite, > 0, ≤ 9_999_999.
 * 5. Fast-path return if `[...combined].length <= TITLE_BUDGET`.
 * 6. Otherwise, truncate the leading product-name segment at the last word boundary
 *    that brings the total at or below `TITLE_BUDGET`.
 * 7. If still over budget, emit one `console.warn` (with slug); hard-truncate to
 *    `TITLE_BUDGET + 4 = 53` cp at a word boundary.
 *
 * Postconditions:
 * - Result NEVER contains ` with Price` (R6.2, R6.3).
 * - Result ALWAYS contains 'Cake Design' (R6.6).
 * - `[...result].length <= TITLE_BUDGET + 4 = 53` (R6.8).
 */
export function buildPdpTitle(input: {
    seoTitle: string | null | undefined;
    keywords: string | null | undefined;
    tags: string[] | null | undefined;
    price: number | null | undefined;
    slug: string;
}): string {
    const { seoTitle, keywords, tags, price, slug } = input;

    // Step 1: assemble base title.
    let base = (seoTitle ?? '').trim().replace(/\s*\|\s*Genie\.ph\s*$/i, '').trim();
    // R6.2 / R6.3: never include ' with Price' (case-insensitive). Strip if upstream
    // data slipped it in (e.g., legacy seo_title rows).
    base = base.replace(/\s+with\s+price\b/gi, '').trim();

    // Step 2: fallback assembly from tags + keywords.
    if (base.length === 0) {
        const tagList = Array.isArray(tags) ? tags.slice(0, 2) : [];
        const tagsPrefix = tagList
            .map((t) => (typeof t === 'string' && t.length > 0 ? t.charAt(0).toUpperCase() + t.slice(1) : ''))
            .filter(Boolean)
            .join(' ');
        const kw = (typeof keywords === 'string' && keywords.trim().length > 0) ? keywords : 'Custom';
        base = (tagsPrefix ? `${tagsPrefix} ` : '') + `${kw} Cake Design`;
    }

    // Step 3: ensure 'Cake Design' presence (R6.6).
    if (!/cake\s*design/i.test(base)) {
        base = /cake\s*$/i.test(base) ? `${base} Design` : `${base} Cake Design`;
    }

    // Step 4: Price_Segment iff valid (R6.4, R6.5).
    let priceSegment = '';
    if (
        typeof price === 'number' &&
        Number.isFinite(price) &&
        price > 0 &&
        price <= PRICE_MAX
    ) {
        priceSegment = ` | Php ${Math.round(price).toLocaleString('en-US')}`;
    }

    let combined = base + priceSegment;

    // Step 5: fits-as-is fast path.
    if ([...combined].length <= TITLE_BUDGET) return combined;

    // Step 6: word-boundary truncation of leading product-name (R6.7).
    // Strategy: cut leading at the first space at or after `targetLeadingLength`.
    // This removes minimum chars while preserving word boundaries; result may
    // overshoot TITLE_BUDGET by the gap to that space, which step 7 handles.
    const lower = combined.toLowerCase();
    const cakeDesignIdx = lower.indexOf(' cake design');
    if (cakeDesignIdx > 0) {
        const overflow = [...combined].length - TITLE_BUDGET;
        const leading = combined.slice(0, cakeDesignIdx);
        const rest = combined.slice(cakeDesignIdx);
        const targetLeadingLength = leading.length - overflow;
        if (targetLeadingLength > 0) {
            let firstSpace = -1;
            const start = Math.max(0, targetLeadingLength);
            for (let i = start; i < leading.length; i += 1) {
                if (leading[i] === ' ') {
                    firstSpace = i;
                    break;
                }
            }
            if (firstSpace > 0) {
                combined = leading.slice(0, firstSpace) + rest;
            } else {
                // No space at/after target — fall back to last space in leading
                // so we still gain some truncation while preserving a word boundary.
                const lastSpace = leading.lastIndexOf(' ');
                if (lastSpace > 0) {
                    combined = leading.slice(0, lastSpace) + rest;
                }
            }
        }
    }

    if ([...combined].length <= TITLE_BUDGET) return combined;

    // Step 7: still over budget — emit one console.warn and hard-truncate to ≤ 53 cp.
    console.warn(`[PDP title overflow] slug=${slug} length=${[...combined].length}`);
    if ([...combined].length > TITLE_BUDGET + 4) {
        const cap = TITLE_BUDGET + 4;
        const cut = [...combined].slice(0, cap).join('');
        const lastSpace = cut.lastIndexOf(' ');
        combined = lastSpace > TITLE_BUDGET ? cut.slice(0, lastSpace) : cut;
    }

    return combined;
}

/**
 * Builds an `AggregateRating` JSON-LD block from per-design or site-level review stats.
 *
 * Priority (R1.1–R1.4, R1.9):
 * 1. `perDesign` if it has integer `total >= 1` and finite `averageRating` in [1, 5].
 * 2. `site` if not the constant fallback AND it has integer `total >= 1` and finite
 *    `averageRating` in [1, 5].
 * 3. Otherwise null (omit `aggregateRating` from the Product graph).
 */
export function resolveAggregateRating(input: {
    perDesign: { total: number; averageRating: number } | null;
    site: { total: number; averageRating: number } | null;
    isSiteFallback: boolean;
}): {
    '@type': 'AggregateRating';
    ratingValue: number;
    reviewCount: number;
    bestRating: 5;
    worstRating: 1;
} | null {
    const { perDesign, site, isSiteFallback } = input;

    if (
        perDesign != null &&
        Number.isInteger(perDesign.total) &&
        perDesign.total >= 1 &&
        Number.isFinite(perDesign.averageRating) &&
        perDesign.averageRating >= 1.0 &&
        perDesign.averageRating <= 5.0
    ) {
        return ratingBlock(perDesign.averageRating, perDesign.total);
    }

    if (
        !isSiteFallback &&
        site != null &&
        Number.isInteger(site.total) &&
        site.total >= 1 &&
        Number.isFinite(site.averageRating) &&
        site.averageRating >= 1.0 &&
        site.averageRating <= 5.0
    ) {
        return ratingBlock(site.averageRating, site.total);
    }

    return null;
}

function ratingBlock(
    avg: number,
    count: number,
): {
    '@type': 'AggregateRating';
    ratingValue: number;
    reviewCount: number;
    bestRating: 5;
    worstRating: 1;
} {
    return {
        '@type': 'AggregateRating',
        ratingValue: Number(avg.toFixed(2)),
        reviewCount: count,
        bestRating: 5,
        worstRating: 1,
    };
}

/**
 * Resolves SKU and MPN for the Product JSON-LD (R4.1–R4.7).
 *
 * - `mpn = p_hash` when `p_hash` is a non-empty string, else `mpn = slug`.
 * - `sku = lex-min(listings[].product_id)` when `listings` non-empty, else `sku = slug`.
 * - If the resolved `sku === mpn`, replace `sku` with `slug + ':design'` to ensure
 *   distinct identifiers for Google Merchant Center import.
 * - Result is invariant under permutations of `listings`.
 */
export function resolveSkuMpn(input: {
    slug: string;
    p_hash: string | null | undefined;
    listings: { product_id: string }[];
}): { sku: string; mpn: string } {
    const { slug, p_hash, listings } = input;

    const mpn = typeof p_hash === 'string' && p_hash.length > 0 ? p_hash : slug;

    let sku: string;
    if (listings.length > 0) {
        // UTF-16 code-unit ascending lex-min.
        sku = listings.map((l) => l.product_id).sort()[0];
    } else {
        sku = slug;
    }

    if (sku === mpn) {
        sku = `${slug}:design`;
    }

    return { sku, mpn };
}
