import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeCakeFeaturesOnly } from './geminiService';
import { CLIENT_API_ERROR_EVENT, type ClientApiErrorReport } from '@/lib/clientApiErrors';

vi.mock('./roboflowService', () => ({
    detectObjectsWithRoboflow: vi.fn(),
    roboflowBboxToAppCoordinates: vi.fn(),
    findMatchingDetection: vi.fn(),
}));

vi.mock('@/config/features', () => ({
    FEATURE_FLAGS: {},
    isRoboflowConfigured: vi.fn(() => false),
}));

vi.mock('@/lib/utils/imageOptimization', () => ({
    compressImage: vi.fn(),
    dataURItoBlob: vi.fn(),
}));

vi.mock('@/utils/editImageTuning', () => ({
    getEditImageCompressionOptions: vi.fn(),
}));

vi.mock('@/lib/ai/analysisDebug', () => ({
    logCakeAnalysisDebug: vi.fn(),
}));

describe('analyzeCakeFeaturesOnly client error reporting', () => {
    const fetchMock = vi.fn();
    const reports: ClientApiErrorReport[] = [];
    const handleReport = (event: Event) => {
        reports.push((event as CustomEvent<ClientApiErrorReport>).detail);
    };

    beforeEach(() => {
        reports.length = 0;
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        window.addEventListener(CLIENT_API_ERROR_EVENT, handleReport);
    });

    afterEach(() => {
        window.removeEventListener(CLIENT_API_ERROR_EVENT, handleReport);
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('reports server errors with the response message and route context, without image data', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            error: 'Invalid generated cake analysis: cakeThickness: 5 in is not supported for Square',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        }));

        await expect(analyzeCakeFeaturesOnly('private-image-payload', 'image/png'))
            .rejects.toThrow('Failed to analyze cake image. Please try again.');

        expect(reports).toHaveLength(1);
        expect(reports[0]).toMatchObject({
            endpoint: '/api/ai/analyze',
            method: 'POST',
            status: 500,
            message: 'Invalid generated cake analysis: cakeThickness: 5 in is not supported for Square',
        });
        expect(JSON.stringify(reports[0])).not.toContain('private-image-payload');
    });

    it('does not report client-side 4xx analysis responses as internal errors', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Invalid upload' }), {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
        }));

        await expect(analyzeCakeFeaturesOnly('image-payload', 'image/png'))
            .rejects.toThrow('Failed to analyze cake image. Please try again.');

        expect(reports).toHaveLength(0);
    });
});
