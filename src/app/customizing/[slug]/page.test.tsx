import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecentSearchPage from './page';
import { createClient } from '@/lib/supabase/server';
import { getCakeBasePriceOptions, getRelatedProductsByKeywords } from '@/services/supabaseService';

vi.mock('next/navigation', () => ({ notFound: vi.fn(), permanentRedirect: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('next/image', () => ({ default: (props: Record<string, unknown>) => <img {...props} /> }));
vi.mock('../CustomizingClient', () => ({ default: () => <div data-testid="customizing-client" /> }));
vi.mock('@/components/LoadingSpinner', () => ({ LoadingSpinner: () => <div data-testid="loading-spinner" /> }));
vi.mock('@/components/DesignAboutSection', () => ({ DesignAboutSection: () => <div data-testid="design-about-section" /> }));
vi.mock('@/components/LazyImage', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img data-testid="lazy-image" alt={alt} src={src} />,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/services/supabaseService', () => ({
  getCakeBasePriceOptions: vi.fn(),
  getRelatedProductsByKeywords: vi.fn(),
}));
vi.mock('@/contexts/CustomizationContext', () => ({
  CustomizationProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('RecentSearchPage', () => {
  beforeEach(() => {
    const design = {
      slug: 'pink-minimalist-light-pink-bento-cake-f707',
      keywords: 'Pink Minimalist Bento Cake',
      seo_title: 'Pink Minimalist Bento Cake | Genie.ph',
      seo_description: 'Soft pink minimalist bento cake design.',
      alt_text: 'Pink minimalist bento cake with clean icing details',
      original_image_url: 'https://example.com/pink-bento-cake.webp',
      price: 1299,
      tags: ['pink', 'minimalist'],
      analysis_json: {
        cakeType: 'custom',
        icing_design: {},
        main_toppers: [],
        support_elements: [],
        cake_messages: [],
      },
    };

    vi.mocked(createClient).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: design }),
          }),
        }),
      }),
    } as never);
    vi.mocked(getCakeBasePriceOptions).mockResolvedValue([{ price: 1299, size: '6 in' }] as never);
    vi.mocked(getRelatedProductsByKeywords).mockResolvedValue({ data: [], error: null } as never);
  });

  it('keeps the SSR fallback hidden for JS sessions while rendering the client UI', async () => {
    const page = await RecentSearchPage({ params: Promise.resolve({ slug: 'pink-minimalist-light-pink-bento-cake-f707' }) });
    const { container } = render(page);
    const staticMarkup = renderToStaticMarkup(page);

    expect(screen.getByTestId('customizing-client')).toBeInTheDocument();

    const ssrFallback = container.querySelector('#ssr-content');
    expect(ssrFallback).toHaveStyle({ display: 'none' });

    expect(staticMarkup).toContain('<noscript>');
    expect(staticMarkup).toContain('#ssr-content { display: block !important; }');
    expect(staticMarkup).toContain('rel="preload"');
    expect(staticMarkup).toContain('href="https://example.com/pink-bento-cake.webp"');
  });
});