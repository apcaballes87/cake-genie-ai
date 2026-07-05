import { describe, expect, it } from 'vitest';
import type { AiChatHistoryEntry, CakeInfoUI, CakeMessageUI, IcingDesignUI, MainTopperUI, SupportElementUI } from '@/types';
import { buildCartCustomizationDetails } from './buildCartCustomizationDetails';

describe('buildCartCustomizationDetails', () => {
  it('includes structured AI chat history and the legacy prompt mirror in the cart payload', () => {
    const cakeInfo: CakeInfoUI = {
      type: '1 Tier',
      thickness: '4 in',
      size: '6" Round',
      flavors: ['Chocolate Cake'],
    };

    const mainToppers: MainTopperUI[] = [{
      id: 'topper-1',
      isEnabled: true,
      price: 120,
      type: 'printout',
      original_type: 'printout',
      description: 'Butterfly topper',
      size: 'medium',
      quantity: 1,
      group_id: 'group-1',
      classification: 'hero',
    }];

    const supportElements: SupportElementUI[] = [{
      id: 'support-1',
      isEnabled: true,
      price: 80,
      type: 'sprinkles',
      original_type: 'sprinkles',
      description: 'Gold sprinkles',
      size: 'small',
      group_id: 'group-2',
    }];

    const cakeMessages: CakeMessageUI[] = [{
      id: 'message-1',
      isEnabled: true,
      price: 50,
      type: 'icing_script',
      text: 'Happy Birthday',
      position: 'top',
      color: '#ffffff',
    }];

    const icingDesign: IcingDesignUI = {
      base: 'soft_icing',
      color_type: 'single',
      colors: { side: '#ff69b4' },
      border_top: false,
      border_base: false,
      drip: true,
      gumpasteBaseBoard: false,
      dripPrice: 100,
      gumpasteBaseBoardPrice: 0,
    };

    const aiChatHistory: AiChatHistoryEntry[] = [{
      prompt: 'make the side pink',
      referenceImageUrl: 'https://example.com/reference.webp',
      referenceImageName: 'reference.webp',
      createdAt: '2026-07-05T10:00:00.000Z',
    }];

    const result = buildCartCustomizationDetails({
      cakeInfo,
      mainToppers,
      supportElements,
      cakeMessages,
      icingDesign,
      additionalInstructions: 'Match the uploaded reference.',
      aiChatHistory,
      commerceSnapshot: {
        product: {
          productId: null,
          designSlug: 'pink-butterfly-cake',
          designPHash: null,
          merchantId: null,
          canonicalUrl: 'https://genie.ph/customizing/pink-butterfly-cake',
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
            base: 'soft_icing',
            drip: false,
            gumpasteBaseBoard: false,
            colors: {},
          },
          specialInstructions: '',
          selectedDesignSource: 'uploaded_image',
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
          basePrice: 999,
          addOnPrice: 200,
          rushFee: 0,
          finalPrice: 1199,
          pricingVersion: 'pricing_rules:v1',
        },
        constraints: {
          availabilityClass: 'normal',
          leadTimeLabel: '1 day',
          deliveryZoneCompatible: null,
          blackoutDate: null,
          minimumLeadTimeDays: 1,
        },
        policyUrls: {
          returnPolicy: '/return-policy',
          deliveryRates: '/delivery-rates',
          privacy: '/privacy',
          reviews: '/reviews',
        },
      },
    });

    expect(result.ai_chat_history).toEqual(aiChatHistory);
    expect(result.chat_history).toEqual(['make the side pink']);
    expect(result.additionalInstructions).toBe('Match the uploaded reference.');
  });
});
