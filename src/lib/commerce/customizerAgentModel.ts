import {
  getCakeTypesForIcingBase,
  inferIcingBaseFromCakeType,
  THICKNESS_OPTIONS_MAP,
} from '@/constants';
import type {
  BasePriceInfo,
  CakeInfoUI,
  CakeMessageUI,
  CommerceOrderSnapshot,
  IcingDesignUI,
  MainTopperUI,
  SupportElementUI,
} from '@/types';

export interface CustomizerAgentOption {
  value: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
  basePrice?: number;
}

export interface CustomizerAgentModel {
  version: '2026-06-19';
  routePattern: '/customizing/[slug]';
  design: {
    slug: string | null;
    pHash: string | null;
    canonicalUrl: string | null;
    sourceSurface: CommerceOrderSnapshot['product']['sourceSurface'];
  };
  selection: {
    icingBase: IcingDesignUI['base'] | null;
    cakeType: string | null;
    cakeSize: string | null;
    cakeThickness: string | null;
    flavors: string[];
    cakeMessageTexts: string[];
    enabledMainToppers: number;
    enabledSupportElements: number;
    specialInstructions: string;
  };
  options: {
    icingBases: CustomizerAgentOption[];
    cakeTypes: CustomizerAgentOption[];
    sizes: CustomizerAgentOption[];
    thicknesses: CustomizerAgentOption[];
    flavorSlots: number;
  };
  pricing: {
    currency: 'PHP';
    basePrice: number;
    addOnPrice: number;
    finalPrice: number;
    displayedPrice: number | null;
    ediblePhotoAddonPrice: number;
    breakdown: { item: string; price: number }[];
  };
  constraints: CommerceOrderSnapshot['constraints'];
  policyUrls: CommerceOrderSnapshot['policyUrls'];
  status: {
    canAddToCart: boolean;
    canShare: boolean;
    isAnalyzing: boolean;
    isUpdatingDesign: boolean;
    activeError: string | null;
  };
  actions: {
    available: string[];
  };
}

export interface CustomizerAgentCapabilityMap {
  version: '2026-06-19';
  tools: Array<{
    name: 'configure_custom_cake';
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
  }>;
}

type BuildCustomizerAgentModelInput = {
  commerceSnapshot: CommerceOrderSnapshot;
  cakeInfo: CakeInfoUI | null;
  icingDesign: IcingDesignUI | null;
  basePriceOptions: BasePriceInfo[] | null;
  mainToppers: MainTopperUI[];
  supportElements: SupportElementUI[];
  cakeMessages: CakeMessageUI[];
  additionalInstructions: string;
  addOnPriceBreakdown: { item: string; price: number }[];
  ediblePhotoAddonPrice: number;
  displayedPrice: number | null;
  canAddToCart: boolean;
  canShare: boolean;
  isAnalyzing: boolean;
  isUpdatingDesign: boolean;
  activeError: string | null;
};

