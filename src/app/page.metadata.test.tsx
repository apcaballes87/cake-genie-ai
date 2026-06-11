import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/services/supabaseService', () => ({
  getRecommendedProducts: vi.fn().mockResolvedValue({ data: [], error: null }),
  getPopularDesigns: vi.fn().mockResolvedValue({ data: [], error: null }),
  getDesignCategories: vi.fn().mockResolvedValue({ data: [], error: null }),
  getHomepageBlogPreviews: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock('./LandingClient', () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="landing-client">{children}</div>,
}));

vi.mock('@/components/landing', () => ({
  RecommendedProductsSection: () => <div>Recommended Products</div>,
  IntroContent: () => <div>Intro Content</div>,
}));

vi.mock('@/components/NewsletterPopup', () => ({
  default: () => null,
}));

vi.mock('@/components/landing/LandingFooter', () => ({
  LandingFooter: () => <div>Footer</div>,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockRejectedValue(new Error('No database in unit test')),
}));

describe('home page SEO schema', () => {
  it('renders CollectionPage schema with FAQPage and without duplicate WebSite JSON-LD', async () => {
    const { default: Home } = await import('./page');
    const markup = renderToStaticMarkup(await Home());

    expect(markup).toContain('https://schema.org');
    expect(markup).toContain('CollectionPage');
    // The home page intentionally includes a FAQPage JSON-LD block (for
    // AI citability / GEO). The "no commercial FAQ" rule this test used
    // to enforce was retired when FAQPage was added for SEO.
    expect(markup).toContain('FAQPage');
    expect(markup).not.toContain('"@type":"WebSite"');
  });
});
