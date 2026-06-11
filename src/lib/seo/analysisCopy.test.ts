import { describe, expect, it } from 'vitest';

import { appendAvailabilitySentence } from './analysisCopy';

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
