import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { RelatedProductsSection } from './RelatedProductsSection';

vi.mock('react-masonry-css', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ProductCard', () => ({
  ProductCard: ({ slug }: { slug?: string | null }) => <div data-testid="product-card">{slug || 'no-slug'}</div>,
}));

vi.mock('./BlogUploadButton', () => ({
  BlogUploadButton: () => <button type="button">Upload Your Design & Get Price in Seconds</button>,
}));

vi.mock('@/services/supabaseService', () => ({
  getRelatedProductsByKeywords: vi.fn(),
}));

beforeAll(() => {
  class MockIntersectionObserver {
    observe() { }
    disconnect() { }
    unobserve() { }
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

describe('RelatedProductsSection', () => {
  it('renders the upload CTA and secondary birthday collections button', () => {
    render(
      <RelatedProductsSection
        initialProducts={[
          {
            p_hash: '1',
            original_image_url: 'https://example.com/cake.jpg',
            slug: 'birthday-cake-1',
          },
        ]}
        keyword="minimalist cake"
        slug="sample-post"
      />,
    );

    expect(screen.getByRole('button', { name: 'Upload Your Design & Get Price in Seconds' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse Cakes Collections' })).toHaveAttribute(
      'href',
      '/collections',
    );
  });
});