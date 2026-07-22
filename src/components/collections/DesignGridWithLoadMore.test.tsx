import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignGridWithLoadMore } from './DesignGridWithLoadMore';

const { fetchMoreDesignsMock } = vi.hoisted(() => ({
    fetchMoreDesignsMock: vi.fn(),
}));

vi.mock('next/link', () => ({
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

vi.mock('react-masonry-css', () => ({
    default: ({ breakpointCols, className, columnClassName, children }: {
        breakpointCols: Record<string, number>;
        className: string;
        columnClassName: string;
        children: ReactNode;
    }) => (
        <div
            data-testid="product-masonry"
            data-breakpoints={JSON.stringify(breakpointCols)}
            data-class-name={className}
            data-column-class-name={columnClassName}
        >
            {children}
        </div>
    ),
}));

vi.mock('@/components/ProductCard', () => ({
    ProductCard: ({ keywords, priority }: { keywords?: string | null; priority?: boolean }) => (
        <article data-testid="product-card" data-priority={priority ? 'true' : 'false'}>
            {keywords}
        </article>
    ),
}));

vi.mock('@/components/LoadingSpinner', () => ({
    LoadingSpinner: () => <span data-testid="loading-spinner" />,
}));

vi.mock('@/app/collections/actions', () => ({
    fetchMoreDesigns: fetchMoreDesignsMock,
}));

vi.mock('./GoogleSearchSection', () => ({
    GoogleSearchSection: () => <div data-testid="google-search-section" />,
}));

const design = (index: number, altText?: string) => ({
    slug: `boss-baby-cake-${index}`,
    p_hash: `hash-${index}`,
    original_image_url: `https://example.com/cake-${index}.webp`,
    price: 1299 + index,
    keywords: `Boss Baby Cake ${index}`,
    alt_text: altText,
});

describe('DesignGridWithLoadMore', () => {
    beforeEach(() => {
        fetchMoreDesignsMock.mockReset();
        vi.stubGlobal('IntersectionObserver', class {
            observe() {}
            disconnect() {}
            unobserve() {}
        });
    });

    it('matches the search-results masonry layout without rendering SEO captions as grid items', () => {
        render(
            <DesignGridWithLoadMore
                initialDesigns={[
                    design(1, 'A long description that must not appear below the product card.'),
                    design(2),
                ]}
                keyword="boss-baby-cake"
                collectionTitle="Boss Baby Cake"
                currentPage={1}
                totalPages={1}
                basePath="/collections/boss-baby-cake"
            />,
        );

        const masonry = screen.getByTestId('product-masonry');
        expect(masonry).toHaveAttribute('data-class-name', 'flex -ml-3 w-auto');
        expect(masonry).toHaveAttribute('data-column-class-name', 'pl-3 bg-clip-padding');
        expect(JSON.parse(masonry.getAttribute('data-breakpoints') || '{}')).toEqual({
            default: 6,
            1536: 6,
            1280: 5,
            1024: 4,
            768: 3,
            640: 2,
        });
        expect(screen.getAllByTestId('product-card')).toHaveLength(2);
        expect(screen.queryByText('A long description that must not appear below the product card.')).not.toBeInTheDocument();
        expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
    });

    it('uses the search-style load-more control and appends the next server page', async () => {
        let resolveNextPage: (result: {
            designs: ReturnType<typeof design>[];
            reachedEnd: boolean;
        }) => void = () => undefined;
        fetchMoreDesignsMock.mockReturnValue(new Promise((resolve) => {
            resolveNextPage = resolve;
        }));

        render(
            <DesignGridWithLoadMore
                initialDesigns={[design(31)]}
                keyword="boss-baby-cake"
                currentPage={2}
                totalPages={3}
                basePath="/collections/boss-baby-cake"
            />,
        );

        fireEvent.click(screen.getByRole('link', { name: 'Load more designs' }));

        expect(fetchMoreDesignsMock).toHaveBeenCalledWith('boss-baby-cake', 60);
        expect(screen.getByRole('link', { name: /Loading/ })).toHaveAttribute('aria-disabled', 'true');

        await act(async () => {
            resolveNextPage({
                designs: [design(61), design(62)],
                reachedEnd: true,
            });
        });

        expect(screen.getAllByTestId('product-card')).toHaveLength(3);
        expect(screen.queryByRole('link', { name: 'Load more designs' })).not.toBeInTheDocument();
        expect(screen.queryByText('Next designs')).not.toBeInTheDocument();
        expect(screen.queryByText(/Page 2 of 3/)).not.toBeInTheDocument();
    });
});
