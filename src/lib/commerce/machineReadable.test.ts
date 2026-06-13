import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import {
  alignPriceOptionsToStartingPrice,
  buildCommerceOrderSnapshot,
  buildCustomCakeAdditionalProperties,
  buildMerchantCenterCustomLabels,
  buildMerchantReturnPolicy,
  buildOfferShippingDetails,
  buildPriceSummary,
  CUSTOM_CAKE_LEAD_TIME,
  deriveConstraintSnapshot,
  deriveDeliveryZone,
  getMerchantListingActivePrice,
  getCommercePolicyUrls,
  mapDesignAvailabilityToSchema,
  PH_Country_Code,
  validateLeadTimeConstants,
} from './machineReadable';
import { DELIVERY_FEES_BY_CITY } from './deliveryRates';

describe('machine-readable commerce helpers', () => {
  it('builds price ranges from variant prices', () => {
    const summary = buildPriceSummary(
      [
        { size: '6" Round', price: 1099 },
        { size: '8" Round', price: 1499 },
      ],
      999,
    );

    expect(summary.lowPrice).toBe(1099);
    expect(summary.highPrice).toBe(1499);
    expect(summary.offerCount).toBe(2);
    expect(summary.singlePrice).toBeNull();
  });

  it('picks the lowest visible price as the merchant listing active price', () => {
    const activePrice = getMerchantListingActivePrice(
      [
        { size: '6" Round', price: 1299 },
        { size: '8" Round', price: 1599 },
      ],
      1099,
    );

    expect(activePrice).toBe(1299);
  });

  it('aligns a generic size ladder to a merchant-specific starting price', () => {
    const alignedPrices = alignPriceOptionsToStartingPrice(
      [
        { size: '6" Round', price: 1299 },
        { size: '8" Round', price: 1599 },
        { size: '10" Round', price: 1899 },
      ],
      1599,
    );

    expect(alignedPrices).toEqual([
      { size: '6" Round', price: 1599 },
      { size: '8" Round', price: 1899 },
      { size: '10" Round', price: 2199 },
    ]);
  });

  it('maps rush availability to an in-stock schema offer', () => {
    expect(mapDesignAvailabilityToSchema('rush')).toBe('https://schema.org/InStock');
    expect(mapDesignAvailabilityToSchema('normal')).toBe('https://schema.org/PreOrder');
  });

  it('derives stable commerce constraint snapshots', () => {
    const constraints = deriveConstraintSnapshot({
      availabilityClass: 'same-day',
      earliestFulfillmentDate: '2026-05-24',
      cutoffEligible: true,
      branchCompatible: true,
      deliveryZoneCompatible: true,
      blackoutDate: false,
    });

    expect(constraints.availabilityClass).toBe('same-day');
    expect(constraints.cutoffEligible).toBe(true);
    expect(constraints.leadTimeLabel).toContain('Same-day');
  });

  it('builds custom cake additional properties for schema', () => {
    const properties = buildCustomCakeAdditionalProperties({
      cakeType: '1 Tier',
      availability: 'rush',
      sizeLabel: '6" Round',
      merchantName: 'Genie.ph',
      selectedDesignSource: 'analysis_cache',
      uploadAssisted: true,
    });
    const propertyNames = properties
      .filter(Boolean)
      .map((property) => property?.name);

    expect(propertyNames).toContain('Cake Type');
    expect(propertyNames).toContain('Customization Mode');
  });

  it('builds merchant-center labels and delivery zones', () => {
    const labels = buildMerchantCenterCustomLabels({
      availability: 'made_to_order',
      merchantCity: 'Cebu City',
      cakeType: 'Bento',
      uploadAssisted: true,
      madeToOrder: true,
    });

    expect(labels.customLabel0).toBe('made_to_order');
    expect(labels.customLabel4).toBe('made-to-order');
    expect(deriveDeliveryZone('Cebu City')).toBe('metro-cebu');
  });

  it('fills policy urls when building an order snapshot', () => {
    const snapshot = buildCommerceOrderSnapshot({
      product: {
        productId: null,
        designSlug: 'pink-butterfly-cake-design',
        designPHash: 'hash',
        merchantId: null,
        canonicalUrl: 'https://genie.ph/customizing/pink-butterfly-cake-design',
        sourceSurface: 'customizing',
      },
      variant: {
        cakeType: '1 Tier',
        cakeThickness: '4 in',
        cakeSize: '6" Round',
        flavors: ['Chocolate Cake'],
      },
      customization: {
        mainToppers: [],
        supportElements: [],
        cakeMessages: [],
        icingDesign: {
          drip: false,
          gumpasteBaseBoard: false,
          colors: {},
        },
        specialInstructions: '',
        selectedDesignSource: 'analysis_cache',
        referenceImageUrl: null,
        uploadedReferenceImage: true,
      },
      fulfillment: {
        fulfillmentType: 'unspecified',
        pickupBranchId: null,
        deliveryCity: null,
        deliveryZone: null,
        eventDate: null,
        eventTimeSlot: null,
      },
      pricing: {
        currency: 'PHP',
        basePrice: 1099,
        addOnPrice: 300,
        rushFee: 0,
        finalPrice: 1399,
        pricingVersion: 'pricing_rules:v1',
      },
      constraints: {
        availabilityClass: 'rush',
        earliestFulfillmentDate: null,
        cutoffEligible: true,
        branchCompatible: null,
        deliveryZoneCompatible: null,
        blackoutDate: null,
      },
      policyUrls: getCommercePolicyUrls(),
    });

    expect(snapshot.policyUrls.returnPolicy).toBe('https://genie.ph/return-policy');
  });
});

