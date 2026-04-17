import { buildMarketingPageMetadata } from '@/lib/utils/metadata';
import { LocalSeoLandingPage } from '@/components/local-seo/LocalSeoLandingPage';
import { CEBU_LANDING_PAGES } from '@/components/local-seo/cebuLandingData';

export const revalidate = 3600;

const config = CEBU_LANDING_PAGES['cake-delivery-cebu-city'];

export const metadata = buildMarketingPageMetadata({
  title: config.metadataTitle,
  description: config.metaDescription,
  canonicalPath: `https://genie.ph/${config.slug}`,
});

export default function CakeDeliveryCebuCityPage() {
  return <LocalSeoLandingPage config={config} />;
}
