import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMoreDesigns } from './actions';

const { getDesignsByKeywordMock } = vi.hoisted(() => ({
    getDesignsByKeywordMock: vi.fn(),
}));

vi.mock('@/services/supabaseService', () => ({
    getDesignsByKeyword: getDesignsByKeywordMock,
}));

describe('fetchMoreDesigns', () => {
    beforeEach(() => {
        getDesignsByKeywordMock.mockReset();
    });

    it('keeps the collection page size and drops rows without a usable public image', async () => {
        getDesignsByKeywordMock.mockResolvedValue({
            data: [
                {
                    slug: 'missing-image',
                    p_hash: 'missing',
                    original_image_url: '',
                },
                {
                    slug: 'valid-image',
                    p_hash: 'valid',
                    original_image_url: 'https://example.com/original.webp',
                    studio_edited_image_url: 'https://example.com/studio.webp',
                },
            ],
            error: null,
        });

        const result = await fetchMoreDesigns('boss-baby-cake', 60);

        expect(getDesignsByKeywordMock).toHaveBeenCalledWith('boss-baby-cake', 30, 60);
        expect(result).toEqual({
            designs: [
                expect.objectContaining({
                    slug: 'valid-image',
                    original_image_url: 'https://example.com/studio.webp',
                    studio_edited_image_url: null,
                }),
            ],
            reachedEnd: true,
        });
    });
});
