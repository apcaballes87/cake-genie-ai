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
 * Truncates `text` to a maximum length at a word boundary.
 *
 * Contract (R5.1):
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
 * 3. Truncate to fit the 155 character budget at a word boundary.
 * 4. Iteratively strip trailing `.`, `…`, and whitespace.
 * 5. If empty after strip, return a generic descriptive fallback.
 * 6. If the original ended in `.` (and not `…`) and budget allows, restore one `.`.
 *
 * Postconditions:
 * - `[...result].length <= 155` (R5.4 upper bound).
 * - Result NEVER ends with trailing ellipsis/dot runs.
 * - Result does not inject price text into Google-search meta descriptions.
 */
export function optimizeMetaDescription(descriptionText: string): string {
    // Step 1–2: boilerplate filter + fallback.
    let uniqueText = filterBoilerplateSentences(descriptionText ?? '');
    if (uniqueText.length < 15) {
        uniqueText = (descriptionText ?? '').trim();
    }

    // Step 3: truncate to code-point budget at a word boundary.
    const budget = 155;
    let truncated = truncateToWordBoundary(uniqueText, budget);
    // Defensive code-point reslice in case the UTF-16 truncation produced
    // a string whose code-point count still exceeds `budget`.
    if ([...truncated].length > budget) {
        truncated = [...truncated].slice(0, budget).join('');
    }

    // Step 4: iterative trailing-punctuation strip (R5.1).
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

    // Step 5: empty-after-strip fallback (R5.6).
    if (truncated.length === 0) {
        return 'Custom cake design available for Genie.ph customization.';
    }

    // Step 6: restore single '.' if original ended in '.' (only `.`s in trailing run, no `…`)
    // and uniqueText already fits within budget. R5.5 limits this to the "fits" branch.
    const trailingRunMatch = uniqueText.match(/[.\u2026\s]*$/);
    const trailingRun = trailingRunMatch ? trailingRunMatch[0] : '';
    const originalEndsWithDotOnly =
        /^\.\s*$/.test(trailingRun);
    const uniqueFitsBudget = [...uniqueText].length <= budget;
    if (originalEndsWithDotOnly && uniqueFitsBudget) {
        const candidate = `${truncated}.`;
        if ([...candidate].length <= 155) {
            return candidate;
        }
    }

    return truncated;
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
