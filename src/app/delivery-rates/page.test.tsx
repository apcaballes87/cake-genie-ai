import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

describe('delivery rates page', () => {
  it('renders checkout-backed fee summaries and metadata', async () => {
    const { default: DeliveryRatesPage, metadata } = await import('./page');
    const markup = renderToStaticMarkup(<DeliveryRatesPage />);

    expect(metadata.alternates?.canonical).toBe('https://genie.ph/delivery-rates');
    expect(metadata.description).toContain('free delivery in Cebu City');
    expect(metadata.description).toContain('₱300 for Liloan');
    expect(markup).toContain('7 cities');
    expect(markup).toContain('Free');
    expect(markup).toContain('Currently in Cebu City');
    expect(markup).toContain('Currently in Liloan');
    expect(markup).toContain('same delivery fee table used at checkout');
  });
});
