import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/services/supabaseService', () => ({
  getRecommendedProducts: vi.fn().mockResolvedValue({ data: [], error: null }),
  getHomepageBlogPreviews: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock('@/app/LandingClient', () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="landing-client">{children}</div>,
}));

vi.mock('@/components/landing', async () => {
  const actual = await vi.importActual<typeof import('@/components/landing')>('@/components/landing');
  return {
    ...actual,
    RecommendedProductsSection: () => <div>Mother&apos;s Day Recommended Products</div>,
  };
});

vi.mock('@/components/NewsletterPopup', () => ({
  default: () => null,
}));

vi.mock('@/components/landing/LandingFooter', () => ({
  LandingFooter: () => <div>Footer</div>,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockRejectedValue(new Error('No database in unit test')),
}));

describe("mother's day landing page", () => {
  it('renders mother-focused schema and copy', async () => {
    const { default: MothersDayPage, metadata } = await import('./page');
    const markup = renderToStaticMarkup(await MothersDayPage());

    expect(metadata.alternates?.canonical).toBe('https://genie.ph/mothersday');
    expect(markup).toContain('CollectionPage');
    expect(markup).toContain('May 10, 2026');
    expect(markup).toContain('Looking for the best Mother');
  });
});
