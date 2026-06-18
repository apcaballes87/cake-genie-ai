import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CustomizingAgentProtocol } from './CustomizingAgentProtocol';
import { CUSTOMIZER_AGENT_CAPABILITY_MAP, type CustomizerAgentModel } from '@/lib/commerce/customizerAgentModel';

const agentModel: CustomizerAgentModel = {
  version: '2026-06-19',
  routePattern: '/customizing/[slug]',
  design: {
    slug: 'pink-bento-cake',
    pHash: 'hash-123',
    canonicalUrl: 'https://genie.ph/customizing/pink-bento-cake',
    sourceSurface: 'customizing',
  },
  selection: {
    icingBase: 'soft_icing',
    cakeType: 'Bento',
    cakeSize: '4" Round',
    cakeThickness: '2 in',
    flavors: ['Chocolate Cake'],
    cakeMessageTexts: ['Happy birthday'],
    enabledMainToppers: 0,
    enabledSupportElements: 0,
    specialInstructions: '',
  },
  options: {
    icingBases: [{ value: 'soft_icing', label: 'Soft Icing', selected: true }],
    cakeTypes: [{ value: 'Bento', label: 'Bento', selected: true }],
    sizes: [{ value: '4" Round', label: '4" Round', selected: true, basePrice: 399 }],
    thicknesses: [{ value: '2 in', label: '2 in', selected: true }],
    flavorSlots: 1,
  },
  pricing: {
    currency: 'PHP',
    basePrice: 399,
    addOnPrice: 0,
    finalPrice: 399,
    displayedPrice: 399,
    ediblePhotoAddonPrice: 0,
    breakdown: [],
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
  status: {
    canAddToCart: true,
    canShare: true,
    isAnalyzing: false,
    isUpdatingDesign: false,
    activeError: null,
  },
  actions: {
    available: ['edit_options', 'add_to_cart', 'share'],
  },
};

describe('CustomizingAgentProtocol', () => {
  it('emits parseable JSON scripts for the live agent model and capability map', () => {
    const { container } = render(<CustomizingAgentProtocol model={agentModel} />);

    const modelScript = container.querySelector('#customizer-agent-model');
    const capabilityScript = container.querySelector('#customizer-capability-map');

    expect(modelScript).not.toBeNull();
    expect(capabilityScript).not.toBeNull();
    expect(JSON.parse(modelScript!.innerHTML)).toEqual(agentModel);
    expect(JSON.parse(capabilityScript!.innerHTML)).toEqual(CUSTOMIZER_AGENT_CAPABILITY_MAP);
  });
});
