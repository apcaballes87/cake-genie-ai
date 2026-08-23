import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRunActiveCakeAnalysis = vi.fn();
const mockCreateAdminServerSupabaseClient = vi.fn();
const mockCalculateCachePriceFromAnalysis = vi.fn();
const mockIsRejectedGeneratedCakeAnalysis = vi.fn();

vi.mock('@/lib/ai/analyzeCakeImage', () => ({
    runActiveCakeAnalysis: (...args: unknown[]) => mockRunActiveCakeAnalysis(...args),
}));

vi.mock('@/lib/supabase/adminServer', () => ({
    createAdminServerSupabaseClient: () => mockCreateAdminServerSupabaseClient(),
}));

vi.mock('@/services/supabaseService', () => ({
    calculateCachePriceFromAnalysis: (...args: unknown[]) => mockCalculateCachePriceFromAnalysis(...args),
}));

vi.mock('@/lib/ai/generatedAnalysisContract', () => ({
    isRejectedGeneratedCakeAnalysis: (...args: unknown[]) => mockIsRejectedGeneratedCakeAnalysis(...args),
}));

describe('prompt comparison server helpers', () => {
    beforeEach(() => {
        vi.resetModules();
        mockRunActiveCakeAnalysis.mockReset();
        mockCreateAdminServerSupabaseClient.mockReset();
        mockCalculateCachePriceFromAnalysis.mockReset();
        mockIsRejectedGeneratedCakeAnalysis.mockReset();
        vi.restoreAllMocks();
    });

    it('throws PromptComparisonError when cache row is not found', async () => {
        const admin = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                            data: null,
                            error: null,
                        }),
                    }),
                }),
            }),
        };
        mockCreateAdminServerSupabaseClient.mockReturnValue(admin);

        const { PromptComparisonError, runCakeAnalysisWithVersion } = await import('./promptComparison');

        await expect(runCakeAnalysisWithVersion('missing-hash', '3.35')).rejects.toThrow(PromptComparisonError);
        await expect(runCakeAnalysisWithVersion('missing-hash', '3.35')).rejects.toThrow('No cache row exists');
    });

    it('throws PromptComparisonError when original_image_url is missing', async () => {
        const admin = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                            data: { p_hash: 'abc', slug: 'test', price: 1299, original_image_url: null },
                            error: null,
                        }),
                    }),
                }),
            }),
        };
        mockCreateAdminServerSupabaseClient.mockReturnValue(admin);

        const { runCakeAnalysisWithVersion } = await import('./promptComparison');

        await expect(runCakeAnalysisWithVersion('abc', '3.35')).rejects.toThrow('no original image URL');
    });

    it('downloads the image, runs analysis with the specified version, and returns the result', async () => {
        const admin = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                            data: {
                                p_hash: 'abc',
                                slug: 'birthday-cake',
                                price: 1299,
                                original_image_url: 'https://example.com/cake.jpg',
                            },
                            error: null,
                        }),
                    }),
                }),
            }),
        };
        mockCreateAdminServerSupabaseClient.mockReturnValue(admin);

        const fakeImageResponse = {
            ok: true,
            status: 200,
            headers: {
                get: vi.fn().mockReturnValue('image/jpeg'),
            },
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        };
        global.fetch = vi.fn().mockResolvedValue(fakeImageResponse as unknown as Response);

        const newAnalysis = { cakeType: '2 Tier', cakeThickness: '4 in', main_toppers: [] };
        mockRunActiveCakeAnalysis.mockResolvedValue({ result: newAnalysis, promptVersion: '3.35' });
        mockIsRejectedGeneratedCakeAnalysis.mockReturnValue(false);
        mockCalculateCachePriceFromAnalysis.mockResolvedValue(1399);

        const { runCakeAnalysisWithVersion } = await import('./promptComparison');
        const result = await runCakeAnalysisWithVersion('abc', '3.35');

        expect(result).toEqual({
            p_hash: 'abc',
            slug: 'birthday-cake',
            analysis_json: newAnalysis,
            price: 1399,
            prompt_version: '3.35',
            is_rejected: false,
        });
        expect(mockRunActiveCakeAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                promptVersion: '3.35',
                sourceRoute: 'api/admin/cake-analysis-compare',
            }),
        );
        expect(mockCalculateCachePriceFromAnalysis).toHaveBeenCalledWith(newAnalysis);
    });

    it('returns rejection details when the analysis is rejected', async () => {
        const admin = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                            data: {
                                p_hash: 'abc',
                                slug: 'rejected-cake',
                                price: 999,
                                original_image_url: 'https://example.com/cake.jpg',
                            },
                            error: null,
                        }),
                    }),
                }),
            }),
        };
        mockCreateAdminServerSupabaseClient.mockReturnValue(admin);

        const fakeImageResponse = {
            ok: true,
            status: 200,
            headers: {
                get: vi.fn().mockReturnValue('image/jpeg'),
            },
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        };
        global.fetch = vi.fn().mockResolvedValue(fakeImageResponse as unknown as Response);

        const rejectedResult = {
            cakeType: '',
            cakeThickness: '',
            main_toppers: [],
            support_elements: [],
            cake_messages: [],
            icing_design: { base: 'soft_icing', color_type: 'single', colors: { side: '#FFFFFF', top: '#FFFFFF' }, drip: false, border_top: false, border_base: false, gumpasteBaseBoard: false },
            keyword: '',
            alt_text: '',
            seo_title: '',
            seo_description: '',
            rejection: { isRejected: true, reason: 'not_a_cake', message: 'No cake detected' },
        };
        mockRunActiveCakeAnalysis.mockResolvedValue({ result: rejectedResult, promptVersion: '3.35' });
        mockIsRejectedGeneratedCakeAnalysis.mockReturnValue(true);

        const { runCakeAnalysisWithVersion } = await import('./promptComparison');
        const result = await runCakeAnalysisWithVersion('abc', '3.35');

        expect(result).toEqual({
            p_hash: 'abc',
            slug: 'rejected-cake',
            analysis_json: rejectedResult,
            price: null,
            prompt_version: '3.35',
            is_rejected: true,
            rejection_reason: 'not_a_cake',
            rejection_message: 'No cake detected',
        });
        expect(mockCalculateCachePriceFromAnalysis).not.toHaveBeenCalled();
    });
});