export const CUSTOMIZER_AGENT_CAPABILITY_MAP: CustomizerAgentCapabilityMap = {
  version: '2026-06-19',
  tools: [
    {
      name: 'configure_custom_cake',
      description:
        'Set or update the current custom cake configuration without scraping button styling.',
      inputSchema: {
        type: 'object',
        required: ['design_slug', 'cake_type', 'size', 'thickness', 'flavors', 'icing_base'],
        properties: {
          design_slug: { type: 'string' },
          cake_type: { type: 'string' },
          size: { type: 'string' },
          thickness: { type: 'string' },
          flavors: { type: 'array', items: { type: 'string' } },
          icing_base: { type: 'string', enum: ['soft_icing', 'fondant'] },
          message_text: { type: ['string', 'null'] },
          special_instructions: { type: ['string', 'null'] },
          decor_changes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['kind', 'action', 'target_id'],
              properties: {
                kind: {
                  type: 'string',
                  enum: ['topper', 'support', 'message', 'icing'],
                },
                action: {
                  type: 'string',
                  enum: ['enable', 'disable', 'replace', 'edit'],
                },
                target_id: { type: 'string' },
              },
            },
          },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          price: {
            type: 'object',
            properties: {
              base: { type: 'number' },
              addons: { type: 'number' },
              final: { type: 'number' },
              currency: { type: 'string', enum: ['PHP'] },
            },
          },
          constraints: {
            type: 'object',
            properties: {
              availability_class: { type: 'string' },
              lead_time_label: { type: ['string', 'null'] },
              minimum_lead_time_days: { type: ['number', 'null'] },
            },
          },
          next_actions: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  ],
};

export function buildCustomizerAgentModel({
  commerceSnapshot,
  cakeInfo,
  icingDesign,
  basePriceOptions,
  mainToppers,
  supportElements,
  cakeMessages,
  additionalInstructions,
  addOnPriceBreakdown,
  ediblePhotoAddonPrice,
  displayedPrice,
  canAddToCart,
  canShare,
  isAnalyzing,
  isUpdatingDesign,
  activeError,
}: BuildCustomizerAgentModelInput): CustomizerAgentModel {
  const resolvedIcingBase = cakeInfo
    ? icingDesign?.base ?? inferIcingBaseFromCakeType(cakeInfo.type)
    : null;

  const enabledMainToppers = mainToppers.filter((item) => item.isEnabled).length;
  const enabledSupportElements = supportElements.filter((item) => item.isEnabled).length;
  const enabledMessages = cakeMessages.filter((item) => item.isEnabled);

  const actions = ['edit_options', 'edit_flavors', 'edit_icing', 'edit_messages'];
  if (canAddToCart) actions.push('add_to_cart');
  if (canShare) actions.push('share');

  return {
    version: '2026-06-19',
    routePattern: '/customizing/[slug]',
    design: {
      slug: commerceSnapshot.product.designSlug,
      pHash: commerceSnapshot.product.designPHash,
      canonicalUrl: commerceSnapshot.product.canonicalUrl,
      sourceSurface: commerceSnapshot.product.sourceSurface,
    },
    selection: {
      icingBase: resolvedIcingBase,
      cakeType: cakeInfo?.type ?? null,
      cakeSize: cakeInfo?.size ?? null,
      cakeThickness: cakeInfo?.thickness ?? null,
      flavors: cakeInfo?.flavors ?? [],
      cakeMessageTexts: enabledMessages.map((message) => message.text),
      enabledMainToppers,
      enabledSupportElements,
      specialInstructions: additionalInstructions.trim(),
    },
    options: {
      icingBases: [
        {
          value: 'soft_icing',
          label: 'Soft Icing',
          selected: resolvedIcingBase === 'soft_icing',
        },
        {
          value: 'fondant',
          label: 'Fondant',
          selected: resolvedIcingBase === 'fondant',
        },
      ],
      cakeTypes: resolvedIcingBase
        ? getCakeTypesForIcingBase(resolvedIcingBase).map((cakeType) => ({
            value: cakeType,
            label: cakeType,
            selected: cakeInfo?.type === cakeType,
          }))
        : [],
      sizes: (basePriceOptions ?? []).map((option) => ({
        value: option.size,
        label: option.size,
        selected: cakeInfo?.size === option.size,
        basePrice: option.price,
      })),
      thicknesses: cakeInfo
        ? (THICKNESS_OPTIONS_MAP[cakeInfo.type] ?? []).map((thickness) => ({
            value: thickness,
            label: thickness,
            selected: cakeInfo.thickness === thickness,
          }))
        : [],
      flavorSlots: cakeInfo?.flavors.length ?? 0,
    },
    pricing: {
      currency: 'PHP',
      basePrice: commerceSnapshot.pricing.basePrice,
      addOnPrice: commerceSnapshot.pricing.addOnPrice,
      finalPrice: commerceSnapshot.pricing.finalPrice,
      displayedPrice,
      ediblePhotoAddonPrice,
      breakdown: addOnPriceBreakdown,
    },
    constraints: commerceSnapshot.constraints,
    policyUrls: commerceSnapshot.policyUrls,
    status: {
      canAddToCart,
      canShare,
      isAnalyzing,
      isUpdatingDesign,
      activeError,
    },
    actions: {
      available: actions,
    },
  };
}

export function serializeAgentJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
