import { Metadata } from 'next';
import LandingClient from './LandingClient';
import { getRecommendedProducts, getMerchants } from '@/services/supabaseService';
import { MerchantShowcase, RecommendedProductsSection } from '@/components/landing';

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
};

function WebSiteSchema() {
  const schema = {
    '@context': 'https://schema.org',
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
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default async function Home() {
  const [recommendedProductsRes, merchantsRes] = await Promise.all([
    getRecommendedProducts(8, 0).catch(err => ({ data: [], error: err })),
    getMerchants().catch(err => ({ data: [], error: err }))
  ]);

  const recommendedProducts = recommendedProductsRes.data || [];
  const merchants = merchantsRes.data || [];

  return (
    <>
      <WebSiteSchema />
      <LandingClient>
        {/* Server-rendered sections for LCP optimization */}
        <MerchantShowcase merchants={merchants} />
        <RecommendedProductsSection products={recommendedProducts} />
      </LandingClient>
    </>
  );
}

