/**
 * Deterministic, customer-facing PDP title builder for `/customizing/[slug]`.
 *
 * Replaces AI-emitted `seo_title` values (which leaked internal IDs like
 * "Kuromi Cake - 1002" and mislabeled designs like "Corset Heart" → "Naughty Cake")
 * with a structured, Google-Merchant-aligned title:
 *
 *   [Theme(-Inspired)] [Color] [Detail] [Type] [Occasion] Cake
 *
 * Design goals (per .kiro/specs/customizing-pdp-seo-fixes, R6/R7):
 * - Important descriptive details first; no promotional or internal-looking text.
 * - "-Inspired" suffix on entertainment/character IP so unlicensed character
 *   cakes never imply an official license (Google title guidance + legal safety).
 * - NEVER sources text from `cake_messages` (customer PII like real names).
 * - Pure function: no I/O, no React. Unit-testable and reusable by both the
 *   write path (supabaseService) and the one-time backfill.
 *
 * The numeric design code (e.g. 1002) belongs to internal SKU/MPN only and is
 * never emitted into the visible title.
 */

import { hexToName } from '@/lib/utils/urlHelpers';

/** Default in-route title budget: 60 cp SERP cap − len(' | Genie.ph') = 49. */
export const CAKE_TITLE_BUDGET = 49;

export function extractDesignCodeFromSlug(slug: string | null | undefined): string | null {
    if (!slug) return null;
    const match = slug.match(/-([a-f0-9]{4,16})$/);
    if (!match) return null;
    const hash = match[1];
    if (hash.length > 4) {
        return hash.substring(hash.length - 4).toUpperCase();
    }
    return hash.toUpperCase();
}

export interface CakeTitleInput {
    /** Theme keyword, e.g. "Kuromi", "18th Birthday", "Corset Heart". */
    keyword?: string | null;
    /** Raw cakeType from analysis_json, e.g. "1 Tier", "2 Tier Fondant", "Bento". */
    cakeType?: string | null;
    /** Icing top color (hex or name). */
    colorTop?: string | null;
    /** Icing side color (hex or name), used as a fallback for colorTop. */
    colorSide?: string | null;
    /** color_type from analysis_json: 'single' | 'gradient' | 'multicolor'. */
    colorType?: string | null;
    /** tags array (used for occasion + detail inference). */
    tags?: (string | null | undefined)[] | null;
    /** Optional hero-topper descriptions (used for detail inference only). */
    heroToppers?: (string | null | undefined)[] | null;
    /** Unique design code suffix extracted from the slug hash. */
    designCode?: string | null;
}

/**
 * Entertainment / character / franchise IP tokens. A keyword matching any of
 * these (word-boundary, case-insensitive) gets the "-Inspired" suffix so the
 * title never implies an official license. Brand/company logos (McDonald's,
 * Jollibee, Red Horse, Shopee) are intentionally excluded — those depict a
 * real brand rather than a licensable character and read naturally without it.
 */
const FRANCHISE_TOKENS: readonly string[] = [
    // Sanrio
    'kuromi', 'my melody', 'melody', 'hello kitty', 'cinnamoroll', 'pompompurin', 'sanrio',
    // Disney / Pixar
    'disney', 'pixar', 'frozen', 'elsa', 'anna', 'olaf', 'moana', 'encanto', 'mirabel',
    'little mermaid', 'ariel', 'cinderella', 'belle', 'beauty and the beast', 'snow white',
    'tinker bell', 'tinkerbell', 'sofia the first', 'minnie mouse', 'mickey mouse', 'minnie',
    'mickey', 'cars', 'lightning mcqueen', 'toy story', 'buzz lightyear', 'woody', 'zootopia',
    'judy hopps', 'stitch', 'lilo', 'rapunzel', 'tangled', 'aurora', 'jasmine', 'aladdin',
    'lion king', 'simba', 'winnie the pooh', 'dumbo',
    // Marvel / DC
    'marvel', 'spiderman', 'spider-man', 'iron man', 'captain america', 'avengers', 'hulk',
    'thor', 'black panther', 'batman', 'superman', 'wonder woman', 'flash', 'aquaman',
    // Anime
    'one piece', 'luffy', 'zoro', 'naruto', 'demon slayer', 'mitsuri', 'jujutsu kaisen',
    'gojo', 'haikyuu', 'genshin', 'genshin impact', 'spy x family', 'anya forger', 'anya',
    'dragon ball', 'pokemon', 'pikachu', 'eevee', 'sailor moon', 'attack on titan',
    // KPop
    'bts', 'katseye', 'kpop', 'k-pop', 'blackpink', 'twice', 'exo', 'seventeen',
    'going seventeen', 'bini', 'saja boys', 'kpop demon hunter', 'kpop demon hunters',
    'k-pop demon hunter', 'k-pop demon hunters', 'demon hunter',
    // Kids' shows / games / toys
    'bluey', 'cocomelon', 'ms rachel', 'blippi', 'paw patrol', 'peppa pig', 'my little pony',
    'minecraft', 'roblox', 'mobile legends', 'beyblade', 'spongebob', 'patrick',
    'madagascar', 'star wars', 'boss baby', 'barbie', 'gabby', 'gabbys dollhouse',
    'transformers', 'gundam', 'jurassic park', 'jurassic world', 'shimmer and shine',
    'diana and roma', 'my singing monsters', 'geometry dash', 'sesame street', 'elmo',
    'lego', 'super mario', 'mario', 'sonic', 'friends tv show',
];

