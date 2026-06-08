import { describe, expect, it } from 'vitest';
import { generateRichAltText, generateDesignDetails, generateDynamicFAQ } from './designContentUtils';

const RICH_ANALYSIS = {
    cakeType: '1 tier',
    icing_design: {
        base: 'soft_icing',
        colors: { side: '#ffffff', top: '#ffc0cb' },
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

    it('handles cupcakes correct phrasing in alt text, details and FAQ', () => {
        const cupcakeDesign = {
            keywords: 'Cinderella',
            slug: 'cinderella-cupcakes-sky-blue',
            analysis_json: {
                cakeType: 'Cupcake',
                icing_design: {
                    base: 'soft_icing',
                    colors: { side: '#87ceeb', top: '#87ceeb' }
                },
                main_toppers: [
                    { description: 'cinderella figure', type: 'printout' }
                ],
                cake_messages: [
                    { text: 'Happy 5th' }
                ]
            },
            tags: ['birthday', 'girl']
        };

        const alt = generateRichAltText(cupcakeDesign);
        expect(alt.toLowerCase()).toContain('cupcakes');
        expect(alt.toLowerCase()).not.toContain('cake design');

        const details = generateDesignDetails(cupcakeDesign);
        expect(details.toLowerCase()).toContain('cupcakes');
        expect(details.toLowerCase()).toContain('carry the message');
        expect(details.toLowerCase()).not.toContain('this cinderella cake');

        const faqs = generateDynamicFAQ(cupcakeDesign, [{ size: '12 pieces', price: 499 }]);
        expect(faqs[0].question.toLowerCase()).toContain('cupcakes');
        expect(faqs[0].answer.toLowerCase()).toContain('these cinderella cupcakes');
    });
});
