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
        expect(onSuccess).toHaveBeenCalledWith('edited-image');
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
        expect(onSuccess).toHaveBeenNthCalledWith(1, 'first-image');
        expect(onSuccess).toHaveBeenNthCalledWith(2, 'second-image');
    });
});