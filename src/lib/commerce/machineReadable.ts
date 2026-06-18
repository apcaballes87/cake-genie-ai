import type { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';
import type {
  BasePriceInfo,
  CommerceConstraintsSnapshot,
  CommerceOrderSnapshot,
  CommercePolicyUrls,
} from '@/types';
import { getDeliveryRateSummary } from './deliveryRates';

const DEFAULT_POLICY_URLS: CommercePolicyUrls = {
  returnPolicy: 'https://genie.ph/return-policy',
  deliveryRates: 'https://genie.ph/delivery-rates',
  privacy: 'https://genie.ph/privacy',
  reviews: 'https://genie.ph/reviews',
};

const METRO_CEBU_DELIVERY_CITIES = new Set([
  'Cebu City',
  'Mandaue City',
  'Lapu-Lapu City',
  'Talisay City',
  'Consolacion',
  'Cordova',
  'Liloan',
]);

export const PH_Country_Code: 'PH' = 'PH';

export const CUSTOM_CAKE_LEAD_TIME = {
  handlingTimeMinDays: 1,
  handlingTimeMaxDays: 3,
  transitTimeMinDays: 0,
  transitTimeMaxDays: 1,
} as const;

/**
 * Validates the Lead_Time_Constants object at module load (R2.1, R2.3, R2.9).
 *
 * Throws RangeError naming the offending property when:
 * - any value is non-integer
 * - any value is negative
 * - any value exceeds 30
 * - handlingTimeMinDays > handlingTimeMaxDays
 * - transitTimeMinDays > transitTimeMaxDays
 */
export function validateLeadTimeConstants(
  c: typeof CUSTOM_CAKE_LEAD_TIME,
): void {
  const entries: ReadonlyArray<
    readonly [keyof typeof CUSTOM_CAKE_LEAD_TIME, number]
  > = [
    ['handlingTimeMinDays', c.handlingTimeMinDays],
    ['handlingTimeMaxDays', c.handlingTimeMaxDays],
    ['transitTimeMinDays', c.transitTimeMinDays],
    ['transitTimeMaxDays', c.transitTimeMaxDays],
  ];

  for (const [name, value] of entries) {
    if (!Number.isInteger(value)) {
      throw new RangeError(
        `CUSTOM_CAKE_LEAD_TIME.${name} must be an integer (received ${value})`,
      );
    }
    if (value < 0) {
      throw new RangeError(
        `CUSTOM_CAKE_LEAD_TIME.${name} must be non-negative (received ${value})`,
      );
    }
    if (value > 30) {
      throw new RangeError(
        `CUSTOM_CAKE_LEAD_TIME.${name} must be <= 30 (received ${value})`,
      );
    }
  }

  if (c.handlingTimeMinDays > c.handlingTimeMaxDays) {
    throw new RangeError(
      `CUSTOM_CAKE_LEAD_TIME.handlingTimeMinDays (${c.handlingTimeMinDays}) must be <= handlingTimeMaxDays (${c.handlingTimeMaxDays})`,
    );
  }
  if (c.transitTimeMinDays > c.transitTimeMaxDays) {
    throw new RangeError(
      `CUSTOM_CAKE_LEAD_TIME.transitTimeMinDays (${c.transitTimeMinDays}) must be <= transitTimeMaxDays (${c.transitTimeMaxDays})`,
    );
  }
}

// Module-load invariant guard (R2.9): fail fast if Lead_Time_Constants are misconfigured.
validateLeadTimeConstants(CUSTOM_CAKE_LEAD_TIME);

export function getCommercePolicyUrls(): CommercePolicyUrls {
  return DEFAULT_POLICY_URLS;
}

export function getMerchantCenterGoogleProductCategory(): string {
  return 'Food, Beverages & Tobacco > Food Items > Bakery > Cakes & Dessert Bars > Cakes';
}

export function mapDesignAvailabilityToSchema(
  availability: string | null | undefined,
): string {
  switch (availability) {
    case 'rush':
    case 'same-day':
      return 'https://schema.org/InStock';
    case 'normal':
      return 'https://schema.org/PreOrder';
    case 'preorder':
      return 'https://schema.org/PreOrder';
    case 'made_to_order':
      return 'https://schema.org/PreOrder';
    case 'in_stock':
      return 'https://schema.org/InStock';
    case 'out_of_stock':
      return 'https://schema.org/OutOfStock';
    default:
      return 'https://schema.org/PreOrder';
  }
}

export function getLeadTimeLabel(
  availability: string | null | undefined,
): string | null {
  switch (availability) {
    case 'rush':
      return 'Ready in 60 minutes';
    case 'same-day':
      return 'Same-day fulfillment';
    case 'normal':
      return 'Requires advance lead time';
    case 'preorder':
      return 'Pre-order / scheduled fulfillment';
    case 'made_to_order':
      return 'Made to order';
    case 'in_stock':
      return 'Available now';
    case 'out_of_stock':
      return 'Currently unavailable';
    default:
      return null;
  }
}

export function buildPriceSummary(
  prices: BasePriceInfo[] | undefined,
  fallbackPrice: number | null | undefined,
): {
  lowPrice: number | null;
  highPrice: number | null;
  offerCount: number;
  singlePrice: number | null;
} {
  if (prices && prices.length > 0) {
    const sorted = [...prices].sort((a, b) => a.price - b.price);
    return {
      lowPrice: sorted[0]?.price ?? null,
      highPrice: sorted[sorted.length - 1]?.price ?? null,
      offerCount: sorted.length,
      singlePrice: null,
    };
  }

  return {
    lowPrice: fallbackPrice ?? null,
    highPrice: fallbackPrice ?? null,
    offerCount: fallbackPrice ? 1 : 0,
    singlePrice: fallbackPrice ?? null,
  };
}

export function getMerchantListingActivePrice(
  prices: BasePriceInfo[] | undefined,
  fallbackPrice: number | null | undefined,
): number | null {
  const summary = buildPriceSummary(prices, fallbackPrice);

  if (summary.lowPrice !== null && summary.lowPrice > 0) {
    return summary.lowPrice;
  }

  if (summary.singlePrice !== null && summary.singlePrice > 0) {
    return summary.singlePrice;
  }

  return null;
}

export function alignPriceOptionsToStartingPrice(
  prices: BasePriceInfo[] | undefined,
  startingPrice: number | null | undefined,
): BasePriceInfo[] {
  if (!prices || prices.length === 0) {
    return [];
  }

  if (!startingPrice || !Number.isFinite(startingPrice) || startingPrice <= 0) {
    return prices;
  }

  const currentMinPrice = Math.min(...prices.map((price) => price.price));
  const delta = Math.round(startingPrice - currentMinPrice);

  if (delta === 0) {
    return prices;
  }

  return prices.map((price) => ({
    ...price,
    price: Math.max(1, Math.round(price.price + delta)),
  }));
}

export function buildOfferShippingDetails(
  _merchant?: CakeGenieMerchant | null,
): {
  '@type': 'OfferShippingDetails';
  shippingDestination: { '@type': 'DefinedRegion'; addressCountry: 'PH' };
  doesNotShip: false;
  shippingRate: {
    '@type': 'MonetaryAmount';
    currency: 'PHP';
    maxValue: number;
  };
  deliveryTime: {
    '@type': 'ShippingDeliveryTime';
    handlingTime: {
      '@type': 'QuantitativeValue';
      unitCode: 'DAY';
      minValue: number;
      maxValue: number;
    };
    transitTime: {
      '@type': 'QuantitativeValue';
      unitCode: 'DAY';
      minValue: number;
      maxValue: number;
    };
  };
} {
  void _merchant;
  const { maxFee } = getDeliveryRateSummary();

  return {
    '@type': 'OfferShippingDetails',
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'PH',
    },
    doesNotShip: false,
    shippingRate: {
      '@type': 'MonetaryAmount',
      currency: 'PHP',
      maxValue: maxFee,
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        unitCode: 'DAY',
        minValue: CUSTOM_CAKE_LEAD_TIME.handlingTimeMinDays,
        maxValue: CUSTOM_CAKE_LEAD_TIME.handlingTimeMaxDays,
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        unitCode: 'DAY',
        minValue: CUSTOM_CAKE_LEAD_TIME.transitTimeMinDays,
        maxValue: CUSTOM_CAKE_LEAD_TIME.transitTimeMaxDays,
      },
    },
  };
}

