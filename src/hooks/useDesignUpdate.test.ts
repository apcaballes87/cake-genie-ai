import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateDesign } from '@/services/designService';
import { useDesignUpdate } from './useDesignUpdate';

vi.mock('@/services/designService', () => ({
    updateDesign: vi.fn(),
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
});
