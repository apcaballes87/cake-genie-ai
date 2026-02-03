import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trackSearchTerm } from '@/services/supabaseService';
import { AppState } from './useAppNavigation';
import { GoogleCSE, GoogleCSEElement } from '@/types';

// Global window type extension from App.tsx
declare global {
  interface Window {
    __gcse?: {
      parsetags: string;
      callback: () => void;
    };
    google?: GoogleCSE | any;
  }
}

// Declare gtag for Google Analytics event tracking
declare const gtag: (...args: any[]) => void;

interface UseSearchEngineProps {
  appState: AppState;
  setAppState: (state: AppState) => void;
  handleImageUpload: (file: File, imageUrl?: string) => Promise<any>;
  setImageError: (error: string | null) => void;
  originalImageData: { data: string; mimeType: string } | null;
  setIsFetchingWebImage: (fetching: boolean) => void;
}

const GOOGLE_SEARCH_CONTAINER_ID = 'google-search-container';

const fetchWithTimeout = (
  resource: RequestInfo,
  options: RequestInit & { timeout: number }
): Promise<Response> => {
  const { timeout = 6000 } = options;

  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const id = setTimeout(() => {
      controller.abort();
      reject(new Error('Fetch timed out'));
    }, timeout);

    fetch(resource, { ...options, signal: controller.signal })
      .then(response => {
        clearTimeout(id);
        if (!response.ok) {
          reject(new Error(`HTTP error! status: ${response.status}`));
        } else {
          resolve(response);
        }
      })
      .catch(error => {
        clearTimeout(id);
        reject(error);
      });
  });
};


