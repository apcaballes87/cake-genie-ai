import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getDevelopmentPromptVersionOverride } from './promptVersionOverride';
import { getContractCorrectionInstruction } from '@/lib/ai/analyzeCakeImage';
import { GeneratedAnalysisContractError } from '@/lib/ai/generatedAnalysisContract';

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

    it('allows a local-only staged prompt override without exposing it outside development', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('CAKE_ANALYSIS_PROMPT_VERSION', ' 3.92 ');
        expect(getDevelopmentPromptVersionOverride()).toBe('3.92');

        vi.stubEnv('NODE_ENV', 'production');
        expect(getDevelopmentPromptVersionOverride()).toBeUndefined();
    });

    it('retries an integrated diameter-line orientation violation with explicit [y, x] geometry guidance', () => {
        const correction = getContractCorrectionInstruction(new GeneratedAnalysisContractError(
            'integrated bbox geometry: geometry.cake_diameter_line must be a left-to-right predominantly horizontal line',
        ));

        expect(correction).toContain('integrated_bbox_v1');
        expect(correction).toContain('Every measurement point is [y, x], never [x, y]');
        expect(correction).toContain('left rim to right rim');
        expect(correction).toContain('Do not reuse the invalid measurement lines');
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
