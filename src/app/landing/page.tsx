import React from 'react';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';

type AppState = 'landing' | 'searching' | 'customizing' | 'cart' | 'auth' | 'addresses' | 'orders' | 'checkout' | 'order_confirmation' | 'shared_design' | 'about' | 'how_to_order' | 'contact' | 'reviews';

interface LandingPageProps {
  onSearch: (query: string) => void;
  onUploadClick: () => void;
  setAppState: (state: AppState) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({
  onSearch,
  onUploadClick,
  setAppState,
}) => {
  return (
    <div className="flex flex-col items-center justify-between h-full w-full overflow-hidden">
      <div className="text-center w-full max-w-2xl mx-auto flex flex-col items-center flex-1 justify-center -translate-y-[60px]">
        <img 
            src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20face%20logo.webp" 
            alt="Genie Logo"
            className="w-36 h-36 -mb-4 object-contain"
        />
        <div className="relative inline-block">
          <h1 className="text-7xl md:text-7xl font-extrabold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">
            Genie
          </h1>
          <span className="absolute top-0 -right-5 transform -translate-y-1/2 translate-x-1/2 rotate-12 bg-yellow-300 text-yellow-800 text-xs font-bold px-2.5 py-1 rounded-full shadow-md">ALPHA</span>
        </div>
        <p className="text-slate-600 mb-6 text-sm">Your Cake Wish, Granted.</p>
        
        <div className="w-full">
            <SearchAutocomplete 
              onSearch={onSearch}
              onUploadClick={onUploadClick}
              placeholder="Search for a design or upload an image" 
            />
        </div>
        
        <p className="text-slate-500 text-sm mt-8">Upload or search any cake design, customize your cake and get instant pricing.</p>
      </div>
      <footer className="p-4 bg-transparent text-center">
        <div className="flex justify-center items-center gap-4 text-sm text-slate-500">
            <button onClick={() => setAppState('about')} className="hover:text-pink-600 transition-colors">About Us</button>
            <button onClick={() => setAppState('how_to_order')} className="hover:text-pink-600 transition-colors">How to Order</button>
            <button onClick={() => setAppState('contact')} className="hover:text-pink-600 transition-colors">Contact Us</button>
            <button onClick={() => setAppState('reviews')} className="hover:text-pink-600 transition-colors">Reviews</button>
        </div>
      </footer>
    </div>
  );
};

export default React.memo(LandingPage);