describe('CUSTOM_CAKE_LEAD_TIME — R2.1–R2.3, R2.9', () => {
  it('initializes to {1, 3, 0, 1}', () => {
    expect(CUSTOM_CAKE_LEAD_TIME.handlingTimeMinDays).toBe(1);
    expect(CUSTOM_CAKE_LEAD_TIME.handlingTimeMaxDays).toBe(3);
    expect(CUSTOM_CAKE_LEAD_TIME.transitTimeMinDays).toBe(0);
    expect(CUSTOM_CAKE_LEAD_TIME.transitTimeMaxDays).toBe(1);
  });

  it('all four values are integers in [0, 30]', () => {
    const values = [
      CUSTOM_CAKE_LEAD_TIME.handlingTimeMinDays,
      CUSTOM_CAKE_LEAD_TIME.handlingTimeMaxDays,
      CUSTOM_CAKE_LEAD_TIME.transitTimeMinDays,
      CUSTOM_CAKE_LEAD_TIME.transitTimeMaxDays,
    ];
    for (const value of values) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(30);
    }
  });

  it('handlingTimeMin ≤ handlingTimeMax and transitTimeMin ≤ transitTimeMax', () => {
    expect(CUSTOM_CAKE_LEAD_TIME.handlingTimeMinDays).toBeLessThanOrEqual(
      CUSTOM_CAKE_LEAD_TIME.handlingTimeMaxDays,
    );
    expect(CUSTOM_CAKE_LEAD_TIME.transitTimeMinDays).toBeLessThanOrEqual(
      CUSTOM_CAKE_LEAD_TIME.transitTimeMaxDays,
    );
  });

  it('validateLeadTimeConstants throws RangeError naming the offending property when handlingTimeMinDays is negative', () => {
    expect(() =>
      validateLeadTimeConstants({
        handlingTimeMinDays: -1,
        handlingTimeMaxDays: 3,
        transitTimeMinDays: 0,
        transitTimeMaxDays: 1,
      } as typeof CUSTOM_CAKE_LEAD_TIME),
    ).toThrow(RangeError);
    expect(() =>
      validateLeadTimeConstants({
        handlingTimeMinDays: -1,
        handlingTimeMaxDays: 3,
        transitTimeMinDays: 0,
        transitTimeMaxDays: 1,
      } as typeof CUSTOM_CAKE_LEAD_TIME),
    ).toThrow(/handlingTimeMinDays/);
  });

  it('validateLeadTimeConstants throws when min > max', () => {
    expect(() =>
      validateLeadTimeConstants({
        handlingTimeMinDays: 5,
        handlingTimeMaxDays: 2,
        transitTimeMinDays: 0,
        transitTimeMaxDays: 1,
      } as typeof CUSTOM_CAKE_LEAD_TIME),
    ).toThrow(/handlingTimeMinDays/);
  });

  it('validateLeadTimeConstants throws when value > 30', () => {
    expect(() =>
      validateLeadTimeConstants({
        handlingTimeMinDays: 1,
        handlingTimeMaxDays: 31,
        transitTimeMinDays: 0,
        transitTimeMaxDays: 1,
      } as typeof CUSTOM_CAKE_LEAD_TIME),
    ).toThrow(/handlingTimeMaxDays/);
  });

  it('validateLeadTimeConstants throws when value is non-integer', () => {
    expect(() =>
      validateLeadTimeConstants({
        handlingTimeMinDays: 1.5,
        handlingTimeMaxDays: 3,
        transitTimeMinDays: 0,
        transitTimeMaxDays: 1,
      } as unknown as typeof CUSTOM_CAKE_LEAD_TIME),
    ).toThrow(/handlingTimeMinDays/);
  });
});

describe('PH_Country_Code — R3.1', () => {
  it('exports the literal "PH"', () => {
    expect(PH_Country_Code).toBe('PH');
    expect(typeof PH_Country_Code).toBe('string');
  });
});

