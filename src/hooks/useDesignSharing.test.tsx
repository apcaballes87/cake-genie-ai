import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CakeInfoUI } from '@/types';
import { useDesignSharing } from './useDesignSharing';

const { maybeSingle, eq } = vi.hoisted(() => ({ maybeSingle: vi.fn(), eq: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => {
    const query = { select: () => query, eq, maybeSingle };
    eq.mockReturnValue(query);
    return { from: () => query };
} }));

describe('useDesignSharing', () => {
    beforeEach(() => {
        eq.mockClear();
        maybeSingle.mockResolvedValue({ data: { slug: 'photo-cake-white-1-tier-cake-39cc', seo_status: 'pending' } });
    });
    it('shares a pending analysis with selected cake type and size', async () => {
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
            'https://genie.ph/customizing/photo-cake-white-1-tier-cake-39cc?caketype=1+Tier&size=6%22+Round',
        );
        expect(result.current.shareData?.shareUrl).toBe(
            'http://localhost:3000/customizing/photo-cake-white-1-tier-cake-39cc?caketype=1+Tier&size=6%22+Round',
        );
        expect(eq).not.toHaveBeenCalledWith('seo_status', 'published');
    });
    it('keeps height in the share URL for published designs', async () => {
        maybeSingle.mockResolvedValue({ data: { slug: 'photo-cake-white-1-tier-cake-39cc', seo_status: 'published' } });
        const { result } = renderHook(() => useDesignSharing({
            slug: 'photo-cake-white-1-tier-cake-39cc',
            originalImageUrl: null,
            cakeInfo: { type: '1 Tier', size: '6" Round', thickness: '4 in' } as CakeInfoUI,
        }));

        await act(async () => {
            await result.current.handleShare();
        });

        expect(result.current.shareData?.botShareUrl).toBe(
            'https://genie.ph/customizing/photo-cake-white-1-tier-cake-39cc?caketype=1+Tier&size=6%22+Round&height=4+in',
        );
    });
    it('does not create a link when the saved row has no slug', async () => {
        maybeSingle.mockResolvedValue({ data: null });
        const { result } = renderHook(() => useDesignSharing({ slug: 'pending-design', originalImageUrl: null }));
        await act(async () => { await result.current.handleShare(); });
        expect(result.current.shareData).toBeNull();
        expect(result.current.isShareModalOpen).toBe(false);
    });

});
