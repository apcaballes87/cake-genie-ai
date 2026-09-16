import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGenerateContent = vi.fn();
const mockGetOrCreatePromptCache = vi.fn();
const mockGetActivePromptDetails = vi.fn();
const mockGetDynamicTypeEnums = vi.fn();

const validAnalysis = {
    cakeType: '1 Tier',
    cakeThickness: '4 in',
    main_toppers: [],
    support_elements: [],
    cake_messages: [],
    icing_design: {
        base: 'soft_icing',
        color_type: 'single',
        colors: { side: '#87CEEB', top: '#FFFFFF' },
        drip: false,
        border_top: false,
        border_base: false,
        gumpasteBaseBoard: false,
    },
    keyword: 'Ocean Mermaid',
    alt_text: 'Blue ocean mermaid birthday cake.',
    seo_title: 'Ocean Mermaid Birthday Cake with Blue Icing in Cebu',
    seo_description: 'A blue ocean mermaid birthday cake.',
    rejection: { isRejected: false, reason: '', message: '' },
};

const validAnalysisOnly = {
    cakeType: validAnalysis.cakeType,
    cakeThickness: validAnalysis.cakeThickness,
    main_toppers: validAnalysis.main_toppers,
    support_elements: validAnalysis.support_elements,
    cake_messages: validAnalysis.cake_messages,
    icing_design: validAnalysis.icing_design,
    keyword: validAnalysis.keyword,
    rejection: validAnalysis.rejection,
};

const validLineRatioAnalysis = {
    ...validAnalysisOnly,
    cake_measurements: {
        diameter: { start: { x: 100, y: 500 }, end: { x: 900, y: 500 } },
        height: { start: { x: 500, y: 500 }, end: { x: 500, y: 800 } },
    },
    support_elements: [{
        type: 'edible_flowers',
        material: 'edible_fondant',
        group_id: 'side_flower',
        color: '#FF69B4',
        quantity: 1,
        size_line: { start: { x: 400, y: 300 }, end: { x: 480, y: 300 } },
        description: 'one pink fondant flower on the cake side',
    }],
};

vi.mock('@/lib/ai/client', () => ({
    getAI: vi.fn(() => ({
        models: {
            generateContent: mockGenerateContent,
        },
    })),
    getOrCreatePromptCache: (...args: unknown[]) => mockGetOrCreatePromptCache(...args),
}));

vi.mock('@/lib/supabase/client', () => ({
    createClient: vi.fn(() => ({})),
}));

vi.mock('@/services/prompts/promptLoader', () => ({
    getActivePromptDetails: (...args: unknown[]) => mockGetActivePromptDetails(...args),
}));

vi.mock('@/lib/ai/utils', () => ({
    getDynamicTypeEnums: (...args: unknown[]) => mockGetDynamicTypeEnums(...args),
}));