/** Occasion vocabulary inferred from keyword/tags. Order = display priority. */
const OCCASION_TOKENS: readonly { token: string; label: string }[] = [
    { token: 'gender reveal', label: 'Gender Reveal' },
    { token: 'bridal shower', label: 'Bridal Shower' },
    { token: 'bachelorette', label: 'Bachelorette' },
    { token: 'baby shower', label: 'Baby Shower' },
    { token: 'mothers day', label: "Mother's Day" },
    { token: "mother's day", label: "Mother's Day" },
    { token: 'fathers day', label: "Father's Day" },
    { token: "father's day", label: "Father's Day" },
    { token: 'graduation', label: 'Graduation' },
    { token: 'christening', label: 'Christening' },
    { token: 'baptismal', label: 'Baptism' },
    { token: 'baptism', label: 'Baptism' },
    { token: 'dedication', label: 'Dedication' },
    { token: 'anniversary', label: 'Anniversary' },
    { token: 'monthsary', label: 'Monthsary' },
    { token: 'engagement', label: 'Engagement' },
    { token: 'wedding', label: 'Wedding' },
    { token: 'debut', label: 'Debut' },
    { token: 'retirement', label: 'Retirement' },
    { token: 'despedida', label: 'Despedida' },
    { token: 'christmas', label: 'Christmas' },
    { token: 'halloween', label: 'Halloween' },
    { token: 'valentine', label: 'Valentine' },
    { token: 'birthday', label: 'Birthday' },
];

/** Detail/decoration vocabulary. Order = display priority. */
const DETAIL_RULES: readonly { match: RegExp; label: string }[] = [
    { match: /\bbow\b/i, label: 'Bow' },
    { match: /\bdrip\b/i, label: 'Drip' },
    { match: /\b(floral|flower|flowers|daisy|daisies|rose|roses|sunflower|tulip)\b/i, label: 'Floral' },
    { match: /\bbutterfly|butterflies\b/i, label: 'Butterfly' },
    { match: /\bheart\b/i, label: 'Heart' },
    { match: /\bcrown\b/i, label: 'Crown' },
    { match: /\brosette\b/i, label: 'Rosette' },
    { match: /\bruffle\b/i, label: 'Ruffle' },
    { match: /\b(lace|corset)\b/i, label: 'Lace' },
    { match: /\bpearl\b/i, label: 'Pearl' },
    { match: /\b(glitter|sparkle)\b/i, label: 'Glitter' },
    { match: /\bsilhouette\b/i, label: 'Silhouette' },
    { match: /\bvintage\b/i, label: 'Vintage' },
];

