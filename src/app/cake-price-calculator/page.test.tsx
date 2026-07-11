import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

describe('cake pricing guide page', () => {
  it('renders canonical pricing facts instead of the duplicate uploader flow', async () => {
    const { default: Page, metadata } = await import('./page');
    const markup = renderToStaticMarkup(<Page />);

    expect(metadata.alternates?.canonical).toBe('https://genie.ph/cake-price-calculator');
    expect(metadata.openGraph).toMatchObject({
      title: 'Cake Pricing and Ordering Guide | Genie.ph',
      url: 'https://genie.ph/cake-price-calculator',
    });
    expect(markup).toContain('Official Genie.ph pricing and ordering facts');
    expect(markup).toContain('The real AI upload flow starts on Genie.ph');
    expect(markup).toContain('Bento cakes on Genie.ph start at ₱499.');
    expect(markup).toContain('GCash, Maya, ShopeePay, Visa, Mastercard, BPI, BDO, and Palawan');
    expect(markup).toContain('href="/?upload=1"');
    expect(markup).not.toContain('Available for delivery in Cebu City and Cavite');
    expect(markup).not.toContain('SoftwareApplication');
  });
});
