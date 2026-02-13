import { Metadata } from 'next';
import LandingClient from './LandingClient';
import { getRecommendedProducts } from '@/services/supabaseService';
import { RecommendedProductsSection, IntroContent } from '@/components/landing';

// ISR: Revalidate every hour for fresh data while maintaining fast loads
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu!',
  description: 'Upload any cake design, customize with AI and get instant pricing from the best cakeshops and homebakers here in Cebu.',
  openGraph: {
    title: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu!',
    description: 'Upload any cake design, customize with AI and get instant pricing from the best cakeshops and homebakers here in Cebu.',
    images: ['https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta%20GENIE.jpg'],
    url: 'https://genie.ph/',
    type: 'website',
  },
  alternates: {
    canonical: 'https://genie.ph',
  },
};

function WebSiteSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'Genie.ph',
        url: 'https://genie.ph',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://genie.ph/search?q={search_term_string}'
          },
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@type': 'CollectionPage',
        name: 'Online Marketplace for Custom Cakes in Cebu',
        description: 'Browse customizable cakes from top local bakers in Cebu. Get instant pricing and order online.',
        url: 'https://genie.ph',
        hasPart: [
          {
            '@type': 'CreativeWork',
            name: 'Minimalist Cakes',
            url: 'https://genie.ph/search?q=minimalist+cakes'
          },
          {
            '@type': 'CreativeWork',
            name: 'Bento Cakes',
            url: 'https://genie.ph/search?q=bento+cakes'
          },
          {
            '@type': 'CreativeWork',
            name: 'Wedding Cakes',
            url: 'https://genie.ph/search?q=wedding'
          }
        ]
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default async function Home() {
  const recommendedProductsRes = await getRecommendedProducts(8, 0).catch(err => ({ data: [], error: err }));

  const recommendedProducts = recommendedProductsRes.data || [];

  return (
    <>
      <WebSiteSchema />
      <LandingClient>
        {/* Server-rendered sections for LCP optimization */}
        {/* <MerchantShowcase merchants={merchants} /> - Hidden for now */}
        <RecommendedProductsSection products={recommendedProducts} />
        <IntroContent />
      </LandingClient>
    </>
  );
}

