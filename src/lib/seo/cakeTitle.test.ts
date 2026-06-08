import { describe, expect, it } from 'vitest';
import {
    buildCakeTitle,
    extractTitleInputFromAnalysis,
    CAKE_TITLE_BUDGET,
    type CakeTitleInput,
} from './cakeTitle';

// Canonical real-row fixtures (PII messages intentionally omitted).
const FIXTURES: Record<string, CakeTitleInput> = {
    kuromi: { keyword: 'Kuromi', cakeType: '1 Tier', colorTop: '#C4B5FD', colorType: 'single', tags: ['purple', 'pink', 'flowers', 'kuromi', 'birthday'], heroToppers: ['Kuromi character holding flowers'] },
    corsetHeart: { keyword: 'Corset Heart', cakeType: '1 Tier Fondant', colorTop: '#FFFFFF', colorType: 'multicolor', tags: ['corset heart', 'corset', 'black', 'red'] },
    littleMermaid: { keyword: 'Little Mermaid', cakeType: '2 Tier Fondant', colorTop: '#8B5CF6', colorType: 'multicolor', tags: ['ariel', 'sea', 'mermaid'], heroToppers: ['Ariel character'] },
    eighteenth: { keyword: '18th birthday', cakeType: '1 Tier', colorTop: '#FFFFFF', colorType: 'single', tags: ['silhouette', 'rosette', 'black', '18th'] },
    barista: { keyword: 'Barista Coffee', cakeType: '1 Tier', colorTop: '#FFFFFF', colorType: 'single', tags: ['barista', 'coffee', 'minimalist'] },
    katseye: { keyword: 'Katseye Kpop', cakeType: '1 Tier', colorTop: '#FFFFFF', colorType: 'single', tags: ['katseye', 'kpop', 'birthday'] },
    redHorse: { keyword: 'Red Horse Beer', cakeType: '1 Tier', colorTop: '#FFFFFF', colorSide: '#FF0000', colorType: 'single', tags: ['beer', 'red', 'horse'] },
    onePiece: { keyword: 'One Piece', cakeType: '1 Tier', colorTop: '#F5F5DC', colorType: 'multicolor', tags: ['one piece', 'luffy'], heroToppers: ['Luffy character'] },
    wedding: { keyword: 'Wedding', cakeType: '2 Tier', colorTop: '#FFFFFF', colorType: 'single', tags: ['roses', 'wedding', 'gold'] },
    blueyBirthday: { keyword: 'Bluey Birthday', cakeType: '1 Tier', colorTop: '#87CEEB', colorType: 'single', tags: ['bluey', 'birthday'] },
};

