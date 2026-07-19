/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BlogPostPage from './page';
import { getBlogBySlug, getRelatedProductsByKeywords } from '@/services/supabaseService';

vi.mock('@/services/supabaseService', () => ({
  getBlogBySlug: vi.fn(),
  getAllBlogSlugs: vi.fn(),
  getRelatedProductsByKeywords: vi.fn(),
}));

vi.mock('@/components/SEOSchemas', () => ({
  BlogPostingSchema: () => null,
  BlogBreadcrumbSchema: () => null,
}));

vi.mock('@/components/landing/LandingHeader', () => ({
  default: () => <header data-testid="landing-header" />,
}));

vi.mock('@/components/landing/LandingFooter', () => ({
  LandingFooter: () => <footer data-testid="landing-footer" />,
}));

vi.mock('./BlogContent', () => ({
  BlogContent: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock('@/components/blog/RelatedProductsSection', () => ({
  RelatedProductsSection: () => null,
}));

vi.mock('@/components/blog/BlogDesignShowcaseSection', () => ({
  BlogDesignShowcaseSection: () => null,
}));

vi.mock('@/components/LazyImage', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img data-component="lazy-image" alt={alt} src={src} />
  ),
}));

describe('BlogPostPage', () => {
  it('renders the featured image with the shared LazyImage component', async () => {
    vi.mocked(getBlogBySlug).mockResolvedValue({
      data: {
        slug: 'sample-post',
        title: 'Sample Post',
        excerpt: 'A short excerpt',
        author: 'Genie',
        author_url: null,
        date: '2026-03-01',
        updated_at: '2026-03-02',
        image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/blogs/sample.webp',
        content: 'Hello blog',
        keywords: null,
        cake_search_keywords: null,
        related_cakes_intro: null,
      },
      error: null,
    });
    vi.mocked(getRelatedProductsByKeywords).mockResolvedValue({ data: [], error: null });

    render(await BlogPostPage({ params: Promise.resolve({ slug: 'sample-post' }) }));

    const image = screen.getByAltText('Sample Post');
    expect(image).toHaveAttribute('data-component', 'lazy-image');
    expect(image).toHaveAttribute(
      'src',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/blogs/sample.webp',
    );
    expect(screen.getByTestId('landing-header')).toBeInTheDocument();
    expect(screen.getByTestId('landing-footer')).toBeInTheDocument();
  });
});
