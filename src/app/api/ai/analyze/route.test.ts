import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getDevelopmentPromptVersionOverride } from './promptVersionOverride';
import { buildCakeAnalysisContractRepairInstruction } from '@/lib/ai/analyzeCakeImage';

const mockGenerateContent = vi.fn();
const mockGetOrCreatePromptCache = vi.fn();
const mockGetActivePromptDetails = vi.fn();
const mockGetPromptDetailsByVersion = vi.fn();
const mockGetDynamicTypeEnums = vi.fn();
const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/N7sAAAAASUVORK5CYII=';

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
    getPromptDetailsByVersion: (...args: unknown[]) => mockGetPromptDetailsByVersion(...args),
}));

vi.mock('@/lib/supabase/adminServer', () => ({
    createAdminServerSupabaseClient: vi.fn(() => ({})),
}));

vi.mock('@/lib/ai/utils', () => ({
    getDynamicTypeEnums: (...args: unknown[]) => mockGetDynamicTypeEnums(...args),
}));

describe('POST /api/ai/analyze', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    beforeEach(() => {
        vi.resetModules();
        mockGenerateContent.mockReset();
        mockGetOrCreatePromptCache.mockReset();
        mockGetActivePromptDetails.mockReset();
        mockGetPromptDetailsByVersion.mockReset();
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
        mockGetPromptDetailsByVersion.mockResolvedValue({
            promptText: '## STEP 5: SEO COPY GENERATION\nAnalyze this cake',
            version: '3.92',
        });
        mockGenerateContent.mockResolvedValue({
            text: JSON.stringify(validAnalysis),
        });
    });

    it('allows a local-only staged prompt override without exposing it outside development', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('CAKE_ANALYSIS_PROMPT_VERSION', ' 3.92 ');
        expect(getDevelopmentPromptVersionOverride()).toBe('3.92');

        vi.stubEnv('NODE_ENV', 'production');
        expect(getDevelopmentPromptVersionOverride()).toBeUndefined();
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
        expect(payload.error).toContain('Missing or invalid imageData');
    });

    it.each([
        ['malformed JSON', '{', 400],
        ['a null body', 'null', 400],
        ['a missing MIME type', JSON.stringify({ imageData: validPngBase64 }), 400],
        ['a non-string imageData', JSON.stringify({ imageData: [], mimeType: 'image/png' }), 400],
        ['a non-string MIME type', JSON.stringify({ imageData: validPngBase64, mimeType: 7 }), 400],
        ['a non-string sourceContext', JSON.stringify({ imageData: validPngBase64, mimeType: 'image/png', sourceContext: [] }), 400],
        ['invalid base64 imageData', JSON.stringify({ imageData: 'not-base64!', mimeType: 'image/png' }), 400],
        ['an unsupported image MIME type', JSON.stringify({ imageData: validPngBase64, mimeType: 'image/gif' }), 415],
        ['an image MIME mismatch', JSON.stringify({ imageData: validPngBase64, mimeType: 'image/webp' }), 400],
    ] as const)('rejects %s before calling the model', async (_name, body, expectedStatus) => {
        const { POST } = await import('./route');
        const response = await POST(new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body,
        }));

        expect(response.status).toBe(expectedStatus);
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('returns 413 when the request exceeds the bounded JSON-body size', async () => {
        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            headers: { 'content-length': String(4 * 1024 * 1024 + 1) },
            body: JSON.stringify({ imageData: validPngBase64, mimeType: 'image/png' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(413);
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('enforces the body-size limit from the stream when content-length is absent', async () => {
        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({ imageData: 'A'.repeat(4 * 1024 * 1024), mimeType: 'image/png' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(413);
        expect(mockGenerateContent).not.toHaveBeenCalled();
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
                imageData: validPngBase64,
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
                imageData: validPngBase64,
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

    it('repairs one provider response that omits a required priced-row field', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue(null);
        mockGenerateContent
            .mockResolvedValueOnce({
                text: JSON.stringify({
                    ...validAnalysis,
                    main_toppers: [{
                        type: 'printout',
                        material: 'photopaper',
                        group_id: 'hero',
                        classification: 'hero',
                        quantity: 1,
                        description: 'printed topper',
                    }],
                }),
            })
            .mockResolvedValueOnce({ text: JSON.stringify(validAnalysis) });

        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({ imageData: validPngBase64, mimeType: 'image/png' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
        expect(mockGenerateContent.mock.calls[1][0].contents[0].parts.at(-1).text)
            .toContain('complete replacement JSON object');
    });

    it('bounds contract repair to one retry when the provider remains invalid', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue(null);
        const invalidResponse = {
            text: JSON.stringify({
                ...validAnalysis,
                main_toppers: [{
                    type: 'printout',
                    material: 'photopaper',
                    group_id: 'hero',
                    classification: 'hero',
                    quantity: 1,
                    description: 'printed topper',
                }],
            }),
        };
        mockGenerateContent.mockResolvedValueOnce(invalidResponse).mockResolvedValueOnce(invalidResponse);

        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({ imageData: validPngBase64, mimeType: 'image/png' }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(502);
        expect(payload.error).toContain('could not be validated');
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('repairs an integrated measurement-line violation with the required [y, x] geometry guidance', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('CAKE_ANALYSIS_PROMPT_VERSION', '3.92');
        mockGetOrCreatePromptCache.mockResolvedValue(null);
        const validIntegratedResponse = {
            analysis: validAnalysis,
            geometry: {
                geometry_version: 'integrated_bbox_v1',
                cake_diameter_line: { start: [300, 100], end: [300, 900] },
                cake_height_line: { start: [300, 500], end: [800, 500] },
            },
        };
        mockGenerateContent
            .mockResolvedValueOnce({
                text: JSON.stringify({
                    ...validIntegratedResponse,
                    geometry: {
                        ...validIntegratedResponse.geometry,
                        // This is an [x, y] diameter line interpreted as [y, x].
                        cake_diameter_line: { start: [100, 300], end: [900, 300] },
                    },
                }),
            })
            .mockResolvedValueOnce({ text: JSON.stringify(validIntegratedResponse) });

        const { POST } = await import('./route');
        const response = await POST(new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({ imageData: validPngBase64, mimeType: 'image/png' }),
        }));

        expect(response.status).toBe(200);
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
        const repairText = mockGenerateContent.mock.calls[1][0].contents[0].parts.at(-1).text;
        expect(repairText).toContain('cake_diameter_line must run from the cake’s left rim to right rim');
        expect(repairText).toContain('Every measurement point is [y, x], never [x, y]');
        expect(repairText).toContain('left rim to right rim');
    });

    it('does not tell an integrated response to emit model-owned size fields during repair', () => {
        const error = new Error('Invalid response format from AI', {
            cause: new Error('integrated bbox geometry: geometry.cake_diameter_line must be a left-to-right predominantly horizontal line'),
        });
        const repairText = buildCakeAnalysisContractRepairInstruction(error, 'integrated_bbox_v1');

        expect(repairText).not.toMatch(/size fields/i);
        expect(repairText).toContain('integrated_bbox_v1');
    });

    it('uses a type-supported thickness when the repaired integrated response still has no usable height line', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        mockGetActivePromptDetails.mockResolvedValue({
            promptText: '## STEP 5: SEO COPY GENERATION\nAnalyze this cake using integrated_bbox_v2.',
            version: '3.93',
        });
        mockGetOrCreatePromptCache.mockResolvedValue(null);
        const analysis: Record<string, unknown> = { ...validAnalysis, cakeType: 'Square' };
        delete analysis.cakeThickness;
        const responseWithoutHeight = {
            text: JSON.stringify({
                analysis,
                geometry: {
                    geometry_version: 'integrated_bbox_v2',
                    cake_diameter_line: { start: [300, 100], end: [300, 900] },
                },
            }),
        };
        mockGenerateContent.mockResolvedValueOnce(responseWithoutHeight).mockResolvedValueOnce(responseWithoutHeight);

        const { POST } = await import('./route');
        const response = await POST(new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({ imageData: validPngBase64, mimeType: 'image/png' }),
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.cakeType).toBe('Square');
        expect(payload.cakeThickness).toBe('3 in');
        expect(payload.geometry).not.toHaveProperty('cake_height_line');
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
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
                imageData: validPngBase64,
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
                imageData: validPngBase64,
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

    it('reuses prompt details and enum config across hot requests without creating a provider cache', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue('mock-cache-name');

        const { POST } = await import('./route');
        const makeRequest = () =>
            new NextRequest('http://localhost/api/ai/analyze', {
                method: 'POST',
                body: JSON.stringify({
                    imageData: validPngBase64,
                    mimeType: 'image/png',
                }),
            });

        const firstResponse = await POST(makeRequest());
        const secondResponse = await POST(makeRequest());

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);
        expect(mockGetActivePromptDetails).toHaveBeenCalledTimes(1);
        expect(mockGetDynamicTypeEnums).toHaveBeenCalledTimes(1);
        expect(mockGetOrCreatePromptCache).not.toHaveBeenCalled();
    });
});
