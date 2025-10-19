import React from 'react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { BackIcon } from '../../components/icons';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';

interface SearchingPageProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  searchQuery: string;
  error: string | null;
  isSearching: boolean;
  isLoading: boolean;
  onSearch: (query?: string) => void;
  onClose: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  originalImageData: { data: string; mimeType: string } | null;
  onUploadClick: () => void;
  // Add isProcessingImage prop
  isProcessingImage: boolean;
}

const SearchingPage: React.FC<SearchingPageProps> = ({
  searchInput,
  setSearchInput,
  searchQuery,
  error,
  isSearching,
  isLoading,
  onSearch,
  onClose,
  onKeyDown,
  onUploadClick,
  isProcessingImage,
}) => {
  return (
    <div className="w-full max-w-6xl mx-auto h-full flex flex-col">
      {/* Global CSS to hide Google CSE overlays and show pagination */}
      <style>{`
        #google-search-container .gs-image-box-popup,
        #google-search-container .gs-image-popup-box,
        #google-search-container .gs-title,
        #google-search-container .gs-bidi-start-align {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        /* Make pagination visible and styled */
        #google-search-container .gsc-cursor-box,
        #google-search-container .gsc-cursor,
        #google-search-container .gsc-cursor-page,
        #google-search-container .gsc-cursor-current-page {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }

        /* Style pagination for better visibility */
        #google-search-container .gsc-cursor-box {
          text-align: center !important;
          margin: 2rem 0 !important;
          padding: 1rem 0 !important;
        }

        #google-search-container .gsc-cursor-page {
          display: inline-block !important;
          padding: 0.5rem 0.75rem !important;
          margin: 0 0.25rem !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 0.5rem !important;
          background-color: white !important;
          color: #64748b !important;
          cursor: pointer !important;
          transition: all 0.2s !important;
        }

        #google-search-container .gsc-cursor-page:hover {
          background-color: #f8fafc !important;
          border-color: #cbd5e1 !important;
          color: #475569 !important;
        }

        #google-search-container .gsc-cursor-current-page {
          background: linear-gradient(to right, #ec4899, #a855f7) !important;
          color: white !important;
          border-color: #ec4899 !important;
          font-weight: 600 !important;
        }

        #google-search-container .gsc-cursor-current-page:hover {
          background: linear-gradient(to right, #db2777, #9333ea) !important;
          border-color: #db2777 !important;
        }
      `}</style>
      <div className="w-full flex items-center gap-2 md:gap-4 max-w-2xl mx-auto mb-6">
        <button
          onClick={onClose}
          className="p-2 text-slate-600 hover:text-purple-700 transition-colors flex-shrink-0"
          aria-label="Go back"
        >
          <BackIcon />
        </button>
        <div className="flex-grow">
          <SearchAutocomplete
            onSearch={(query) => {
              setSearchInput(query);
              onSearch(query);
            }}
            onUploadClick={onUploadClick}
            placeholder="Search for cake designs..."
          />
        </div>
      </div>
      <p className="text-center text-slate-500 mb-4">
        Search results for: <span className="font-semibold text-slate-700">"{searchQuery}"</span>
      </p>
      {error && (
        <div className="text-center p-4 my-4 bg-red-50 rounded-lg max-w-md mx-auto">
          <p className="font-semibold text-red-600">Error</p>
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}
      {isSearching && (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <LoadingSpinner />
          <p className="mt-4 text-slate-500">Searching for cakes...</p>
        </div>
      )}
      <div className="relative flex-grow">
        {/* Show processing overlay when an image is being handled */}
        {isProcessingImage && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center z-10 rounded-lg animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 border-2 border-purple-100">
              <LoadingSpinner />
              <p className="mt-6 text-slate-700 font-bold text-lg text-center">Loading Image...</p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse"></div>
                  <span>Fetching image from source</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <span>Processing for AI analysis</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  <span>Preparing customization</span>
                </div>
              </div>
              <p className="mt-6 text-slate-500 text-xs text-center">This usually takes 5-10 seconds</p>
            </div>
          </div>
        )}
        {isLoading && !isProcessingImage && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center z-10 rounded-lg animate-fade-in">
            <LoadingSpinner />
            <p className="mt-4 text-slate-600 font-semibold">Preparing Image for Analysis...</p>
          </div>
        )}
        <div id="google-search-container" className="flex-grow min-h-[400px]"></div>
      </div>
    </div>
  );
};

export default React.memo(SearchingPage);