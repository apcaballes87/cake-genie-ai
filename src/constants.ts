import { Color, CakeType, CakeThickness, CakeSize, CakeFlavor, IcingDesign } from '@/types';
export { DELIVERY_FEES_BY_CITY, getDeliveryFeeByCity } from '@/lib/commerce/deliveryRates';

export const COLORS: Color[] = [
  { name: 'Dark Red', hex: '#8B0000' },
  { name: 'Red', hex: '#FF0000' },
  { name: 'Coral', hex: '#FF7F50' },
  { name: 'Orange', hex: '#FFA500' },
  { name: 'Peach', hex: '#FFDAB9' },
  { name: 'Gold', hex: '#FFD700' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Light Yellow', hex: '#FFFFE0' },
  { name: 'Champagne', hex: '#F7E7CE' },
  { name: 'Ivory', hex: '#FFFFF0' },
  { name: 'Beige', hex: '#F5F5DC' },
  { name: 'Green', hex: '#008000' },
  { name: 'Light Green', hex: '#90EE90' },
  { name: 'Mint', hex: '#98FF98' },
  { name: 'Teal', hex: '#008080' },
  { name: 'Navy', hex: '#000080' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Light Blue', hex: '#87CEEB' },
  { name: 'Purple', hex: '#800080' },
  { name: 'Lavender', hex: '#E6E6FA' },
  { name: 'Hot Pink', hex: '#FF69B4' },
  { name: 'Pink', hex: '#FFC0CB' },
  { name: 'Light Pink', hex: '#FFB6C1' },
  { name: 'Rose Gold', hex: '#B76E79' },
  { name: 'Brown', hex: '#8B4513' },
  { name: 'Tan', hex: '#D2B48C' },
  { name: 'Silver', hex: '#C0C0C0' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#000000' },
];

export const CAKE_TYPES: CakeType[] = [
  'Bento',
  '1 Tier', '2 Tier', '3 Tier',
  '1 Tier Fondant', '2 Tier Fondant', '3 Tier Fondant',
  'Square', 'Rectangle',
  'Square Fondant', 'Rectangle Fondant',
  'Cupcake',
  'Bento Cupcake Set'
];

export const SOFT_ICING_CAKE_TYPES: CakeType[] = [
  'Bento',
  '1 Tier',
  '2 Tier',
  '3 Tier',
  'Square',
  'Rectangle',
  'Cupcake',
  'Bento Cupcake Set'
];

export const FONDANT_CAKE_TYPES: CakeType[] = [
  '1 Tier Fondant',
  '2 Tier Fondant',
  '3 Tier Fondant',
  'Square Fondant',
  'Rectangle Fondant',
];

export const inferIcingBaseFromCakeType = (cakeType: CakeType): IcingDesign['base'] =>
  cakeType.toLowerCase().includes('fondant') ? 'fondant' : 'soft_icing';

export const getCakeTypesForIcingBase = (base: IcingDesign['base']): CakeType[] =>
  base === 'fondant' ? FONDANT_CAKE_TYPES : SOFT_ICING_CAKE_TYPES;

export const getEquivalentCakeTypeForIcingBase = (
  cakeType: CakeType,
  base: IcingDesign['base']
): CakeType => {
  if (base === 'fondant') {
    switch (cakeType) {
      case '1 Tier':
      case '1 Tier Fondant':
      case 'Bento':
        return '1 Tier Fondant';
      case '2 Tier':
      case '2 Tier Fondant':
        return '2 Tier Fondant';
      case '3 Tier':
      case '3 Tier Fondant':
        return '3 Tier Fondant';
      case 'Square':
      case 'Square Fondant':
        return 'Square Fondant';
      case 'Rectangle':
      case 'Rectangle Fondant':
        return 'Rectangle Fondant';
      default:
        return '1 Tier Fondant';
    }
  }

  switch (cakeType) {
    case '1 Tier':
    case '1 Tier Fondant':
      return '1 Tier';
    case '2 Tier':
    case '2 Tier Fondant':
      return '2 Tier';
    case '3 Tier':
    case '3 Tier Fondant':
      return '3 Tier';
    case 'Square':
    case 'Square Fondant':
      return 'Square';
    case 'Rectangle':
    case 'Rectangle Fondant':
      return 'Rectangle';
    case 'Bento':
    default:
      return 'Bento';
  }
};

export const getEquivalentCakeSizeForIcingBase = (
  cakeSize: CakeSize,
  base: IcingDesign['base']
): CakeSize => {
  if (base === 'fondant') {
    return cakeSize.toLowerCase().includes('fondant') ? cakeSize : `${cakeSize} Fondant`;
  }

  return cakeSize.replace(/\s+Fondant$/i, '');
};

export const CAKE_THICKNESSES: CakeThickness[] = ['2 in', '3 in', '4 in', '5 in', '6 in'];

export const FLAVOR_OPTIONS: CakeFlavor[] = ['Chocolate Cake', 'Ube Cake', 'Vanilla Cake', 'Mocha Cake'];

export const TEMPORARILY_DISABLED_FLAVORS: CakeFlavor[] = ['Mocha Cake'];

export const DEFAULT_THICKNESS_MAP: Record<CakeType, CakeThickness> = {
  '1 Tier': '4 in',
  '2 Tier': '4 in',
  '3 Tier': '4 in',
  'Square': '4 in',
  'Rectangle': '4 in',
  '1 Tier Fondant': '5 in',
  '2 Tier Fondant': '5 in',
  '3 Tier Fondant': '5 in',
  'Bento': '2 in',
  'Square Fondant': '5 in',
  'Rectangle Fondant': '5 in',
  'Cupcake': '2 in',
  'Bento Cupcake Set': '2 in',
};

export const THICKNESS_OPTIONS_MAP: Record<CakeType, CakeThickness[]> = {
  '1 Tier': ['3 in', '4 in', '5 in', '6 in'],
  '2 Tier': ['4 in', '5 in'],
  '3 Tier': ['4 in', '5 in'],
  'Square': ['3 in', '4 in'],
  'Rectangle': ['3 in', '4 in'],
  '1 Tier Fondant': ['5 in', '6 in'],
  '2 Tier Fondant': ['5 in', '6 in'],
  '3 Tier Fondant': ['5 in', '6 in'],
  'Bento': ['2 in'],
  'Square Fondant': ['5 in', '6 in'],
  'Rectangle Fondant': ['5 in', '6 in'],
  'Cupcake': ['2 in'],
  'Bento Cupcake Set': ['2 in'],
};

export const ANALYSIS_PHRASES = [
  'Preheating the analysis engine',
  'Scanning for delicious details',
  'Slicing the image into digital layers',
  'Identifying icing colors and textures',
  'Consulting with our digital pastry chef',
  'Measuring the cake tiers',
  'Searching for the main toppers',
  'Deconstructing the design elements',
  'Translating pixels into pastry',
  'Counting the candles (just kidding!)',
  'Checking for fondant vs. soft icing',
  'Whipping up your customization options',
  'Uncovering the recipe for your design',
  'Identifying supporting decorations',
  'Getting the full scoop on your cake',
  'Finalizing the feature list',
  'Just a moment, our AI has a sweet tooth',
  'Preparing your design palette',
  'Sketching out the cake\'s blueprint',
  'Almost there, just adding the finishing touches',
];

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Defensive: env vars pasted into Vercel / .env files sometimes pick up
// trailing newlines or surrounding whitespace. We strip both ends so the
// resulting URLs concatenated downstream stay valid. (Webhook smoke test
// caught a `\n` between host and `/storage/v1/...` once.)
const supabaseUrl = typeof rawSupabaseUrl === 'string' ? rawSupabaseUrl.trim() : rawSupabaseUrl;

if (!supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE_URL')) {
  throw new Error("Supabase URL is required for asset paths. Please update it in the `.env.local` file.");
}

// ============================================================================
// STORAGE CONFIGURATION
// ============================================================================

/**
 * Base URL for Supabase storage
 */
export const STORAGE_BASE_URL = `${supabaseUrl}/storage/v1/object/public`;

/**
 * Available storage buckets
 */
export const STORAGE_BUCKETS = {
  cakegenie: 'cakegenie',
  landingpage: 'landingpage',
} as const;

/**
 * Helper function to build asset URLs
 * @param bucket - The storage bucket name
 * @param path - The path to the asset within the bucket
 * @returns Full URL to the asset
 */
export const getAssetUrl = (bucket: keyof typeof STORAGE_BUCKETS, path: string): string =>
  `${STORAGE_BASE_URL}/${STORAGE_BUCKETS[bucket]}/${path}`;

export const getProxiedImageUrl = (url: string): string =>
  `/api/proxy-image?url=${encodeURIComponent(url)}`;

export const getCachedAssetUrl = (bucket: keyof typeof STORAGE_BUCKETS, path: string): string =>
  getProxiedImageUrl(getAssetUrl(bucket, path));

/**
 * Static icing mask for the 6-inch edible photo cake (the default cake shape used
 * for selfie→edible-photo composites in `ImageContext`). Pre-generated once and
 * reused for every icing color change, so selfie flows get instant client-side
 * recolors without paying for a Gemini mask-generation call.
 *
 * The mask follows the standard icing-mask convention (icing rendered red,
 * everything else pitch-black) consumed by `recolorWithMask` in
 * `@/lib/icingMaskComposite`. Dimensions don't have to match the source image —
 * the compositor rescales the mask as needed.
 */
export const EDIBLE_PHOTO_MASK_URL = getAssetUrl('cakegenie', 'cold-caking/6in-mask.webp');

/**
 * Common application assets - use these instead of hardcoding URLs
 */
export const COMMON_ASSETS = {
  // Branding (direct Supabase, not proxied — these load on every page so the
  // proxy round trip was a sitewide cost)
  // 360px-wide variant: the header/footer logo never renders wider than ~164
  // CSS px (≈287px at the test device's DPR), so the original 700x171 asset
  // was oversized. This trims ~50% of the transfer bytes. The 700x171 original
  // (genie-logo-header.webp) is kept in storage for any higher-DPI use.
  logo: getAssetUrl('landingpage', 'genie-logo-header-360.webp'),
  logoSquare: getAssetUrl('cakegenie', 'genie%20logo.webp'),
  watermark: getAssetUrl('cakegenie', 'genie%20watermark.png'),

  // Reference images
  threeTierReference: getAssetUrl('cakegenie', '3tier.webp'),

  // Landing page
  callForBakeshops: getAssetUrl('cakegenie', 'call%20for%20bakeshops.webp'),
} as const;

// Hero assets bypass the /api/proxy-image route and load directly from Supabase
// CDN. Going through the proxy was forcing every first-paint hero LCP image to
// take a serverless round trip, hurting LCP. The proxy still exists (and is
// useful for non-Supabase image hosts like Pinterest/Instagram); we just don't
// need it for assets we already own and host on Supabase storage with
// long-lived public URLs.
export const HOMEPAGE_ASSETS = {
  heroProducts: {
    minimalist: getAssetUrl('landingpage', 'landing-page-model-white-minimalist-cake-small.webp'),
    vintage: getAssetUrl('landingpage', 'landing-page-model-pink-vintage-cake-small.webp'),
    doodle: getAssetUrl('landingpage', 'landing-page-model-white-doodle-cake-small.webp'),
    photo: getAssetUrl('landingpage', 'landing-page-model-edible-photo-cake-small.webp'),
    floral: getAssetUrl('landingpage', 'landing-page-model-vintage-white-cake-small.webp'),
    bento: getAssetUrl('landingpage', 'landing-page-model-pink-bento-cake-small.webp'),
  },
  transition: getAssetUrl('landingpage', 'generic-vs-personal-cake.webp'),
  delivery: getAssetUrl('landingpage', 'geniephdelivery-small.webp'),
} as const;

/**
 * Landing page quick link image sets
 */
export const LANDING_PAGE_IMAGES = {
  minimalist: [
    getAssetUrl('landingpage', 'minimalist1.webp'),
    getAssetUrl('landingpage', 'minimalist2.webp'),
    getAssetUrl('landingpage', 'minimalist3.webp'),
    getAssetUrl('landingpage', 'minimalist5.webp'),
    getAssetUrl('landingpage', 'minimalist6.webp'),
    getAssetUrl('landingpage', 'minimalist7.webp'),
    getAssetUrl('landingpage', 'minimalist8.webp'),
  ],
  ediblePhoto: [
    getAssetUrl('landingpage', 'ep1.webp'),
    getAssetUrl('landingpage', 'ep2.webp'),
    getAssetUrl('landingpage', 'ep3.webp'),
    getAssetUrl('landingpage', 'ep4.webp'),
    getAssetUrl('landingpage', 'ep5.webp'),
    getAssetUrl('landingpage', 'ep6.webp'),
  ],
  bento: [
    getAssetUrl('landingpage', 'BENTO1.webp'),
    getAssetUrl('landingpage', 'bento2.webp'),
    getAssetUrl('landingpage', 'bento3.webp'),
    getAssetUrl('landingpage', 'bento4.webp'),
    getAssetUrl('landingpage', 'bento5.webp'),
    getAssetUrl('landingpage', 'bento6.webp'),
  ],
  birthdayPrintouts: [
    getAssetUrl('landingpage', 'printout1-blackpink.webp'),
    getAssetUrl('landingpage', 'printout2-BTS.webp'),
    getAssetUrl('landingpage', 'printout3-kpop-demon-hunters.webp'),
    getAssetUrl('landingpage', 'printout4-pokemon.webp'),
    getAssetUrl('landingpage', 'printout5-bini.webp'),
  ],
} as const;

// Legacy alias for backwards compatibility
const storageBaseUrl = `${supabaseUrl}/storage/v1/object/public/cakegenie`;

export const FLAVOR_THUMBNAILS: Record<CakeFlavor, string> = {
  'Chocolate Cake': `${storageBaseUrl}/cakechocolate.webp`,
  'Ube Cake': `${storageBaseUrl}/cakeube.webp`,
  'Vanilla Cake': `${storageBaseUrl}/cakevanilla.webp`,
  'Mocha Cake': `${storageBaseUrl}/cakemocha.webp`,
};

export const TIER_THUMBNAILS: Record<number, string[]> = {
  1: [`${storageBaseUrl}/1-tier-highlight.webp`],
  2: [`${storageBaseUrl}/2tiertop.webp`, `${storageBaseUrl}/2tierbottom.webp`],
  3: [`${storageBaseUrl}/3tiertop.webp`, `${storageBaseUrl}/3tiermiddle.webp`, `${storageBaseUrl}/3tierbottom.webp`]
};

export const CAKE_TYPE_THUMBNAILS: Record<CakeType, string> = {
  '1 Tier': `${storageBaseUrl}/1tier.webp`,
  '2 Tier': `${storageBaseUrl}/2tier.webp`,
  '3 Tier': `${storageBaseUrl}/3tier.webp`,
  '1 Tier Fondant': `${storageBaseUrl}/1tier.webp`,
  '2 Tier Fondant': `${storageBaseUrl}/2tier.webp`,
  '3 Tier Fondant': `${storageBaseUrl}/3tier.webp`,
  'Square': `${storageBaseUrl}/square.webp`,
  'Rectangle': `${storageBaseUrl}/rectangle.webp`,
  'Bento': `${storageBaseUrl}/bento.webp`,
  'Square Fondant': `${storageBaseUrl}/square.webp`,
  'Rectangle Fondant': `${storageBaseUrl}/rectangle.webp`,
  'Cupcake': `${storageBaseUrl}/bento.webp`,
  'Bento Cupcake Set': `${storageBaseUrl}/bento.webp`,
};

export const CAKE_SIZE_THUMBNAILS: Record<string, string> = {
  // 1 Tier
  '6" Round': `${storageBaseUrl}/1tier.webp`,
  '8" Round': `${storageBaseUrl}/1tier.webp`,
  '10" Round': `${storageBaseUrl}/1tier.webp`,
  // 2 Tier
  '6"/8" Round': `${storageBaseUrl}/2tier.webp`,
  '8"/10" Round': `${storageBaseUrl}/2tier.webp`,
  // 3 Tier
  '6"/8"/10" Round': `${storageBaseUrl}/3tier.webp`,
  // Square
  '6" Square': `${storageBaseUrl}/square.webp`,
  '8" Square': `${storageBaseUrl}/square.webp`,
  // Rectangle
  '9"x13" Rectangle': `${storageBaseUrl}/rectangle.webp`,
  // Bento
  '4" Round': `${storageBaseUrl}/bento.webp`,
  // Square (new format)
  '8x8': `${storageBaseUrl}/square.webp`,
  '10x10': `${storageBaseUrl}/square.webp`,
  // Rectangle (new format)
  '8x12': `${storageBaseUrl}/rectangle.webp`,
  '10x14': `${storageBaseUrl}/rectangle.webp`,
  '12x16': `${storageBaseUrl}/rectangle.webp`,
  '2oz - 12 pieces': `${storageBaseUrl}/bento.webp`,
};

export const SQUARE_RECT_SIZE_PATTERN = /\d+\s*[xX×]\s*\d+/g;

export const DEFAULT_SIZE_MAP: Record<CakeType, CakeSize> = {
  '1 Tier': '6" Round',
  '2 Tier': '6"/8" Round',
  '3 Tier': '6"/8"/10" Round',
  'Square': '8" Square',
  'Rectangle': '9"x13" Rectangle',
  '1 Tier Fondant': '6" Round',
  '2 Tier Fondant': '6"/8" Round',
  '3 Tier Fondant': '6"/8"/10" Round',
  'Bento': '4" Round',
  'Square Fondant': '8" Square',
  'Rectangle Fondant': '9"x13" Rectangle',
  'Cupcake': '2oz - 12 pieces',
  'Bento Cupcake Set': '4" Bento + 5 Cupcakes',
};

export const CAKE_THICKNESS_THUMBNAILS: Record<CakeThickness, string> = {
  '2 in': `${storageBaseUrl}/thickness_2in.webp`,
  '3 in': `${storageBaseUrl}/thickness_3in.webp`,
  '4 in': `${storageBaseUrl}/thickness_4in.webp`,
  '5 in': `${storageBaseUrl}/thickness_5in.webp`,
  '6 in': `${storageBaseUrl}/thickness_6in.webp`,
};

export const CITIES_AND_BARANGAYS: Record<string, string[]> = {
  "Cebu City": ["Adlaon", "Agsungot", "Apas", "Babag", "Bacayan", "Banilad", "Basak Pardo", "Basak San Nicolas", "Bonbon", "Budla-an", "Buhisan", "Bulacao", "Buot", "Busay", "Calamba", "Cambinocot", "Kamagayan", "Kamputhaw (Camputhaw)", "Capitol Site", "Carreta", "Cogon Pardo", "Cogon Ramos", "Day-as", "Duljo Fatima", "Ermita", "Guadalupe", "Guba", "Hipodromo", "Inayawan", "Kalubihan", "Kalunasan", "Kasambagan", "Kinasang-an Pardo", "Labangon", "Lahug", "Lorega San Miguel", "Lusaran", "Luz", "Mabini", "Mabolo", "Malubog", "Mambaling", "Pahina Central", "Pahina San Nicolas", "Pamutan", "Pari-an", "Paril", "Pasil", "Pit-os", "Poblacion Pardo", "Pulangbato", "Pung-ol Sibugay", "Punta Princesa", "Quiot", "Sambag I", "Sambag II", "San Antonio", "San Jose", "San Nicolas Proper", "San Roque", "Santa Cruz", "Sapangdaku", "Sawang Calero", "Sinsin", "Sirao", "Suba", "Sudlon I", "Sudlon II", "T. Padilla", "Tabunan", "Tagba-o", "Talamban", "Taptap", "Tejero", "Tinago", "Tisa", "To-ong", "Zapatera"],
  "Mandaue City": ["Alang-alang", "Bakilid", "Banilad", "Basak", "Cabancalan", "Cambaro", "Canduman", "Casili", "Casuntingan", "Centro", "Cubacub", "Guizo", "Ibabao-Estancia", "Jagobiao", "Labogon", "Looc", "Maguikay", "Mantuyong", "Opao", "Pagsabungan", "Paknaan", "Subangdaku", "Tabok", "Tawason", "Tingub", "Tipolo", "Umapad"],
  "Consolacion": ["Cabangahan", "Cansaga", "Danao", "Garing", "Jugan", "Lamac", "Lanipga", "Nangka", "Panas", "Panoypoy", "Pitogo", "Poblacion Occidental", "Poblacion Oriental", "Polog", "Pulpogan", "Sacsac", "Tayud", "Tilhaong", "Tugbongan"],
  "Lapu-lapu City": ["Agus", "Babag", "Bankal", "Baring", "Basak", "Buaya", "Calawisan", "Canjulao", "Caw-oy", "Cawhagan", "Caubian", "Gun-ob", "Ibo", "Looc", "Mactan", "Maribago", "Marigondon", "Pajac", "Pajo", "Pangan-an", "Poblacion", "Punta Engaño", "Sabang", "Santa Rosa", "Subabasbas", "Talima", "Tingo", "Tungasan", "San Vicente"],
  "Cordova": ["Alegria", "Bangbang", "Buagsong", "Catarman", "Cogon", "Dapitan", "Day-as", "Gabi", "Gilutongan", "Ibabao", "Pilipog", "Poblacion", "San Miguel"],
  "Talisay City": ["Biasong", "Bulacao", "Cadulawan", "Camp IV", "Cansojong", "Dapdap", "Jaclupan", "Lagtang", "Lawaan I", "Lawaan II", "Lawaan III", "Linao", "Maghaway", "Manipis", "Mohon", "Pooc", "Poblacion", "San Isidro", "San Roque", "Tabunok", "Tangke", "Tapul"],
};



export const DEFAULT_ICING_DESIGN: import('@/types').IcingDesignUI = {
  base: 'soft_icing',
  color_type: 'single',
  colors: { top: '#FFFFFF', side: '#FFFFFF' },
  border_top: false,
  border_base: false,
  drip: false,
  gumpasteBaseBoard: false,
  dripPrice: 100,
  gumpasteBaseBoardPrice: 100,
};
