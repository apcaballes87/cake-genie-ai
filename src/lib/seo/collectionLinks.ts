const CURATED_COLLECTION_LINKS: Record<string, string> = {
  birthday: '/birthday-cake-delivery-cebu-city',
  birthdays: '/birthday-cake-delivery-cebu-city',
  'birthday cake': '/birthday-cake-delivery-cebu-city',
  'birthday cakes': '/birthday-cake-delivery-cebu-city',
  anniversary: '/collections/anniversary-cake',
  anniversaries: '/collections/anniversary-cake',
  'anniversary cakes': '/collections/anniversary-cake',
  'christmas day': '/collections/christmas-cake',
  christmas: '/collections/christmas-cake',
  'new year': '/collections/new-year-cake',
  wedding: '/collections/wedding-cake',
  weddings: '/collections/wedding-cake',
  'wedding cakes': '/collections/wedding-cake',
  bento: '/collections/bento-cake',
  'bento cakes': '/collections/bento-cake',
  minimalist: '/collections/minimalist-cake',
  'minimalist cake': '/collections/minimalist-cake',
  'minimalist cakes': '/collections/minimalist-cake',
  'mothers day cake': '/collections/mothers-day-cakes',
  "mother's day cake": '/collections/mothers-day-cakes',
  'floral cake': '/collections/floral-cake',
  'dinosaur cake': '/collections/dinosaurs-cake',
  'dinosaur cakes': '/collections/dinosaurs-cake',
  'princess cake': '/collections/princess-cake',
  'princess cakes': '/collections/princess-cake',
  'cocomelon cake': '/collections/cocomelon-cake',
  'toy story cake': '/collections/toy-story-cake',
  shops: '/shop',
}

export function getCuratedCollectionHref(label: string): string {
  const normalized = label
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return CURATED_COLLECTION_LINKS[normalized] || '/collections'
}
