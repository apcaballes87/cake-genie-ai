import { useEffect } from 'react';

interface SEOConfig {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  keywords?: string;
  author?: string;
  structuredData?: object;
}

/**
 * Hook to dynamically update SEO meta tags for better Google indexing
 * This is crucial for SPAs to have proper SEO on different routes
 */
export const useSEO = (config: SEOConfig) => {
  useEffect(() => {
    // Update document title
    document.title = config.title;

    // Helper function to update or create meta tag
    const updateMetaTag = (selector: string, content: string, attribute: 'name' | 'property' = 'name') => {
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, selector.replace(`[${attribute}="`, '').replace('"]', ''));
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Update basic meta tags
    updateMetaTag('[name="description"]', config.description);
    if (config.keywords) {
      updateMetaTag('[name="keywords"]', config.keywords);
    }
    if (config.author) {
      updateMetaTag('[name="author"]', config.author);
    }

    // Update Open Graph tags
    updateMetaTag('[property="og:title"]', config.title, 'property');
    updateMetaTag('[property="og:description"]', config.description, 'property');
    updateMetaTag('[property="og:type"]', config.type || 'website', 'property');

    if (config.url) {
      updateMetaTag('[property="og:url"]', config.url, 'property');

      // Update canonical URL
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = config.url;
    }

    if (config.image) {
      updateMetaTag('[property="og:image"]', config.image, 'property');
      updateMetaTag('[name="twitter:image"]', config.image);
    }

    // Update Twitter Card tags
    updateMetaTag('[name="twitter:title"]', config.title);
    updateMetaTag('[name="twitter:description"]', config.description);

    // Update structured data (JSON-LD)
    if (config.structuredData) {
      let script = document.querySelector('script[type="application/ld+json"][data-dynamic]');
      if (!script) {
        script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        script.setAttribute('data-dynamic', 'true');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(config.structuredData);
    }

    // Cleanup function to restore default values if needed
    return () => {
      // Optional: You can restore default meta tags here if needed
    };
  }, [config]);
};

/**
 * Generate structured data for a cake product
 */
export const generateCakeStructuredData = (design: {
  title: string;
  description: string;
  image: string;
  price: number;
  url: string;
  cakeType: string;
  cakeSize: string;
  availability: string;
}) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: design.title,
    description: design.description,
    image: design.image,
    offers: {
      '@type': 'Offer',
      price: design.price.toFixed(2),
      priceCurrency: 'PHP',
      availability: `https://schema.org/${design.availability === 'rush' ? 'InStock' : 'PreOrder'}`,
      url: design.url,
    },
    brand: {
      '@type': 'Brand',
      name: 'Genie.ph',
    },
    category: 'Custom Cakes',
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Cake Type',
        value: design.cakeType,
      },
      {
        '@type': 'PropertyValue',
        name: 'Size',
        value: design.cakeSize,
      },
    ],
  };
};
