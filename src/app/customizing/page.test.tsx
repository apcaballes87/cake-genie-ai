import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('./CustomizingClient', () => ({
  default: () => <div data-testid="customizing-client" />,
}));

vi.mock('@/components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

vi.mock('@/components/landing/LandingFooter', () => ({
  LandingFooter: ({ children }: { children?: ReactNode }) => <div data-testid="landing-footer">{children}</div>,
}));

vi.mock('@/components/ProductCard', () => ({
  ProductCard: ({ keywords }: { keywords?: string | null }) => <div data-testid="product-card">{keywords || 'Custom Cake'}</div>,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        })),
      })),
    })),
  })),
}));

vi.mock('@/services/supabaseService', () => ({
  getPopularDesigns: vi.fn().mockResolvedValue({
    data: [
      {
        p_hash: 'hash-1',
        slug: 'birthday-cake-design',
        original_image_url: 'https://example.com/birthday.webp',
        alt_text: 'Birthday cake design',
        keywords: 'Birthday Cake',
        price: 1299,
      },
    ],
    error: null,
  }),
}));

describe('customizing page discovery links', () => {
  it('promotes collection hubs instead of legacy customizing category routes', async () => {
    const { default: CustomizingPage } = await import('./page');

    const page = await CustomizingPage({ searchParams: Promise.resolve({}) });
    render(page);
    const staticMarkup = renderToStaticMarkup(page);

    expect(screen.getByRole('link', { name: 'Birthday Cake Designs' })).toHaveAttribute('href', '/collections/birthday-cakes');
    expect(screen.getByRole('link', { name: 'Wedding Cake Designs' })).toHaveAttribute('href', '/collections/wedding-cake');
    expect(staticMarkup).toContain('https://genie.ph/collections/birthday-cakes');
    expect(staticMarkup).not.toContain('https://genie.ph/customizing/category/birthday-cakes');
  });

  it('preloads the current Shopify ref handoff image before hydration', async () => {
    const { default: CustomizingPage } = await import('./page');

    const page = await CustomizingPage({
      searchParams: Promise.resolve({
        ref: 'https://cdn.example.com/cake.webp',
        source: 'shopify',
      }),
    });
    const staticMarkup = renderToStaticMarkup(page);

    expect(staticMarkup).toContain('/api/proxy-image?url=https%3A%2F%2Fcdn.example.com%2Fcake.webp');
  });
});
