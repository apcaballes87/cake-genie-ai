import { describe, expect, it } from 'vitest';

import { appendAvailabilitySentence, enrichStoredSeoDescription } from './analysisCopy';

describe('appendAvailabilitySentence', () => {
  it.each([
    ['rush', 'This design is available for rush orders with preparation within 60 minutes.'],
    ['same-day', 'This design is available for same-day orders with 3 to 4 hours of preparation.'],
    ['normal', 'This design requires at least one day of lead time.'],
  ] as const)('appends the %s availability sentence', (availability, expected) => {
    expect(appendAvailabilitySentence('A sky blue bento cake.', availability)).toBe(
      `A sky blue bento cake. ${expected}`,
    );
  });

  it('does not append the same availability sentence twice', () => {
    const description =
      'A sky blue bento cake. This design is available for rush orders with preparation within 60 minutes.';

    expect(appendAvailabilitySentence(description, 'rush')).toBe(description);
  });
});

describe('enrichStoredSeoDescription', () => {
  const analysisResult = {
    cakeType: 'Bento',
    cakeThickness: '3 in',
    main_toppers: [],
    support_elements: [
      {
        type: 'satin_ribbon',
        description: 'green satin ribbon bows and drapes',
        size: 'medium',
        group_id: 'ribbon',
        quantity: 1,
      },
      {
        type: 'icing_decorations',
        description: 'piped green heart accents',
        size: 'tiny',
        group_id: 'hearts',
        quantity: 10,
      },
    ],
    cake_messages: [],
    icing_design: {
      base: 'soft-icing',
      color_type: 'single',
      colors: { side: '#FFFFFF', top: '#FFFFFF' },
      border_top: true,
      border_base: false,
      drip: false,
      gumpasteBaseBoard: false,
    },
    keyword: 'Minimalist Bento',
  } as const;

  it('appends generated supporting detail when the raw description is too short', () => {
    const rawDescription =
      'This minimalist bento cake features smooth white soft icing and a clean, modern aesthetic.';
    const result = enrichStoredSeoDescription({
      analysisResult: analysisResult as never,
      availability: 'rush',
      keywords: 'Minimalist Bento',
      tags: ['minimalist', 'bento'],
      rawDescription,
    });

    expect(result).toContain('green satin ribbon bows and drapes');
    expect(result).toContain('piped green heart accents');
    expect(result).toContain('This design is available for rush orders with preparation within 60 minutes.');
    expect(result.split(/\s+/).filter(Boolean).length).toBeGreaterThan(
      rawDescription.split(/\s+/).filter(Boolean).length,
    );
  });

  it('normalizes availability so it appears only once', () => {
    const result = enrichStoredSeoDescription({
      analysisResult: analysisResult as never,
      availability: 'rush',
      keywords: 'Minimalist Bento',
      rawDescription: 'This minimalist bento cake features smooth white soft icing. This design is available for rush orders with preparation within 60 minutes.',
    });

    expect(
      result.match(/This design is available for rush orders with preparation within 60 minutes\./g)?.length,
    ).toBe(1);
  });
});
