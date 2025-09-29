import { Color, CakeType, CakeThickness, CakeSize } from './types';

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
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#000000' },
];

export const CAKE_TYPES: CakeType[] = [
  '1 Tier', '2 Tier', '3 Tier', 
  '1 Tier Fondant', '2 Tier Fondant', '3 Tier Fondant',
  'Square', 'Rectangle', 'Bento'
];

export const CAKE_THICKNESSES: CakeThickness[] = ['2 in', '3 in', '4 in', '5 in', '6 in'];

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
    '2 Tier': ['4 in'],
    '3 Tier': ['4 in'],
    'Square': ['3 in'],
    'Rectangle': ['3 in'],
    '1 Tier Fondant': ['5 in'],
    '2 Tier Fondant': ['5 in'],
    '3 Tier Fondant': ['5 in'],
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

export const CAKE_TYPE_THUMBNAILS: Record<CakeType, string> = {
    '1 Tier': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/1tier.png',
    '2 Tier': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/2tier.png',
    '3 Tier': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/3tier.png',
    '1 Tier Fondant': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/1tier.png',
    '2 Tier Fondant': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/2tier.png',
    '3 Tier Fondant': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/3tier.png',
    'Square': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/square.png',
    'Rectangle': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/rectangle.png',
    'Bento': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/bento.png',
};

export const CAKE_SIZE_THUMBNAILS: Record<string, string> = {
    // 1 Tier
    '6" Round': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/1tier.png',
    '8" Round': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/1tier.png',
    '10" Round': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/1tier.png',
    // 2 Tier
    '6"/8" Round': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/2tier.png',
    '8"/10" Round': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/2tier.png',
    // 3 Tier
    '6"/8"/10" Round': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/3tier.png',
    // Square
    '6" Square': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/square.png',
    '8" Square': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/square.png',
    // Rectangle
    '9"x13" Rectangle': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/rectangle.png',
    // Bento
    '4" Round': 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/bento.png',
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

export const CITIES_AND_BARANGAYS: Record<string, string[]> = {
  "Cebu City": ["Adlaon", "Agsungot", "Apas", "Babag", "Bacayan", "Banilad", "Basak Pardo", "Basak San Nicolas", "Bonbon", "Budla-an", "Buhisan", "Bulacao", "Buot", "Busay", "Calamba", "Cambinocot", "Kamagayan", "Kamputhaw (Camputhaw)", "Capitol Site", "Carreta", "Cogon Pardo", "Cogon Ramos", "Day-as", "Duljo Fatima", "Ermita", "Guadalupe", "Guba", "Hipodromo", "Inayawan", "Kalubihan", "Kalunasan", "Kasambagan", "Kinasang-an Pardo", "Labangon", "Lahug", "Lorega San Miguel", "Lusaran", "Luz", "Mabini", "Mabolo", "Malubog", "Mambaling", "Pahina Central", "Pahina San Nicolas", "Pamutan", "Pari-an", "Paril", "Pasil", "Pit-os", "Poblacion Pardo", "Pulangbato", "Pung-ol Sibugay", "Punta Princesa", "Quiot", "Sambag I", "Sambag II", "San Antonio", "San Jose", "San Nicolas Proper", "San Roque", "Santa Cruz", "Sapangdaku", "Sawang Calero", "Sinsin", "Sirao", "Suba", "Sudlon I", "Sudlon II", "T. Padilla", "Tabunan", "Tagba-o", "Talamban", "Taptap", "Tejero", "Tinago", "Tisa", "To-ong", "Zapatera"],
  "Mandaue City": ["Alang-alang", "Bakilid", "Banilad", "Basak", "Cabancalan", "Cambaro", "Canduman", "Casili", "Casuntingan", "Centro", "Cubacub", "Guizo", "Ibabao-Estancia", "Jagobiao", "Labogon", "Looc", "Maguikay", "Mantuyong", "Opao", "Pagsabungan", "Paknaan", "Subangdaku", "Tabok", "Tawason", "Tingub", "Tipolo", "Umapad"],
  "Consolacion": ["Cabangahan", "Cansaga", "Danao", "Garing", "Jugan", "Lamac", "Lanipga", "Nangka", "Panas", "Panoypoy", "Pitogo", "Poblacion Occidental", "Poblacion Oriental", "Polog", "Pulpogan", "Sacsac", "Tayud", "Tilhaong", "Tugbongan"],
  "Lapu-lapu City": ["Agus", "Babag", "Bankal", "Baring", "Basak", "Buaya", "Calawisan", "Canjulao", "Caw-oy", "Cawhagan", "Caubian", "Gun-ob", "Ibo", "Looc", "Mactan", "Maribago", "Marigondon", "Pajac", "Pajo", "Pangan-an", "Poblacion", "Punta Engaño", "Sabang", "Santa Rosa", "Subabasbas", "Talima", "Tingo", "Tungasan", "San Vicente"],
  "Cordova": ["Alegria", "Bangbang", "Buagsong", "Catarman", "Cogon", "Dapitan", "Day-as", "Gabi", "Gilutongan", "Ibabao", "Pilipog", "Poblacion", "San Miguel"],
  "Talisay City": ["Biasong", "Bulacao", "Cadulawan", "Camp IV", "Cansojong", "Dapdap", "Jaclupan", "Lagtang", "Lawaan I", "Lawaan II", "Lawaan III", "Linao", "Maghaway", "Manipis", "Mohon", "Pooc", "Poblacion", "San Isidro", "San Roque", "Tabunok", "Tangke", "Tapul"],
};