export function buildMerchantReturnPolicy(): {
  '@type': 'MerchantReturnPolicy';
  applicableCountry: 'PH';
  merchantReturnDays: 0;
  returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility';
  returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted';
  returnPolicyCountry: 'PH';
  url: string;
} {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: PH_Country_Code,
    merchantReturnDays: 0,
    returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
    returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    returnPolicyCountry: PH_Country_Code,
    url: DEFAULT_POLICY_URLS.returnPolicy,
  };
}

export function buildCustomCakeAdditionalProperties(input: {
  cakeType?: string | null;
  availability?: string | null;
  sizeLabel?: string | null;
  merchantName?: string | null;
  selectedDesignSource?: string | null;
  uploadAssisted?: boolean;
}) {
  const values = [
    input.cakeType
      ? { '@type': 'PropertyValue', name: 'Cake Type', value: input.cakeType }
      : null,
    input.sizeLabel
      ? { '@type': 'PropertyValue', name: 'Starting Size', value: input.sizeLabel }
      : null,
    input.availability
      ? { '@type': 'PropertyValue', name: 'Fulfillment Class', value: input.availability }
      : null,
    getLeadTimeLabel(input.availability)
      ? { '@type': 'PropertyValue', name: 'Lead Time', value: getLeadTimeLabel(input.availability) }
      : null,
    input.uploadAssisted
      ? {
          '@type': 'PropertyValue',
          name: 'Customization Mode',
          value: 'Can be customized from uploaded reference image',
        }
      : {
          '@type': 'PropertyValue',
          name: 'Customization Mode',
          value: 'Made-to-order customizable cake design',
        },
    input.selectedDesignSource
      ? { '@type': 'PropertyValue', name: 'Design Source', value: input.selectedDesignSource }
      : null,
    input.merchantName
      ? { '@type': 'PropertyValue', name: 'Merchant', value: input.merchantName }
      : null,
  ].filter(Boolean);

  return values;
}

