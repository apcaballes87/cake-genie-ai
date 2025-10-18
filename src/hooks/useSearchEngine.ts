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
  // Add state to track if an image is being processed
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const cseElementRef = useRef<any>(null);

  const handleImageFromUrl = useCallback(async (imageUrl: string, clickedElement: HTMLElement) => {
    // Prevent multiple clicks while processing
    if (isProcessingImage) return;

    console.log('🎯 Image clicked, starting fetch...');
    setIsProcessingImage(true);

    // Immediate visual feedback
    document.querySelectorAll('#google-search-container img').forEach(img => ((img as HTMLElement).style.border = 'none'));
    clickedElement.style.border = '4px solid #EC4899';
    clickedElement.style.boxShadow = '0 0 20px rgba(236, 72, 153, 0.5)';
    clickedElement.style.transform = 'scale(0.95)';
    clickedElement.style.transition = 'all 0.2s ease';

    try {
      console.log('📥 Fetching image via proxy...');

      // Try multiple proxy services for better reliability and speed
      const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(imageUrl)}`,
        imageUrl // Try direct fetch as last resort
      ];

      let blob: Blob | null = null;
      let lastError: Error | null = null;

      // Try each proxy in sequence until one works
      for (let i = 0; i < proxies.length; i++) {
        try {
          console.log(`Trying proxy ${i + 1}/${proxies.length}:`, proxies[i].substring(0, 100) + '...');

          // Create AbortController for timeout (better browser support)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

          try {
            const response = await fetch(proxies[i], {
              signal: controller.signal,
              mode: i === proxies.length - 1 ? 'cors' : 'cors', // CORS mode for all
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const fetchedBlob = await response.blob();

            // Validate it's actually an image
            if (fetchedBlob.type.startsWith('text/') || fetchedBlob.size < 100) {
              console.warn(`Invalid content type: ${fetchedBlob.type}, size: ${fetchedBlob.size}`);
              throw new Error('Invalid image data');
            }

            blob = fetchedBlob;
            console.log(`✅ Successfully fetched via proxy ${i + 1} - Type: ${fetchedBlob.type}, Size: ${fetchedBlob.size} bytes`);
            break;
          } catch (fetchErr) {
            clearTimeout(timeoutId);
            throw fetchErr;
          }
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Fetch failed');
          console.warn(`❌ Proxy ${i + 1} failed:`, lastError.message);

          // Don't continue if this was the last proxy
          if (i === proxies.length - 1) {
            break;
          }
          continue;
        }
      }

      if (!blob) {
        const errorMsg = lastError?.message || 'All proxies failed';
        console.error('❌ All proxies failed. Last error:', errorMsg);
        throw lastError || new Error('All proxies failed to fetch the image');
      }

      console.log('🔄 Converting to File object...');
      const file = new File([blob], 'cake-design.webp', { type: blob.type || 'image/webp' });
      console.log('📦 File created:', file.name, file.size, 'bytes');

      console.log('📤 Uploading to image handler...');
      await handleImageUpload(file);
      console.log('✅ Image upload completed successfully');

    } catch (err) {
      console.error("❌ Image fetch error:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error("❌ Error details:", errorMessage);

      setImageError(`Could not load image: ${errorMessage}. Try saving it to your device and using the 'Upload' button.`);
      clickedElement.style.border = '4px solid #EF4444';
      clickedElement.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.5)';
      setAppState('searching');
    } finally {
      setIsProcessingImage(false);
      console.log('🏁 Image processing finished');
      // Reset transform
      setTimeout(() => {
        clickedElement.style.transform = 'scale(1)';
      }, 200);
    }
  }, [handleImageUpload, setImageError, setAppState, isProcessingImage]);
  
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
    // Check if CSE is already loaded
    if (window.google?.search?.cse) {
      setIsCSELoaded(true);
      return;
    }

    // Set up the callback before loading the script
    if (!window.__gcse) {
      window.__gcse = {
        parsetags: 'explicit',
        callback: () => {
          console.log('Google CSE callback fired');
          setIsCSELoaded(true);
        }
      };
    }

    // Check if script is already in the DOM
    const existingScript = document.getElementById('google-cse-script');
    if (existingScript) {
      // Script exists, check if CSE is loaded
      const checkInterval = setInterval(() => {
        if (window.google?.search?.cse) {
          console.log('Google CSE detected via polling');
          setIsCSELoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);

      setTimeout(() => clearInterval(checkInterval), 10000);
      return () => clearInterval(checkInterval);
    }

    // Load the script
    const script = document.createElement('script');
    const cseId = import.meta.env.VITE_GOOGLE_CSE_ID;
    if (!cseId) {
      console.error('VITE_GOOGLE_CSE_ID is not defined in environment variables');
      setImageError('Search engine not configured. Please contact support.');
      return;
    }
    script.src = `https://cse.google.com/cse.js?cx=${cseId}`;
    script.async = true;
    script.id = 'google-cse-script';

    script.onload = () => {
      console.log('Google CSE script loaded');
      // Poll for CSE availability after script loads
      const checkInterval = setInterval(() => {
        if (window.google?.search?.cse) {
          console.log('Google CSE ready after script load');
          setIsCSELoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);

      setTimeout(() => clearInterval(checkInterval), 5000);
    };

    script.onerror = () => {
      console.error('Failed to load Google CSE script');
      setImageError('Failed to load the search engine. Please refresh the page.');
      setIsSearching(false);
    };

    document.head.appendChild(script);

    return () => {
      const scriptEl = document.getElementById('google-cse-script');
      if (scriptEl) scriptEl.remove();
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

    console.log('Rendering Google CSE with query:', searchQuery);

    const renderAndExecute = () => {
        try {
            let element = cseElementRef.current;
            if (!element) {
                console.log('Creating new CSE element');
                element = window.google.search.cse.element.render({
                    div: 'google-search-container',
                    tag: 'searchresults-only',
                    gname: 'image-search',
                    attributes: { searchType: 'image', disableWebSearch: true }
                });
                cseElementRef.current = element;
                console.log('CSE element created successfully');
            }
            console.log('Executing search for:', searchQuery);
            element.execute(searchQuery);
        } catch (e) {
            console.error('CSE render/execute error:', e);
            setImageError('Failed to initialize or run the search service. Please refresh.');
        } finally {
            setIsSearching(false);
        }
    };

    const container = document.getElementById('google-search-container');
    if (container) {
        console.log('Container found, rendering CSE');
        renderAndExecute();
    } else {
        console.log('Container not found, polling...');
        // Poll for the container if it's not immediately available
        let attempts = 0;
        const intervalId = setInterval(() => {
            const polledContainer = document.getElementById('google-search-container');
            if (polledContainer) {
                console.log('Container found after polling');
                clearInterval(intervalId);
                renderAndExecute();
            } else if (attempts > 30) { // Give up after ~3 seconds
                console.error('Container not found after 30 attempts');
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
        console.log('Waiting for Google CSE to load...');
        // Increased timeout to 15 seconds to give more time for the script to load
        timeoutId = window.setTimeout(() => {
          if (!isCSELoaded) {
            console.error('Google CSE failed to load within timeout period');
            setImageError('The search service is taking too long. Please refresh the page and try again.');
            setIsSearching(false);
          }
        }, 15000);
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
            // Only process if not already processing
            if (!isProcessingImage) {
                handleImageFromUrl(img.src, img);
            }
        }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [appState, handleImageFromUrl, isProcessingImage]);

  useEffect(() => {
    if (appState !== 'searching') return;
    const container = document.getElementById('google-search-container');
    if (!container) return;
    const observer = new MutationObserver(() => {
        // Hide Google CSE UI elements that we don't need
        container.querySelectorAll('.gcse-result-tabs, .gsc-tabsArea, .gsc-above-wrapper-area, .gsc-adBlock').forEach(el => (el as HTMLElement).style.display = 'none');

        // Hide the image overlay info (link, size, etc.) that appears on hover - check multiple times
        const hideOverlays = () => {
            container.querySelectorAll('.gs-image-box-popup, .gs-image-popup-box, .gs-title, .gs-bidi-start-align').forEach(el => {
                (el as HTMLElement).style.display = 'none !important' as any;
                (el as HTMLElement).style.visibility = 'hidden';
                (el as HTMLElement).style.opacity = '0';
                (el as HTMLElement).style.pointerEvents = 'none';
            });
        };
        hideOverlays();
        // Check again after a delay since Google might add these dynamically
        setTimeout(hideOverlays, 100);

        container.querySelectorAll('.gs-image-box:not(.customize-btn-added)').forEach(resultContainer => {
            const containerEl = resultContainer as HTMLElement;
            const img = containerEl.querySelector('img');
            if (img && img.src) {
                containerEl.style.position = 'relative';
                containerEl.style.cursor = 'pointer';
                containerEl.style.transition = 'transform 0.2s ease';

                // Hide any child elements that could overlay our button
                const overlays = containerEl.querySelectorAll('.gs-title, .gs-bidi-start-align, .gs-image-popup-box');
                overlays.forEach(overlay => {
                    (overlay as HTMLElement).style.display = 'none';
                });

                // Add hover effect for better interactivity
                containerEl.addEventListener('mouseenter', () => {
                    if (!isProcessingImage) {
                        containerEl.style.transform = 'translateY(-4px)';
                        img.style.filter = 'brightness(1.1)';
                    }
                });
                containerEl.addEventListener('mouseleave', () => {
                    containerEl.style.transform = 'translateY(0)';
                    img.style.filter = 'brightness(1)';
                });

                const button = document.createElement('button');
                const sparkleIconSVG = `<svg class="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>`;
                button.innerHTML = `${sparkleIconSVG}<span>Customize</span>`;
                button.className = 'absolute bottom-2 right-2 flex items-center bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold py-1.5 px-3 rounded-full shadow-lg hover:shadow-xl transition-all opacity-0 transform hover:scale-105 z-[9999]';
                button.style.pointerEvents = 'auto'; // Ensure button is always clickable

                // Add disabled state when processing
                if (isProcessingImage) {
                    button.disabled = true;
                    button.style.cursor = 'not-allowed';
                    button.style.opacity = '0.6';
                }

                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Only process if not already processing
                    if (!isProcessingImage) {
                        handleImageFromUrl(img.src, img);
                    }
                });

                containerEl.appendChild(button);
                containerEl.classList.add('customize-btn-added');

                // Show button with 500ms delay after image container appears
                setTimeout(() => {
                    button.style.opacity = '1';
                    button.style.transition = 'opacity 0.3s ease-in-out, transform 0.2s ease';
                }, 500);
            }
        });
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [appState, handleImageFromUrl, isProcessingImage]);


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
    // Expose the processing state
    isProcessingImage,
  };
};