export type PriorityCollectionSeo = {
  description: string
  keywords: string[]
}

export const PRIORITY_COLLECTION_ALIASES: Record<string, string> = {
  '18th-birthday-cake': 'debut-cake',
  '18th-birthday-cakes': 'debut-cake',
  '60th-birthday-cake': 'senior-cake',
  '60th-birthday-cakes': 'senior-cake',
}

export const FEATURED_COLLECTION_LINKS = [
  { slug: 'bento-cake', label: 'Bento Cake Designs' },
  { slug: 'minimalist-cake', label: 'Minimalist Cake Designs' },
  { slug: 'katseye-cake', label: 'KATSEYE Cake Designs' },
  { slug: 'kuromi-cake', label: 'Kuromi Cake Designs' },
  { slug: 'minecraft-cake', label: 'Minecraft Cake Designs' },
  { slug: 'graduation-cake', label: 'Graduation Cake Designs' },
  { slug: 'debut-cake', label: '18th Birthday & Debut Cake Designs' },
  { slug: '30th-birthday-cake', label: '30th Birthday Cake Designs' },
  { slug: 'senior-cake', label: '60th Birthday Cake Designs' },
] as const

export const PRIORITY_COLLECTION_SEO: Record<string, PriorityCollectionSeo> = {
  'bento-cake': {
    description: 'Browse bento cake designs for birthdays, monthsaries, and small gifts in Cebu. Compare styles, open any design for instant starting-price context, and customize its message, colors, and size for Metro Cebu delivery or pickup.',
    keywords: ['bento cake design', 'bento cake price cebu', 'mini cake cebu', 'korean bento cake'],
  },
  'minimalist-cake': {
    description: 'Compare Korean-style, pastel, vintage-piped, and simple birthday cakes in Cebu. Open a design to customize its message, colors, and size and see starting prices.',
    keywords: ['minimalist cake design', 'minimalist cake cebu', 'korean minimalist cake', 'simple birthday cake cebu'],
  },
  'katseye-cake': {
    description: 'Explore Katseye cake designs inspired by the group’s music, colors, logos, and fan celebrations. Open a distinct design to customize its message, size, and finish, then check pricing and Metro Cebu ordering options.',
    keywords: ['katseye cake', 'katseye cake design', 'kpop cake cebu', 'katseye birthday cake'],
  },
  'kuromi-cake': {
    description: 'Find Kuromi cake designs with black, purple, pink, bow, skull, and character details for Cebu birthdays. Compare real cake images, customize a design, and see starting-price and delivery options before ordering.',
    keywords: ['kuromi cake design', 'kuromi birthday cake', 'sanrio cake cebu', 'kuromi cake price'],
  },
  'minecraft-cake': {
    description: 'Browse Minecraft cake designs with blocks, Creepers, Steve, tools, and pixel-style decorations. Each image opens to a distinct customizable cake page with pricing context and Metro Cebu delivery or pickup options.',
    keywords: ['minecraft cake design', 'minecraft birthday cake', 'minecraft cake cebu', 'creeper cake'],
  },
  'graduation-cake': {
    description: 'Explore graduation cake designs for school, college, and university celebrations in Cebu. Compare caps, diplomas, school colors, and congratulatory messages, then customize a design and check starting prices.',
    keywords: ['graduation cake design', 'graduation cake cebu', 'graduation cake price', 'congratulations cake'],
  },
  'debut-cake': {
    description: 'Browse 18th birthday and debut cake designs for Cebu celebrations, from elegant florals and bows to personalized milestone themes. Customize a distinct design, review starting-price context, and plan delivery or pickup.',
    keywords: ['18th birthday cake design', 'debut cake cebu', '18th birthday cake price', 'debut cake ideas'],
  },
  '30th-birthday-cake': {
    description: 'Find 30th birthday cake designs for Cebu milestone celebrations, including elegant, funny, minimalist, and themed styles. Open any image to customize the message and details and see starting-price context.',
    keywords: ['30th birthday cake design', '30th birthday cake cebu', '30th cake ideas', 'milestone cake price'],
  },
  'senior-cake': {
    description: 'Explore 60th birthday cake designs for Cebu milestone celebrations, from elegant floral and gold details to personalized family themes. Customize a design and review starting prices and delivery or pickup options.',
    keywords: ['60th birthday cake design', '60th birthday cake cebu', 'senior birthday cake', 'milestone cake price'],
  },
}

export function resolvePriorityCollectionSlug(slug: string): string {
  return PRIORITY_COLLECTION_ALIASES[slug] || slug
}