export function buildMerchantCenterCustomLabels(input: {
  availability: string | null | undefined;
  merchantCity?: string | null | undefined;
  cakeType?: string | null | undefined;
  uploadAssisted?: boolean | null | undefined;
  madeToOrder?: boolean | null | undefined;
}) {
  return {
    customLabel0: input.availability || 'unknown',
    customLabel1: input.merchantCity || 'unspecified-city',
    customLabel2: input.cakeType || 'unspecified-cake-type',
    customLabel3: input.uploadAssisted ? 'upload-assisted' : 'standard-customization',
    customLabel4: input.madeToOrder ? 'made-to-order' : 'catalog-product',
  };
}

export function deriveDeliveryZone(city?: string | null): string | null {
  if (!city) return null;
  if (METRO_CEBU_DELIVERY_CITIES.has(city)) return 'metro-cebu';
  if (city.toLowerCase().includes('bacoor')) return 'bacoor-cavite';
  return city.toLowerCase().replace(/\s+/g, '-');
}

export function deriveConstraintSnapshot(input: {
  availabilityClass?: string | null;
  earliestFulfillmentDate?: string | null;
  cutoffEligible?: boolean | null;
  branchCompatible?: boolean | null;
  deliveryZoneCompatible?: boolean | null;
  blackoutDate?: boolean | null;
  minimumLeadTimeDays?: number | null;
}): CommerceConstraintsSnapshot {
  const availabilityClass = input.availabilityClass;
  const normalizedAvailability: CommerceConstraintsSnapshot['availabilityClass'] =
    availabilityClass === 'rush' ||
    availabilityClass === 'same-day' ||
    availabilityClass === 'normal' ||
    availabilityClass === 'in_stock' ||
    availabilityClass === 'preorder' ||
    availabilityClass === 'made_to_order' ||
    availabilityClass === 'out_of_stock'
      ? availabilityClass
      : 'unknown';

  return {
    availabilityClass: normalizedAvailability,
    earliestFulfillmentDate: input.earliestFulfillmentDate ?? null,
    cutoffEligible: input.cutoffEligible ?? null,
    branchCompatible: input.branchCompatible ?? null,
    deliveryZoneCompatible: input.deliveryZoneCompatible ?? null,
    blackoutDate: input.blackoutDate ?? null,
    leadTimeLabel: getLeadTimeLabel(availabilityClass),
    minimumLeadTimeDays: input.minimumLeadTimeDays ?? null,
  };
}

export function buildCommerceOrderSnapshot(
  snapshot: CommerceOrderSnapshot,
): CommerceOrderSnapshot {
  return {
    ...snapshot,
    policyUrls: snapshot.policyUrls || getCommercePolicyUrls(),
  };
}

export function buildMerchantCenterDescription(
  product: CakeGenieMerchantProduct,
  merchant: CakeGenieMerchant,
): string {
  return (
    product.long_description ||
    product.short_description ||
    `Customize ${product.title} from ${merchant.business_name}. Delivery and pickup options depend on lead time and service area.`
  );
}

export function getMerchantListingNote(merchant?: CakeGenieMerchant | null): string {
  if (!merchant) {
    return 'Custom cakes are made to order. Delivery and pickup options vary by service area, branch coverage, and lead time.';
  }

  const city = merchant.city?.trim();
  if (city) {
    return `Custom cakes are made to order. Delivery and pickup options depend on ${city} coverage, branch availability, and lead time.`;
  }

  return 'Custom cakes are made to order. Delivery and pickup options vary by service area, branch coverage, and lead time.';
}
