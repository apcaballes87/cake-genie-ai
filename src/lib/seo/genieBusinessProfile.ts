export const GENIE_BASE_URL = 'https://genie.ph'

export const genieBusinessProfile = {
  name: 'Genie.ph',
  legalName: 'Alalai Information Technology Solutions',
  description:
    'Genie.ph is an AI-powered custom cake marketplace in Cebu that helps customers upload a design, get instant pricing, customize details, and order from vetted local bakers.',
  shortDescription:
    'AI-powered custom cake marketplace in Cebu with instant pricing, customization, and Metro Cebu delivery.',
  siteUrl: GENIE_BASE_URL,
  organizationId: `${GENIE_BASE_URL}/#organization`,
  websiteId: `${GENIE_BASE_URL}/#website`,
  logoUrl:
    'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20favicon.webp',
  heroImageUrl:
    'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/customized-cakes-cover-photo-genieph.webp',
  ogImageUrl:
    'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/pages/CUSTOM-CAKES-FOR-RUSH-ORDERS.WEBP',
  supportEmail: 'support@genie.ph',
  phoneDisplay: '+63 908 940 8747',
  phoneHref: 'tel:+639089408747',
  mapUrl:
    'https://www.google.com/maps/search/?api=1&query=Unit%203%2C%20Treehouse%20Building%2C%20R.%20Aboitiz%20St.%20Camputhaw%2C%20Cebu%20City%2C%20Cebu',
  addressLine: 'Unit 3, Treehouse Building, R. Aboitiz St. Camputhaw, Cebu City, Cebu',
  hoursDisplay: 'Mon - Sat: 9:00 AM - 6:00 PM',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Unit 3, Treehouse Building, R. Aboitiz St. Camputhaw',
    addressLocality: 'Cebu City',
    addressRegion: 'Cebu',
    postalCode: '6000',
    addressCountry: 'PH',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 10.3124792,
    longitude: 123.8929501,
  },
  socialProfiles: [
    'https://web.facebook.com/geniephilippines',
    'https://www.instagram.com/genie.ph/',
    'https://www.tiktok.com/@genie.ph',
    'https://www.youtube.com/@genieph',
  ],
  trustLinks: {
    reviews: `${GENIE_BASE_URL}/reviews`,
    about: `${GENIE_BASE_URL}/about`,
    contact: `${GENIE_BASE_URL}/contact`,
    returnPolicy: `${GENIE_BASE_URL}/return-policy`,
    deliveryRates: `${GENIE_BASE_URL}/delivery-rates`,
    dtiProof:
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/DTI%20Alalai%20ITS.jpg',
    awardProof:
      'https://www.facebook.com/photo/?fbid=122301349718225955&set=pcb.122301048476225955',
    checkout: 'https://checkout.xendit.co/od/genieph',
  },
  serviceAreas: [
    'Cebu City',
    'Mandaue City',
    'Lapu-Lapu City',
    'Talisay City',
    'Consolacion',
    'Minglanilla',
    'Liloan',
  ],
  primaryServiceAreaLabel: 'Metro Cebu',
  services: [
    {
      slug: 'ai-cake-pricing',
      name: 'AI cake price estimates',
      description:
        'Upload a cake peg and get a fast starting price estimate based on size, design complexity, toppers, icing, and finish.',
    },
    {
      slug: 'custom-cake-ordering',
      name: 'Custom cake ordering',
      description:
        'Customize cake size, flavor, style, toppers, colors, and messages before checkout through Genie.ph.',
    },
    {
      slug: 'rush-and-same-day',
      name: 'Rush and same-day cake delivery',
      description:
        'Rush-friendly minimalist, bento, and simple celebration cakes can qualify for same-day delivery when production slots are still open.',
    },
    {
      slug: 'bento-and-minimalist',
      name: 'Bento and minimalist cakes',
      description:
        'Browse and order popular bento, minimalist, and doodle cake styles for birthdays, gifts, and last-minute celebrations.',
    },
    {
      slug: 'birthday-and-event-cakes',
      name: 'Birthday and event cakes',
      description:
        'Order custom cakes for birthdays, anniversaries, christenings, graduations, baby showers, and themed parties in Metro Cebu.',
    },
    {
      slug: 'wedding-and-milestone',
      name: 'Wedding and milestone cakes',
      description:
        'Plan more detailed celebration cakes for weddings, debuts, and milestone events with longer lead times and larger formats.',
    },
    {
      slug: 'edible-photo-prints',
      name: 'Edible photo and printed topper cakes',
      description:
        'Use edible photo prints or printed toppers for personalized gifts, themed cakes, and fast-turnaround celebration orders.',
    },
  ],
  trustHighlights: [
    'Verified customer reviews and order photos',
    'DTI registration and visible business permits',
    'Startup Innovation Summit award recognition in Mandaue City',
    'Secure online checkout and support contact details',
  ],
} as const

export type GenieServiceDefinition = (typeof genieBusinessProfile.services)[number]

export function buildGenieOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': genieBusinessProfile.organizationId,
    name: genieBusinessProfile.name,
    legalName: genieBusinessProfile.legalName,
    url: genieBusinessProfile.siteUrl,
    logo: genieBusinessProfile.logoUrl,
    image: genieBusinessProfile.heroImageUrl,
    description: genieBusinessProfile.description,
    email: genieBusinessProfile.supportEmail,
    telephone: genieBusinessProfile.phoneDisplay,
    sameAs: genieBusinessProfile.socialProfiles,
    address: genieBusinessProfile.address,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: genieBusinessProfile.phoneDisplay,
      email: genieBusinessProfile.supportEmail,
      contactType: 'customer service',
      areaServed: genieBusinessProfile.primaryServiceAreaLabel,
      availableLanguage: ['English', 'Filipino'],
    },
    areaServed: genieBusinessProfile.serviceAreas.map((area) => ({
      '@type': 'City',
      name: area,
    })),
    knowsAbout: genieBusinessProfile.services.map((service) => service.name),
  }
}

export function buildGenieWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': genieBusinessProfile.websiteId,
    name: genieBusinessProfile.name,
    url: genieBusinessProfile.siteUrl,
    description: genieBusinessProfile.shortDescription,
    publisher: {
      '@id': genieBusinessProfile.organizationId,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${genieBusinessProfile.siteUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildGenieLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${genieBusinessProfile.siteUrl}/contact#localbusiness`,
    name: genieBusinessProfile.name,
    url: genieBusinessProfile.siteUrl,
    description: genieBusinessProfile.shortDescription,
    image: genieBusinessProfile.ogImageUrl,
    logo: genieBusinessProfile.logoUrl,
    telephone: genieBusinessProfile.phoneDisplay,
    email: genieBusinessProfile.supportEmail,
    address: genieBusinessProfile.address,
    geo: genieBusinessProfile.geo,
    sameAs: genieBusinessProfile.socialProfiles,
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '09:00',
        closes: '18:00',
      },
    ],
    areaServed: genieBusinessProfile.serviceAreas.map((area) => ({
      '@type': 'City',
      name: area,
    })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Genie.ph cake services',
      itemListElement: genieBusinessProfile.services.map((service) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: service.name,
          description: service.description,
        },
      })),
    },
    parentOrganization: {
      '@id': genieBusinessProfile.organizationId,
    },
  }
}
