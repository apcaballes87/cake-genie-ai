import { useEffect } from 'react';

/**
 * Hook to manage canonical URL meta tag in the document head
 * Helps prevent duplicate content issues in SEO
 * 
 * @param path - The canonical path for this page (without hash)
 * @example
 * useCanonicalUrl('/about') // Sets canonical to https://genie.ph/about
 */
export const useCanonicalUrl = (path: string) => {
  useEffect(() => {
    const canonicalUrl = `https://genie.ph${path}`;
    
    // Remove existing canonical tag if any
    const existingCanonical = document.querySelector('link[rel="canonical"]');
    if (existingCanonical) {
      existingCanonical.remove();
    }

    // Create and add new canonical tag
    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = canonicalUrl;
    document.head.appendChild(link);

    // Cleanup on unmount
    return () => {
      const canonical = document.querySelector(`link[rel="canonical"][href="${canonicalUrl}"]`);
      if (canonical) {
        canonical.remove();
      }
    };
  }, [path]);
};
