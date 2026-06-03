import { Suspense } from 'react';
import { buildMarketingPageMetadata } from '@/lib/utils/metadata';
import LandingClient from '@/app/LandingClient';
import { RecommendedProductsSection } from '@/components/landing';
import { KidsIntroContent } from '@/components/landing/KidsIntroContent';
import { LandingFooter } from '@/components/landing/LandingFooter';
import NewsletterPopup from '@/components/NewsletterPopup';
import { getRecommendedProducts, type RecommendedProductsQueryOptions } from '@/services/supabaseService';
import { createClient } from '@/lib/supabase/server';
import { buildReviewSummary, normalizePublicReviews, REVIEW_SELECT } from '@/lib/reviews';

export const revalidate = 3600;

export const metadata = buildMarketingPageMetadata({
  title: 'Kids Party Cakes Cebu | Themed Birthday Cakes for Kids in Cebu',
  description: 'Order kids party cakes in Cebu with themed birthday cake ideas, clear starting-price guidance, and easy customization. Genie.ph helps parents order character and themed cakes across Metro Cebu.',
  canonicalPath: 'https://genie.ph/kids-party-cakes-cebu',
});

const KIDS_PARTY_PRODUCT_QUERY: RecommendedProductsQueryOptions = {
  keywords: ['character', 'dinosaur', 'princess', 'superhero', 'cocomelon', 'kids', 'toy', 'boy', 'girl'],
};

interface KidsProduct {
  p_hash: string;
  original_image_url: string;
  price: number;
  keywords?: string;
  slug?: string;
  availability?: string;
  image_width?: number | null;
  image_height?: number | null;
}

function buildKidsHeroContent(products: KidsProduct[]) {
  const defaultProducts = [
    {
      title: 'Dinosaur Cakes',
      image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/analysis-cache/dinosaur-cake-9dc3072741010707.webp',
      headlineVariant: 1,
    },
    {
      title: 'Princess Cakes',
      image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/analysis-cache/disney-princess-cake-ffc3032333dfe77b.webp',
      headlineVariant: 2,
    },
    {
      title: 'Superhero Cakes',
      image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/analysis-cache/avengers-superhero-yellow-1-tier-cake-ffcb.webp',
      headlineVariant: 3,
    },
    {
      title: 'Toy Story Cakes',
      image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/analysis-cache/toy-story-sky-blue-1-tier-cake-3eff.webp',
      headlineVariant: 4,
    },
    {
      title: 'Cocomelon Cakes',
      image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/customizations/cocomelon-teal-1-tier-cake-be51.webp',
      headlineVariant: 5,
    },
    {
      title: 'Cartoon Cakes',
      image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/customizations/cartoon-dolphin-sky-blue-1-tier-cake-c3c7.webp',
      headlineVariant: 6,
    },
  ];

  const heroProducts = [...defaultProducts];
  const categories = [
    { name: 'dinosaur', variant: 1 },
    { name: 'princess', variant: 2 },
    { name: 'superhero', variant: 3 },
    { name: 'toy story', variant: 4 },
    { name: 'cocomelon', variant: 5 },
    { name: 'cartoon', variant: 6 },
  ];

  categories.forEach((cat, index) => {
    const match = products.find((p) => {
      const searchStr = ((p.keywords || '') + ' ' + (p.slug || '')).toLowerCase();
      return searchStr.includes(cat.name);
    });
    if (match) {
      heroProducts[index] = {
        title: match.keywords?.split(',')[0]?.trim() || heroProducts[index].title,
        image: match.original_image_url,
        headlineVariant: cat.variant,
      };
    }
  });

  return {
    eyebrow: 'Themed Kids Birthday Cakes in Cebu',
    headlineVariants: [
      'Custom Cakes',
      'Dinosaur Cakes',
      'Princess Cakes',
      'Superhero Cakes',
      'Toy Story Cakes',
      'Cocomelon Cakes',
      'Cartoon Cakes',
    ],
    headlineA11yLabel: 'Custom Cakes, Dinosaur Cakes, Princess Cakes, Superhero Cakes, Toy Story Cakes, Cocomelon Cakes, and Cartoon Cakes.',
    lineTwo: 'For Kids',
    lineThree: 'Party Fun',
    products: heroProducts,
  };
}

async function getKidsPartyProducts(limit: number = 8): Promise<KidsProduct[]> {
  const response = await getRecommendedProducts(80, 0, KIDS_PARTY_PRODUCT_QUERY);
  const candidates = (response.data || []) as KidsProduct[];
  return candidates.slice(0, limit);
}

async function getReviewSummaryData() {
  const supabase = await createClient();

  const [reviewRowsRes, ratingRowsRes] = await Promise.all([
    supabase
      .from('cakegenie_reviews')
      .select(REVIEW_SELECT)
      .eq('is_visible', true)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('cakegenie_reviews')
      .select('rating')
      .eq('is_visible', true)
      .eq('is_approved', true),
  ]);

  const reviews = normalizePublicReviews(reviewRowsRes.data);
  const reviewSummary = buildReviewSummary(ratingRowsRes.data);

  return {
    reviews,
    reviewSummary,
  };
}

function KidsPartySchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Kids Party Cakes Cebu | Themed Birthday Cakes for Kids in Cebu',
        description: 'Order kids party cakes in Cebu with themed birthday cake ideas, clear starting-price guidance, and easy customization. Genie.ph helps parents order character and themed cakes across Metro Cebu.',
        url: 'https://genie.ph/kids-party-cakes-cebu',
        isPartOf: {
          '@type': 'WebSite',
          name: 'Genie.ph',
          url: 'https://genie.ph',
        },
      },
      {
        '@type': 'CollectionPage',
        name: 'Kids Party Cakes',
        description: 'Shop kids party cakes and themed birthday cakes in Cebu including princess, dinosaur, and superhero custom cakes.',
        url: 'https://genie.ph/kids-party-cakes-cebu',
        hasPart: [
          {
            '@type': 'CreativeWork',
            name: 'Dinosaur Cakes',
            url: 'https://genie.ph/search?q=dinosaur%20cake',
          },
          {
            '@type': 'CreativeWork',
            name: 'Princess Cakes',
            url: 'https://genie.ph/search?q=princess%20cake',
          },
          {
            '@type': 'CreativeWork',
            name: 'Superhero Cakes',
            url: 'https://genie.ph/search?q=superhero%20cake',
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://genie.ph',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Kids Party Cakes Cebu',
            item: 'https://genie.ph/kids-party-cakes-cebu',
          },
        ],
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

export default async function KidsPartyCakesCebuPage() {
  const [recommendedProducts, reviewData] = await Promise.all([
    getKidsPartyProducts(8).catch(() => []),
    getReviewSummaryData().catch(() => ({
      reviews: [],
      reviewSummary: { total: 0, averageRating: 0 },
    })),
  ]);

  const heroContent = buildKidsHeroContent(recommendedProducts);

  return (
    <>
      <KidsPartySchema />
      <LandingClient heroContent={heroContent} reviewSummary={reviewData.reviewSummary}>
        <RecommendedProductsSection
          products={recommendedProducts}
          headingHighlight="Kids Birthday Picks:"
          headingText="Real themed cakes kids love"
          description="Compare and customize real character, dinosaur, and princess cake designs ordered by parents in Cebu."
          listName="kids_recommended"
          emptyStateText="No kids party cakes found at the moment."
          loadMoreEnabled={false}
        />
        <KidsIntroContent />
      </LandingClient>
      <NewsletterPopup />
      <LandingFooter reviewSummary={reviewData.reviewSummary} />
    </>
  );
}
