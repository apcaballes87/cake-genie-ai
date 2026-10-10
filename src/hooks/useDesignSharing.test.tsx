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
    it('shares a pending analysis using only the slug, cake type, and size', async () => {
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
        expect(eq).toHaveBeenCalledWith('slug', 'photo-cake-white-1-tier-cake-39cc');
        expect(eq).not.toHaveBeenCalledWith('seo_status', 'published');
    });
    it('does not expose a link if the cache row cannot be resolved', async () => {
        maybeSingle.mockResolvedValue({ data: null });
        const { result } = renderHook(() => useDesignSharing({ slug: 'pending-design', originalImageUrl: null }));
        await act(async () => { await result.current.handleShare(); });
        expect(result.current.shareData).toBeNull();
        expect(result.current.isShareModalOpen).toBe(false);
    });

    it('preserves the existing cake height option for published designs', async () => {
        maybeSingle.mockResolvedValue({ data: { slug: 'published-cake', seo_status: 'published' } });
        const { result } = renderHook(() => useDesignSharing({
            slug: 'published-cake',
            originalImageUrl: null,
            cakeInfo: { type: '1 Tier', size: '6" Round', thickness: '4 in' },
        }));

        await act(async () => {
            await result.current.handleShare();
        });

        expect(result.current.shareData?.botShareUrl).toBe(
            'https://genie.ph/customizing/published-cake?caketype=1+Tier&size=6%22+Round&height=4+in',
        );
    });

});
