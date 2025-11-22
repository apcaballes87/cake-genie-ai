import { useEffect } from 'react';

export const useSEO = (title: string, description: string) => {
  useEffect(() => {
    // Update Title
    document.title = title;
    
    // Update Meta Description
    let metaDescription = document.querySelector("meta[name='description']");
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', description);

    // Update Open Graph Tags if they exist (from index.html structure)
    const ogTitle = document.querySelector("meta[property='og:title']");
    if (ogTitle) ogTitle.setAttribute('content', title);

    const ogDescription = document.querySelector("meta[property='og:description']");
    if (ogDescription) ogDescription.setAttribute('content', description);

    // Update Twitter Tags if they exist
    const twitterTitle = document.querySelector("meta[name='twitter:title']");
    if (twitterTitle) twitterTitle.setAttribute('content', title);

    const twitterDescription = document.querySelector("meta[name='twitter:description']");
    if (twitterDescription) twitterDescription.setAttribute('content', description);

  }, [title, description]);
};
