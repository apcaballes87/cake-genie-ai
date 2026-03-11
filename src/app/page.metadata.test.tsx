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

describe('home page SEO schema', () => {
  it('keeps website schema but no longer renders FAQPage schema', async () => {
    const { default: Home } = await import('./page');
    const markup = renderToStaticMarkup(await Home());

    expect(markup).toContain('https://schema.org');
    expect(markup).toContain('WebSite');
    expect(markup).not.toContain('FAQPage');
  });
});