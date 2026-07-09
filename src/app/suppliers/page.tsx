import { buildMarketingPageMetadata } from '@/lib/utils/metadata';
import SuppliersDirectoryClient from './SuppliersDirectoryClient';
import { createClient } from '@supabase/supabase-js';
import type { Supplier } from './SuppliersDirectoryClient';

export const metadata = buildMarketingPageMetadata({
  title: 'Metro Cebu Party & Event Suppliers Directory',
  description: "Browse Cebu's premier event coordinators, planners, wedding hosts, stylists, mobile coffee carts, and party rentals in our Metro Cebu directory.",
  canonicalPath: 'https://genie.ph/suppliers',
});

type SupplierSignupRow = {
  id: string;
  created_at: string;
  name: string;
  contact_number: string;
  business_name: string;
  description: string;
  business_type: string;
  facebook_page_url: string | null;
  website_url: string | null;
  extra_link_url: string | null;
  image_url: string | null;
}

const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  cakes: 'Cakes & Desserts',
  photo_video: 'Photo & Video',
  catering: 'Catering',
  hosting: 'Host / Emcee',
  band_music: 'Band / DJ / Music',
  coordinator: 'Event Coordinator / Planner',
  styling_decor: 'Styling & Decor',
  flowers: 'Flowers & Bouquets',
  lights_sounds: 'Lights & Sounds',
  venue: 'Venue / Event Space',
  rentals: 'Tables, Chairs & Party Rentals',
  mobile_bar: 'Mobile Bar / Coffee Cart',
  entertainment: 'Magician / Performer / Entertainment',
  hair_makeup: 'Hair & Makeup',
  invites_souvenirs: 'Invitations, Giveaways & Souvenirs',
  transportation: 'Transport / Bridal Car',
  other: 'Other Event Service',
};

function buildContactUrl(row: SupplierSignupRow): string {
  return row.facebook_page_url || row.website_url || row.extra_link_url || `tel:${row.contact_number.replace(/[^\d+]/g, '')}`;
}

function mapSignupToSupplier(row: SupplierSignupRow): Supplier {
  const categoryLabel = SUPPLIER_TYPE_LABELS[row.business_type] || 'Event Supplier';

  return {
    id: row.id,
    name: row.business_name,
    ownerName: row.name,
    category: row.business_type,
    categoryLabel,
    tagline: categoryLabel,
    description: row.description,
    contactNumber: row.contact_number,
    contactUrl: buildContactUrl(row),
    facebookPageUrl: row.facebook_page_url,
    websiteUrl: row.website_url,
    extraLinkUrl: row.extra_link_url,
    imageUrl: row.image_url || 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/genie-logo-header-360.webp',
    listedAt: row.created_at,
  };
}

async function getSignupSuppliers(): Promise<Supplier[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[suppliers] Missing Supabase env vars for supplier directory fetch.');
    return [];
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase
    .from('cakegenie_supplier_signups')
    .select('id, created_at, name, contact_number, business_name, description, business_type, facebook_page_url, website_url, extra_link_url, image_url')
    .in('status', ['new', 'reviewing', 'approved'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[suppliers] Failed to fetch supplier signups:', error);
    return [];
  }

  return (data || []).map((row) => mapSignupToSupplier(row as SupplierSignupRow));
}

function SuppliersSchema({ suppliers }: { suppliers: Supplier[] }) {
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
        'numberOfItems': suppliers.length,
        'itemListElement': suppliers.map((supplier, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'LocalBusiness',
            name: supplier.name,
            image: supplier.imageUrl,
            description: supplier.description,
            category: supplier.categoryLabel,
            telephone: supplier.contactNumber,
            url: supplier.websiteUrl || supplier.facebookPageUrl || supplier.extraLinkUrl || 'https://genie.ph/suppliers',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'Cebu City',
              addressRegion: 'Cebu',
              addressCountry: 'PH',
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

export default async function SuppliersPage() {
  const suppliers = await getSignupSuppliers();

  return (
    <>
      <SuppliersSchema suppliers={suppliers} />
      <SuppliersDirectoryClient suppliers={suppliers} />
    </>
  );
}
