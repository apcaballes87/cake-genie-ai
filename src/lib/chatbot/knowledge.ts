import type { SupabaseClient } from '@supabase/supabase-js';

import { DELIVERY_FEES_BY_CITY } from '@/lib/commerce/deliveryRates';
import { CANONICAL_CAKE_TYPES } from '@/lib/utils/cakeType';
import { roundDownToNearest99 } from '@/lib/utils/pricing';
import { genieBusinessProfile } from '@/lib/seo/genieBusinessProfile';
import { calculatePriceFromDatabase } from '@/services/pricingService.database';
import type {
  CakeInfoUI,
  CakeMessageUI,
  CakeThickness,
  CakeType,
  IcingDesignUI,
  MainTopperType,
  MainTopperUI,
  SupportElementType,
  SupportElementUI,
} from '@/types';

import type {
  ChatbotFact,
  ChatbotIntent,
  ChatbotLanguage,
  ChatPageContext,
  ChatPageSelection,
} from './types';

export type BusinessProfile = {
  version: number;
  name: string;
  addressLine: string;
  hoursDisplay: string;
  supportEmail: string;
  phoneDisplay: string;
  phoneHref: string;
  mapUrl: string;
  serviceArea: string;
};

const CAKE_THICKNESSES = new Set<CakeThickness>(['2 in', '3 in', '4 in', '5 in', '6 in']);
const CAKE_TYPES = new Set<string>(CANONICAL_CAKE_TYPES);

const FALLBACK_PROFILE: BusinessProfile = {
  version: 0,
  name: genieBusinessProfile.name,
  addressLine: genieBusinessProfile.addressLine,
  hoursDisplay: genieBusinessProfile.hoursDisplay,
  supportEmail: genieBusinessProfile.supportEmail,
  phoneDisplay: genieBusinessProfile.phoneDisplay,
  phoneHref: genieBusinessProfile.phoneHref,
  mapUrl: genieBusinessProfile.mapUrl,
  serviceArea: genieBusinessProfile.primaryServiceAreaLabel,
};

function peso(amount: number): string {
  return `₱${Math.round(amount).toLocaleString('en-PH')}`;
}

export async function loadBusinessProfile(database: SupabaseClient): Promise<BusinessProfile> {
  const { data, error } = await database
    .from('chatbot_business_profile_versions')
    .select('version, name, address_line, hours_display, support_email, phone_display, phone_href, map_url, service_area, valid_from, valid_until')
    .eq('status', 'published')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  if (error || !data
    || (data.valid_from && new Date(data.valid_from).getTime() > now)
    || (data.valid_until && new Date(data.valid_until).getTime() <= now)) return FALLBACK_PROFILE;
  return {
    version: typeof data.version === 'number' ? data.version : FALLBACK_PROFILE.version,
    name: data.name || FALLBACK_PROFILE.name,
    addressLine: data.address_line || FALLBACK_PROFILE.addressLine,
    hoursDisplay: data.hours_display || FALLBACK_PROFILE.hoursDisplay,
    supportEmail: data.support_email || FALLBACK_PROFILE.supportEmail,
    phoneDisplay: data.phone_display || FALLBACK_PROFILE.phoneDisplay,
    phoneHref: data.phone_href || FALLBACK_PROFILE.phoneHref,
    mapUrl: data.map_url || FALLBACK_PROFILE.mapUrl,
    serviceArea: data.service_area || FALLBACK_PROFILE.serviceArea,
  };
}

