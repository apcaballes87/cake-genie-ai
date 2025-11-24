import { Color, CakeType, CakeThickness, CakeSize, CakeFlavor } from './types';
import { SUPABASE_URL } from './config';

export const COLORS: Color[] = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Light Red', hex: '#FCA5A5' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Green', hex: '#16A34A' },
  { name: 'Light Green', hex: '#4ADE80' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Light Blue', hex: '#93C5FD' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Light Purple', hex: '#C4B5FD' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Light Pink', hex: '#FBCFE8' },
  { name: 'Brown', hex: '#78350F' },
  { name: 'Light Brown', hex: '#B45309' },
  { name: 'Gray', hex: '#64748B' },
  { name: 'Cream', hex: '#F5E6D3' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#000000' },
];

export const CAKE_TYPES: CakeType[] = [
  '1 Tier', '2 Tier', '3 Tier',
  '1 Tier Fondant', '2 Tier Fondant', '3 Tier Fondant',
  'Square', 'Rectangle', 'Bento'
];

export const CAKE_THICKNESSES: CakeThickness[] = ['2 in', '3 in', '4 in', '5 in', '6 in'];

export const FLAVOR_OPTIONS: CakeFlavor[] = ['Chocolate Cake', 'Ube Cake', 'Vanilla Cake', 'Mocha Cake'];

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

const supabaseUrl = SUPABASE_URL;

if (!supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE_URL')) {
  throw new Error("Supabase URL is required for asset paths. Please update it in the `config.ts` file.");
}

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
};

export const DEFAULT_SIZE_MAP: Record<CakeType, CakeSize> = {
  '1 Tier': '8" Round',
  '2 Tier': '6"/8" Round',
  '3 Tier': '6"/8"/10" Round',
  'Square': '8" Square',
  'Rectangle': '9"x13" Rectangle',
  '1 Tier Fondant': '8" Round',
  '2 Tier Fondant': '6"/8" Round',
  '3 Tier Fondant': '6"/8"/10" Round',
  'Bento': '4" Round',
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

export const SHOPIFY_TAGS = {
  TIER: 'tier',
  TYPE: 'type',
  FLAVOR: 'flavor',
};

export const DEFAULT_ICING_DESIGN = {
  base: 'soft_icing' as const,
  color_type: 'single' as const,
  colors: { side: '#FFFFFF' },
  border_top: false,
  border_base: false,
  drip: false,
  gumpasteBaseBoard: false,
  dripPrice: 100,
  gumpasteBaseBoardPrice: 100,
};