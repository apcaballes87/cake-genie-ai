import { getDeliveryRateSummary } from '@/lib/commerce/deliveryRates';
import { genieBusinessProfile } from '@/lib/seo/genieBusinessProfile';

const deliveryRateSummary = getDeliveryRateSummary();

export const SUPPORT_PAGE_PATHS = {
  facts: '/cake-price-calculator',
  customizing: '/customizing',
  customizingUpload: '/?upload=1',
  deliveryRates: '/delivery-rates',
  paymentOptions: '/payment-options',
  howToOrder: '/how-to-order',
  reviews: '/reviews',
  trust: '/is-genie-ph-a-scam',
  contact: '/contact',
} as const;

export const PUBLIC_ORDER_FACTS = {
  bentoStartingPrice: '₱499',
  pricingSummary:
    'Bento cakes on Genie.ph start at ₱499. Larger cakes, tiered designs, and more detailed decorations are priced after AI analysis based on size, design complexity, toppers, icing, and finish.',
  pricingShortSummary:
    'Bento cakes start at ₱499, while larger or more detailed cakes are priced after AI analysis based on size and design complexity.',
  pricingProcessSummary:
    'Upload a design on Genie.ph, review the AI-generated starting price, then customize size, flavor, icing, toppers, and messages before adding the cake to cart.',
  deliverySummary: `Genie.ph delivers across ${genieBusinessProfile.primaryServiceAreaLabel}, including ${genieBusinessProfile.serviceAreas.join(', ')}. Delivery fees vary by city, from free delivery in ${deliveryRateSummary.lowestRateCity} up to ₱${deliveryRateSummary.maxFee} in ${deliveryRateSummary.highestRateCity}.`,
  paymentSummary:
    'Genie.ph accepts GCash, Maya, ShopeePay, Visa, Mastercard, BPI, BDO, and Palawan through secure Xendit-powered checkout.',
  leadTimeSummary:
    'Lead times depend on cake size, design complexity, and baker availability. Simple cakes may be fulfilled faster, while larger or more detailed cakes usually need more notice before delivery or pickup.',
  supportSummary: `Need help before paying? Contact Genie.ph at ${genieBusinessProfile.supportEmail} or ${genieBusinessProfile.phoneDisplay}.`,
  trustSummary:
    'Customers can verify Genie.ph through the reviews page, published support details, public permits, delivery-rates page, and the trust page that links to external proof.',
} as const;

export const PUBLIC_PRICING_QUESTIONS = [
  {
    question: 'How much do custom cakes cost on Genie.ph?',
    answer: PUBLIC_ORDER_FACTS.pricingSummary,
  },
  {
    question: 'Where does Genie.ph deliver?',
    answer: PUBLIC_ORDER_FACTS.deliverySummary,
  },
  {
    question: 'What payment methods does Genie.ph accept?',
    answer: PUBLIC_ORDER_FACTS.paymentSummary,
  },
  {
    question: 'How long does a custom cake order take?',
    answer: PUBLIC_ORDER_FACTS.leadTimeSummary,
  },
] as const;

export const PAYMENT_METHOD_GROUPS = [
  {
    title: 'E-Wallets',
    description: 'Fast online checkout using popular Philippine wallets.',
    accentClassName: 'bg-blue-50 text-blue-600',
    methods: [
      {
        name: 'GCash',
        logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/gcash.jpg',
        description: 'Pay directly from your GCash balance.',
      },
      {
        name: 'Maya',
        logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/maya.jpg',
        description: 'Fast and secure payments via Maya.',
      },
      {
        name: 'ShopeePay',
        logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/shopeepay.jpg',
        description: 'Use your ShopeePay wallet during checkout when available.',
      },
    ],
  },
  {
    title: 'Cards',
    description: 'Secure card checkout for both credit and debit cards.',
    accentClassName: 'bg-purple-50 text-purple-600',
    methods: [
      {
        name: 'Visa',
        logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/visa.jpg',
        description: 'All Visa credit and debit cards accepted.',
      },
      {
        name: 'Mastercard',
        logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/mastercard.jpg',
        description: 'All Mastercard credit and debit cards accepted.',
      },
    ],
  },
  {
    title: 'Online Banking',
    description: 'Bank-supported online checkout options.',
    accentClassName: 'bg-green-50 text-green-600',
    methods: [
      {
        name: 'BPI',
        logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/bpi.jpg',
        description: 'Pay through BPI online or the BPI mobile app.',
      },
      {
        name: 'BDO',
        logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/bdo.jpg',
        description: 'Pay through BDO online banking or the BDO mobile app.',
      },
    ],
  },
  {
    title: 'Over-the-Counter',
    description: 'Physical payment partner support where available.',
    accentClassName: 'bg-amber-50 text-amber-600',
    methods: [
      {
        name: 'Palawan',
        logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/palawan.jpg',
        description: 'Pay at Palawan Pawnshop or Palawan Express branches.',
      },
    ],
  },
] as const;

export function buildCanonicalFactsPageDescription() {
  return `${PUBLIC_ORDER_FACTS.pricingShortSummary} ${PUBLIC_ORDER_FACTS.deliverySummary}`;
}
