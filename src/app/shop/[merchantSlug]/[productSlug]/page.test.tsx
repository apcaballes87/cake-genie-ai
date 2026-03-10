import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductPage from './page';
import { getAnalysisByExactHash, getCakeBasePriceOptions, getMerchantBySlug, getMerchantProductBySlug } from '@/services/supabaseService';

vi.mock('next/navigation', () => ({ notFound: vi.fn() }));
vi.mock('@/app/customizing/CustomizingClient', () => ({ default: () => <div data-testid="customizing-client" /> }));
vi.mock('@/components/LoadingSkeletons', () => ({ CustomizingPageSkeleton: () => <div data-testid="page-skeleton" /> }));
vi.mock('@/components/SEOSchemas', () => ({ ProductSchema: () => null }));
vi.mock('@/contexts/CustomizationContext', () => ({
  CustomizationProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/utils/customizationMapper', () => ({
  mapAnalysisToState: vi.fn(() => ({ cakeInfo: { type: '1 Tier', thickness: '3 in' } })),
}));
vi.mock('@/services/supabaseService', () => ({
  getMerchantBySlug: vi.fn(),
  getMerchantProductBySlug: vi.fn(),
  getCakeBasePriceOptions: vi.fn(),
  getAnalysisByExactHash: vi.fn(),
}));

describe('ProductPage', () => {
  beforeEach(() => {
    vi.mocked(getMerchantBySlug).mockResolvedValue({
      data: { business_name: 'Sweet Delights', city: 'Cebu' },
      error: null,
    } as never);
    vi.mocked(getMerchantProductBySlug).mockResolvedValue({
      data: {
        product_id: 'product-123',
        title: 'Anniversary Bento Cake',
        slug: 'anniversary-bento-cake',
        image_url: 'https://example.com/anniversary-bento-cake.webp',
        alt_text: 'Anniversary bento cake with ribbon details',
        custom_price: 1299,
        cake_type: '1 Tier',
        p_hash: '000038d7bfffffb8',
      },
      error: null,
    } as never);
    vi.mocked(getAnalysisByExactHash).mockResolvedValue({ cakeInfo: { type: '1 Tier', thickness: '3 in' } } as never);
    vi.mocked(getCakeBasePriceOptions).mockResolvedValue([{ price: 1299, size: '6 in' }] as never);
  });

  it('preloads the hero image before rendering the customizing client', async () => {
    const page = await ProductPage({ params: Promise.resolve({ merchantSlug: 'sweet-delights', productSlug: 'anniversary-bento-cake' }) });
    render(page);
    const staticMarkup = renderToStaticMarkup(page);

    expect(screen.getByTestId('customizing-client')).toBeInTheDocument();
    expect(staticMarkup).toContain('rel="preload"');
    expect(staticMarkup).toContain('href="https://example.com/anniversary-bento-cake.webp"');
  });
});