import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

describe('payment options page', () => {
  it('renders accepted methods and canonical checkout guidance server-side', async () => {
    const { default: Page, metadata } = await import('./page');
    const markup = renderToStaticMarkup(<Page />);

    expect(metadata.alternates?.canonical).toBe('https://genie.ph/payment-options');
    expect(metadata.description).toContain('GCash, Maya, ShopeePay');
    expect(markup).toContain('Payment options on Genie.ph');
    expect(markup).toContain('Secure payments via Xendit');
    expect(markup).toContain('No cash on delivery');
    expect(markup).toContain('Palawan');
    expect(markup).toContain('/cake-price-calculator');
    expect(markup).toContain('/customizing#upload');
  });
});
