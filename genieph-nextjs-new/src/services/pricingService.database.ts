// services/pricingService.database.ts
import { getSupabaseClient } from '@/lib/supabase/client';
import type { PricingRule, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, AddOnPricing, CakeType } from '@/types';

const supabase = getSupabaseClient();

// Cache pricing rules in memory for 5 minutes
let pricingRulesCache: {
  rules: Map<string, PricingRule[]>;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getPricingRules(): Promise<Map<string, PricingRule[]>> {
  const now = Date.now();

  if (pricingRulesCache && (now - pricingRulesCache.timestamp < CACHE_DURATION)) {
    return pricingRulesCache.rules;
  }

  const { data, error } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Failed to fetch pricing rules:', error);
    if (pricingRulesCache) return pricingRulesCache.rules; // Fallback to stale cache on error
    throw error;
  }

  const rulesMap = new Map<string, PricingRule[]>();
  data.forEach(rule => {
    const existing = rulesMap.get(rule.item_key) || [];
    existing.push(rule);
    rulesMap.set(rule.item_key, existing);
  });

  pricingRulesCache = {
    rules: rulesMap,
    timestamp: now
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
  }
): Promise<{ addOnPricing: AddOnPricing; itemPrices: Map<string, number> }> {

  const rules = await getPricingRules();

  const { mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo } = uiState;

  const breakdown: { item: string; price: number; }[] = [];
  const itemPrices = new Map<string, number>();

  let heroGumpasteTotal = 0;
  let supportGumpasteRawTotal = 0;
  let nonGumpasteTotal = 0;

  const getRule = (
    type: string,
    size?: string,
    category?: 'main_topper' | 'support_element' | 'message' | 'icing_feature' | 'special'
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

    // 1. Try specific key: type_size
    if (size) {
      const specificKey = `${effectiveType}_${size}`;
      const specificRules = rules.get(specificKey);
      if (specificRules && specificRules.length > 0) {
        return specificRules[0];
      }
    }

    // 2. Try generic key: type
    const genericRules = rules.get(effectiveType);
    const rule = findMatch(genericRules || []);

    if (!rule) {
      console.warn(`No pricing rule found for: type="${type}" (mapped to "${effectiveType}"), size="${size}", category="${category}"`);
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
    const rule = getRule(topper.type, topper.size, 'main_topper');

    if (rule) {
      price = rule.price;

      if (rule.quantity_rule === 'per_piece') {
        price *= topper.quantity;
      } else if (rule.quantity_rule === 'per_3_pieces') {
        price = Math.ceil(topper.quantity / 3) * rule.price;
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
    const rule = getRule(element.type, effectiveSize, 'support_element');

    if (rule) {
      price = rule.price;

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
    if (message.isEnabled) {
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