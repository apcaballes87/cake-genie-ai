// services/pricingService.database.ts
import { getSupabaseClient } from '@/lib/supabase/client';
import type { PricingRule, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, AddOnPricing, CakeType } from '@/types';
import { FEATURE_FLAGS } from '@/config/features';
import { validateAnalysis } from '@/lib/utils/validateAnalysis';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('PricingService');

const supabase = getSupabaseClient();

// Cache pricing rules in memory for 5 minutes
let pricingRulesCache: {
  rules: Map<string, PricingRule[]>;
  timestamp: number;
  key: string;
} | null = null;

const CACHE_KEY_PREFIX = 'pricing_rules_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getPricingRules(merchantId?: string): Promise<Map<string, PricingRule[]>> {
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
    .select('*')
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

  const rulesMap = new Map<string, PricingRule[]>();

  // Sort data so merchant-specific rules come first
  const sortedData = [...data].sort((a, b) => {
    if (a.merchant_id && !b.merchant_id) return -1; // Merchant rule first
    if (!a.merchant_id && b.merchant_id) return 1;  // Global rule last
    return 0;
  });

  sortedData.forEach(rule => {
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

  const rules = await getPricingRules(merchantId);

  const { mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo } = uiState;

  const breakdown: { item: string; price: number; }[] = [];
  const itemPrices = new Map<string, number>();

  let heroGumpasteTotal = 0;
  let supportGumpasteRawTotal = 0;
  let nonGumpasteTotal = 0;

  const getRule = (
    type: string,
    size?: string,
    category?: 'main_topper' | 'support_element' | 'message' | 'icing_feature' | 'special',
    subtype?: string
  ): PricingRule | undefined => {

    // Handle legacy type mapping for edible_2d_gumpaste
    let effectiveType = type;
    if (type === 'edible_2d_gumpaste') {
      if (category === 'main_topper') {
        effectiveType = 'edible_2d_shapes';
      } else {
        effectiveType = 'edible_2d_support';
      }
    }

    // Helper to find match in a list of rules
    const findMatch = (rulesList: PricingRule[]) => {
      if (!rulesList || rulesList.length === 0) return undefined;

      // If size is provided, try to find exact match
      if (size) {
        const match = rulesList.find(r =>
          (r.size && r.size.toLowerCase() === size.toLowerCase())
        );
        if (match) return match;
      }

      // Default to first rule if no size specified or no size match found
      return rulesList[0];
    };

    // 1. Try subtype-specific key first: type_subtype (e.g., chocolates_ferrero)
    if (subtype) {
      const subtypeKey = `${effectiveType}_${subtype}`;
      const subtypeRules = rules.get(subtypeKey);
      if (subtypeRules && subtypeRules.length > 0) {
        return subtypeRules[0];
      }
    }

    // 2. Try specific key: type_size (e.g., chocolates_small)
    if (size) {
      const specificKey = `${effectiveType}_${size}`;
      const specificRules = rules.get(specificKey);
      if (specificRules && specificRules.length > 0) {
        return specificRules[0];
      }
    }

    // 3. Try generic key: type (e.g., chocolates)
    const genericRules = rules.get(effectiveType);
    const rule = findMatch(genericRules || []);

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

      if (rule.quantity_rule === 'per_piece') {
        price *= topper.quantity;
      } else if (rule.quantity_rule === 'per_3_pieces') {
        price = Math.ceil(topper.quantity / 3) * rule.price;
      } else if (rule.quantity_rule === 'buy_3_get_1_free') {
        const qty = topper.quantity || 1;
        const freeItems = Math.floor(qty / 3);
        price = rule.price * qty - freeItems * rule.price;
      } else if (rule.quantity_rule === 'per_digit') {
        const digitCount = (topper.description.match(/\d/g) || []).length || 1;
        price = digitCount * rule.price;
      }

      if (rule.multiplier_rule === 'tier_count') {
        price *= extractTierCount(cakeInfo.type);
      }

      const conditions = rule.special_conditions;
      if (conditions) {
        if (conditions.bento_price && cakeInfo.type === 'Bento') price = conditions.bento_price;
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
    const effectiveSize = element.size || (element as any).coverage;
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

      if (rule.quantity_rule === 'per_piece') {
        price *= effectiveQty;
      } else if (rule.quantity_rule === 'per_3_pieces') {
        price = Math.ceil(effectiveQty / 3) * rule.price;
      } else if (rule.quantity_rule === 'buy_3_get_1_free') {
        const qty = effectiveQty || 1;
        const freeItems = Math.floor(qty / 3);
        price = rule.price * qty - freeItems * rule.price;
      } else if (rule.quantity_rule === 'per_digit') {
        const digitCount = (element.description.match(/\d/g) || []).length || 1;
        price = digitCount * rule.price;
      }

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