import type { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';
import type {
  BasePriceInfo,
  CommerceConstraintsSnapshot,
  CommerceOrderSnapshot,
  CommercePolicyUrls,
} from '@/types';

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

export function buildOfferShippingDetails(
  _merchant?: CakeGenieMerchant | null,
): {
  '@type': 'OfferShippingDetails';
  shippingDestination: { '@type': 'DefinedRegion'; addressCountry: 'PH' };
  doesNotShip: false;
} {
  void _merchant;

  return {
    '@type': 'OfferShippingDetails',
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'PH',
    },
    doesNotShip: false,
  };
}

export function buildMerchantReturnPolicy() {
  return {
    '@type': 'MerchantReturnPolicy',
    returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    merchantReturnDays: 0,
    returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
    returnPolicyCountry: 'PH',
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
