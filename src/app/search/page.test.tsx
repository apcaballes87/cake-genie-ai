import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchProductsFTSCount = vi.fn();

vi.mock('@/services/supabaseService', () => ({
  searchProductsFTSCount,
}));

vi.mock('./SearchingClient', () => ({
  default: () => <div data-testid="searching-client" />,
}));

vi.mock('@/components/LoadingSkeletons', () => ({
  SearchPageSkeleton: () => <div data-testid="search-skeleton" />,
}));

describe('search page metadata', () => {
  beforeEach(() => {
    searchProductsFTSCount.mockReset();
  });

  it('generates correct metadata when query is provided', async () => {
    searchProductsFTSCount.mockResolvedValue(15);

    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ q: 'Spiderman' }),
    });

    expect(searchProductsFTSCount).toHaveBeenCalledWith('Spiderman');
    expect(metadata.title).toEqual({ absolute: '15 Cake designs for "Spiderman" | Genie.ph' });
    expect(metadata.description).toBe('Browse 15 custom cake designs matching "Spiderman". Order from local bakeries in Cebu.');
    expect(metadata.openGraph?.title).toBe('15 Cake designs for "Spiderman" | Genie.ph');
    expect(metadata.openGraph?.description).toBe('Browse 15 custom cake designs matching "Spiderman". Order from local bakeries in Cebu.');
    expect(metadata.twitter?.title).toBe('15 Cake designs for "Spiderman" | Genie.ph');
    expect(metadata.twitter?.description).toBe('Browse 15 custom cake designs matching "Spiderman". Order from local bakeries in Cebu.');
  });

  it('generates fallback metadata when query is empty', async () => {
    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ q: '' }),
    });

    expect(searchProductsFTSCount).not.toHaveBeenCalled();
    expect(metadata.title).toEqual({ absolute: 'Search Cake Designs | Genie.ph' });
    expect(metadata.description).toBe('Search for cake designs to customize. Find the perfect cake for any occasion.');
  });
});
