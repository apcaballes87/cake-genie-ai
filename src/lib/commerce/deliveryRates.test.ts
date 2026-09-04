import { describe, expect, it } from 'vitest';

import {
  DELIVERY_FEES_BY_CITY,
  DELIVERY_FEES_BY_CITY_CAKES_AND_MEMORIES,
  getDeliveryFeeByCity,
  getDeliveryFeeByCityForCatalog,
  getDeliveryRateCards,
  getDeliveryRateSummary,
} from './deliveryRates';

describe('delivery rates', () => {
  it('resolves city aliases to the checkout-backed fee table', () => {
    expect(getDeliveryFeeByCity('Cebu City')).toBe(DELIVERY_FEES_BY_CITY['Cebu City']);
    expect(getDeliveryFeeByCity('Lapu-lapu City')).toBe(DELIVERY_FEES_BY_CITY['Lapu-lapu City']);
    expect(getDeliveryFeeByCity('Mandaue')).toBe(DELIVERY_FEES_BY_CITY.Mandaue);
  });

  it('summarizes the visible delivery-rate cards from the current fee table', () => {
    expect(getDeliveryRateCards()).toEqual([
      { city: 'Cebu City', rate: 0 },
      { city: 'Mandaue City', rate: 50 },
      { city: 'Lapu-Lapu City', rate: 100 },
      { city: 'Talisay City', rate: 150 },
      { city: 'Consolacion', rate: 200 },
      { city: 'Cordova', rate: 200 },
      { city: 'Liloan', rate: 300 },
    ]);

    expect(getDeliveryRateSummary()).toEqual({
      minFee: 0,
      maxFee: 300,
      lowestRateCity: 'Cebu City',
      highestRateCity: 'Liloan',
    });
  });
});

describe('getDeliveryFeeByCityForCatalog', () => {
  it('returns Genie rates for genie catalog', () => {
    expect(getDeliveryFeeByCityForCatalog('Cebu City', 'genie')).toBe(0);
    expect(getDeliveryFeeByCityForCatalog('Mandaue', 'genie')).toBe(50);
    expect(getDeliveryFeeByCityForCatalog('Liloan', 'genie')).toBe(300);
  });

  it('returns C&M rates for cakes_and_memories catalog', () => {
    expect(getDeliveryFeeByCityForCatalog('Cebu City', 'cakes_and_memories')).toBe(200);
    expect(getDeliveryFeeByCityForCatalog('Mandaue', 'cakes_and_memories')).toBe(250);
    expect(getDeliveryFeeByCityForCatalog('Lapu-Lapu', 'cakes_and_memories')).toBe(400);
    expect(getDeliveryFeeByCityForCatalog('Talisay', 'cakes_and_memories')).toBe(300);
    expect(getDeliveryFeeByCityForCatalog('Cordova', 'cakes_and_memories')).toBe(500);
    expect(getDeliveryFeeByCityForCatalog('Consolacion', 'cakes_and_memories')).toBe(500);
    expect(getDeliveryFeeByCityForCatalog('Liloan', 'cakes_and_memories')).toBe(600);
  });

  it('defaults to genie catalog when catalog is omitted', () => {
    expect(getDeliveryFeeByCityForCatalog('Cebu City')).toBe(0);
    expect(getDeliveryFeeByCityForCatalog('Liloan')).toBe(300);
  });

  it('returns 0 for unknown cities in both catalogs', () => {
    expect(getDeliveryFeeByCityForCatalog('Manila', 'genie')).toBe(0);
    expect(getDeliveryFeeByCityForCatalog('Manila', 'cakes_and_memories')).toBe(0);
  });

  it('handles null/undefined city gracefully', () => {
    expect(getDeliveryFeeByCityForCatalog(null, 'genie')).toBe(0);
    expect(getDeliveryFeeByCityForCatalog(undefined, 'cakes_and_memories')).toBe(0);
  });
});
