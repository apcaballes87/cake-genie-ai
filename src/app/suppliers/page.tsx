import { buildMarketingPageMetadata } from '@/lib/utils/metadata';
import SuppliersDirectoryClient from './SuppliersDirectoryClient';
import { SUPPLIERS_DATA, SUPPLIER_CATEGORIES } from '@/data/suppliersData';

export const metadata = buildMarketingPageMetadata({
  title: 'Metro Cebu Party & Event Suppliers Directory',
  description: "Browse Cebu's premier event coordinators, planners, wedding hosts, stylists, mobile coffee carts, and party rentals in our Metro Cebu directory.",
  canonicalPath: 'https://genie.ph/suppliers',
});

function SuppliersSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': 'https://genie.ph/suppliers#webpage',
        name: 'Metro Cebu Party & Event Suppliers Directory',
        description: 'Browse the ultimate directory of local party and event suppliers in Metro Cebu. Find coordinators, decorators, hosts, mobile coffee carts, sound systems, and more.',
        url: 'https://genie.ph/suppliers',
        isPartOf: {
          '@type': 'WebSite',
          name: 'Genie.ph',
          url: 'https://genie.ph',
        },
      },
      {
        '@type': 'CollectionPage',
        '@id': 'https://genie.ph/suppliers#collection',
        name: 'Metro Cebu Party & Event Suppliers',
        description: 'Directory of event and party service providers within Metro Cebu including planners, emcees, photographers, caterers, and rentals.',
        url: 'https://genie.ph/suppliers',
        hasPart: [
          {
            '@type': 'CreativeWork',
            name: 'Event Stylists & Decorators Cebu',
            url: 'https://genie.ph/suppliers?category=stylists',
          },
          {
            '@type': 'CreativeWork',
            name: 'Wedding & Debut Coordinators Cebu',
            url: 'https://genie.ph/suppliers?category=coordinators',
          },
          {
            '@type': 'CreativeWork',
            name: 'Event Hosts & Emcees Cebu',
            url: 'https://genie.ph/suppliers?category=hosts',
          },
          {
            '@type': 'CreativeWork',
            name: 'Mobile Coffee & Bars Cebu',
            url: 'https://genie.ph/suppliers?category=coffeebars',
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://genie.ph',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Suppliers Directory',
            item: 'https://genie.ph/suppliers',
          },
        ],
      },
      {
        '@type': 'ItemList',
        'numberOfItems': SUPPLIERS_DATA.length,
        'itemListElement': SUPPLIERS_DATA.map((supplier, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'LocalBusiness',
            name: supplier.name,
            image: supplier.imageUrl,
            description: supplier.description,
            category: SUPPLIER_CATEGORIES[supplier.category as keyof typeof SUPPLIER_CATEGORIES],
            priceRange: supplier.priceRange === 'Premium' ? '$$$' : supplier.priceRange === 'Mid-range' ? '$$' : '$',
            telephone: '+63 908 940 8747',
            address: {
              '@type': 'PostalAddress',
              addressLocality: supplier.locationsCovered[0] || 'Cebu City',
              addressRegion: 'Cebu',
              addressCountry: 'PH',
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: supplier.rating,
              reviewCount: supplier.reviewCount,
              bestRating: 5,
              worstRating: 1,
            },
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
    />
  );
}

export default function SuppliersPage() {
  return (
    <>
      <SuppliersSchema />
      <SuppliersDirectoryClient />
    </>
  );
}
