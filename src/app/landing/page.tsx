

import React, { useState, useEffect } from 'react';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';
import LazyImage from '../../components/LazyImage';
import { useCanonicalUrl } from '../../hooks';
import { useSEO } from '../../hooks/useSEO';

type AppState = 'landing' | 'searching' | 'customizing' | 'cart' | 'auth' | 'addresses' | 'orders' | 'checkout' | 'order_confirmation' | 'shared_design' | 'about' | 'how_to_order' | 'contact' | 'reviews' | 'pricing_sandbox';

interface LandingPageProps {
  onSearch: (query: string) => void;
  onUploadClick: () => void;
  setAppState: (state: AppState) => void;
  user: { email?: string } | null;
}

const quickLinks = [
  {
    name: 'Minimalist Cakes',
    imageUrls: [
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist1.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist2.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist3.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist5.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist6.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist7.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist8.jpg'
    ],
    searchTerm: 'minimalist cakes'
  },
  {
    name: 'Edible Photo',
    imageUrls: [
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/ep1.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/ep2.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/ep3.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/ep4.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/ep5.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/ep6.jpg'
    ],
    searchTerm: 'edible photo cakes'
  },
  {
    name: 'Bento Cakes',
    imageUrls: [
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/BENTO1.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/bento2.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/bento3.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/bento4.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/bento5.jpg',
      'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/bento6.jpg'
    ],
    searchTerm: 'bento cakes'
  }
];

const LandingPage: React.FC<LandingPageProps> = ({
  onSearch,
  onUploadClick,
  setAppState,
  user,
}) => {
  // Add canonical URL for SEO
  useCanonicalUrl('/');

  useSEO({
    title: 'Genie.ph | Rush order custom cakes in Cebu!',
    description: 'Find any cake design, customize it with AI, and get instant pricing. Create your dream cake with Genie.ph\'s AI-powered platform.',
    image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta%20GENIE.jpg',
    url: 'https://genie.ph/',
    type: 'website',
    keywords: 'cake design, AI cake customization, custom cakes, cake pricing, birthday cakes, wedding cakes, Cebu cakes, rush order cakes',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Genie.ph",
      "url": "https://genie.ph",
      "logo": "https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20face%20logo.webp",
      "description": "Rush Order Custom Cakes in Cebu!",
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+63-908-940-8747",
        "contactType": "Customer Service"
      },
      "sameAs": [
        "https://www.facebook.com/genieph",
        "https://www.instagram.com/genieph"
      ]
    }
  });

  const [localSearchInput, setLocalSearchInput] = React.useState('');
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setImageIndex(prevIndex => prevIndex + 1); // Cycle through images
    }, 2000); // Change image every 2 seconds

    return () => clearInterval(interval); // Cleanup on component unmount
  }, []);

  return (
    <div className="flex flex-col items-center justify-between h-full w-full">
      <div className="text-center w-full max-w-2xl mx-auto flex flex-col items-center flex-1 justify-center transform sm:translate-y-0 translate-y-[15px]">
        <div className="relative inline-block">
          <img src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20logo%20long2.webp" alt="Genie Logo" className="w-[264px] h-[264px] -mt-5 -mb-8 object-contain" />
          <div className="absolute top-[70px] right-[-35px] bg-gradient-to-br from-purple-300 to-purple-500 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-lg transform rotate-12 border-2 border-white">
            BETA
          </div>
        </div>

        <div className="w-full -mt-5">
          <SearchAutocomplete
            onSearch={onSearch}
            onUploadClick={onUploadClick}
            placeholder="Search for a design or upload an image"
            value={localSearchInput}
            onChange={setLocalSearchInput}
          />
        </div>

        <p className="text-slate-500 text-sm mt-4">Upload or search any cake design, customize your cake and get instant pricing.</p>

        <div className="mt-8 w-full">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">
            Available Cakes For Today
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-4 sm:gap-6">
            {quickLinks.map((link) => {
              const currentImageUrl = link.imageUrls[imageIndex % link.imageUrls.length];
              return (
                <button
                  key={link.name}
                  onClick={() => onSearch(link.searchTerm)}
                  className="group text-center focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 rounded-lg"
                >
                  <div className="aspect-square bg-white rounded-lg overflow-hidden border border-slate-200 shadow-md group-hover:shadow-xl transition-all duration-300 transform scale-90 group-hover:scale-95">
                    <LazyImage
                      key={link.name}
                      src={currentImageUrl}
                      alt={link.name}
                      className="w-full h-full object-cover"
                      eager={true}
                      preventFlickerOnUpdate={true}
                    />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-700 group-hover:text-pink-600 transition-colors">
                    {link.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <footer className="p-4 bg-transparent text-center">
        <div className="flex justify-center items-center gap-4 text-sm text-slate-500">
          <button onClick={() => setAppState('about')} className="hover:text-pink-600 transition-colors">About Us</button>
          <button onClick={() => setAppState('how_to_order')} className="hover:text-pink-600 transition-colors">How to Order</button>
          <button onClick={() => setAppState('contact')} className="hover:text-pink-600 transition-colors">Contact Us</button>
          <button onClick={() => setAppState('reviews')} className="hover:text-pink-600 transition-colors">Reviews</button>
          {user && user.email === 'apcaballes@gmail.com' && (
            <button onClick={() => setAppState('pricing_sandbox')} className="hover:text-pink-600 transition-colors">Pricing Sandbox</button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default React.memo(LandingPage);