import { HOMEPAGE_ASSETS } from '@/constants';

export interface LandingHeroProduct {
  title: string;
  image: string;
  headlineVariant: number;
}

export interface LandingHeroContent {
  eyebrow: string;
  headlineVariants: readonly string[];
  headlineA11yLabel: string;
  lineTwo: string;
  lineThree: string;
  products: readonly LandingHeroProduct[];
}

export const DEFAULT_LANDING_HERO_CONTENT: LandingHeroContent = {
  eyebrow: 'Best Online Cake Delivery for Rush Orders in Cebu',
  headlineVariants: [
    'Custom Cakes',
    'Minimalist Cakes',
    'Vintage Cakes',
    'Floral Cakes',
    'Photo Cakes',
    'Bento Cakes',
    'Doodle Cakes',
  ],
  headlineA11yLabel:
    'Custom Cakes, Minimalist Cakes, Vintage Cakes, Floral Cakes, Photo Cakes, Bento Cakes, and Doodle Cakes.',
  lineTwo: "For Today's",
  lineThree: 'Celebrations',
  products: [
    {
      title: 'Minimalist Cakes',
      image: HOMEPAGE_ASSETS.heroProducts.minimalist,
      headlineVariant: 1,
    },
    {
      title: 'Vintage Cakes',
      image: HOMEPAGE_ASSETS.heroProducts.vintage,
      headlineVariant: 2,
    },
    {
      title: 'Doodle Cakes',
      image: HOMEPAGE_ASSETS.heroProducts.doodle,
      headlineVariant: 6,
    },
    {
      title: 'Edible Photo Cakes',
      image: HOMEPAGE_ASSETS.heroProducts.photo,
      headlineVariant: 4,
    },
    {
      title: 'Floral Cakes',
      image: HOMEPAGE_ASSETS.heroProducts.floral,
      headlineVariant: 3,
    },
    {
      title: 'Bento Cakes',
      image: HOMEPAGE_ASSETS.heroProducts.bento,
      headlineVariant: 5,
    },
  ],
};

export const MOTHERS_DAY_HERO_CONTENT: LandingHeroContent = {
  eyebrow: "Mother's Day Cakes in Cebu | May 10, 2026",
  headlineVariants: ["Mother's Day Cakes"],
  headlineA11yLabel: "Mother's Day Cakes.",
  lineTwo: 'Made With',
  lineThree: 'More Love',
  products: [
    {
      title: "Mother's Day Cake",
      image:
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/customizations/mothers-day-white-1-tier-cake-da80.webp',
      headlineVariant: 0,
    },
    {
      title: 'Floral Peony Cake',
      image:
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/customizations/floral-peony-light-pink-1-tier-cake-fffc.webp',
      headlineVariant: 0,
    },
    {
      title: 'Photo Mom Cake',
      image:
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/customizations/photo-mom-cake-lavender-1-tier-cake-3f83.webp',
      headlineVariant: 0,
    },
    {
      title: 'Floral Bouquet Cake',
      image:
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/customizations/floral-bouquet-ivory-1-tier-cake-fff9.webp',
      headlineVariant: 0,
    },
    {
      title: 'White Floral Gold Cake',
      image:
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/customizations/white-floral-gold-white-1-tier-cake-9fde.webp',
      headlineVariant: 0,
    },
    {
      title: 'Purple Floral Cake',
      image:
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/customizations/purple-floral-white-square-cake-ffc5.webp',
      headlineVariant: 0,
    },
  ],
};
export const VARIANT_B_HERO_CONTENT: LandingHeroContent = {
  ...DEFAULT_LANDING_HERO_CONTENT,
};
