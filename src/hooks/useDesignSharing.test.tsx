import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CakeInfoUI } from '@/types';
import { useDesignSharing } from './useDesignSharing';

describe('useDesignSharing', () => {
    it('includes selected cake options in generated share links', async () => {
        const cakeInfo = {
            type: '1 Tier',
            size: '6" Round',
            thickness: '4 in',
        } as CakeInfoUI;

        const { result } = renderHook(() => useDesignSharing({
            slug: 'photo-cake-white-1-tier-cake-39cc',
            originalImageUrl: null,
            cakeInfo,
        }));

        await act(async () => {
            await result.current.handleShare();
        });

        expect(result.current.shareData?.botShareUrl).toBe(
            'https://genie.ph/customizing/photo-cake-white-1-tier-cake-39cc?caketype=1+Tier&size=6%22+Round&height=4+in',
        );
        expect(result.current.shareData?.shareUrl).toBe(
            'http://localhost:3000/customizing/photo-cake-white-1-tier-cake-39cc?caketype=1+Tier&size=6%22+Round&height=4+in',
        );
    });
});