export const useSearchEngine = ({
  appState,
  setAppState,
  handleImageUpload,
  setImageError,
  originalImageData,
  setIsFetchingWebImage
}: UseSearchEngineProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSearching, setIsSearching] = useState(false);
  const [isCSELoaded, setIsCSELoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const cseElementRef = useRef<GoogleCSEElement | null>(null);
  const isProcessingUrlRef = useRef(false);

  const handleImageFromUrl = useCallback(async (imageUrl: string, clickedElement: HTMLElement) => {
    if (isProcessingUrlRef.current) return;
    isProcessingUrlRef.current = true;
    setIsFetchingWebImage(true);

    // Reset styles on all other images and apply active style to the clicked one
    const container = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
    if (container) {
      container.querySelectorAll('img').forEach(img => {
        const htmlImg = img as HTMLElement;
        htmlImg.style.border = 'none';
        htmlImg.style.boxShadow = 'none';
        htmlImg.style.transform = 'scale(1)';
        htmlImg.style.opacity = '1';
      });
    }
    clickedElement.style.transition = 'all 0.2s ease-out';
    clickedElement.style.border = '4px solid #EC4899';
    clickedElement.style.boxShadow = '0 0 20px rgba(236, 72, 153, 0.6)';
    clickedElement.style.transform = 'scale(0.95)';
    clickedElement.style.opacity = '0.9';

    // Use our local API route as the primary proxy
    // This avoids 403 errors from public proxies
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    const timeout = 10000; // 10 seconds

    try {
      const blob = await fetchWithTimeout(proxyUrl, { timeout })
        .then(response => {
          if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
          return response.blob();
        })
        .then(blob => {
          if (blob.type.startsWith('text/') || blob.type.includes('json')) {
            throw new Error('Proxy returned invalid content');
          }
          return blob;
        });

      const file = new File([blob], 'cake-design.webp', { type: blob.type || 'image/webp' });
      await handleImageUpload(file, imageUrl);

    } catch (err) {
      console.warn("Primary proxy failed, trying fallbacks...", err);

      // Fallback strategies if local proxy fails
      try {
        // Backup: Try allorigins
        const backupProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`;
        const blob = await fetchWithTimeout(backupProxy, { timeout })
          .then(r => r.blob());

        const file = new File([blob], 'cake-design.webp', { type: blob.type || 'image/webp' });
        await handleImageUpload(file, imageUrl);
      } catch (backupErr) {
        console.error("All fetch attempts failed:", backupErr);
        setImageError("Could not load image. It may be protected. Tip: Try saving the image to your device and using the 'Upload' button.");
        clickedElement.style.border = '4px solid #EF4444';
        clickedElement.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.6)';
        setAppState('searching');
      }
    } finally {
      setIsFetchingWebImage(false);
      isProcessingUrlRef.current = false;
    }
  }, [handleImageUpload, setImageError, setAppState, setIsFetchingWebImage]);

  const handleSearch = useCallback((query?: string) => {
    const searchQueryValue = typeof query === 'string' ? query.trim() : searchInput.trim();
    if (!searchQueryValue) return;

    // Update URL to reflect the new search query
    const newHelper = new URLSearchParams(searchParams.toString());
    newHelper.set('q', searchQueryValue);
    router.push(`/search?${newHelper.toString()}`);

    // Analytics: Track when a user starts the design process via search
    if (typeof gtag === 'function') {
      gtag('event', 'start_design', {
        'event_category': 'ecommerce_funnel',
        'event_label': 'search'
      });
    }

    trackSearchTerm(searchQueryValue).catch(console.error);
    if (typeof query === 'string') setSearchInput(searchQueryValue);
    setIsSearching(true);
    setImageError(null);
    setAppState('searching');
    setSearchQuery(searchQueryValue);
  }, [searchInput, setImageError, setAppState, router, searchParams]); // Added router and searchParams to dependencies

  // FIX: Added React to import to make React.KeyboardEvent available.
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { if (searchInput.trim()) handleSearch(searchInput.trim()); }
    if (e.key === 'Escape' && appState === 'searching') { originalImageData ? setAppState('customizing') : setAppState('landing'); }
  }, [searchInput, handleSearch, appState, originalImageData, setAppState]);

  useEffect(() => {
    // Check if the search engine is already loaded from a previous visit
    if (window.google?.search?.cse) {
      setIsCSELoaded(true);
      return;
    }

    // If the script is already injected but not fully loaded (or we missed the callback),
    // we poll for the object to become available.
    if (window.__gcse || document.getElementById('google-cse-script')) {
      const checkInterval = setInterval(() => {
        if (window.google?.search?.cse) {
          setIsCSELoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);

      // Stop polling after 10 seconds to avoid infinite loops
      const timeout = setTimeout(() => clearInterval(checkInterval), 10000);

      return () => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }

    // Standard injection if not present
    window.__gcse = {
      parsetags: 'explicit',
      callback: () => {
        if (window.google?.search?.cse) {
          setIsCSELoaded(true);
        }
      }
    };

    const script = document.createElement('script');
    script.src = 'https://cse.google.com/cse.js?cx=825ca1503c1bd4d00';
    script.async = true;
    script.id = 'google-cse-script';
    script.onerror = () => {
      setImageError('Failed to load the search engine. Please refresh the page.');
      setIsSearching(false);
    };
    document.head.appendChild(script);

    return () => {
      // We don't remove the script on unmount to preserve the cache/state for re-navigation
      // document.getElementById('google-cse-script')?.remove(); 
    };
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
            div: GOOGLE_SEARCH_CONTAINER_ID,
            tag: 'searchresults-only',
            gname: 'image-search',
            attributes: { searchType: 'image', disableWebSearch: true }
          });
          cseElementRef.current = element;
        }
        element?.execute(searchQuery);
      } catch (e) {
        setImageError('Failed to initialize or run the search service. Please refresh.');
      } finally {
        setIsSearching(false);
      }
    };

    const container = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
    if (container) {
      renderAndExecute();
    } else {
      // Poll for the container if it's not immediately available
      let attempts = 0;
      const intervalId = setInterval(() => {
        const polledContainer = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
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
      const container = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
      if (container) container.innerHTML = '';
      cseElementRef.current = null;
    }
  }, [appState]);

  useEffect(() => {
    if (appState !== 'searching') return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const img = target.tagName === 'IMG' ? target : target.closest('a')?.querySelector('img');
      if (img instanceof HTMLImageElement && img.src && document.getElementById(GOOGLE_SEARCH_CONTAINER_ID)?.contains(img)) {
        event.preventDefault();
        handleImageFromUrl(img.src, img);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [appState, handleImageFromUrl]);

  useEffect(() => {
    if (appState !== 'searching') return;
    const container = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
    if (!container) return;
    const processResults = () => {
      container.querySelectorAll('.gcse-result-tabs, .gsc-tabsArea, .gsc-above-wrapper-area, .gsc-adBlock, .gs-image-box-popup, .gs-image-popup-box, .gs-title, .gs-bidi-start-align').forEach(el => (el as HTMLElement).style.display = 'none');
      container.querySelectorAll('.gs-image-box:not(.customize-btn-added)').forEach(resultContainer => {
        const containerEl = resultContainer as HTMLElement;
        containerEl.classList.add('customize-btn-added'); // Mark as processed immediately to prevent re-adding

        const img = containerEl.querySelector('img');
        if (img && img.src) {
          // Delay button appearance by 500ms as requested
          setTimeout(() => {
            // Before appending, ensure the container is still part of the document
            if (!document.body.contains(containerEl)) return;

            containerEl.style.position = 'relative';
            const button = document.createElement('button');
            const sparkleIconSVG = `<svg class="w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>`;
            button.innerHTML = `${sparkleIconSVG}<span>Get Price</span>`;
            button.className = 'absolute bottom-2 right-2 flex items-center bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold py-1.5 px-3 rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all opacity-0 z-50';
            button.addEventListener('click', (e) => { e.stopPropagation(); handleImageFromUrl(img.src, img); });
            containerEl.appendChild(button);

            // Use requestAnimationFrame to trigger the CSS transition for fade-in
            requestAnimationFrame(() => {
              button.style.opacity = '1';
            });
          }, 500);
        }
      });
    };

    // Run immediately in case results are already there
    processResults();

    const observer = new MutationObserver(processResults);
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