describe('buildOfferShippingDetails — R2 deliveryTime', () => {
  it('returns ShippingDeliveryTime with handlingTime/transitTime', () => {
    const result = buildOfferShippingDetails() as any;
    expect(result).toHaveProperty('deliveryTime');
    expect(result.shippingRate).toEqual({
      '@type': 'MonetaryAmount',
      currency: 'PHP',
      maxValue: Math.max(...Object.values(DELIVERY_FEES_BY_CITY)),
    });
    expect(result.deliveryTime['@type']).toBe('ShippingDeliveryTime');
    expect(result.deliveryTime.handlingTime).toEqual({
      '@type': 'QuantitativeValue',
      unitCode: 'DAY',
      minValue: 1,
      maxValue: 3,
    });
    expect(result.deliveryTime.transitTime).toEqual({
      '@type': 'QuantitativeValue',
      unitCode: 'DAY',
      minValue: 0,
      maxValue: 1,
    });
  });

  it('preserves legacy shippingDestination.addressCountry and doesNotShip', () => {
    const result = buildOfferShippingDetails() as any;
    expect(result['@type']).toBe('OfferShippingDetails');
    expect(result.shippingDestination['@type']).toBe('DefinedRegion');
    expect(result.shippingDestination.addressCountry).toBe('PH');
    expect(result.doesNotShip).toBe(false);
    expect(result.shippingRate.currency).toBe('PHP');
  });

  it('preserves shape when called with explicit null merchant', () => {
    const result = buildOfferShippingDetails(null) as any;
    expect(result['@type']).toBe('OfferShippingDetails');
    expect(result.shippingDestination['@type']).toBe('DefinedRegion');
    expect(result.shippingDestination.addressCountry).toBe('PH');
    expect(result.doesNotShip).toBe(false);
    expect(result.shippingRate.maxValue).toBe(Math.max(...Object.values(DELIVERY_FEES_BY_CITY)));
    expect(result.deliveryTime['@type']).toBe('ShippingDeliveryTime');
    expect(result.deliveryTime.handlingTime.unitCode).toBe('DAY');
    expect(result.deliveryTime.transitTime.unitCode).toBe('DAY');
  });

  it('Property 2: OfferShippingDetails shape invariant', () => {
    // Feature: customizing-pdp-seo-fixes, Property 2: OfferShippingDetails shape invariant
    // Validates: Requirements 2.4, 2.5, 2.6, 2.7, 2.8
    fc.assert(
      fc.property(
        // any merchant arg, including null/undefined and partial CakeGenieMerchant
        fc.option(
          fc.record(
            {
              merchant_id: fc.string(),
              business_name: fc.string(),
              slug: fc.string(),
              city: fc.option(fc.string(), { nil: null }),
            },
            { requiredKeys: ['merchant_id', 'business_name', 'slug'] },
          ),
        ),
        (merchant) => {
          const r = buildOfferShippingDetails(merchant as any) as any;
          expect(r['@type']).toBe('OfferShippingDetails');
          expect(r.shippingDestination.addressCountry).toBe('PH');
          expect(r.doesNotShip).toBe(false);
          expect(r.shippingRate.currency).toBe('PHP');
          expect(r.shippingRate.maxValue).toBe(Math.max(...Object.values(DELIVERY_FEES_BY_CITY)));
          expect(r.deliveryTime['@type']).toBe('ShippingDeliveryTime');
          expect(r.deliveryTime.handlingTime.unitCode).toBe('DAY');
          expect(r.deliveryTime.transitTime.unitCode).toBe('DAY');
          expect(r.deliveryTime.handlingTime.minValue).toBeLessThanOrEqual(
            r.deliveryTime.handlingTime.maxValue,
          );
          expect(r.deliveryTime.transitTime.minValue).toBeLessThanOrEqual(
            r.deliveryTime.transitTime.maxValue,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('buildMerchantReturnPolicy — R3.2–R3.5', () => {
  it('sets applicableCountry === PH_Country_Code', () => {
    const result = buildMerchantReturnPolicy() as any;
    expect(result.applicableCountry).toBe('PH');
    expect(result.applicableCountry).toBe(PH_Country_Code);
  });

  it('uses the same reference for returnPolicyCountry and applicableCountry', () => {
    const result = buildMerchantReturnPolicy() as any;
    expect(Object.is(result.returnPolicyCountry, result.applicableCountry)).toBe(true);
    expect(result.returnPolicyCountry).toBe(PH_Country_Code);
    expect(result.applicableCountry).toBe(PH_Country_Code);
  });

  it('preserves all pre-existing fields with unchanged values', () => {
    const result = buildMerchantReturnPolicy() as any;
    expect(result['@type']).toBe('MerchantReturnPolicy');
    expect(result.returnPolicyCategory).toBe(
      'https://schema.org/MerchantReturnNotPermitted',
    );
    expect(result.merchantReturnDays).toBe(0);
    expect(result.returnFees).toBe(
      'https://schema.org/ReturnFeesCustomerResponsibility',
    );
    expect(result.url).toBe('https://genie.ph/return-policy');
  });

  it('returned object has exactly the expected key set (no new keys beyond applicableCountry, no removed keys)', () => {
    const result = buildMerchantReturnPolicy();
    expect(Object.keys(result).sort()).toEqual([
      '@type',
      'applicableCountry',
      'merchantReturnDays',
      'returnFees',
      'returnPolicyCategory',
      'returnPolicyCountry',
      'url',
    ]);
  });
});
