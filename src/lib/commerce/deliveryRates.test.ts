import { describe, expect, it } from 'vitest';

import {
  DELIVERY_FEES_BY_CITY,
  getDeliveryFeeByCity,
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
