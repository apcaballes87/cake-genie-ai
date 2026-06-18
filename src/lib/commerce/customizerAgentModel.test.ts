import { describe, expect, it } from 'vitest';
import { buildCustomizerAgentModel } from './customizerAgentModel';

describe('buildCustomizerAgentModel', () => {
  it('reuses the commerce snapshot and exposes the selected options for agents', () => {
    const model = buildCustomizerAgentModel({
      commerceSnapshot: {
        product: {
          productId: null,
          designSlug: 'pink-bento-cake',
          designPHash: 'hash-123',
          merchantId: null,
          canonicalUrl: 'https://genie.ph/customizing/pink-bento-cake',
          sourceSurface: 'customizing',
        },
        variant: {
          cakeType: 'Bento',
          cakeThickness: '2 in',
          cakeSize: '4" Round',
          flavors: ['Chocolate Cake'],
        },
        customization: {
          mainToppers: [],
          supportElements: [],
          cakeMessages: [],
          icingDesign: {
            base: 'soft_icing',
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
          basePrice: 399,
          addOnPrice: 0,
          rushFee: 0,
          finalPrice: 399,
          pricingVersion: 'pricing_rules:v1',
        },
        constraints: {
          availabilityClass: 'rush',
          earliestFulfillmentDate: null,
          cutoffEligible: true,
          branchCompatible: null,
          deliveryZoneCompatible: null,
          blackoutDate: null,
          leadTimeLabel: 'Ready in 60 minutes',
          minimumLeadTimeDays: 0,
        },
        policyUrls: {
          returnPolicy: 'https://genie.ph/return-policy',
          deliveryRates: 'https://genie.ph/delivery-rates',
          privacy: 'https://genie.ph/privacy',
          reviews: 'https://genie.ph/reviews',
        },
      },
      cakeInfo: {
        type: 'Bento',
        thickness: '2 in',
        size: '4" Round',
        flavors: ['Chocolate Cake'],
      },
      icingDesign: {
        base: 'soft_icing',
        color_type: 'single',
        colors: { side: '#ffffff' },
        border_top: false,
        border_base: false,
        drip: false,
        gumpasteBaseBoard: false,
        dripPrice: 0,
        gumpasteBaseBoardPrice: 0,
      },
      basePriceOptions: [{ size: '4" Round', price: 399 }],
      mainToppers: [],
      supportElements: [],
      cakeMessages: [],
      additionalInstructions: 'Keep it simple',
      addOnPriceBreakdown: [],
      ediblePhotoAddonPrice: 0,
      displayedPrice: 399,
      canAddToCart: true,
      canShare: false,
      isAnalyzing: false,
      isUpdatingDesign: false,
      activeError: null,
    });

    expect(model.design.slug).toBe('pink-bento-cake');
    expect(model.selection.cakeType).toBe('Bento');
    expect(model.pricing.displayedPrice).toBe(399);
    expect(model.constraints.minimumLeadTimeDays).toBe(0);
    expect(model.actions.available).toContain('add_to_cart');
    expect(model.options.sizes[0]).toMatchObject({
      value: '4" Round',
      basePrice: 399,
      selected: true,
    });
  });
});
