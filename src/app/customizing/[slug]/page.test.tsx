import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecentSearchPage from './page';
import { createClient } from '@/lib/supabase/server';
import { getCakeBasePriceOptions, getRelatedProductsByKeywords } from '@/services/supabaseService';

let capturedInitialData: unknown;

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
  CustomizationProvider: ({ children, initialData }: { children: ReactNode; initialData?: unknown }) => {
    capturedInitialData = initialData;
    return <>{children}</>;
  },
}));

describe('RecentSearchPage', () => {
  beforeEach(() => {
    capturedInitialData = undefined;
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

  it('renders a visible SSR image and preload link for image SEO alongside the hidden SSR fallback', async () => {
    const page = await RecentSearchPage({ params: Promise.resolve({ slug: 'pink-minimalist-light-pink-bento-cake-f707' }) });
    const { container } = render(page);
    const staticMarkup = renderToStaticMarkup(page);
    const topLevelChildren = Children.toArray((page as ReactElement<{ children?: ReactNode }>).props.children);

    const hasDirectPreloadLink = topLevelChildren.some(
      (child) => isValidElement<{ rel?: string }>(child) && child.type === 'link' && child.props.rel === 'preload',
    );

    expect(screen.getByTestId('customizing-client')).toBeInTheDocument();

    const ssrFallback = container.querySelector('#ssr-content');
    expect(ssrFallback).toBeInTheDocument();

    // SSR block stays visible in the HTML for crawlers; the client hides it after hydration.
    expect(staticMarkup).toContain('<noscript>');
    // Preload link added for LCP optimization (image SEO improvement)
    expect(hasDirectPreloadLink).toBe(true);
    // Visible SSR <img> tag for Googlebot + hidden SSR fallback both reference the image
    expect(staticMarkup).toContain('src="https://example.com/pink-bento-cake.webp"');
  });

  it('prefers the studio-edited image for the customizing hero when it is not blank', async () => {
    const design = {
      slug: 'studio-edited-cake',
      keywords: 'Studio Edited Cake',
      seo_title: 'Studio Edited Cake | Genie.ph',
      seo_description: 'Studio edited cake design.',
      alt_text: 'Studio edited cake',
      original_image_url: 'https://example.com/original-cake.webp',
      studio_edited_image_url: ' https://example.com/studio-edited-cake.webp ',
      price: 1299,
      tags: ['studio'],
      analysis_json: {
        cakeType: 'custom',
        icing_design: {},
        main_toppers: [],
        support_elements: [],
        cake_messages: [],
      },
    };

    vi.mocked(createClient).mockResolvedValueOnce({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: design }),
          }),
        }),
      }),
    } as never);

    const page = await RecentSearchPage({ params: Promise.resolve({ slug: 'studio-edited-cake' }) });
    const staticMarkup = renderToStaticMarkup(page);

    expect(staticMarkup).toContain('src="https://example.com/studio-edited-cake.webp"');
    expect(staticMarkup).toContain('href="https://example.com/studio-edited-cake.webp"');
    expect(staticMarkup).not.toContain('https://example.com/original-cake.webp');
  });

  it('still renders when SEO-side data fetches fail independently', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    vi.mocked(getCakeBasePriceOptions).mockRejectedValueOnce(new Error('pricing failed'));
    vi.mocked(getRelatedProductsByKeywords).mockRejectedValueOnce(new Error('related failed'));

    const page = await RecentSearchPage({ params: Promise.resolve({ slug: 'pink-minimalist-light-pink-bento-cake-f707' }) });
    render(page);

    expect(screen.getByTestId('customizing-client')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);

    consoleErrorSpy.mockRestore();
  });

  it('applies the toy-to-printout policy for analyzed slug pages', async () => {
    const toyDesign = {
      slug: 'paw-patrol-cake-1135-cake-design',
      keywords: 'Paw Patrol Cake',
      seo_title: 'Paw Patrol Cake | Genie.ph',
      seo_description: 'Paw Patrol cake design.',
      alt_text: 'Paw Patrol cake with toy toppers',
      original_image_url: 'https://example.com/paw-patrol-cake.webp',
      price: 2999,
      availability: 'normal',
      tags: ['paw patrol'],
      analysis_json: {
        cakeType: '1 Tier',
        cakeThickness: '4 in',
        icing_design: {},
        main_toppers: [
          {
            type: 'toy',
            description: 'paw patrol figure',
            x: 0.5,
            y: 0.2,
          },
        ],
        support_elements: [],
        cake_messages: [],
      },
    };

    vi.mocked(createClient).mockResolvedValueOnce({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: toyDesign }),
          }),
        }),
      }),
    } as never);

    const page = await RecentSearchPage({ params: Promise.resolve({ slug: toyDesign.slug }) });
    render(page);

    const initialData = capturedInitialData as { mainToppers?: Array<{ type: string; original_type: string }> };

    expect(initialData.mainToppers).toHaveLength(1);
    expect(initialData.mainToppers?.[0]).toMatchObject({
      type: 'printout',
      original_type: 'toy',
    });
  });
});