describe('POST /api/ai/analyze', () => {
    beforeEach(() => {
        vi.resetModules();
        mockGenerateContent.mockReset();
        mockGetOrCreatePromptCache.mockReset();
        mockGetActivePromptDetails.mockReset();
        mockGetDynamicTypeEnums.mockReset();
        mockGetActivePromptDetails.mockResolvedValue({
            promptText: '## STEP 5: SEO COPY GENERATION\nAnalyze this cake',
            version: '1.0',
        });
        mockGetDynamicTypeEnums.mockResolvedValue({
            mainTopperTypes: ['printout', 'edible_3d_ordinary'],
            supportElementTypes: ['edible_flowers', 'edible_2d_support', 'sprinkles'],
            subtypesByType: {},
        });
        mockGenerateContent.mockResolvedValue({
            text: JSON.stringify(validAnalysis),
        });
    });

    it('rejects requests if imageData or mimeType is missing', async () => {
        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload.error).toContain('Missing required fields');
    });

    it('processes successfully for admin requests without a Turnstile check', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue('mock-cache-name');

        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            headers: {
                'x-admin-pin': '231323',
            },
            body: JSON.stringify({
                imageData: 'base64-data',
                mimeType: 'image/png',
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.seo_title).toBe(validAnalysis.seo_title);
        expect(mockGenerateContent).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'gemini-3.5-flash-lite' })
        );
    });

    it('processes successfully for public requests without requiring a Turnstile token', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue(null); // Force uncached path for test coverage

        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: 'base64-data',
                mimeType: 'image/png',
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.seo_title).toBe(validAnalysis.seo_title);
        expect(mockGenerateContent).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'gemini-3.5-flash-lite' })
        );
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('fails closed when the conditional white-wafer verifier returns malformed JSON', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue(null);
        mockGetActivePromptDetails.mockResolvedValue({ promptText: 'Analyze this cake', version: '3.88' });
        mockGetDynamicTypeEnums.mockResolvedValue({
            mainTopperTypes: ['printout', 'edible_3d_ordinary'],
            supportElementTypes: ['edible_flowers', 'edible_2d_support', 'sprinkles', 'edible_photo_side_wave'],
            subtypesByType: {},
        });
        mockGenerateContent
            .mockResolvedValueOnce({
                text: JSON.stringify({
                    ...validAnalysisOnly,
                    support_elements: [{
                        type: 'edible_photo_side_wave',
                        material: 'waferpaper',
                        group_id: 'wafer_paper_side_wrap',
                        color: '#F5F5DC',
                        size: 'large',
                        quantity: 1,
                        description: 'repeated perimeter wrap of separate thin upright wafer-paper strips with loose wavy edges',
                    }],
                }),
            })
            .mockResolvedValueOnce({ text: '{}' });

        const { POST } = await import('./route');
        const response = await POST(new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({ imageData: 'base64-data', mimeType: 'image/png' }),
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.support_elements).toEqual([]);
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
        expect(mockGenerateContent.mock.calls[1][0]).toMatchObject({
            config: expect.objectContaining({ responseMimeType: 'application/json', temperature: 0 }),
        });
    });

    it('fails closed when the conditional white-wafer verifier times out', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue(null);
        mockGetActivePromptDetails.mockResolvedValue({ promptText: 'Analyze this cake', version: '3.89' });
        mockGetDynamicTypeEnums.mockResolvedValue({
            mainTopperTypes: ['printout', 'edible_3d_ordinary'],
            supportElementTypes: ['edible_flowers', 'edible_2d_support', 'sprinkles', 'edible_photo_side_wave'],
            subtypesByType: {},
        });
        mockGenerateContent
            .mockResolvedValueOnce({
                text: JSON.stringify({
                    ...validAnalysisOnly,
                    support_elements: [{
                        type: 'edible_photo_side_wave',
                        material: 'waferpaper',
                        group_id: 'ambiguous_white_side_wave',
                        color: '#FFFFFF',
                        size: 'large',
                        quantity: 1,
                        description: 'separate upright white wafer-paper strips with loose wavy edges around the side',
                    }],
                }),
            })
            .mockRejectedValueOnce(new Error('verifier timeout'));

        const { POST } = await import('./route');
        const response = await POST(new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({ imageData: 'base64-data', mimeType: 'image/png' }),
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.support_elements).toEqual([]);
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('retains a wave only after every white-only verifier cue passes', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue(null);
        mockGetActivePromptDetails.mockResolvedValue({ promptText: 'Analyze this cake', version: '3.88' });
        mockGetDynamicTypeEnums.mockResolvedValue({
            mainTopperTypes: ['printout', 'edible_3d_ordinary'],
            supportElementTypes: ['edible_flowers', 'edible_2d_support', 'sprinkles', 'edible_photo_side_wave'],
            subtypesByType: {},
        });
        mockGenerateContent
            .mockResolvedValueOnce({
                text: JSON.stringify({
                    ...validAnalysisOnly,
                    support_elements: [{
                        type: 'edible_photo_side_wave',
                        material: 'waferpaper',
                        group_id: 'white_wafer_paper_side_wrap',
                        color: '#FFFFFF',
                        size: 'large',
                        quantity: 1,
                        description: 'repeated perimeter wrap of separate thin upright white wafer-paper strips with loose wavy edges',
                    }],
                }),
            })
            .mockResolvedValueOnce({
                text: JSON.stringify({
                    hasDistinctThinPaperStrips: true,
                    hasUprightSeparateAttachment: true,
                    hasLooseFreeWavyEdges: true,
                    hasPredominantlyFullHeightWrap: true,
                    hasWhiteUnprintedSheets: true,
                }),
            });

        const { POST } = await import('./route');
        const response = await POST(new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({ imageData: 'base64-data', mimeType: 'image/png' }),
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.support_elements).toEqual([expect.objectContaining({
            type: 'edible_photo_side_wave',
            material: 'waferpaper',
        })]);
    });

    it('reconciles an unsupported Fondant thickness instead of returning 500', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue(null);
        mockGenerateContent.mockResolvedValue({
            text: JSON.stringify({
                ...validAnalysis,
                cakeType: '1 Tier Fondant',
                cakeThickness: '4 in',
                icing_design: {
                    ...validAnalysis.icing_design,
                    base: 'fondant',
                },
            }),
        });

        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: 'base64-data',
                mimeType: 'image/png',
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.cakeType).toBe('1 Tier Fondant');
        expect(payload.cakeThickness).toBe('5 in');
    });

    it('returns a canonical sprinkles tuple from the shared post-processor', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue(null);
        mockGenerateContent.mockResolvedValue({
            text: JSON.stringify({
                ...validAnalysis,
                support_elements: [{
                    type: 'edible_2d_support',
                    material: 'edible_fondant',
                    group_id: 'tiny_rainbow_sprinkles',
                    color: '#FF0000',
                    size: 'tiny',
                    quantity: 20,
                    description: 'colorful sprinkles on top',
                }],
            }),
        });

        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: 'base64-data',
                mimeType: 'image/png',
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.support_elements).toEqual([expect.objectContaining({
            type: 'sprinkles',
            material: 'candy',
            quantity: 1,
        })]);
    });

    it('retries once with a correction instruction when a variable-priced support element omits its size line', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue('mock-cache-name');
        mockGetActivePromptDetails.mockResolvedValue({
            promptText: 'Analyze this cake',
            version: '3.83',
        });
        mockGenerateContent
            .mockResolvedValueOnce({
                text: JSON.stringify({
                    ...validLineRatioAnalysis,
                    support_elements: [{
                        ...validLineRatioAnalysis.support_elements[0],
                        size_line: undefined,
                    }],
                }),
            })
            .mockResolvedValueOnce({ text: JSON.stringify(validLineRatioAnalysis) });

        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({ imageData: 'base64-data', mimeType: 'image/png' }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.support_elements[0]).toEqual(expect.objectContaining({
            type: 'edible_flowers',
            size: 'small',
        }));
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
        expect(mockGenerateContent.mock.calls[1][0].contents[0].parts).toEqual(expect.arrayContaining([
            expect.objectContaining({ text: expect.stringContaining('omitted a required representative `size_line`') }),
        ]));
        expect(mockGenerateContent.mock.calls[1][0].config.cachedContent).toBe('mock-cache-name');
    });

    it('reuses cached prompt details and enum config across hot requests', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue('mock-cache-name');

        const { POST } = await import('./route');
        const makeRequest = () =>
            new NextRequest('http://localhost/api/ai/analyze', {
                method: 'POST',
                body: JSON.stringify({
                    imageData: 'base64-data',
                    mimeType: 'image/png',
                }),
            });

        const firstResponse = await POST(makeRequest());
        const secondResponse = await POST(makeRequest());

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);
        expect(mockGetActivePromptDetails).toHaveBeenCalledTimes(1);
        expect(mockGetDynamicTypeEnums).toHaveBeenCalledTimes(1);
        expect(mockGetOrCreatePromptCache).toHaveBeenCalledTimes(1);
    });
});
