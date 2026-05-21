import { describe, expect, it } from 'vitest';

import {
  buildCommerceOrderSnapshot,
  buildCustomCakeAdditionalProperties,
  buildMerchantCenterCustomLabels,
  buildPriceSummary,
  deriveConstraintSnapshot,
  deriveDeliveryZone,
  getCommercePolicyUrls,
  mapDesignAvailabilityToSchema,
} from './machineReadable';

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
