// services/pricingService.database.ts
import { getSupabaseClient } from '@/lib/supabase/client';
import type { PricingRule, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, AddOnPricing, CakeType } from '@/types';
import { FEATURE_FLAGS } from '@/config/features';
import { validateAnalysis } from '@/lib/utils/validateAnalysis';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('PricingService');

const supabase = getSupabaseClient();

const RECOGNIZED_QUANTITY_RULES = [
  'per_piece',
  'per_3_pieces',
  'per_digit',
  'buy_3_get_1_free',
  'fixed',
  'flat',
] as const;

type RecognizedQuantityRule = (typeof RECOGNIZED_QUANTITY_RULES)[number];
type PricingCategory = NonNullable<PricingRule['category']>;
type LoadedPricingRule = Omit<PricingRule, 'quantity_rule'> & {
  quantity_rule: RecognizedQuantityRule | null;
  merchant_id?: string | null;
};

const recognizedQuantityRules = new Set<string>(RECOGNIZED_QUANTITY_RULES);
const warnedLegacyEmptyQuantityRuleIds = new Set<number>();

// Cache pricing rules in memory for 5 minutes
let pricingRulesCache: {
  rules: Map<string, LoadedPricingRule[]>;
  timestamp: number;
  key: string;
} | null = null;

const CACHE_KEY_PREFIX = 'pricing_rules_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const ZERO_COST_SUPPORT_ELEMENT_TYPES = new Set(['icing_decorations']);

function normalizeLoadedRule(
  rule: PricingRule & { merchant_id?: string | null; quantity_rule: string | null }
): LoadedPricingRule {
  if (rule.quantity_rule === null) {
    return rule as LoadedPricingRule;
  }

  const normalizedQuantityRule = rule.quantity_rule.trim();
  if (normalizedQuantityRule.length === 0) {
    if (!warnedLegacyEmptyQuantityRuleIds.has(rule.rule_id)) {
      warnedLegacyEmptyQuantityRuleIds.add(rule.rule_id);
      logger.warn(
        `Treating empty quantity_rule as null for legacy pricing rule ${rule.rule_id} (${rule.item_key})`
      );
    }
    return {
      ...rule,
      quantity_rule: null,
    };
  }

  if (!recognizedQuantityRules.has(normalizedQuantityRule)) {
    const error = new Error(
      `Unknown quantity_rule "${rule.quantity_rule}" for pricing rule ${rule.rule_id} (${rule.item_key})`
    );
    logger.error(error.message);
    throw error;
  }

  return {
    ...rule,
    quantity_rule: normalizedQuantityRule as RecognizedQuantityRule,
  };
}

function applyQuantityRule(
  rule: LoadedPricingRule,
  quantity: number | undefined,
  description: string
): number {
  const unitPrice = rule.price;
  const effectiveQuantity = quantity ?? 1;

  switch (rule.quantity_rule) {
    case null:
    case 'fixed':
    case 'flat':
      return unitPrice;
    case 'per_piece':
      return unitPrice * effectiveQuantity;
    case 'per_3_pieces':
      return Math.ceil(effectiveQuantity / 3) * unitPrice;
    case 'buy_3_get_1_free': {
      const chargedQuantity = effectiveQuantity - Math.floor(effectiveQuantity / 3);
      return unitPrice * chargedQuantity;
    }
    case 'per_digit': {
      const digitCount = (description.match(/\d/g) || []).length || 1;
      return digitCount * unitPrice;
    }
    default: {
      const exhaustiveQuantityRule: never = rule.quantity_rule;
      throw new Error(`Unsupported quantity_rule "${exhaustiveQuantityRule}"`);
    }
  }
}

async function getPricingRules(merchantId?: string): Promise<Map<string, LoadedPricingRule[]>> {
  const now = Date.now();
  const cacheKey = merchantId ? `${CACHE_KEY_PREFIX}${merchantId}` : `${CACHE_KEY_PREFIX}global`;

  // Check memory cache
  if (pricingRulesCache &&
    pricingRulesCache.key === cacheKey &&
    (now - pricingRulesCache.timestamp < CACHE_DURATION)) {
    return pricingRulesCache.rules;
  }

  let query = supabase
    .from('pricing_rules')
    .select('rule_id, item_key, item_type, classification, size, description, price, category, quantity_rule, multiplier_rule, special_conditions, merchant_id, is_active, created_at, updated_at')
    .eq('is_active', true);

  if (merchantId) {
    // Fetch global rules AND merchant specific rules
    query = query.or(`merchant_id.is.null,merchant_id.eq.${merchantId}`);
  } else {
    // Fetch only global rules
    // UPDATE: Due to database migration where all rules were assigned a merchant_id,
    // we strictly relaxing this to fetch ALL rules if no merchant is specified,
    // to ensure we find the "default" (main store) rules.
    // query = query.is('merchant_id', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch pricing rules:', error);
    if (pricingRulesCache && pricingRulesCache.key === cacheKey) return pricingRulesCache.rules;
    throw error;
  }

  const rulesMap = new Map<string, LoadedPricingRule[]>();

  data.map(normalizeLoadedRule).forEach(rule => {
    const existing = rulesMap.get(rule.item_key) || [];
    existing.push(rule);
    rulesMap.set(rule.item_key, existing);
  });

  pricingRulesCache = {
    rules: rulesMap,
    timestamp: now,
    key: cacheKey
  };

  return rulesMap;
}