describe('buildCakeTitle — R6', () => {
    it('always ends in "Cake" and never contains "Cake Cake"', () => {
        for (const input of Object.values(FIXTURES)) {
            const t = buildCakeTitle(input);
            expect(t).toMatch(/\bCake$/);
            expect(t).not.toMatch(/cake\s+cake/i);
        }
    });

    it('appends "-Inspired" for Franchise_List themes', () => {
        expect(buildCakeTitle(FIXTURES.kuromi)).toContain('Kuromi-Inspired');
        expect(buildCakeTitle(FIXTURES.littleMermaid)).toContain('Little Mermaid-Inspired');
        expect(buildCakeTitle(FIXTURES.katseye)).toContain('Katseye');
        expect(buildCakeTitle(FIXTURES.katseye)).toContain('-Inspired');
        expect(buildCakeTitle(FIXTURES.onePiece)).toContain('One Piece-Inspired');
    });

    it('does NOT append "-Inspired" for real brands or generic occasions', () => {
        expect(buildCakeTitle(FIXTURES.redHorse)).not.toContain('-Inspired');
        expect(buildCakeTitle(FIXTURES.wedding)).not.toContain('-Inspired');
        expect(buildCakeTitle(FIXTURES.eighteenth)).not.toContain('-Inspired');
        expect(buildCakeTitle(FIXTURES.corsetHeart)).not.toContain('-Inspired');
    });

    it('attaches -Inspired to the franchise token, not a trailing generic word', () => {
        // "Bluey Birthday" → "Bluey-Inspired ... Birthday", never "Bluey Birthday-Inspired"
        const t = buildCakeTitle(FIXTURES.blueyBirthday);
        expect(t).toContain('Bluey-Inspired');
        expect(t).not.toMatch(/Birthday-Inspired/);
    });

    it('omits color when colorType is multicolor', () => {
        // corsetHeart is multicolor white → no "White" segment
        const t = buildCakeTitle(FIXTURES.corsetHeart);
        expect(t).not.toContain('White');
    });

    it('maps hex color via the shared palette (e.g. #C4B5FD → Lavender)', () => {
        expect(buildCakeTitle(FIXTURES.kuromi)).toContain('Lavender');
    });

    it('never emits a numeric internal code, " with Price", or a price', () => {
        for (const input of Object.values(FIXTURES)) {
            const t = buildCakeTitle(input);
            expect(t).not.toMatch(/\s-\s\d{2,}/);
            expect(t).not.toMatch(/with price/i);
            expect(t).not.toContain('₱');
            expect(t).not.toMatch(/\bPhp\b/);
        }
    });

    it('output ≤ budget and output + " | Genie.ph" ≤ 60 cp', () => {
        for (const input of Object.values(FIXTURES)) {
            const t = buildCakeTitle(input);
            expect([...t].length).toBeLessThanOrEqual(CAKE_TITLE_BUDGET);
            expect([...`${t} | Genie.ph`].length).toBeLessThanOrEqual(60);
        }
    });

    it('respects an explicit budget by dropping segments / truncating', () => {
        const t = buildCakeTitle(FIXTURES.kuromi, 20);
        expect([...t].length).toBeLessThanOrEqual(20);
        expect(t).toMatch(/\bCake$/);
    });

    it('is deterministic for identical input', () => {
        const a = buildCakeTitle(FIXTURES.littleMermaid);
        const b = buildCakeTitle(FIXTURES.littleMermaid);
        expect(a).toBe(b);
    });

    it('uses "Custom" theme when keyword is empty/whitespace', () => {
        expect(buildCakeTitle({ keyword: '', cakeType: '1 Tier', colorType: 'single' })).toMatch(/^Custom/);
        expect(buildCakeTitle({ keyword: '   ', tags: [] })).toMatch(/^Custom/);
        expect(buildCakeTitle({})).toBe('Custom Cake');
    });

    it('handles keyword-stuffed themes without "Cake Cake" and within budget', () => {
        const t = buildCakeTitle({
            keyword: 'New Year, 1 Tier, Happy New Year 2026, Cake, Custom, Cebu, Gold, White, Celebration',
            cakeType: '1 Tier',
            colorTop: '#FFD700',
            colorType: 'single',
            tags: ['new year', 'gold'],
        });
        expect(t).not.toMatch(/cake\s+cake/i);
        expect([...t].length).toBeLessThanOrEqual(CAKE_TITLE_BUDGET);
        expect(t).toMatch(/\bCake$/);
    });

    it('strips a trailing "Cake" from the keyword (no duplication)', () => {
        const t = buildCakeTitle({ keyword: 'Red Bento Cake', cakeType: 'Bento', colorTop: '#FF0000', colorType: 'single', tags: ['red', 'bento'] });
        expect(t).not.toMatch(/cake\s+cake/i);
        expect(t).toMatch(/\bCake$/);
    });

    it('builds cupcake titles ending in "Cupcakes" and not containing "Cake"', () => {
        const t = buildCakeTitle({
            keyword: 'Cinderella Cupcakes Sky Blue Cake',
            cakeType: 'Cupcake',
            colorTop: '#87CEEB',
            colorType: 'single',
            tags: ['cinderella', 'blue', 'cupcakes']
        });
        expect(t).toContain('Cinderella-Inspired');
        expect(t).toContain('Cupcakes');
        expect(t).not.toContain('Cake');
        expect(t).not.toMatch(/cupcakes\s+cupcakes/i);
    });
});

describe('extractTitleInputFromAnalysis — R7.2 / R10.2 parity mapper', () => {
    const analysis = {
        keyword: 'Kuromi',
        cakeType: '1 Tier',
        icing_design: { colors: { side: '#C4B5FD', top: '#C4B5FD' }, color_type: 'single' },
        main_toppers: [
            { description: 'Kuromi character', classification: 'hero' },
            { description: 'sprinkles', classification: 'support' },
        ],
    };

    it('maps all structured fields and keeps only hero toppers', () => {
        const input = extractTitleInputFromAnalysis(analysis, 'Kuromi', ['purple', 'kuromi']);
        expect(input.keyword).toBe('Kuromi');
        expect(input.cakeType).toBe('1 Tier');
        expect(input.colorTop).toBe('#C4B5FD');
        expect(input.colorType).toBe('single');
        expect(input.tags).toEqual(['purple', 'kuromi']);
        expect(input.heroToppers).toEqual(['Kuromi character']);
    });

    it('prefers the keywords column over analysis.keyword when present', () => {
        const input = extractTitleInputFromAnalysis({ ...analysis, keyword: 'Old' }, 'New Keyword', []);
        expect(input.keyword).toBe('New Keyword');
    });

    it('falls back to analysis.keyword when keywords column is empty', () => {
        const input = extractTitleInputFromAnalysis(analysis, '', []);
        expect(input.keyword).toBe('Kuromi');
    });

    it('produces identical titles via the mapper as via direct input (parity)', () => {
        const viaMapper = buildCakeTitle(extractTitleInputFromAnalysis(analysis, 'Kuromi', ['purple', 'kuromi', 'birthday', 'flowers']));
        const viaDirect = buildCakeTitle({
            keyword: 'Kuromi', cakeType: '1 Tier', colorTop: '#C4B5FD', colorSide: '#C4B5FD', colorType: 'single',
            tags: ['purple', 'kuromi', 'birthday', 'flowers'], heroToppers: ['Kuromi character'],
        });
        expect(viaMapper).toBe(viaDirect);
    });

    it('handles null/empty analysis gracefully', () => {
        const input = extractTitleInputFromAnalysis(null, null, null);
        expect(input.heroToppers).toEqual([]);
        expect(buildCakeTitle(input)).toBe('Custom Cake');
    });
});
