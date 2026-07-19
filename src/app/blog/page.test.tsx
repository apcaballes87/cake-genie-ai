import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BlogPage from './page';
import { getAllBlogs } from '@/services/supabaseService';

vi.mock('@/services/supabaseService', () => ({
  getAllBlogs: vi.fn(),
}));

vi.mock('@/components/SEOSchemas', () => ({
  BlogSchema: () => null,
}));

vi.mock('@/components/landing/LandingHeader', () => ({
  default: () => <header data-testid="landing-header" />,
}));

vi.mock('@/components/landing/LandingFooter', () => ({
  LandingFooter: () => <footer data-testid="landing-footer" />,
}));

vi.mock('@/components/LazyImage', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img data-component="lazy-image" alt={alt} src={src} />
  ),
}));

describe('BlogPage', () => {
  it('renders blog thumbnails with the shared LazyImage component', async () => {
    vi.mocked(getAllBlogs).mockResolvedValue({
      data: [
        {
          slug: 'sample-post',
          title: 'Sample Post',
          excerpt: 'A short excerpt',
          author: 'Genie',
          author_url: null,
          date: '2026-03-01',
          image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/blogs/sample.webp',
        },
      ],
      error: null,
    });

    render(await BlogPage());

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