export async function calculatePriceFromDatabase(
  uiState: {
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    cakeMessages: CakeMessageUI[],
    icingDesign: IcingDesignUI,
    cakeInfo: CakeInfoUI,
  },
  merchantId?: string
): Promise<{ addOnPricing: AddOnPricing; itemPrices: Map<string, number> }> {

  // NEW: Validation layer (only runs when feature flag is enabled)
  // This catches type mismatches early with structured logging
  if (FEATURE_FLAGS.USE_NEW_PRICING_SYSTEM) {
    const validation = validateAnalysis({
      mainToppers: uiState.mainToppers,
      supportElements: uiState.supportElements,
      cakeMessages: uiState.cakeMessages,
    });

    if (!validation.isValid) {
      logger.warn('Pricing validation failed, proceeding with best effort', {
        errors: validation.errors.map(e => `${e.field}: ${e.value}`),
      });
    }
  }

  const { mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo } = uiState;

  // Bento Cupcake Set pricing: Use standard database pricing (Bento rules apply via special_conditions)
  const isBentoCupcakeSet = cakeInfo.type === 'Bento Cupcake Set';

  // Cupcakes pricing override (Option B: Flat Maximum)
  const isCupcakes = cakeInfo.type === 'Cupcake' || cakeInfo.type.toLowerCase().startsWith('cupcakes-');
  if (isCupcakes && !isBentoCupcakeSet) {
    const breakdown: { item: string; price: number; }[] = [];
    const itemPrices = new Map<string, number>();

    const getCupcakeItemPrice = (type: string): number => {
      if (type === 'edible_3d_complex') return 300;
      if (['edible_2d_complex', 'edible_photo_top', 'edible_photo_print', 'edible_photo_side'].includes(type)) return 200;
      if ([
        'edible_3d_ordinary',
        'edible_3d_support',
        'edible_2d_support',
        'gumpaste_bundle',
        'gumpaste_panel',
        'gumpaste_creations',
        'edible_flowers',
        'chocolates',
        'macarons',
        'meringue',
        'candy',
        'marshmallows',
        'premium_sprinkles',
        'dragees',
        'icing_decorations'
      ].includes(type)) return 100;
      return 0;
    };

    let maxPrice = 0;
    let maxPriceItemDescription = '';

    // Initialize all to 0
    mainToppers.forEach(t => itemPrices.set(t.id, 0));
    supportElements.forEach(e => itemPrices.set(e.id, 0));
    cakeMessages.forEach(m => itemPrices.set(m.id, 0));

    // Process main toppers
    mainToppers.forEach(topper => {
      if (!topper.isEnabled) return;
      const price = getCupcakeItemPrice(topper.type);
      itemPrices.set(topper.id, price);
      if (price > maxPrice) {
        maxPrice = price;
        maxPriceItemDescription = topper.description;
      }
    });

    // Process support elements
    supportElements.forEach(element => {
      if (!element.isEnabled) return;
      const price = getCupcakeItemPrice(element.type);
      itemPrices.set(element.id, price);
      if (price > maxPrice) {
        maxPrice = price;
        maxPriceItemDescription = element.description;
      }
    });

    const addOnPrice = maxPrice;

    if (addOnPrice > 0) {
      breakdown.push({
        item: `Cupcake Topper Design Add-on (${maxPriceItemDescription || 'Flat Rate'})`,
        price: addOnPrice,
      });
    }

    return {
      addOnPricing: { addOnPrice, breakdown },
      itemPrices,
    };
  }

  const rules = await getPricingRules(merchantId);

  const breakdown: { item: string; price: number; }[] = [];
  const itemPrices = new Map<string, number>();

  let heroGumpasteTotal = 0;
  let supportGumpasteRawTotal = 0;
  let nonGumpasteTotal = 0;

  const getRule = (
    type: string,
    size?: string,
    category?: PricingCategory,
    subtype?: string
  ): LoadedPricingRule | undefined => {

    // Handle legacy type mapping for analyzer/UI values that predate current rule keys.
    let effectiveType = type;
    if (type === 'edible_2d_gumpaste') {
      if (category === 'main_topper') {
        effectiveType = 'edible_2d_shapes';
      } else {
        effectiveType = 'edible_2d_support';
      }
    } else if (category === 'message' && type === 'icing_text') {
      effectiveType = 'icing_script';
    } else if (type === 'fresh_flowers') {
      effectiveType = 'edible_flowers';
    }

    const selectByMerchant = (candidates: LoadedPricingRule[]): LoadedPricingRule | undefined => {
      const deterministicCandidates = [...candidates].sort((a, b) => a.rule_id - b.rule_id);

      if (merchantId) {
        return deterministicCandidates.find(rule => rule.merchant_id === merchantId)
          ?? deterministicCandidates.find(rule => rule.merchant_id == null);
      }

      return deterministicCandidates.find(rule => rule.merchant_id == null)
        ?? deterministicCandidates.find(rule => rule.merchant_id != null);
    };

    const findMatch = (
      rulesList: LoadedPricingRule[],
      requestedSize?: string
    ): LoadedPricingRule | undefined => {
      if (!rulesList || rulesList.length === 0) return undefined;

      const normalizedSize = requestedSize?.trim().toLowerCase();
      const findWithinCategory = (
        requestedCategory: PricingCategory | null
      ): LoadedPricingRule | undefined => {
        const categoryMatches = rulesList.filter(rule => rule.category === requestedCategory);

        if (normalizedSize) {
          const exactSizeMatch = selectByMerchant(
            categoryMatches.filter(rule => rule.size?.trim().toLowerCase() === normalizedSize)
          );
          if (exactSizeMatch) return exactSizeMatch;

          const unsizedMatch = selectByMerchant(
            categoryMatches.filter(rule => rule.size == null)
          );
          if (unsizedMatch) return unsizedMatch;
        }

        return selectByMerchant(categoryMatches);
      };

      if (category) {
        return findWithinCategory(category) ?? findWithinCategory(null);
      }

      return findWithinCategory(null);
    };

    // 1. Try subtype-specific key first: type_subtype (e.g., chocolates_ferrero)
    if (subtype) {
      const subtypeKey = `${effectiveType}_${subtype}`;
      const subtypeRules = rules.get(subtypeKey);
      const subtypeRule = findMatch(subtypeRules || [], size);
      if (subtypeRule) return subtypeRule;
    }

    // 2. Try specific key: type_size (e.g., chocolates_small)
    if (size) {
      const specificKey = `${effectiveType}_${size}`;
      const specificRules = rules.get(specificKey);
      const specificRule = findMatch(specificRules || [], size);
      if (specificRule) return specificRule;
    }

    // 3. Try generic key: type (e.g., chocolates)
    const genericRules = rules.get(effectiveType);
    const rule = findMatch(genericRules || [], size);

    // Icing decorations are part of the analyzed cake image but currently carry no
    // add-on charge. Keep that intentional zero-price fallback quiet until a paid
    // pricing rule is introduced.
    if (!rule && category === 'support_element' && ZERO_COST_SUPPORT_ELEMENT_TYPES.has(effectiveType)) {
      return undefined;
    }

    if (!rule) {
      console.warn(`No pricing rule found for: type="${type}" (mapped to "${effectiveType}"), size="${size}", subtype="${subtype}", category="${category}"`);
    }

    return rule;
  };

  const allowanceRule = getRule('gumpaste_allowance', undefined, 'special');
  const GUMPASTE_ALLOWANCE = allowanceRule?.price || 100;

  const extractTierCount = (cakeType: CakeType): number => {
    if (cakeType.includes('3 Tier')) return 3;
    if (cakeType.includes('2 Tier')) return 2;
    return 1;
  };

  // Process Main Toppers
  mainToppers.forEach(topper => {
    if (!topper.isEnabled) {
      itemPrices.set(topper.id, 0);
      return;
    }

    let price = 0;
    const rule = getRule(topper.type, topper.size, 'main_topper', topper.subtype);

    if (rule) {
      price = rule.price;

      if (topper.type === 'edible_photo_top') {
        const sizeLabel = cakeInfo.size || '6" Round';
        if (sizeLabel.includes('4"') || sizeLabel.toLowerCase().includes('bento') || cakeInfo.type === 'Bento') {
          price = 0;
        } else if (sizeLabel.includes('6"')) {
          price = 100;
        } else {
          price = 200;
        }
      } else {
        price = applyQuantityRule(rule, topper.quantity, topper.description);
      }

      if (rule.multiplier_rule === 'tier_count') {
        price *= extractTierCount(cakeInfo.type);
      }

      const conditions = rule.special_conditions;
      if (conditions) {
        if (conditions.bento_price && (cakeInfo.type === 'Bento' || cakeInfo.type === 'Bento Cupcake Set')) price = conditions.bento_price;
      }

      if (rule.classification === 'hero') {
        heroGumpasteTotal += price;
      } else if (rule.classification === 'support') {
        supportGumpasteRawTotal += price;
      } else {
        nonGumpasteTotal += price;
      }
    }

    itemPrices.set(topper.id, price);
    if (price > 0) breakdown.push({ item: topper.description, price });
  });

  // Process Support Elements
  supportElements.forEach(element => {
    if (!element.isEnabled) {
      itemPrices.set(element.id, 0);
      return;
    }

    let price = 0;
    // Fallback to coverage if size is missing (backward compatibility)
    const effectiveSize = element.size || (element as SupportElementUI & { coverage?: string }).coverage;
    const rule = getRule(element.type, effectiveSize, 'support_element', element.subtype);

    if (rule) {
      price = rule.price;

      // Robust Quantity Handling for Support Elements (mirroring main topper logic)
      let effectiveQty = element.quantity || 0;

      // Fallback for missing quantity if it's a countable type
      if (effectiveQty === 0 && element.size) {
        const countableTypes = ['plastic_ball_regular', 'plastic_ball_disco', 'gumpaste_bundle'];
        if (countableTypes.includes(element.type)) {
          if (element.size === 'large') effectiveQty = 12;
          else if (element.size === 'medium') effectiveQty = 8;
          else if (element.size === 'small') effectiveQty = 4;
          else effectiveQty = 1;
        }
      }

      // Ensure at least 1 if rule is per-something
      if (rule.quantity_rule) {
        effectiveQty = Math.max(1, effectiveQty);
      }

      price = applyQuantityRule(rule, effectiveQty, element.description);

      if (rule.multiplier_rule === 'tier_count') {
        price *= extractTierCount(cakeInfo.type);
      }

      const conditions = rule.special_conditions;
      if (conditions?.allowance_eligible) {
        supportGumpasteRawTotal += price;
      } else {
        nonGumpasteTotal += price;
      }

    }

    itemPrices.set(element.id, price);
    if (price > 0) breakdown.push({ item: element.description, price });
  });

  // Process Messages
  cakeMessages.forEach(message => {
    let price = 0;
    if (message.isEnabled && message.text && message.text.trim().length > 0) {
      const rule = getRule(message.type, undefined, 'message');
      if (rule) {
        price = rule.price;
        const conditions = rule.special_conditions;
        if (conditions?.allowance_eligible) {
          supportGumpasteRawTotal += price;
        } else {
          nonGumpasteTotal += price;
        }
        breakdown.push({ item: `"${message.text}" (${message.type})`, price });
      }
    }
    itemPrices.set(message.id, price);
  });

  // Process Icing Features
  if (icingDesign.drip) {
    const rule = getRule('drip_per_tier', undefined, 'icing_feature');
    if (rule) {
      const dripPrice = rule.price * extractTierCount(cakeInfo.type);
      nonGumpasteTotal += dripPrice;
      breakdown.push({ item: `Drip Effect`, price: dripPrice });
      itemPrices.set('icing_drip', dripPrice);
    }
  } else {
    itemPrices.set('icing_drip', 0);
  }

  if (icingDesign.gumpasteBaseBoard) {
    const rule = getRule('gumpaste_base_board', undefined, 'icing_feature');
    if (rule) {
      const baseBoardPrice = rule.price;
      nonGumpasteTotal += baseBoardPrice;
      breakdown.push({ item: "Gumpaste Covered Base Board", price: baseBoardPrice });
      itemPrices.set('icing_gumpasteBaseBoard', baseBoardPrice);
    }
  } else {
    itemPrices.set('icing_gumpasteBaseBoard', 0);
  }

  // Apply gumpaste allowance
  const allowanceApplied = Math.min(GUMPASTE_ALLOWANCE, supportGumpasteRawTotal);
  const supportGumpasteCharge = Math.max(0, supportGumpasteRawTotal - GUMPASTE_ALLOWANCE);

  if (allowanceApplied > 0) {
    breakdown.push({ item: "Gumpaste Allowance", price: -allowanceApplied });
  }

  const addOnPrice = heroGumpasteTotal + supportGumpasteCharge + nonGumpasteTotal;

  return {
    addOnPricing: { addOnPrice, breakdown },
    itemPrices,
  };
}

export function clearPricingCache() {
  pricingRulesCache = null;
}
