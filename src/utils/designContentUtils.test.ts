import { describe, expect, it } from 'vitest';
import {
    AIApiClient,
    buildDesignPageContent,
    generateDesignDetails,
    generateDynamicCollectionDescription,
    generateDynamicFAQ,
    generateRichAltText,
} from './designContentUtils';

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

    it('adds thin-page boost FAQs for sparse designs until the estimated unique content clears the floor', () => {
        const sparseDesign = {
            keywords: 'Minimalist Bento',
            availability: 'rush',
            tags: ['minimalist', 'bento'],
            seo_description: 'This minimalist bento cake features smooth white soft icing and a clean, modern aesthetic.',
            analysis_json: {
                cakeType: 'Bento',
                icing_design: {
                    base: 'soft-icing',
                    colors: { side: '#FFFFFF', top: '#FFFFFF' },
                    border_top: true,
                    border_base: false,
                    drip: false,
                    gumpasteBaseBoard: false,
                },
                main_toppers: [],
                support_elements: [
                    { description: 'green satin ribbon bows and drapes', type: 'satin_ribbon', quantity: 1 },
                    { description: 'piped icing border', type: 'icing_decorations', quantity: 1 },
                    { description: 'piped green heart accents', type: 'icing_decorations', quantity: 10 },
                ],
                cake_messages: [],
            },
        };

        const pageContent = buildDesignPageContent(sparseDesign, [{ size: '4" Bento', price: 399 }]);

        expect(pageContent.description.toLowerCase()).toContain('minimalist bento');
        expect(pageContent.faqs.some((faq) => faq.question.includes('store and transport'))).toBe(true);
        expect(pageContent.faqs.some((faq) => faq.question.includes('overall look'))).toBe(true);
        expect(pageContent.estimatedUniqueWordCount).toBeGreaterThanOrEqual(250);
    });
});

describe('generateDynamicCollectionDescription', () => {
    const mockDesigns = [
        {
            keywords: 'cinderella, princess',
            analysis_json: {
                cakeType: '1 tier',
                icing_design: {
                    colors: { top: 'pastel blue' },
                },
                main_toppers: [{ description: 'cinderella tiara topper', type: 'tiara' }],
                cake_messages: [{ text: 'Happy 5th Birthday Princess' }],
            },
        },
        {
            keywords: 'carriage cake',
            analysis_json: {
                cakeType: '2 tier',
                icing_design: {
                    colors: { top: 'white and gold' },
                },
                main_toppers: [{ description: 'golden carriage topper', type: 'carriage' }],
                cake_messages: [],
            },
        },
    ];

    it('returns empty string if designs list is empty', async () => {
        const mockAiClient = {} as unknown as AIApiClient;
        const result = await generateDynamicCollectionDescription('Cinderella', [], mockAiClient);
        expect(result).toBe('');
    });

    it('correctly constructs the prompt and calls the Gemini API to return a description', async () => {
        let capturedArgs: unknown = null;
        const mockAiClient = {
            models: {
                generateContent: async (args: unknown) => {
                    capturedArgs = args;
                    return {
                        text: JSON.stringify({
                            description: 'A magical collection of Cinderella themed custom cakes. Features elegant pastel blue and gold color palettes decorated with carriage and tiara toppers perfect for princess birthdays.',
                        }),
                    };
                },
            },
        } as unknown as AIApiClient;

        const result = await generateDynamicCollectionDescription('Cinderella', mockDesigns, mockAiClient);

        expect(result).toContain('magical collection of Cinderella themed custom cakes');
        expect(capturedArgs).toBeDefined();
        const args = capturedArgs as {
            model: string;
            contents: { role: string; parts: { text: string }[] }[];
            config?: {
                responseMimeType?: string;
                thinkingConfig?: {
                    thinkingLevel?: string;
                };
            };
        };
        expect(args.model).toBe('gemini-3.1-flash-lite-preview');
        expect(args.config?.responseMimeType).toBe('application/json');
        expect(args.config?.thinkingConfig?.thinkingLevel).toBe('LOW');

        // Assert prompt contains elements of the designs context
        const promptText = args.contents[0].parts[0].text;
        expect(promptText).toContain('Cinderella');
        expect(promptText).toContain('pastel blue');
        expect(promptText).toContain('cinderella tiara topper');
        expect(promptText).toContain('white and gold');
        expect(promptText).toContain('golden carriage topper');
    });

    it('handles JSON parsing errors or API errors by returning an empty string', async () => {
        const mockAiClient = {
            models: {
                generateContent: async () => {
                    return {
                        text: 'not-a-json-string',
                    };
                },
            },
        } as unknown as AIApiClient;

        const result = await generateDynamicCollectionDescription('Cinderella', mockDesigns, mockAiClient);
        expect(result).toBe('');
    });
});
