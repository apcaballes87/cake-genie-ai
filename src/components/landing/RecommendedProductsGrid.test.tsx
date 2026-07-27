import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { RecommendedProductsGrid } from './RecommendedProductsGrid';

vi.mock('react-masonry-css', () => ({
    default: ({ children }: { children: ReactNode }) => <div data-testid="masonry">{children}</div>,
}));

vi.mock('@/components/ProductCard', () => ({
    ProductCard: ({ p_hash }: { p_hash: string }) => <article data-testid="product-card">{p_hash}</article>,
}));

vi.mock('@/services/supabaseService', () => ({
    getRecommendedProducts: vi.fn(),
}));

beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', class {
        observe() {}
        disconnect() {}
        unobserve() {}
    });
});

const product = (index: number) => ({
    p_hash: `hash-${index}`,
    original_image_url: `https://example.com/cake-${index}.webp`,
    price: 1299 + index,
});

describe('RecommendedProductsGrid', () => {
    it('keeps twelve initial cakes on mobile and wide desktop while limiting only the middle desktop bands', () => {
        render(
            <RecommendedProductsGrid
                initialProducts={Array.from({ length: 12 }, (_, index) => product(index))}
                limitInitialProductsAtDesktopBreakpoints
            />,
        );

        const cardWrappers = screen.getAllByTestId('product-card').map(card => card.parentElement);

        expect(cardWrappers).toHaveLength(12);
        expect(cardWrappers[7]).not.toHaveClass('hidden');
        expect(cardWrappers[8]).toHaveClass('min-[768px]:max-[1025px]:hidden');
        expect(cardWrappers[9]).toHaveClass('min-[768px]:max-[1025px]:hidden');
        expect(cardWrappers[10]).toHaveClass('min-[768px]:max-[1025px]:hidden');
        expect(cardWrappers[10]).toHaveClass('min-[1025px]:max-[1281px]:hidden');
        expect(cardWrappers[11]).toHaveClass('min-[768px]:max-[1025px]:hidden');
        expect(cardWrappers[11]).toHaveClass('min-[1025px]:max-[1281px]:hidden');
    });

    it('leaves non-homepage recommendation grids unbounded', () => {
        render(
            <RecommendedProductsGrid initialProducts={Array.from({ length: 12 }, (_, index) => product(index))} />,
        );

        screen.getAllByTestId('product-card').forEach(card => {
            expect(card.parentElement).not.toHaveClass('hidden');
        });
    });
});
