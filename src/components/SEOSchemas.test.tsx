import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProductSchema } from './SEOSchemas';

describe('ProductSchema', () => {
  it('emits a Merchant Center-compatible Offer with an active price', () => {
    const markup = renderToStaticMarkup(
      <ProductSchema
        product={{
          title: 'Anniversary Bento Cake',
          slug: 'anniversary-bento-cake',
          image_url: 'https://example.com/anniversary-bento-cake.webp',
          alt_text: 'Anniversary bento cake with ribbon details',
          custom_price: 1599,
          availability: 'in_stock',
          cake_type: '1 Tier',
          category: 'Birthday Cake',
          brand: 'Sweet Delights',
          p_hash: null,
        } as never}
        merchant={{
          business_name: 'Sweet Delights',
          slug: 'sweet-delights',
          city: 'Cebu City',
        } as never}
        prices={[
          { size: '6" Round', price: 1599 },
          { size: '8" Round', price: 1899 },
        ]}
      />,
    );

    expect(markup).toContain('"@type":"Offer"');
    expect(markup).toContain('"price":1599');
    expect(markup).toContain('"priceCurrency":"PHP"');
    expect(markup).toContain('"priceSpecification":{"@type":"UnitPriceSpecification","price":1599,"priceCurrency":"PHP"}');
    expect(markup).toContain('"shippingRate":{"@type":"MonetaryAmount","currency":"PHP"');
    expect(markup).not.toContain('AggregateOffer');
  });
});
