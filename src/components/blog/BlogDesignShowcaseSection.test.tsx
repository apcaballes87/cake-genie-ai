import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlogDesignShowcaseSection } from './BlogDesignShowcaseSection';

describe('BlogDesignShowcaseSection', () => {
  it('renders SEO-friendly image attributes and links in server-compatible markup', () => {
    render(
      <BlogDesignShowcaseSection
        title="Minimalist Cake Ideas"
        intro="Browse real minimalist cake inspiration."
        keyword="minimalist cake"
        products={[
          {
            p_hash: '1',
            original_image_url:
              'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/sample/cake-1.webp',
            slug: 'minimalist-cake-1',
            alt_text: 'Pink minimalist birthday cake with pearl accents',
            image_width: 1200,
            image_height: 1500,
          },
          {
            p_hash: '2',
            original_image_url: 'https://example.com/cake-2.webp',
            keywords: 'floral cake, elegant cake',
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Minimalist Cake Ideas' })).toBeInTheDocument();
    expect(screen.getByText('Browse real minimalist cake inspiration.')).toBeInTheDocument();

    const linkedImage = screen.getByAltText('Pink minimalist birthday cake with pearl accents');
    expect(linkedImage).toHaveAttribute('title', 'Pink minimalist birthday cake with pearl accents');
    expect(linkedImage.getAttribute('src')).toContain('/storage/v1/render/image/public/');

    const designLink = screen.getByRole('link', {
      name: 'Pink minimalist birthday cake with pearl accents',
    });
    expect(designLink).toHaveAttribute('href', '/customizing/minimalist-cake-1');

    const fallbackImage = screen.getByAltText('floral cake');
    expect(fallbackImage).toHaveAttribute('title', 'floral cake');

    expect(screen.getByRole('link', { name: 'View More Designs' })).toHaveAttribute(
      'href',
      '/search?q=minimalist%20cake',
    );
  });

  it('renders nothing when no showcase products are available', () => {
    const { container } = render(
      <BlogDesignShowcaseSection
        title="Minimalist Cake Ideas"
        keyword="minimalist cake"
        products={[]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});