'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useImageManagement } from '@/contexts/ImageContext';
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import { showError } from '@/lib/utils/toast';

interface GoogleSearchSectionProps {
    keyword: string;
}

const GOOGLE_SEARCH_CONTAINER_ID = 'google-search-container-collections';

export const GoogleSearchSection: React.FC<GoogleSearchSectionProps> = ({ keyword }) => {
    const router = useRouter();
    const [isCSELoaded, setIsCSELoaded] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isProcesssingImage, setIsProcessingImage] = useState(false);
    const cseElementRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Contexts
    const {
        handleImageUpload,
        clearImages,
        setError: setImageError
    } = useImageManagement();

    const {
        setIsAnalyzing,
        setAnalysisError,
        setPendingAnalysisData,
        initializeDefaultState,
        clearCustomization
    } = useCakeCustomization();

    const loadingMessages = [
        '🔴 Fetching image from source...',
        '🟣 Processing for AI analysis...',
        '🔵 Preparing customization...'
    ];
    const [loadingStep, setLoadingStep] = useState(0);

    // Loading animation effect
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        if (isProcesssingImage) {
            setLoadingStep(0);
            interval = setInterval(() => {
                setLoadingStep(prev => {
                    if (prev >= loadingMessages.length - 1) {
                        clearInterval(interval);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1500);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isProcesssingImage]);


    // Helper to fetch with timeout
    const fetchWithTimeout = useCallback((resource: RequestInfo, options: RequestInit & { timeout: number }): Promise<Response> => {
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
                    if (!response.ok) reject(new Error(`HTTP error! status: ${response.status}`));
                    else resolve(response);
                })
                .catch(error => {
                    clearTimeout(id);
                    reject(error);
                });
        });
    }, []);

    // Extract high-res URL logic (copied and adapted from useSearchEngine)
    const extractHighResUrl = useCallback(async (thumbnailUrl: string, clickedImg: HTMLElement): Promise<string> => {
        const maxWaitTime = 1600;
        const startTime = Date.now();

        return new Promise((resolve) => {
            const checkForHighRes = (): string | null => {
                const images = document.querySelectorAll('img');
                for (const img of Array.from(images)) {
                    const htmlImg = img as HTMLImageElement;
                    if (
                        !htmlImg.src.includes('gstatic.com') &&
                        !htmlImg.src.startsWith('data:') &&
                        htmlImg.src.startsWith('http') &&
                        htmlImg.naturalWidth > 200 &&
                        htmlImg.complete
                    ) {
                        const isInPopup = htmlImg.closest('.gs-image-popup-box, .gs-image-box-popup, [class*="popup"], [class*="modal"]');
                        // Also check if it's new and likely the high-res one
                        if (isInPopup) {
                            return htmlImg.src;
                        }
                    }
                }
                return null;
            };

            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node instanceof HTMLElement) {
                                const imgs = node.querySelectorAll ? [node, ...Array.from(node.querySelectorAll('img'))] : [node];
                                for (const el of imgs) {
                                    if (el instanceof HTMLImageElement && !el.src.includes('gstatic.com') && el.src.startsWith('http') && el.naturalWidth > 200) {
                                        observer.disconnect();
                                        clearInterval(intervalId);
                                        resolve(el.src);
                                        return;
                                    }
                                }
                            }
                        });
                    }
                    if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                        const target = mutation.target as HTMLImageElement;
                        if (target instanceof HTMLImageElement && !target.src.includes('gstatic.com') && target.src.startsWith('http')) {
                            observer.disconnect();
                            clearInterval(intervalId);
                            resolve(target.src);
                            return;
                        }
                    }
                }
            });

            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

            const intervalId = setInterval(() => {
                const highRes = checkForHighRes();
                if (highRes) {
                    clearInterval(intervalId);
                    observer.disconnect();
                    resolve(highRes);
                } else if (Date.now() - startTime > maxWaitTime) {
                    clearInterval(intervalId);
                    observer.disconnect();
                    resolve(thumbnailUrl);
                }
            }, 100);

            const immediate = checkForHighRes();
            if (immediate) {
                clearInterval(intervalId);
                observer.disconnect();
                resolve(immediate);
            }
        });
    }, []);


    const handleImageFromUrl = useCallback(async (thumbnailUrl: string, clickedElement: HTMLElement) => {
        if (isProcesssingImage) return;
        setIsProcessingImage(true);

        // Inject Styles to hide modal
        const styleId = 'cse-modal-hide-style-collections';
        let styleTag = document.getElementById(styleId) as HTMLStyleElement | null;
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = styleId;
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = `
            .gsc-modal-background-image, .gsc-modal-background-image-visible, .gsc-lightbox, .gs-image-popup-box, .gs-image-box-popup, [class*="gsc-"][class*="modal"], [class*="gsc-"][class*="lightbox"] {
                filter: blur(12px) !important; opacity: 0.5 !important; z-index: 1 !important; pointer-events: none !important; transform: scale(0.98) !important; transition: all 0.3s ease !important;
            }
            .gsc-modal-background-image img, .gs-image-popup-box img { filter: blur(12px) !important; opacity: 0.5 !important; }
        `;

        // Highlight clicked element
        clickedElement.style.transition = 'all 0.2s ease-out';
        clickedElement.style.border = '4px solid #EC4899';
        clickedElement.style.boxShadow = '0 0 20px rgba(236, 72, 153, 0.6)';
        clickedElement.style.transform = 'scale(0.95)';
        clickedElement.style.opacity = '0.9';

        // Trigger CSE click
        const parentAnchor = clickedElement.closest('a.gs-image');
        if (parentAnchor) {
            const syntheticClick = new MouseEvent('click', { bubbles: true, cancelable: false, view: window });
            setTimeout(() => parentAnchor.dispatchEvent(syntheticClick), 0);
        }

        const imageUrl = await extractHighResUrl(thumbnailUrl, clickedElement);

        // Prepare context
        clearImages();
        clearCustomization();
        setIsAnalyzing(true);
        setAnalysisError(null);
        initializeDefaultState();

        // We will navigate AFTER upload success, or handle navigation inside the success callback
        // Actually, SearchingClient navigates immediately.
        router.push('/customizing?from=search');

        try {
            // Try Local Proxy
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
            const blob = await fetchWithTimeout(proxyUrl, { timeout: 10000 }).then(r => {
                if (!r.ok) throw new Error(`Proxy error: ${r.status}`);
                return r.blob();
            }).then(blob => {
                if (blob.type.startsWith('text/') || blob.type.includes('json')) throw new Error('Proxy returned invalid content');
                return blob;
            });

            const file = new File([blob], 'cake-design.webp', { type: blob.type || 'image/webp' });

            // Upload
            await new Promise<void>((resolve, reject) => {
                handleImageUpload(
                    file,
                    (result) => {
                        setPendingAnalysisData(result);
                        setIsAnalyzing(false);
                        resolve();
                    },
                    (error) => {
                        let errorMessage = error.message;
                        if (error.message.startsWith('AI_REJECTION:')) {
                            errorMessage = error.message.replace('AI_REJECTION: ', '');
                        }
                        setAnalysisError(error.message);
                        showError(errorMessage);
                        setIsAnalyzing(false);
                        reject(error);
                    },
                    { imageUrl }
                );
            });

        } catch (err) {
            console.warn("Primary proxy failed, trying backup...", err);
            try {
                const backupProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`;
                const blob = await fetchWithTimeout(backupProxy, { timeout: 10000 }).then(r => r.blob());
                const file = new File([blob], 'cake-design.webp', { type: blob.type || 'image/webp' });
                await new Promise<void>((resolve, reject) => {
                    handleImageUpload(
                        file,
                        (result) => { setPendingAnalysisData(result); setIsAnalyzing(false); resolve(); },
                        (error) => {
                            setAnalysisError(error.message);
                            showError(error.message.replace('AI_REJECTION: ', ''));
                            setIsAnalyzing(false);
                            reject(error);
                        },
                        { imageUrl }
                    );
                });

            } catch (backupErr) {
                console.error("All fetch attempts failed", backupErr);
                setImageError("Could not load image. It may be protected.");
                // Revert UI changes if failure happens before navigation (though we navigated already, so this might render in background)
                setIsProcessingImage(false);
            }
        } finally {
            // Cleanup provided by unmount usually, but good to reset if we stay on page
            setIsProcessingImage(false);
        }

    }, [isProcesssingImage, router, clearImages, clearCustomization, setIsAnalyzing, setAnalysisError, initializeDefaultState, handleImageUpload, setPendingAnalysisData, setImageError, extractHighResUrl, fetchWithTimeout]);


    // Load CSE Script
    useEffect(() => {
        if (window.google?.search?.cse) {
            setIsCSELoaded(true);
            return;
        }

        if (window.__gcse || document.getElementById('google-cse-script-collections')) {
            const checkInterval = setInterval(() => {
                if (window.google?.search?.cse) {
                    setIsCSELoaded(true);
                    clearInterval(checkInterval);
                }
            }, 100);
            return () => clearInterval(checkInterval);
        }

        window.__gcse = {
            parsetags: 'explicit',
            callback: () => {
                if (window.google?.search?.cse) setIsCSELoaded(true);
            }
        };

        const script = document.createElement('script');
        script.src = 'https://cse.google.com/cse.js?cx=825ca1503c1bd4d00';
        script.async = true;
        script.id = 'google-cse-script-collections';
        document.head.appendChild(script);

        return () => {
            // Keeping script around is usually fine
        };
    }, []);

    // Render Logic
    useEffect(() => {
        if (!isCSELoaded || !keyword) return;

        setIsSearching(true);
        const renderAndExecute = () => {
            try {
                if (window.google?.search?.cse?.element) {
                    const element = window.google.search.cse.element.render({
                        div: GOOGLE_SEARCH_CONTAINER_ID,
                        tag: 'searchresults-only',
                        gname: 'image-search-collections',
                        attributes: { searchType: 'image', disableWebSearch: true }
                    });
                    cseElementRef.current = element;
                    element.execute(keyword);
                }
            } catch (e) {
                console.error("CSE Execute Error:", e);
            } finally {
                setTimeout(() => setIsSearching(false), 500);
            }
        };

        // Ensure container exists
        const container = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
        if (container) {
            renderAndExecute();
        } else {
            // simple poll
            setTimeout(renderAndExecute, 200);
        }
    }, [isCSELoaded, keyword]);

    // Cleanup results on unmount or keyword change
    useEffect(() => {
        return () => {
            const container = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
            if (container) container.innerHTML = '';
        };
    }, [keyword]);


    // Mutation Observer for "Get Price" button injection
    useEffect(() => {
        const container = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
        if (!container) return;

        const processResults = () => {
            // Hide unwanted elements
            container.querySelectorAll('.gcse-result-tabs, .gsc-tabsArea, .gsc-above-wrapper-area, .gsc-adBlock, .gs-title, .gs-bidi-start-align').forEach(el => (el as HTMLElement).style.display = 'none');

            // Hide popups
            container.querySelectorAll('.gs-image-box-popup, .gs-image-popup-box, .gsc-modal-background-image, .gsc-modal-background-image-visible, .gsc-lightbox, [class*="lightbox"], [class*="modal"]').forEach(el => {
                const htmlEl = el as HTMLElement;
                htmlEl.style.visibility = 'hidden';
                htmlEl.style.position = 'absolute';
                htmlEl.style.pointerEvents = 'none';
                htmlEl.style.zIndex = '-1';
            });

            container.querySelectorAll('.gs-image-box:not(.customize-btn-added)').forEach(resultContainer => {
                const containerEl = resultContainer as HTMLElement;
                containerEl.classList.add('customize-btn-added');

                const img = containerEl.querySelector('img');
                if (img && img.src) {
                    setTimeout(() => {
                        if (!document.body.contains(containerEl)) return;

                        containerEl.style.position = 'relative';
                        const button = document.createElement('button');
                        const sparkleIconSVG = `<svg class="w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>`;
                        button.innerHTML = `${sparkleIconSVG}<span>Get Price</span>`;
                        button.className = 'absolute bottom-2 right-2 flex items-center bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold py-1.5 px-3 rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all opacity-0 z-50';

                        // Click handler
                        button.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (img.src) handleImageFromUrl(img.src, img);
                        });

                        containerEl.appendChild(button);
                        requestAnimationFrame(() => { button.style.opacity = '1'; });

                    }, 500);
                }
            });
        };

        const observer = new MutationObserver(processResults);
        observer.observe(container, { childList: true, subtree: true });

        // Initial run
        processResults();

        return () => observer.disconnect();
    }, [handleImageFromUrl]);

    // Click handler for images directly
    useEffect(() => {
        const container = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
        if (!container) return;

        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const img = target.tagName === 'IMG' ? target : target.closest('a')?.querySelector('img');
            if (img instanceof HTMLImageElement && img.src && container.contains(img)) {
                event.preventDefault();
                handleImageFromUrl(img.src, img);
            }
        };
        container.addEventListener('click', handleClick); // Listen on container instead of document? better isolated. 
        // Actually SearchingClient uses document.addEventListener. Let's stick closer to safely detecting click.
        // If I listen on container, I need to make sure I don't miss bubbling.
        return () => container.removeEventListener('click', handleClick);
    }, [handleImageFromUrl]);


    return (
        <div className="w-full mt-12 pt-8 border-t border-slate-200">
            <h2 className="text-xl md:text-2xl font-bold bg-linear-to-r from-pink-500 to-purple-600 text-transparent bg-clip-text mb-6">
                More {keyword} Ideas from the Web
            </h2>

            <div className="text-sm text-slate-500 mb-4 bg-purple-50 p-4 rounded-xl border border-purple-100">
                <p className="flex items-center gap-2">
                    <span className="text-xl">💡</span>
                    <span>
                        Don't see what you like above? Browse these Google results.
                        <strong> Click any image</strong> to get an instant price for that design!
                    </span>
                </p>
            </div>

            {isProcesssingImage && (
                <div className="fixed inset-0 bg-white/50 backdrop-blur-md flex flex-col items-center justify-center z-[100] p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 text-center w-full max-w-xs">
                        <LoadingSpinner />
                        <p className="mt-4 text-slate-700 font-semibold text-lg">Working on it...</p>
                        <div className="mt-4 text-left text-sm text-slate-600 space-y-2">
                            {loadingMessages.map((msg, index) => (
                                <div key={index} className={`transition-opacity duration-500 flex items-center gap-2 ${index <= loadingStep ? 'opacity-100' : 'opacity-30'} `}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${index < loadingStep ? 'bg-green-500' : 'bg-slate-300 animate-pulse'} `}></div>
                                    <span>{msg}</span>
                                </div>
                            ))}
                        </div>
                        <p className="mt-4 text-xs text-slate-500">Estimated time: 5-10 seconds</p>
                    </div>
                </div>
            )}

            {isSearching && (
                <div className="flex flex-col items-center justify-center py-12">
                    <LoadingSpinner />
                    <p className="mt-4 text-slate-500">Searching web for {keyword} cakes...</p>
                </div>
            )}

            <div id={GOOGLE_SEARCH_CONTAINER_ID} className="min-h-[400px]"></div>
        </div>
    );
};
