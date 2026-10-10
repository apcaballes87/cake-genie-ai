import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ComparisonPage, { generateMetadata } from './page';

describe('Cebu custom cake pricing comparison', () => {
  it('uses the current public starting price without claiming current 2025 market rates', async () => {
    const params = Promise.resolve({ slug: 'custom-cake-pricing-cebu' });
    const metadata = await generateMetadata({ params });
    const html = renderToStaticMarkup(await ComparisonPage({ params }));

    expect(metadata.title).toEqual({ absolute: 'Custom Cake Prices in Cebu: Starting Prices and Quote Guide | Genie.ph' });
    expect(html).toContain('₱499');
    expect(html).toContain('Priced after AI analysis');
    expect(html).not.toContain('2025');
    expect(html).not.toContain('₱350');
  });
});
