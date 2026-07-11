import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

describe('how to order page', () => {
  it('renders the server-side order flow and support facts', async () => {
    const { default: Page, metadata } = await import('./page');
    const markup = renderToStaticMarkup(<Page />);

    expect(metadata.alternates?.canonical).toBe('https://genie.ph/how-to-order');
    expect(markup).toContain('How to order a custom cake on Genie.ph');
    expect(markup).toContain('The 3-step flow');
    expect(markup).toContain('What affects price');
    expect(markup).toContain('Bento cakes on Genie.ph start at ₱499.');
    expect(markup).toContain('Delivery and pickup');
    expect(markup).toContain('/cake-price-calculator');
    expect(markup).toContain('href="/?upload=1"');
    expect(markup).not.toContain('₱700–₱1,200');
    expect(markup).not.toContain('same-day delivery');
  });
});