function titleCaseWord(w: string): string {
    if (w.length === 0) return w;
    // Preserve short all-caps acronyms (BTS, EXO) and tokens already mixed-case.
    if (/^[A-Z0-9]{2,4}$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
}

function titleCase(s: string): string {
    return s
        .trim()
        .split(/\s+/)
        .map(titleCaseWord)
        .join(' ');
}

/** Returns the longest Franchise_List token matching the keyword (token-boundary), or null. */
function findFranchiseToken(keywordLower: string): string | null {
    let best: string | null = null;
    for (const t of FRANCHISE_TOKENS) {
        const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(t)}([^a-z0-9]|$)`, 'i');
        if (re.test(keywordLower)) {
            if (best === null || t.length > best.length) best = t;
        }
    }
    return best;
}

/**
 * Appends the `-Inspired` qualifier to the matched franchise token *inside* the
 * title-cased theme, so it reads "Bluey-Inspired Birthday" rather than
 * "Bluey Birthday-Inspired". Matching is done word-wise so multi-word tokens
 * (e.g. "my melody", "one piece") are handled. If the token cannot be located
 * positionally, falls back to suffixing the whole theme.
 */
function applyInspiredQualifier(theme: string, keywordLower: string): string {
    const token = findFranchiseToken(keywordLower);
    if (!token) return theme;
    if (/-inspired/i.test(theme)) return theme;

    const themeWords = theme.split(/\s+/);
    const tokenWordCount = token.split(/\s+/).length;
    const tokenLower = token.toLowerCase();

    // Find the run of words equal to the token (case-insensitive).
    for (let i = 0; i + tokenWordCount <= themeWords.length; i += 1) {
        const window = themeWords.slice(i, i + tokenWordCount).join(' ').toLowerCase();
        if (window === tokenLower) {
            const last = i + tokenWordCount - 1;
            themeWords[last] = `${themeWords[last]}-Inspired`;
            return themeWords.join(' ');
        }
    }
    // Token matched via boundary regex but not as exact whole words (e.g. it's a
    // substring of a larger compound). Suffix the whole theme as a safe fallback.
    return `${theme}-Inspired`;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveColor(input: CakeTitleInput): string {
    const colorType = (input.colorType ?? '').toLowerCase();
    if (colorType === 'multicolor') return '';
    const raw = input.colorTop || input.colorSide || '';
    if (!raw) return '';
    const name = hexToName(raw); // hex → 'light-pink'; passthrough for non-hex
    if (!name) return '';
    return titleCase(name.replace(/-/g, ' '));
}

function resolveOccasion(keywordLower: string, tagsLower: string): string {
    const haystack = `${keywordLower} ${tagsLower}`;
    for (const { token, label } of OCCASION_TOKENS) {
        if (haystack.includes(token)) return label;
    }
    return '';
}

function resolveType(cakeType: string | null | undefined): string {
    const t = (cakeType ?? '').toLowerCase();
    if (t.includes('bento')) return 'Bento';
    if (t.includes('3') || t.includes('three')) return '3-Tier';
    if (t.includes('2') || t.includes('two')) return '2-Tier';
    if (t.includes('rectangle')) return 'Rectangle';
    return ''; // 1-tier (default) and bare fondant are omitted as noise
}

function resolveDetail(tagsLower: string, heroLower: string): string {
    const haystack = `${tagsLower} ${heroLower}`;
    for (const { match, label } of DETAIL_RULES) {
        if (match.test(haystack)) return label;
    }
    return '';
}

/** Removes a segment whose words already appear in the running title (case-insensitive). */
function isRedundant(segment: string, existingLower: string): boolean {
    if (!segment) return true;
    const words = segment.toLowerCase().split(/\s+/);
    return words.every((w) => existingLower.includes(w));
}

/**
 * Builds the customer-facing PDP title (no ' | Genie.ph' suffix — the root
 * layout template appends that). Guarantees:
 * - Always ends with 'Cake' (deduped, never 'Cake Cake').
 * - Never contains the internal numeric design code.
 * - Length in code points ≤ `budget` (default 49); over-budget titles are
 *   reduced by dropping Detail → Color → Type → Occasion, then word-truncating
 *   the theme.
 */
export function buildCakeTitle(input: CakeTitleInput, budget: number = CAKE_TITLE_BUDGET): string {
    const designCode = input.designCode ? input.designCode.trim() : '';
    const suffix = designCode ? ` - ${designCode}` : '';
    const bodyBudget = budget - suffix.length;

    const keyword = (input.keyword ?? '').trim();
    const keywordLower = keyword.toLowerCase();
    const tagsLower = (input.tags ?? [])
        .filter((t): t is string => typeof t === 'string' && t.length > 0)
        .join(' ')
        .toLowerCase();
    const heroLower = (input.heroToppers ?? [])
        .filter((t): t is string => typeof t === 'string' && t.length > 0)
        .join(' ')
        .toLowerCase();

    const isCupcake = (input.cakeType ?? '').toLowerCase().includes('cupcake');

    // THEME
    let theme = keyword.length > 0 ? titleCase(keyword) : 'Custom';
    // Normalize separators: drop commas/slashes that appear in raw keywords
    // (e.g. "Boss Baby, 1st Birthday") so franchise-token matching is positional
    // and the title reads cleanly.
    theme = theme.replace(/[,/]+/g, ' ').replace(/\s+/g, ' ').trim();
    // Strip a trailing "Cake" or "Cupcakes" already present in the keyword so we control the head noun.
    theme = theme.replace(/\s*cake\s*$/i, '').trim();
    if (isCupcake) {
        theme = theme.replace(/\s*cupcakes?\s*$/i, '').trim();
    }
    theme = theme || 'Custom';

    // Attach the "-Inspired" qualifier to the specific franchise token within the
    // theme (e.g. "Bluey Birthday" → "Bluey-Inspired Birthday", not
    // "Bluey Birthday-Inspired"). Falls back to whole-theme suffix if the token
    // can't be located positionally.
    theme = applyInspiredQualifier(theme, keywordLower);

    const color = resolveColor(input);
    const detail = resolveDetail(tagsLower, heroLower);
    const type = resolveType(input.cakeType);
    const occasion = resolveOccasion(keywordLower, tagsLower);

    // Assemble in priority order, skipping segments redundant with the theme.
    const assemble = (parts: string[]): string => {
        const kept: string[] = [];
        let runningLower = theme.toLowerCase();
        for (const p of parts) {
            if (!p) continue;
            if (isRedundant(p, runningLower)) continue;
            kept.push(p);
            runningLower += ` ${p.toLowerCase()}`;
        }
        const body = [theme, ...kept].join(' ');
        if (isCupcake) {
            return `${body} Cupcakes`.replace(/\bcupcakes?\s+cupcakes?\b/i, 'Cupcakes');
        }
        return `${body} Cake`.replace(/\bcake\s+cake\b/i, 'Cake');
    };

    // Trim order when over budget: drop Detail, then Color, then Type, then Occasion.
    const candidates: string[][] = [
        [color, detail, type, occasion],
        [color, type, occasion],
        [type, occasion],
        [occasion],
        [],
    ];

    for (const parts of candidates) {
        const titleBody = assemble(parts);
        if ([...titleBody].length <= bodyBudget) {
            return suffix ? `${titleBody}${suffix}` : titleBody;
        }
    }

    // Still over budget: word-truncate the theme while keeping the appropriate head noun.
    const truncatedBody = truncateThemeToFit(theme, bodyBudget, isCupcake);
    return suffix ? `${truncatedBody}${suffix}` : truncatedBody;
}

function truncateThemeToFit(theme: string, budget: number, isCupcake?: boolean): string {
    const suffix = isCupcake ? ' Cupcakes' : ' Cake';
    // Strip any trailing "Cake" or "Cupcakes" already in the theme (keyword-stuffed slugs) so we
    // never produce "... Cake Cake" or "... Cupcakes Cupcakes".
    const cleanTheme = theme.replace(isCupcake ? /\s*cupcakes?\s*$/i : /\s*cake\s*$/i, '').trim() || 'Custom';
    const themeBudget = budget - suffix.length;
    if ([...cleanTheme].length <= themeBudget) return `${cleanTheme}${suffix}`;
    const sliced = [...cleanTheme].slice(0, Math.max(0, themeBudget)).join('');
    const lastSpace = sliced.lastIndexOf(' ');
    const trimmed = (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced)
        .replace(isCupcake ? /\s*cupcakes?\s*$/i : /\s*cake\s*$/i, '')
        .trim();
    return `${trimmed}${suffix}`;
}

/**
 * Minimal structural shape of the analysis JSON needed for title construction.
 * Kept local (not importing HybridAnalysisResult) so this module stays
 * dependency-light and usable from the standalone backfill script, which reads
 * raw JSONB rows rather than typed analysis objects.
 */
export interface TitleAnalysisLike {
    keyword?: string | null;
    cakeType?: string | null;
    icing_design?: {
        colors?: { top?: string | null; side?: string | null } | null;
        color_type?: string | null;
    } | null;
    main_toppers?: Array<{
        description?: string | null;
        classification?: string | null;
    }> | null;
}

/**
 * Maps a cache row / analysis result to {@link CakeTitleInput}. This is the
 * SINGLE source of the DB→input mapping, shared by the write path
 * (`supabaseService`) and the backfill script so the two cannot drift
 * (spec Property 7; R7.2 / R10.2 / R10.5).
 *
 * Reads only non-PII structured attributes — never `cake_messages` or the
 * prior `seo_title`.
 *
 * @param analysis  The analysis object (typed write-path result OR a raw JSONB row).
 * @param keywords  The row's `keywords` column (overrides `analysis.keyword` when present).
 * @param tags      The row's `tags` column.
 */
export function extractTitleInputFromAnalysis(
    analysis: TitleAnalysisLike | null | undefined,
    keywords: string | null | undefined,
    tags: (string | null | undefined)[] | null | undefined,
    slug?: string | null,
): CakeTitleInput {
    const a = analysis ?? {};
    const colors = a.icing_design?.colors ?? {};
    const heroToppers = Array.isArray(a.main_toppers)
        ? a.main_toppers
              .filter((t) => t && t.classification === 'hero')
              .map((t) => t.description ?? '')
              .filter((d) => d.length > 0)
        : [];

    return {
        keyword: (keywords && keywords.trim().length > 0 ? keywords : a.keyword) ?? null,
        cakeType: a.cakeType ?? null,
        colorTop: colors.top ?? null,
        colorSide: colors.side ?? null,
        colorType: a.icing_design?.color_type ?? null,
        tags: tags ?? null,
        heroToppers,
        designCode: extractDesignCodeFromSlug(slug),
    };
}
