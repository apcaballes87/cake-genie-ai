import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomizingDiscoverySections } from './CustomizingDiscoverySections';

vi.mock('next/link', () => ({
    default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

vi.mock('react-masonry-css', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div data-testid="masonry">{children}</div>,
}));

vi.mock('@/components/LazyImage', () => ({
    default: ({ alt }: { alt: string }) => <div data-testid="lazy-image">{alt}</div>,
}));

vi.mock('@/components/ProductCard', () => ({
    ProductCard: ({ keywords }: { keywords?: string | null }) => (
        <div data-testid="product-card">{keywords || 'Custom Cake'}</div>
    ),
}));

describe('CustomizingDiscoverySections', () => {
    it('renders nothing while analysis is in progress', () => {
        const { container } = render(
            <CustomizingDiscoverySections
                isAnalyzing
                relatedDesigns={[]}
                hasMoreDesigns={false}
                isLoadingMoreDesigns={false}
                onLoadMoreDesigns={() => {}}
                relatedCollections={[]}
            />
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('renders related designs and triggers load more', async () => {
        const user = userEvent.setup();
        const onLoadMoreDesigns = vi.fn();

        render(
            <CustomizingDiscoverySections
                isAnalyzing={false}
                relatedDesigns={[
                    {
                        p_hash: 'hash-1',
                        slug: 'design-1',
                        original_image_url: 'https://example.com/design-1.jpg',
                        keywords: 'Birthday Cake',
                    },
                ]}
                hasMoreDesigns
                isLoadingMoreDesigns={false}
                onLoadMoreDesigns={onLoadMoreDesigns}
                relatedCollections={[]}
            />
        );

        expect(screen.getByText('What other designs are trending in Cebu?')).toBeInTheDocument();
        expect(screen.getByTestId('masonry')).toBeInTheDocument();
        expect(screen.getByTestId('product-card')).toHaveTextContent('Birthday Cake');

        await user.click(screen.getByRole('button', { name: 'Show more related designs' }));

        expect(onLoadMoreDesigns).toHaveBeenCalledTimes(1);
    });

    it('renders related collections with links and counts', () => {
        render(
            <CustomizingDiscoverySections
                isAnalyzing={false}
                relatedDesigns={[]}
                hasMoreDesigns={false}
                isLoadingMoreDesigns={false}
                onLoadMoreDesigns={() => {}}
                relatedCollections={[
                    {
                        slug: 'birthday-cakes',
                        name: 'Birthday Cakes',
                        item_count: 12,
                        sample_image: 'https://example.com/collection.jpg',
                    },
                ]}
            />
        );

        expect(screen.getByText('Explore Related Collections')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /birthday cakes/i })).toHaveAttribute('href', '/collections/birthday-cakes');
        expect(screen.getByText('12 Designs')).toBeInTheDocument();
        expect(screen.getByTestId('lazy-image')).toHaveTextContent('Birthday Cakes');
    });
});