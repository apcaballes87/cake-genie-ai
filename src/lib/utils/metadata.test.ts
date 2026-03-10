import { describe, expect, it } from 'vitest';
import { buildMarketingPageMetadata, buildNoIndexPageMetadata } from './metadata';

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
    });
    expect(metadata.twitter).toMatchObject({
      title: 'About the Marketplace and Team | Genie.ph',
      description: 'Learn about Genie.ph and its Cebu cake marketplace.',
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