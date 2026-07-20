import { genieBusinessProfile } from './genieBusinessProfile';

export function buildFAQPageSchema(faqs: { question: string; answer: string }[], pageUrl: string) {
  if (!faqs || faqs.length === 0) return null;

  const sanitize = (str: string) => str.replace(/<\/script/gi, '<\\/script');

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faqpage`,
    mainEntity: faqs.map((faq, index) => ({
      '@type': 'Question',
      '@id': `${pageUrl}#faq-${index + 1}`,
      name: sanitize(faq.question),
      acceptedAnswer: {
        '@type': 'Answer',
        '@id': `${pageUrl}#faq-${index + 1}-answer`,
        text: sanitize(faq.answer),
      },
    })),
  };
}

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': genieBusinessProfile.organizationId,
    name: genieBusinessProfile.name,
    legalName: genieBusinessProfile.legalName,
    url: genieBusinessProfile.siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: genieBusinessProfile.logoUrl,
      width: 600,
      height: 60,
    },
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
  };
}

export function buildWebsiteSchema() {
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
  };
}

export function buildLocalBusinessSchema() {
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
  };
}

export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
