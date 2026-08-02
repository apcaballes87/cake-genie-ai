import { describe, expect, it } from 'vitest';

import { sanitizeChatPageContext } from './pageContext';

describe('sanitizeChatPageContext', () => {
  it('keeps an allowlisted customizer selection and strips prices and sensitive URL data', () => {
    const result = sanitizeChatPageContext({
      url: 'https://genie.ph/customizing/pink-heart-cake?code=secret&utm_source=test#private',
      title: 'Private title',
      displayedPrice: 1,
      selection: {
        cakeType: '1 Tier',
        cakeSize: '6" Round',
        cakeThickness: '3 in',
        icingBase: 'soft_icing',
        flavors: ['Chocolate Cake'],
        icingFeatures: { drip: true, gumpasteBaseBoard: false },
        enabledAddOns: [{
          kind: 'main_topper', type: 'printout', description: 'Birthday printout', size: 'medium', quantity: 1,
        }],
      },
    });

    expect(result).toEqual({
      pageKind: 'customizer',
      pathname: '/customizing/pink-heart-cake',
      designSlug: 'pink-heart-cake',
      merchantProductId: null,
      selection: {
        cakeType: '1 Tier',
        cakeSize: '6" Round',
        cakeThickness: '3 in',
        icingBase: 'soft_icing',
        flavors: ['Chocolate Cake'],
        icingFeatures: { drip: true, gumpasteBaseBoard: false },
        enabledAddOns: [{
          kind: 'main_topper', type: 'printout', description: 'Birthday printout', size: 'medium', subtype: null, quantity: 1, text: null,
        }],
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('displayedPrice');
    expect(JSON.stringify(result)).not.toContain('Private title');
  });

  it('rejects arbitrary origins and does not accept selection data off the customizer', () => {
    expect(sanitizeChatPageContext({
      url: 'https://evil.example/customizing/forged',
      selection: { cakeType: '1 Tier', cakeSize: '6" Round', cakeThickness: '3 in' },
    })).toEqual({ pageKind: 'other', pathname: '/', designSlug: null, merchantProductId: null, selection: null });
  });

  it('keeps a merchant product identifier and underscore-based add-on types', () => {
    expect(sanitizeChatPageContext({
      pathname: '/shop/genie/sample-cake',
      merchantProductId: '8fb19d6e-c2cd-4a30-a1fc-153dbe918a11',
    })).toMatchObject({
      pageKind: 'merchant_product',
      merchantProductId: '8fb19d6e-c2cd-4a30-a1fc-153dbe918a11',
    });

    const customizer = sanitizeChatPageContext({
      pathname: '/customizing/sample-cake',
      selection: {
        cakeType: '1 Tier',
        cakeSize: '6" Round',
        cakeThickness: '3 in',
        enabledAddOns: [{
          kind: 'main_topper',
          type: 'edible_3d_complex',
          description: 'Character topper',
        }],
      },
    });
    expect(customizer.selection?.enabledAddOns[0]?.type).toBe('edible_3d_complex');
  });
});
