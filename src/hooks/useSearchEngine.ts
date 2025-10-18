import React, { useState, useRef, useEffect, useCallback } from 'react';
import { trackSearchTerm } from '../services/supabaseService';

// Global window type extension from App.tsx
declare global {
  interface Window {
    __gcse?: {
      parsetags: string;
      callback: () => void;
    };
    google?: any;
  }
}

interface UseSearchEngineProps {
  appState: string;
  setAppState: (state: any) => void; // Using 'any' as AppState type is not exported
  handleImageUpload: (file: File) => Promise<any>;
  setImageError: (error: string | null) => void;
  originalImageData: { data: string; mimeType: string } | null;
}

export const useSearchEngine = ({
  appState,
  setAppState,
  handleImageUpload,
  setImageError,
  originalImageData
}: UseSearchEngineProps) => {
  const [isSearching, setIsSearching] = useState(false);
  const [isCSELoaded, setIsCSELoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const cseElementRef = useRef<any>(null);

  const handleImageFromUrl = useCallback(async (imageUrl: string, clickedElement: HTMLElement) => {
    document.querySelectorAll('#google-search-container img').forEach(img => ((img as HTMLElement).style.border = 'none'));
    clickedElement.style.border = '3px solid #EC4899';
    clickedElement.style.opacity = '0.7';

    try {
      // Use a CORS proxy to fetch the image data and avoid browser restrictions.
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      const response = await fetch(`${proxyUrl}${encodeURIComponent(imageUrl)}`);
      
      if (!response.ok) {
        // If the proxy fails, it might return an error status.
        throw new Error(`Failed to fetch image via proxy. Status: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Some proxies return an HTML error page with a 200 status. Check the content type.
      if (blob.type.startsWith('text/')) {
        throw new Error('The image source or proxy returned an error page.');
      }

      const file = new File([blob], 'cake-design.webp', { type: blob.type || 'image/webp' });
      await handleImageUpload(file);

    } catch (err) {
      console.error("Image fetch error:", err);
      // Update the error message to be more helpful.
      setImageError("Could not load image. It may be protected. Tip: Try saving it to your device and using the 'Upload' button.");
      clickedElement.style.border = '3px solid #EF4444';
      setAppState('searching');
    }
  }, [handleImageUpload, setImageError, setAppState]);
  
  const handleSearch = useCallback((query?: string) => {
      const searchQueryValue = typeof query === 'string' ? query.trim() : searchInput.trim();
      if (!searchQueryValue) return;
      trackSearchTerm(searchQueryValue).catch(console.error);
      if (typeof query === 'string') setSearchInput(searchQueryValue);
      setIsSearching(true);
      setImageError(null);
      setAppState('searching');
      setSearchQuery(searchQueryValue);
  }, [searchInput, setImageError, setAppState]);

  // FIX: Added React to import to make React.KeyboardEvent available.
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { if (searchInput.trim()) handleSearch(searchInput.trim()); }
    if (e.key === 'Escape' && appState === 'searching') { originalImageData ? setAppState('customizing') : setAppState('landing'); }
  }, [searchInput, handleSearch, appState, originalImageData, setAppState]);

  useEffect(() => {
    if (window.__gcse) return;
    window.__gcse = { parsetags: 'explicit', callback: () => { if (window.google?.search?.cse) setIsCSELoaded(true); } };
    const script = document.createElement('script');
    script.src = 'https://cse.google.com/cse.js?cx=825ca1503c1bd4d00';
    script.async = true;
    script.id = 'google-cse-script';
    script.onerror = () => { setImageError('Failed to load the search engine. Please refresh the page.'); setIsSearching(false); };
    document.head.appendChild(script);
    return () => { document.getElementById('google-cse-script')?.remove(); };
  }, [setImageError]);
  
  useEffect(() => {
    // This effect handles rendering the Google CSE results.
    // It runs when the app enters the 'searching' state and the CSE script is ready.
    if (appState !== 'searching' || !searchQuery || !isCSELoaded) {
        if (appState !== 'searching') {
            setIsSearching(false);
        }
        return;
    }

    const renderAndExecute = () => {
        try {
            let element = cseElementRef.current;
            if (!element) {
                element = window.google.search.cse.element.render({
                    div: 'google-search-container',
                    tag: 'searchresults-only',
                    gname: 'image-search',
                    attributes: { searchType: 'image', disableWebSearch: true }
                });
                cseElementRef.current = element;
            }
            element.execute(searchQuery);
        } catch (e) {
            setImageError('Failed to initialize or run the search service. Please refresh.');
        } finally {
            setIsSearching(false);
        }
    };

    const container = document.getElementById('google-search-container');
    if (container) {
        renderAndExecute();
    } else {
        // Poll for the container if it's not immediately available
        let attempts = 0;
        const intervalId = setInterval(() => {
            const polledContainer = document.getElementById('google-search-container');
            if (polledContainer) {
                clearInterval(intervalId);
                renderAndExecute();
            } else if (attempts > 30) { // Give up after ~3 seconds
                clearInterval(intervalId);
                setImageError('Search container did not appear. Please refresh the page.');
                setIsSearching(false);
            }
            attempts++;
        }, 100);

        return () => clearInterval(intervalId);
    }
  }, [appState, isCSELoaded, searchQuery, setImageError]);

  useEffect(() => {
    let timeoutId: number | null = null;
    if (appState === 'searching' && searchQuery && !isCSELoaded) {
        timeoutId = window.setTimeout(() => { if (!isCSELoaded) { setImageError('The search service is taking too long. Please refresh.'); setIsSearching(false); } }, 8000);
    }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [appState, searchQuery, isCSELoaded, setImageError]);


  useEffect(() => {
    if (appState !== 'searching' && cseElementRef.current) {
        const container = document.getElementById('google-search-container');
        if (container) container.innerHTML = '';
        cseElementRef.current = null;
    }
  }, [appState]);

  useEffect(() => {
    if (appState !== 'searching') return;
    const handleClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const img = target.tagName === 'IMG' ? target : target.closest('a')?.querySelector('img');
        if (img instanceof HTMLImageElement && img.src && document.getElementById('google-search-container')?.contains(img)) {
            event.preventDefault();
            handleImageFromUrl(img.src, img);
        }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [appState, handleImageFromUrl]);

  useEffect(() => {
    if (appState !== 'searching') return;
    const container = document.getElementById('google-search-container');
    if (!container) return;
    const observer = new MutationObserver(() => {
        container.querySelectorAll('.gcse-result-tabs, .gsc-tabsArea, .gsc-above-wrapper-area, .gsc-adBlock').forEach(el => (el as HTMLElement).style.display = 'none');
        container.querySelectorAll('.gs-image-box:not(.customize-btn-added)').forEach(resultContainer => {
            const containerEl = resultContainer as HTMLElement;
            const img = containerEl.querySelector('img');
            if (img && img.src) {
                containerEl.style.position = 'relative';
                const button = document.createElement('button');
                const sparkleIconSVG = `<svg class="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>`;
                button.innerHTML = `${sparkleIconSVG}<span>Customize</span>`;
                button.className = 'absolute bottom-2 right-2 flex items-center bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold py-1.5 px-3 rounded-full shadow-lg hover:shadow-xl transition-all opacity-90 hover:opacity-100 transform hover:scale-105 z-10';
                button.addEventListener('click', (e) => { e.stopPropagation(); handleImageFromUrl(img.src, img); });
                containerEl.appendChild(button);
                containerEl.classList.add('customize-btn-added');
            }
        });
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [appState, handleImageFromUrl]);


  return {
    isSearching,
    isCSELoaded,
    searchQuery,
    searchInput,
    setSearchInput,
    cseElementRef,
    handleSearch,
    handleKeyDown,
    handleImageFromUrl,
  };
};
