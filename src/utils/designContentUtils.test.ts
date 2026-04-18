import { describe, expect, it } from 'vitest';
import { generateRichAltText } from './designContentUtils';

const RICH_ANALYSIS = {
    cakeType: '1 tier',
    icing_design: {
        base: 'soft_icing',
        colors: { top: '#ffc0cb', side: '#ffffff' },
    },
    main_toppers: [
        { description: 'hello kitty figurine', type: 'figurine' },
    ],
    support_elements: [
        { description: 'pink bow', type: 'decoration' },
    ],
    cake_messages: [
        { text: 'Happy Birthday' },
    ],
};

describe('generateRichAltText', () => {
    it('trusts stored alt_text >= 60 chars without regenerating', () => {
        const longAlt = 'Beautiful pastel pink Hello Kitty birthday cake with bow accents.';
        const result = generateRichAltText({
            alt_text: longAlt,
            keywords: 'hello kitty',
            tags: ['birthday'],
            analysis_json: RICH_ANALYSIS,
        });
        expect(result).toBe(longAlt);
    });

    it('upgrades short stored alt_text when analysis_json is rich', () => {
        const shortAlt = 'Hello kitty cake';
        const result = generateRichAltText({
            alt_text: shortAlt,
            keywords: 'hello kitty',
            tags: ['birthday'],
            analysis_json: RICH_ANALYSIS,
        });
        expect(result).not.toBe(shortAlt);
        expect(result.length).toBeGreaterThan(shortAlt.length);
        expect(result.toLowerCase()).toContain('hello kitty');
        expect(result.toLowerCase()).toContain('cake design');
    });

    it('generates alt text when alt_text is null and analysis_json is rich', () => {
        const result = generateRichAltText({
            alt_text: null,
            keywords: 'hello kitty',
            tags: ['birthday'],
            analysis_json: RICH_ANALYSIS,
        });
        expect(result.toLowerCase()).toContain('hello kitty');
        expect(result.toLowerCase()).toContain('cake design');
        expect(result.length).toBeGreaterThan(40);
    });

    it('preserves short stored alt_text when analysis_json is thin', () => {
        const shortAlt = 'Simple vanilla cake';
        const result = generateRichAltText({
            alt_text: shortAlt,
            keywords: 'vanilla',
            tags: [],
            analysis_json: {},
        });
        // Nothing better to generate, so keep the stored value rather than
        // regressing to the absolute fallback.
        expect(result).toBe(shortAlt);
    });

    it('falls back to "<keywords> cake design" only when everything else is empty', () => {
        const result = generateRichAltText({
            alt_text: null,
            keywords: 'vanilla',
            tags: [],
            analysis_json: {},
        });
        expect(result).toBe('vanilla cake design');
    });
});
