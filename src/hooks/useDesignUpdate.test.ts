import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateDesign } from '@/services/designService';
import { useDesignUpdate } from './useDesignUpdate';

vi.mock('@/services/designService', () => ({
    updateDesign: vi.fn(),
}));

const { fileToBase64Mock } = vi.hoisted(() => ({
    fileToBase64Mock: vi.fn(),
}));

vi.mock('@/services/geminiService', () => ({
    fileToBase64: fileToBase64Mock,
}));

describe('useDesignUpdate', () => {
    const baseProps = {
        originalImageData: { data: 'image-data', mimeType: 'image/png' },
        editedImage: null,
        analysisResult: {} as never,
        cakeInfo: {} as never,
        mainToppers: [],
        supportElements: [],
        cakeMessages: [],
        icingDesign: {} as never,
        additionalInstructions: '',
        threeTierReferenceImage: null,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        fileToBase64Mock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('reuses the in-flight promise instead of stacking concurrent updates', async () => {
        let resolveUpdate!: (value: { image: string; prompt: string; systemInstruction: string }) => void;
        vi.mocked(updateDesign).mockImplementation(
            () => new Promise((resolve) => { resolveUpdate = resolve; }),
        );
        const onSuccess = vi.fn();

        const { result } = renderHook(() => useDesignUpdate({ ...baseProps, onSuccess }));

        let firstPromise!: Promise<string>;
        let secondPromise!: Promise<string>;

        act(() => {
            firstPromise = result.current.handleUpdateDesign();
            secondPromise = result.current.handleUpdateDesign();
        });

        expect(firstPromise).toBe(secondPromise);
        expect(updateDesign).toHaveBeenCalledTimes(1);
        expect(result.current.isLoading).toBe(true);

        await act(async () => {
            resolveUpdate({ image: 'edited-image', prompt: 'prompt', systemInstruction: 'system' });
            await firstPromise;
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledWith('edited-image', baseProps.originalImageData);
    });

    it('keeps different visual request keys independent even when they overlap', async () => {
        const resolvers: Array<(value: { image: string; prompt: string; systemInstruction: string }) => void> = [];
        vi.mocked(updateDesign).mockImplementation(
            () => new Promise((resolve) => { resolvers.push(resolve); }),
        );
        const onSuccess = vi.fn();
        const topperAOff = [{ id: 'topper-a', isEnabled: false }] as never;
        const bothToppersOff = [
            { id: 'topper-a', isEnabled: false },
            { id: 'topper-b', isEnabled: false },
        ] as never;
        const { result } = renderHook(() => useDesignUpdate({ ...baseProps, onSuccess }));

        let firstRequest!: Promise<string>;
        let secondRequest!: Promise<string>;
        act(() => {
            firstRequest = result.current.handleUpdateDesign(undefined, {
                requestKey: 'cart-item-a',
                commitResult: false,
                stateOverrides: { mainToppers: topperAOff },
            });
            secondRequest = result.current.handleUpdateDesign(undefined, {
                requestKey: 'cart-item-b',
                commitResult: false,
                stateOverrides: { mainToppers: bothToppersOff },
            });
        });

        expect(firstRequest).not.toBe(secondRequest);
        expect(updateDesign).toHaveBeenCalledTimes(2);
        expect(updateDesign).toHaveBeenNthCalledWith(1, expect.objectContaining({
            mainToppers: topperAOff,
        }));
        expect(updateDesign).toHaveBeenNthCalledWith(2, expect.objectContaining({
            mainToppers: bothToppersOff,
        }));

        await act(async () => {
            resolvers[1]({ image: 'both-off-image', prompt: 'p2', systemInstruction: 's2' });
            await expect(secondRequest).resolves.toBe('both-off-image');
            expect(result.current.isLoading).toBe(true);
            resolvers[0]({ image: 'topper-a-off-image', prompt: 'p1', systemInstruction: 's1' });
            await expect(firstRequest).resolves.toBe('topper-a-off-image');
        });

        expect(onSuccess).not.toHaveBeenCalled();
        expect(result.current.isLoading).toBe(false);
    });

    it('allows a new update after the previous one finishes', async () => {
        vi.mocked(updateDesign)
            .mockResolvedValueOnce({ image: 'first-image', prompt: 'p1', systemInstruction: 's1' })
            .mockResolvedValueOnce({ image: 'second-image', prompt: 'p2', systemInstruction: 's2' });
        const onSuccess = vi.fn();

        const { result } = renderHook(() => useDesignUpdate({ ...baseProps, onSuccess }));

        await act(async () => {
            await result.current.handleUpdateDesign();
        });

        await act(async () => {
            await result.current.handleUpdateDesign();
        });

        expect(updateDesign).toHaveBeenCalledTimes(2);
        expect(onSuccess).toHaveBeenNthCalledWith(1, 'first-image', baseProps.originalImageData);
        expect(onSuccess).toHaveBeenNthCalledWith(2, 'second-image', baseProps.originalImageData);
    });

    it('rejects instead of keeping a stale image when a precise preview is required', async () => {
        vi.mocked(updateDesign).mockRejectedValueOnce(new Error('Image request blocked by safety settings'));
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useDesignUpdate({ ...baseProps, onSuccess }));

        await act(async () => {
            await expect(result.current.handleUpdateDesign(undefined, {
                allowSafetyFallback: false,
            })).rejects.toThrow('Image request blocked by safety settings');
        });

        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('passes state and prompt overrides through to updateDesign', async () => {
        vi.mocked(updateDesign).mockResolvedValueOnce({
            image: 'override-image',
            prompt: 'override-prompt',
            systemInstruction: 'override-system',
        });
        const onSuccess = vi.fn();
        const promptGenerator = vi.fn(() => 'fast-path prompt');
        const overriddenCakeInfo = { size: '8" Round' } as never;
        const overriddenIcingDesign = { drip: true } as never;

        const { result } = renderHook(() => useDesignUpdate({ ...baseProps, onSuccess }));

        await act(async () => {
            await result.current.handleUpdateDesign('[USER REQUEST]: add drip', {
                traceId: 'trace-123',
                source: 'ai-chat-image-edit',
                promptGenerator,
                stateOverrides: {
                    analysisResult: { cakeType: '1 Tier' } as never,
                    cakeInfo: overriddenCakeInfo,
                    cakeMessages: [{ text: 'Hi' }] as never,
                    icingDesign: overriddenIcingDesign,
                    additionalInstructions: 'existing context',
                },
            });
        });

        expect(updateDesign).toHaveBeenCalledWith(expect.objectContaining({
            traceId: 'trace-123',
            requestSource: 'ai-chat-image-edit',
            analysisResult: { cakeType: '1 Tier' },
            originalImageData: baseProps.originalImageData,
            cakeInfo: overriddenCakeInfo,
            cakeMessages: [{ text: 'Hi' }],
            icingDesign: overriddenIcingDesign,
            additionalInstructions: 'existing context. [USER REQUEST]: add drip',
            promptGenerator,
        }));
        expect(onSuccess).toHaveBeenCalledWith('override-image', baseProps.originalImageData);
    });

    it('passes reference images through to updateDesign', async () => {
        vi.mocked(updateDesign).mockResolvedValueOnce({
            image: 'reference-image-result',
            prompt: 'reference-prompt',
            systemInstruction: 'reference-system',
        });
        const onSuccess = vi.fn();
        const referenceImages = [{
            label: 'Chat reference 1',
            targetDescription: 'moodboard.png',
            targetType: 'design reference',
            image: {
                data: 'reference-base64',
                mimeType: 'image/png',
            },
        }];

        const { result } = renderHook(() => useDesignUpdate({ ...baseProps, onSuccess }));

        await act(async () => {
            await result.current.handleUpdateDesign('[USER REQUEST]: make it like this', {
                source: 'ai-chat-image-edit',
                referenceImages,
            });
        });

        expect(updateDesign).toHaveBeenCalledWith(expect.objectContaining({
            requestSource: 'ai-chat-image-edit',
            referenceImages,
        }));
        expect(onSuccess).toHaveBeenCalledWith('reference-image-result', baseProps.originalImageData);
    });

    it('does not apply a stale image result after its request is aborted', async () => {
        let resolveUpdate!: (value: { image: string; prompt: string; systemInstruction: string }) => void;
        vi.mocked(updateDesign).mockImplementation(
            () => new Promise((resolve) => { resolveUpdate = resolve; }),
        );
        const onSuccess = vi.fn();
        const controller = new AbortController();
        const { result } = renderHook(() => useDesignUpdate({ ...baseProps, onSuccess }));

        let request!: Promise<string>;
        act(() => {
            request = result.current.handleUpdateDesign('[USER REQUEST]: change to fondant', {
                source: 'ai-chat-image-edit',
                signal: controller.signal,
            });
        });

        controller.abort();
        await act(async () => {
            resolveUpdate({ image: 'stale-image', prompt: 'prompt', systemInstruction: 'system' });
            await expect(request).rejects.toMatchObject({ name: 'AbortError' });
        });

        expect(updateDesign).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('uses the latest edited image as the base for the next design update', async () => {
        vi.mocked(updateDesign).mockResolvedValueOnce({
            image: 'next-image',
            prompt: 'next-prompt',
            systemInstruction: 'next-system',
        });
        const onSuccess = vi.fn();

        const { result } = renderHook(() => useDesignUpdate({
            ...baseProps,
            editedImage: 'data:image/webp;base64,edited-base64-data',
            onSuccess,
        }));

        await act(async () => {
            await result.current.handleUpdateDesign();
        });

        expect(updateDesign).toHaveBeenCalledWith(expect.objectContaining({
            originalImageData: {
                data: 'edited-base64-data',
                mimeType: 'image/webp',
            },
        }));
        expect(onSuccess).toHaveBeenCalledWith('next-image', {
            data: 'edited-base64-data',
            mimeType: 'image/webp',
        });
    });

    it('resolves an explicit permanent base image without committing a cart preview', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            blob: vi.fn().mockResolvedValue(new Blob(['cart-base'], { type: 'image/webp' })),
        });
        vi.stubGlobal('fetch', fetchMock);
        fileToBase64Mock.mockResolvedValue({
            data: 'resolved-cart-base',
            mimeType: 'image/webp',
        });
        vi.mocked(updateDesign).mockResolvedValueOnce({
            image: 'cart-only-result',
            prompt: 'cart-prompt',
            systemInstruction: 'cart-system',
        });
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useDesignUpdate({ ...baseProps, onSuccess }));

        await act(async () => {
            await result.current.handleUpdateDesign(undefined, {
                requestKey: 'cart-item-url-base',
                baseImage: 'https://example.com/applied-design.webp',
                commitResult: false,
            });
        });

        expect(fetchMock).toHaveBeenCalled();
        expect(updateDesign).toHaveBeenCalledWith(expect.objectContaining({
            originalImageData: {
                data: 'resolved-cart-base',
                mimeType: 'image/webp',
            },
        }));
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('uses the studio-edited image bytes for icing-mask fallback requests', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            blob: vi.fn().mockResolvedValue(new Blob(['studio-image'], { type: 'image/webp' })),
        });
        vi.stubGlobal('fetch', fetchMock);
        fileToBase64Mock.mockResolvedValue({
            data: 'studio-base64-data',
            mimeType: 'image/webp',
        });
        vi.mocked(updateDesign).mockResolvedValueOnce({
            image: 'fallback-image',
            prompt: 'fallback-prompt',
            systemInstruction: 'fallback-system',
        });
        const onSuccess = vi.fn();

        const { result } = renderHook(() => useDesignUpdate({
            ...baseProps,
            studioEditedImageUrl: 'https://example.com/studio.webp',
            onSuccess,
        }));

        await act(async () => {
            await result.current.handleUpdateDesign('Recolor the icing to purple', {
                source: 'icing-mask-fallback',
            });
        });

        expect(fetchMock).toHaveBeenCalledWith('https://example.com/studio.webp', expect.any(Object));
        expect(updateDesign).toHaveBeenCalledWith(expect.objectContaining({
            requestSource: 'icing-mask-fallback',
            originalImageData: {
                data: 'studio-base64-data',
                mimeType: 'image/webp',
            },
        }));
        expect(onSuccess).toHaveBeenCalledWith('fallback-image', {
            data: 'studio-base64-data',
            mimeType: 'image/webp',
        });
    });
});