function buildPricingUiState(selection: ChatPageSelection): {
  mainToppers: MainTopperUI[];
  supportElements: SupportElementUI[];
  cakeMessages: CakeMessageUI[];
  icingDesign: IcingDesignUI;
  cakeInfo: CakeInfoUI;
} | null {
  if (!CAKE_TYPES.has(selection.cakeType) || !CAKE_THICKNESSES.has(selection.cakeThickness as CakeThickness)) {
    return null;
  }

  const mainToppers: MainTopperUI[] = [];
  const supportElements: SupportElementUI[] = [];
  const cakeMessages: CakeMessageUI[] = [];
  selection.enabledAddOns.forEach((addOn, index) => {
    const id = `chat-context-${index}`;
    if (addOn.kind === 'main_topper') {
      mainToppers.push({
        id,
        isEnabled: true,
        price: 0,
        type: addOn.type as MainTopperType,
        original_type: addOn.type as MainTopperType,
        description: addOn.description,
        size: (addOn.size || 'medium') as MainTopperUI['size'],
        quantity: addOn.quantity ?? 1,
        group_id: id,
        classification: 'hero',
        ...(addOn.subtype ? { subtype: addOn.subtype } : {}),
      });
    } else if (addOn.kind === 'support_element') {
      supportElements.push({
        id,
        isEnabled: true,
        price: 0,
        type: addOn.type as SupportElementType,
        original_type: addOn.type as SupportElementType,
        description: addOn.description,
        size: (addOn.size || 'medium') as SupportElementUI['size'],
        group_id: id,
        ...(addOn.subtype ? { subtype: addOn.subtype } : {}),
        ...(addOn.quantity !== null ? { quantity: addOn.quantity } : {}),
      });
    } else {
      cakeMessages.push({
        id,
        isEnabled: true,
        price: 0,
        type: addOn.type as CakeMessageUI['type'],
        text: addOn.text || '',
        position: 'top',
        color: '',
      });
    }
  });

  return {
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign: {
      base: selection.icingBase || (selection.cakeType.includes('Fondant') ? 'fondant' : 'soft_icing'),
      color_type: 'single',
      colors: { side: '' },
      border_top: false,
      border_base: false,
      drip: selection.icingFeatures.drip,
      gumpasteBaseBoard: selection.icingFeatures.gumpasteBaseBoard,
      dripPrice: 0,
      gumpasteBaseBoardPrice: 0,
    },
    cakeInfo: {
      type: selection.cakeType as CakeType,
      thickness: selection.cakeThickness as CakeThickness,
      size: selection.cakeSize,
      flavors: selection.flavors as CakeInfoUI['flavors'],
    },
  };
}

