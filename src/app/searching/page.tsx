import React from 'react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { BackIcon, SearchIcon, CameraIcon } from '../../components/icons';

interface SearchingPageProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  searchQuery: string;
  error: string | null;
  isSearching: boolean;
  isLoading: boolean;
  onSearch: () => void;
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
      <div className="w-full flex items-center gap-2 md:gap-4 max-w-2xl mx-auto mb-6">
        <button
          onClick={onClose}
          className="p-2 text-slate-600 hover:text-purple-700 transition-colors flex-shrink-0"
          aria-label="Go back"
        >
          <BackIcon />
        </button>
        <div className="relative flex-grow">
          <input
            type="text"
            className="w-full pl-5 pr-28 py-3 text-base border-slate-200 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
            placeholder="Search for cake designs..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            <button
                type="button"
                onClick={onUploadClick}
                className="p-3 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-100 transition-colors"
                aria-label="Upload an image"
            >
                <CameraIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onSearch}
              className="p-3 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-100 transition-colors"
              aria-label="Search"
            >
              <SearchIcon />
            </button>
          </div>
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