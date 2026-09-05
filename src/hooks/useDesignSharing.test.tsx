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
        maybeSingle.mockResolvedValue({ data: { slug: 'photo-cake-white-1-tier-cake-39cc' } });
    });
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
    it('does not expose a locally known slug before publication', async () => {
        maybeSingle.mockResolvedValue({ data: null });
        const { result } = renderHook(() => useDesignSharing({ slug: 'pending-design', originalImageUrl: null }));
        await act(async () => { await result.current.handleShare(); });
        expect(eq).toHaveBeenCalledWith('seo_status', 'published');
        expect(result.current.shareData).toBeNull();
        expect(result.current.isShareModalOpen).toBe(false);
    });

});