async function resolveConfiguredPrice(
  database: SupabaseClient,
  context: ChatPageContext,
): Promise<ChatbotFact | null> {
  if (!context.selection) return null;
  const pricingState = buildPricingUiState(context.selection);
  if (!pricingState) return null;

  const { data: basePriceRow, error: basePriceError } = await database
    .from('productsizes_cakegenie')
    .select('price')
    .eq('type', context.selection.cakeType)
    .eq('thickness', context.selection.cakeThickness)
    .eq('cakesize', context.selection.cakeSize)
    .order('price', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (basePriceError || typeof basePriceRow?.price !== 'number') return null;

  try {
    const { addOnPricing } = await calculatePriceFromDatabase(pricingState, undefined, database);
    const total = roundDownToNearest99(basePriceRow.price + addOnPricing.addOnPrice, basePriceRow.price);
    return {
      id: 'dynamic:configured-price',
      text: `The current configured cake price is ${peso(total)}. This excludes delivery fees and any later checkout adjustments.`,
    };
  } catch (error) {
    console.warn('[chatbot] Could not recompute configured price:', error);
    return null;
  }
}

async function resolveDesignStartingPrice(
  database: SupabaseClient,
  context: ChatPageContext,
): Promise<ChatbotFact | null> {
  if (context.designSlug) {
    const { data } = await database
      .from('cakegenie_analysis_cache')
      .select('price, seo_title')
      .eq('slug', context.designSlug)
      .maybeSingle();
    if (typeof data?.price === 'number') {
      return {
        id: `dynamic:design:${context.designSlug}`,
        text: `${data.seo_title || 'This cake design'} starts at ${peso(data.price)}. Delivery and later checkout adjustments are separate.`,
      };
    }
  }

  if (context.merchantProductId) {
    const { data } = await database
      .from('cakegenie_merchant_products')
      .select('title, custom_price')
      .eq('product_id', context.merchantProductId)
      .eq('is_active', true)
      .maybeSingle();
    if (typeof data?.custom_price === 'number') {
      return {
        id: `dynamic:product:${context.merchantProductId}`,
        text: `${data.title || 'This cake'} starts at ${peso(data.custom_price)}. Delivery and later checkout adjustments are separate.`,
      };
    }
  }
  return null;
}

async function resolveGeneralPriceRange(database: SupabaseClient): Promise<ChatbotFact | null> {
  const { data, error } = await database
    .from('productsizes_cakegenie')
    .select('price')
    .order('price', { ascending: true });
  const prices = (data ?? []).flatMap((row) => typeof row.price === 'number' ? [row.price] : []);
  if (error || prices.length === 0) return null;
  return {
    id: 'dynamic:general-price-range',
    text: `Current cake base prices range from ${peso(Math.min(...prices))} to ${peso(Math.max(...prices))}. Design add-ons and delivery are separate.`,
  };
}

function resolveDeliveryFact(message: string): ChatbotFact | null {
  const normalized = message.toLowerCase();
  const matches = Object.entries(DELIVERY_FEES_BY_CITY).filter(([city]) => {
    const boundary = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return boundary.test(normalized);
  });
  if (matches.length === 1) {
    const exactMatch = matches[0];
    return {
      id: `dynamic:delivery:${exactMatch[0].toLowerCase().replace(/\s+/g, '-')}`,
      text: `The current mapped delivery fee for ${exactMatch[0]} is ${peso(exactMatch[1])}. The exact destination is confirmed at checkout.`,
    };
  }
  return null;
}

async function loadPublishedKnowledge(
  database: SupabaseClient,
  intent: ChatbotIntent,
  language: ChatbotLanguage,
): Promise<ChatbotFact[]> {
  const categoryByIntent: Partial<Record<ChatbotIntent, string>> = {
    business_hours: 'business',
    address: 'business',
    contact: 'business',
    customizer_help: 'customizing',
    pricing: 'pricing',
    delivery: 'delivery',
    availability: 'availability',
  };
  const category = categoryByIntent[intent] || intent;
  const preferredLocale = language === 'en' ? 'en-PH' : `${language}-PH`;
  const { data, error } = await database
    .from('chatbot_knowledge_entries')
    .select('id, knowledge_key, version, answer, valid_from, valid_until')
    .eq('status', 'published')
    .eq('category', category)
    .in('locale', preferredLocale === 'en-PH' ? ['en-PH', 'en'] : [preferredLocale, language, 'en-PH', 'en'])
    .order('version', { ascending: false })
    .limit(8);
  if (error) return [];
  const now = Date.now();
  return (data ?? []).flatMap((row) => {
    const isNotStarted = row.valid_from && new Date(row.valid_from).getTime() > now;
    const isExpired = row.valid_until && new Date(row.valid_until).getTime() <= now;
    return typeof row.answer === 'string' && row.answer.trim() && !isNotStarted && !isExpired
      ? [{ id: `knowledge:${row.id}`, text: row.answer.trim().slice(0, 1_000) }]
      : [];
  });
}

export async function resolveChatbotFacts({
  database,
  intent,
  language,
  message,
  pageContext,
}: {
  database: SupabaseClient;
  intent: ChatbotIntent;
  language: ChatbotLanguage;
  message: string;
  pageContext: ChatPageContext;
}): Promise<{ facts: ChatbotFact[]; knowledgeVersion: string }> {
  const [profile, approvedKnowledge] = await Promise.all([
    loadBusinessProfile(database),
    loadPublishedKnowledge(database, intent, language),
  ]);
  const facts: ChatbotFact[] = [];

  if (intent === 'business_hours') {
    facts.push({ id: `business-profile:v${profile.version}`, text: `${profile.name} operating hours are ${profile.hoursDisplay}.` });
  } else if (intent === 'address') {
    facts.push({ id: `business-profile:v${profile.version}`, text: `${profile.name} is at ${profile.addressLine}. Google Maps: ${profile.mapUrl}` });
  } else if (intent === 'contact') {
    facts.push({ id: `business-profile:v${profile.version}`, text: `Contact ${profile.name} at ${profile.phoneDisplay} or ${profile.supportEmail}.` });
  } else if (intent === 'delivery') {
    const delivery = resolveDeliveryFact(message);
    if (delivery) facts.push(delivery);
  } else if (intent === 'customizer_help') {
    facts.push({
      id: 'product-flow:customizer-v1',
      text: 'On the customizing page, choose the cake type, size, thickness, flavors, icing, messages, and enabled decorations. The shown price updates from the current configuration. Review the details, then add the cake to the cart and complete delivery or pickup details at checkout.',
    });
  } else if (intent === 'availability') {
    facts.push({
      id: 'business-policy:availability-v1',
      text: 'Availability depends on the cake, merchant capacity, event date, and cutoff time. Exact rush dates or slots must be confirmed by staff.',
    });
  } else if (intent === 'pricing') {
    const configured = await resolveConfiguredPrice(database, pageContext);
    const design = configured ? null : await resolveDesignStartingPrice(database, pageContext);
    const general = configured || design ? null : await resolveGeneralPriceRange(database);
    if (configured) facts.push(configured);
    else if (design) facts.push(design);
    else if (general) facts.push(general);
  }

  facts.push(...approvedKnowledge);
  return {
    facts: facts.slice(0, 10),
    knowledgeVersion: `business:${profile.version};entries:${approvedKnowledge.map((fact) => fact.id).join(',') || 'none'}`,
  };
}
