import { describe, expect, it } from 'vitest';
import { buildMarketingPageMetadata, buildNoIndexPageMetadata } from './metadata';

const DEFAULT_SOCIAL_IMAGE_URL =
  'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/pages/CUSTOM-CAKES-FOR-RUSH-ORDERS.WEBP';

describe('metadata helpers', () => {
  it('builds page-specific canonical, Open Graph, and Twitter metadata', () => {
    const metadata = buildMarketingPageMetadata({
      title: 'About the Marketplace and Team',
      description: 'Learn about Genie.ph and its Cebu cake marketplace.',
      canonicalPath: 'https://genie.ph/about',
    });

    expect(metadata.title).toEqual({ absolute: 'About the Marketplace and Team | Genie.ph' });
    expect(metadata.alternates?.canonical).toBe('https://genie.ph/about');
    expect(metadata.openGraph).toMatchObject({
      url: 'https://genie.ph/about',
      title: 'About the Marketplace and Team | Genie.ph',
      description: 'Learn about Genie.ph and its Cebu cake marketplace.',
      siteName: 'Genie.ph',
      images: [
        {
          url: DEFAULT_SOCIAL_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: 'Genie.ph - Custom Cakes Online',
        },
      ],
    });
    expect(metadata.twitter).toMatchObject({
      title: 'About the Marketplace and Team | Genie.ph',
      description: 'Learn about Genie.ph and its Cebu cake marketplace.',
      images: [
        {
          url: DEFAULT_SOCIAL_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: 'Genie.ph - Custom Cakes Online',
        },
      ],
    });
  });

  it('supports per-page social preview image overrides', () => {
    const metadata = buildMarketingPageMetadata({
      title: 'Best Cake Shops in Cebu',
      description: 'Compare Cebu cake shops for birthdays, weddings, and rush orders.',
      canonicalPath: 'https://genie.ph/best-cake-shops-cebu',
      socialImage: {
        url: 'https://example.com/cebu-hero.webp',
        width: 1800,
        height: 1100,
        alt: 'Top cake shops in Cebu hero image',
      },
    });

    expect(metadata.openGraph).toMatchObject({
      images: [
        {
          url: 'https://example.com/cebu-hero.webp',
          width: 1800,
          height: 1100,
          alt: 'Top cake shops in Cebu hero image',
        },
      ],
    });
    expect(metadata.twitter).toMatchObject({
      images: [
        {
          url: 'https://example.com/cebu-hero.webp',
          width: 1800,
          height: 1100,
          alt: 'Top cake shops in Cebu hero image',
        },
      ],
    });
  });

  it('builds noindex metadata without canonical leakage', () => {
    const metadata = buildNoIndexPageMetadata({
      title: 'Page Not Found',
      description: 'The page you are looking for does not exist.',
    });

    expect(metadata.title).toEqual({ absolute: 'Page Not Found | Genie.ph' });
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toMatchObject({
      title: 'Page Not Found | Genie.ph',
      description: 'The page you are looking for does not exist.',
      images: [
        {
          url: DEFAULT_SOCIAL_IMAGE_URL,
        },
      ],
    });
    expect(metadata.twitter).toMatchObject({
      images: [
        {
          url: DEFAULT_SOCIAL_IMAGE_URL,
        },
      ],
    });
  });

  it('supports noindex pages that should still pass link equity', () => {
    const metadata = buildNoIndexPageMetadata({
      title: 'Search Cake Designs',
      description: 'Browse search results for custom cake designs.',
      follow: true,
    });

    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    });
  });
});
