'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Play, Pause, Square, CheckCircle2, LogOut } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cacheAnalysisResult, findSimilarAnalysisByHash } from '@/services/supabaseService';
import { fileToBase64 } from '@/services/geminiService';

const ADMIN_PIN = '231323';
const CSE_CONTAINER_ID = 'admin-search-container';
const CSE_CX = 'c2a4e68c125c04ab3';

// Global window type extension for Google CSE
declare global {
    interface Window {
        __gcse?: {
            parsetags: string;
            callback: () => void;
        };
        google?: any;
    }
}

// Helper for pHash (copied from bulk-analysis)
async function generatePerceptualHash(imageSrc: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 8;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Could not get canvas context');

            ctx.drawImage(img, 0, 0, size, size);
            const imageData = ctx.getImageData(0, 0, size, size);
            const grayscale = new Array(size * size);
            let totalLuminance = 0;

            for (let i = 0; i < imageData.data.length; i += 4) {
                const r = imageData.data[i];
                const g = imageData.data[i + 1];
                const b = imageData.data[i + 2];
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                grayscale[i / 4] = luminance;
                totalLuminance += luminance;
            }

            const avgLuminance = totalLuminance / (size * size);
            let hash = 0n;

            for (let i = 0; i < grayscale.length; i++) {
                if (grayscale[i] > avgLuminance) {
                    hash |= 1n << BigInt(i);
                }
            }

            resolve(hash.toString(16).padStart(16, '0'));
        };
        img.onerror = () => reject(new Error('Failed to load image for hashing.'));
        img.src = imageSrc;
    });
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SearchAnalysisAdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pin, setPin] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCSELoaded, setIsCSELoaded] = useState(false);
    const [status, setStatus] = useState<'idle' | 'processing' | 'paused'>('idle');
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [logs, setLogs] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const currentPageRef = useRef(1);
    const isAutoModeRef = useRef(false);

    // Refs for process control
    const isPausedRef = useRef(false);
    const isStoppedRef = useRef(false);
    const cseElementRef = useRef<any>(null);
    const imageQueueRef = useRef<string[]>([]);
    const thumbnailMapRef = useRef<Map<string, string>>(new Map()); // Maps original URL to gstatic thumbnail
    const processedUrlsRef = useRef<Set<string>>(new Set());
    const containerObserverRef = useRef<MutationObserver | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const addLog = useCallback((msg: string) => {
        setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Cleanup process on unmount
    useEffect(() => {
        return () => {
            isStoppedRef.current = true;
        };
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin === ADMIN_PIN) {
            setIsAuthenticated(true);
        } else {
            toast.error('Invalid PIN');
        }
    };

    const handleSearch = () => {
        if (!searchInput.trim()) {
            toast.error('Please enter a search keyword');
            return;
        }
        setSearchQuery(searchInput.trim());
        setCurrentPage(1);
        currentPageRef.current = 1;
        isAutoModeRef.current = false;
        addLog(`Searching for: "${searchInput.trim()}"`);
    };

    const handlePauseToggle = () => {
        if (status === 'processing') {
            isPausedRef.current = true;
            setStatus('paused');
            addLog('Process paused safely.');
        } else if (status === 'paused') {
            isPausedRef.current = false;
            setStatus('processing');
            addLog('Process resumed.');
        }
    };

    const handleStop = () => {
        if (status !== 'idle') {
            isStoppedRef.current = true;
            isPausedRef.current = false;
            setStatus('idle');
            addLog('Stopping process...');
        }
    };

    // Get the gstatic thumbnail URL (for fallback when original fails)
    const getGstaticThumbnail = useCallback((): string | null => {
        const container = document.getElementById(CSE_CONTAINER_ID);
        if (!container) return null;

        // Look for gstatic thumbnail in links
        const links = container.querySelectorAll('a[href*="gstatic.com"]');
        for (const link of Array.from(links)) {
            const href = (link as HTMLAnchorElement).href;
            if (href && href.includes('gstatic.com')) {
                return href;
            }
        }

        // Check img elements for gstatic
        const images = container.querySelectorAll('img');
        for (const img of Array.from(images)) {
            const htmlImg = img as HTMLImageElement;
            if (htmlImg.src.includes('gstatic.com')) {
                return htmlImg.src;
            }
        }

        return null;
    }, []);

    // Highlight current image in CSE grid

    // Highlight current image in CSE grid
    const highlightCurrentImage = useCallback((imageUrl: string, active: boolean) => {
        const container = document.getElementById(CSE_CONTAINER_ID);
        if (!container) return;

        container.querySelectorAll('img').forEach((img) => {
            const htmlImg = img as HTMLElement;
            if ((img as HTMLImageElement).src === imageUrl) {
                htmlImg.style.border = active ? '4px solid #EC4899' : 'none';
                htmlImg.style.boxShadow = active ? '0 0 20px rgba(236,72,153,0.6)' : 'none';
                htmlImg.style.transform = active ? 'scale(0.95)' : 'scale(1)';
                htmlImg.style.transition = 'all 0.2s ease-out';
            }
        });
    }, []);

    // Process images function
    const processImages = async (autoMode = false) => {
        isAutoModeRef.current = autoMode;
        setStatus('processing');
        isPausedRef.current = false;
        isStoppedRef.current = false;

        // Sync our tracking with the ACTUAL current page in Google CSE DOM right before starting
        const activePageDoms = document.querySelectorAll('.gsc-cursor-currentpage');
        if (activePageDoms && activePageDoms.length > 0) {
            let maxPageInfo = 1;
            activePageDoms.forEach(dom => {
                if (dom.textContent) {
                    const parsed = parseInt(dom.textContent.trim(), 10);
                    if (parsed && !Number.isNaN(parsed) && parsed > maxPageInfo) {
                        maxPageInfo = parsed;
                    }
                }
            });

            // If we detect the user manually advanced the page before hitting Start, resync the queue
            // We only do this if we haven't officially advanced to this page yet.
            if (currentPageRef.current !== maxPageInfo && autoMode) {
                addLog(`Manual page skip detected (Page ${maxPageInfo}). Resyncing queue...`);
                imageQueueRef.current = [];
                processedUrlsRef.current = new Set();
            }

            currentPageRef.current = maxPageInfo;
            setCurrentPage(maxPageInfo);
        }

        // --- MANUALLY SCRAPE IMAGES ---
        const scrapeImages = () => {
            const container = document.getElementById(CSE_CONTAINER_ID);
            if (container) {
                container.querySelectorAll('.gs-image-box img, .gs-imageResult img, .gsc-imageResult img').forEach((img) => {
                    const htmlImg = img as HTMLImageElement;
                    if (htmlImg.getBoundingClientRect().width > 0 || htmlImg.src.startsWith('http')) {
                        const url = htmlImg.src;
                        if (url && url.startsWith('http') && !processedUrlsRef.current.has(url) && !imageQueueRef.current.includes(url)) {
                            imageQueueRef.current.push(url);
                        }
                    }
                });
            }
        };

        // Proactively scrape for the current view
        scrapeImages();

        // --- VALIDATE IMAGE QUEUE ---
        if (!imageQueueRef.current.length) {
            if (autoMode) {
                addLog('Waiting for images to populate from next page...');
                let retryAttempts = 0;

                while (retryAttempts < 10) { // Poll for up to 5 seconds (500ms * 10)
                    await delay(500);
                    scrapeImages();
                    if (imageQueueRef.current.length > 0) {
                        break;
                    }
                    retryAttempts++;
                }

                if (!imageQueueRef.current.length) {
                    addLog('No new images found on this page. Stopping auto-mode.');
                    setStatus('idle');
                    isAutoModeRef.current = false;
                    return;
                }
            } else {
                toast.error('No images found. Search first and wait for results to load.');
                setStatus('idle');
                return;
            }
        }

        setProgress({ current: 0, total: imageQueueRef.current.length });

        addLog(`[Page ${currentPageRef.current}] Starting analysis of images on page...`);

        let done = 0;
        let errors = 0;
        let skipped = 0;
        let previousOriginalUrl: string | null = null;

        let i = 0;
        while (i < imageQueueRef.current.length) {
            const currentQueueLength = imageQueueRef.current.length;

            if (isStoppedRef.current) {
                addLog('Stopped by user.');
                break;
            }

            while (isPausedRef.current) {
                if (isStoppedRef.current) break;
                await delay(500);
            }

            if (isStoppedRef.current) break;

            const imageUrl = imageQueueRef.current[i];
            processedUrlsRef.current.add(imageUrl);

            addLog(`[${i + 1}/${currentQueueLength}] Processing: ${imageUrl.substring(0, 40)}...`);
            highlightCurrentImage(imageUrl, true);

            let targetImageUrl = imageUrl; // Default to gstatic

            try {
                // Emulate click to open Google CSE modal to get original URL
                const container = document.getElementById(CSE_CONTAINER_ID);
                const imgElement = Array.from(container?.querySelectorAll('img') || []).find(img => img.src === imageUrl);

                if (imgElement) {
                    addLog(`[${i + 1}/${currentQueueLength}] Opening image modal...`);

                    const linkElement = imgElement.closest('a');
                    const wrapperElement = imgElement.closest('.gsc-imageResult, .gs-imageResult');

                    // Dispatch a single click event to the most appropriate interactive element
                    const clickTarget = (linkElement || wrapperElement || imgElement) as HTMLElement;
                    if (clickTarget) {
                        try {
                            clickTarget.focus?.();
                            clickTarget.click();
                        } catch (e) {
                            try {
                                clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                            } catch (err) { }
                        }
                    }

                    // Wait for modal to open and load image with polling
                    let originalUrl: string | null = null;
                    let waitCycles = 0;

                    while (waitCycles <= 12) { // Poll up to 3 seconds
                        await delay(250);

                        // 1. Check known modal image classes (must be visible)
                        const previewImages = Array.from(document.querySelectorAll('img.gsc-image-preview, img.gs-image-preview, img.gsc-preview-image, img.gs-preview-image')).filter(img => img.getBoundingClientRect().width > 0);
                        if (previewImages.length > 0 && (previewImages[0] as HTMLImageElement).src) {
                            const foundSrc = (previewImages[0] as HTMLImageElement).src;
                            if (foundSrc !== previousOriginalUrl) {
                                originalUrl = foundSrc;
                                break;
                            }
                        }

                        // 2. Alternatively, look for the modal wrapper and find non-thumbnail image inside (must be visible)
                        const overlays = Array.from(document.querySelectorAll('.gsc-results-wrapper-overlay, .gsc-modal-background-image')).filter(el => el.getBoundingClientRect().width > 0);
                        if (overlays.length > 0) {
                            const modalRoot = overlays[0].closest('.gsc-results-wrapper') || overlays[0].parentElement;
                            if (modalRoot) {
                                const modalImages = Array.from(modalRoot.querySelectorAll('img')).filter(img =>
                                    img.src &&
                                    img.src.startsWith('http') &&
                                    !img.src.includes('clear.png') &&
                                    !img.src.includes('cleardot.gif') &&
                                    !img.src.includes('encrypted-tbn') &&
                                    img.getBoundingClientRect().width > 0
                                );

                                if (modalImages.length > 0) {
                                    // Take the first valid high-res image
                                    const foundSrc = modalImages[0].src;
                                    if (foundSrc !== previousOriginalUrl) {
                                        originalUrl = foundSrc;
                                        break;
                                    }
                                }
                            }
                        }
                        waitCycles++;
                    }

                    // Fallback: look for ANY large non-thumbnail image that appeared and is visible
                    if (!originalUrl) {
                        const possibleImages = Array.from(document.querySelectorAll('img')).filter(img =>
                            img.src &&
                            img.src.startsWith('http') &&
                            !img.src.includes('encrypted-tbn') &&
                            !img.src.includes('cleardot.gif') &&
                            !img.src.includes('clear.png') &&
                            img.getBoundingClientRect().width > 0 &&
                            (img.getBoundingClientRect().width > 150 || img.naturalWidth > 150)
                        );
                        if (possibleImages.length > 0) {
                            // Find the largest one
                            let largestImg = possibleImages[0];
                            let maxArea = 0;
                            for (const img of possibleImages) {
                                const area = Math.max(img.getBoundingClientRect().width * img.getBoundingClientRect().height, img.naturalWidth * img.naturalHeight);
                                if (area > maxArea) {
                                    maxArea = area;
                                    largestImg = img;
                                }
                            }
                            if (largestImg.src !== previousOriginalUrl) {
                                originalUrl = largestImg.src;
                            }
                        }
                    }

                    if (originalUrl) {
                        if (originalUrl !== previousOriginalUrl) {
                            previousOriginalUrl = originalUrl;
                        }

                        if (originalUrl.includes('fbcdn.net') || originalUrl.includes('facebook.com')) {
                            addLog(`[${i + 1}/${currentQueueLength}] Facebook URL detected, using gstatic.`);
                        } else {
                            targetImageUrl = originalUrl;
                            addLog(`[${i + 1}/${currentQueueLength}] Found legit URL: ${originalUrl.substring(0, 60)}...`);
                        }
                    } else {
                        addLog(`[${i + 1}/${currentQueueLength}] Original URL not found in modal, using gstatic.`);
                    }

                    // Close the modal
                    const closeBtn = document.querySelector('.gsc-results-close-btn, .gsc-close-btn, .gsc-modal-background-image, .gsc-results-wrapper-overlay') as HTMLElement;
                    if (closeBtn) {
                        closeBtn.click();
                    } else {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                    }
                    await delay(500); // Wait for modal to close
                }
            } catch (err: any) {
                addLog(`[${i + 1}/${currentQueueLength}] Modal interaction failed: ${err.message}`);
            }

            try {
                // Fetch the image using our proxy
                let response = await fetch(`/api/proxy-image?url=${encodeURIComponent(targetImageUrl)}`);

                // Fallback to gstatic if the original URL fetch fails (e.g., 403, 404, or CORS issues in proxy)
                if (!response.ok && targetImageUrl !== imageUrl) {
                    addLog(`[${i + 1}/${currentQueueLength}] Legit URL failed (${response.status}), falling back to gstatic...`);
                    targetImageUrl = imageUrl;
                    response = await fetch(`/api/proxy-image?url=${encodeURIComponent(targetImageUrl)}`);
                }

                if (!response.ok) throw new Error(`Proxy error: ${response.status}`);

                let blob = await response.blob();

                // If it's not an image (e.g., an HTML page or text response)
                if (!blob.type.startsWith('image/')) {
                    if (targetImageUrl !== imageUrl) {
                        addLog(`[${i + 1}/${currentQueueLength}] Legit URL returned non-image (${blob.type}), falling back to gstatic...`);
                        targetImageUrl = imageUrl;
                        response = await fetch(`/api/proxy-image?url=${encodeURIComponent(targetImageUrl)}`);
                        if (!response.ok) throw new Error(`Proxy error fallback: ${response.status}`);
                        blob = await response.blob();
                        if (!blob.type.startsWith('image/')) throw new Error('Not an image');
                    } else {
                        throw new Error(`Not an image (${blob.type})`);
                    }
                }

                const file = new File([blob], 'search-image.webp', { type: blob.type });
                const imageData = await fileToBase64(file);
                const imageSrc = `data:${imageData.mimeType};base64,${imageData.data}`;
                const pHash = await generatePerceptualHash(imageSrc);

                // --- GATE 1: FAST VALIDATION ---
                addLog(`[${i + 1}/${currentQueueLength}] Running validation gate...`);
                const validationResponse = await fetch('/api/ai/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageData: imageData.data, mimeType: imageData.mimeType })
                });

                if (!validationResponse.ok) throw new Error(`Validation API error: ${validationResponse.status}`);
                const validationResult = await validationResponse.json();

                const rejectionMessages: Record<string, string> = {
                    not_a_cake: "Not a cake",
                    non_food: "Non-food item",
                    multiple_cakes: "Multiple cakes",
                    only_cupcakes: "Cupcakes only",
                    complex_sculpture: "Too complex",
                    large_wedding_cake: "Large wedding cake",
                };

                if (validationResult.classification !== 'valid_single_cake') {
                    const reason = rejectionMessages[validationResult.classification] || validationResult.classification;
                    addLog(`[${i + 1}/${currentQueueLength}] 🚫 REJECTED (Validation): ${reason}`);
                    skipped++;
                    done++;
                    continue;
                }

                // --- GATE 2: CACHE CHECK & SEMANTIC ANALYSIS ---
                const cached = await findSimilarAnalysisByHash(pHash, targetImageUrl);
                if (cached) {
                    addLog(`[${i + 1}/${currentQueueLength}] Already in cache — skipped.`);
                    skipped++;
                } else {
                    // 4. AI Analysis
                    const aiResponse = await fetch('/api/ai/analyze', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageData: imageData.data, mimeType: imageData.mimeType })
                    });

                    if (!aiResponse.ok) throw new Error(`AI error: ${await aiResponse.text()}`);
                    const analysisResult = await aiResponse.json();

                    // Check for rejection (e.g., if it's not a cake)
                    if (analysisResult.rejection?.isRejected) {
                        addLog(`[${i + 1}/${currentQueueLength}] 🚫 REJECTED: ${analysisResult.rejection.reason || 'Not a cake'}`);
                        skipped++;
                        done++;
                        continue;
                    }

                    // 5. Save to cache
                    await cacheAnalysisResult(pHash, analysisResult, targetImageUrl, blob);
                    addLog(`[${i + 1}/${currentQueueLength}] Cached and uploaded successfully.`);
                    done++;
                }

                if (isStoppedRef.current) break;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error('Image processing error:', error);
                addLog(`[${i + 1}/${currentQueueLength}] ERROR: ${message}`);
                errors++;
                done++;
            } finally {
                highlightCurrentImage(imageUrl, false);
                setProgress({ current: i + 1, total: currentQueueLength });
                i++;
            }
        }

        setStatus('idle');

        if (!isStoppedRef.current && isAutoModeRef.current && currentPageRef.current < 10) {
            const nextP = currentPageRef.current + 1;
            addLog(`✅ Page ${currentPageRef.current} complete. Advancing to page ${nextP}...`);

            // Clear queue and state for next page
            imageQueueRef.current = [];
            processedUrlsRef.current = new Set();
            setProgress({ current: 0, total: 0 });
            setCurrentPage(nextP);
            currentPageRef.current = nextP;

            // Command CSE to go to next page via DOM clicking
            const container = document.getElementById(CSE_CONTAINER_ID);
            const cursorPages = container?.querySelectorAll('.gsc-cursor-page');
            let clicked = false;

            if (cursorPages && cursorPages.length > 0) {
                for (const page of Array.from(cursorPages)) {
                    if (page.textContent?.trim() === nextP.toString()) {
                        addLog(`Advancing to page ${nextP} via CSE UI...`);
                        (page as HTMLElement).click();
                        clicked = true;
                        break;
                    }
                }
            }

            if (clicked) {
                addLog(`Waiting for Google Search to load page ${nextP}...`);

                // Poll until Google CSE updates the DOM explicitly indicating the new page is current
                let poller = 0;
                while (poller < 20) { // Max 10 seconds (500ms * 20)
                    await delay(500);
                    const activeP = document.querySelector('.gsc-cursor-currentpage');
                    if (activeP && activeP.textContent?.trim() === nextP.toString()) {
                        break;
                    }
                    poller++;
                }

                // Extra short delay to allow images to actually paint into the DOM after page state changed
                await delay(1000);

                processImages(true);
                return;
            } else {
                addLog(`⚠️ Page ${nextP} button not found in CSE UI. Stopping auto-mode.`);
                isAutoModeRef.current = false;
            }
        } else {
            addLog(`Done! Processed: ${done}, Skipped: ${skipped}, Errors: ${errors}`);
            // Reset progress and image queue after final completion
            imageQueueRef.current = [];
            processedUrlsRef.current = new Set();
            setProgress({ current: 0, total: 0 });
            isAutoModeRef.current = false;
        }

        errors === 0 ? toast.success('Analysis complete!') : toast.error(`Completed with ${errors} errors.`);
    };

    // Load Google CSE script on mount
    useEffect(() => {
        if (!isAuthenticated) return;

        if (window.google?.search?.cse) {
            setIsCSELoaded(true);
            return;
        }

        if (window.__gcse || document.getElementById('admin-search-cse-script')) {
            const checkInterval = setInterval(() => {
                if (window.google?.search?.cse) {
                    setIsCSELoaded(true);
                    clearInterval(checkInterval);
                }
            }, 100);

            const timeout = setTimeout(() => clearInterval(checkInterval), 10000);
            return () => {
                clearInterval(checkInterval);
                clearTimeout(timeout);
            };
        }

        window.__gcse = {
            parsetags: 'explicit',
            callback: () => {
                if (window.google?.search?.cse) {
                    setIsCSELoaded(true);
                }
            }
        };

        const script = document.createElement('script');
        script.src = `https://cse.google.com/cse.js?cx=${CSE_CX}`;
        script.async = true;
        script.id = 'admin-search-cse-script';
        document.head.appendChild(script);

        return () => {
            // Don't remove script to preserve state
        };
    }, [isAuthenticated]);

    // Execute search when searchQuery changes
    useEffect(() => {
        if (!searchQuery || !isCSELoaded || !isAuthenticated) return;

        const render = () => {
            if (!cseElementRef.current && window.google?.search?.cse?.element) {
                cseElementRef.current = window.google.search.cse.element.render({
                    div: CSE_CONTAINER_ID,
                    tag: 'searchresults-only',
                    gname: 'admin-image-search',
                    attributes: { searchType: 'image', disableWebSearch: true, imageSearchLayout: 'popup' }
                });
            }

            if (cseElementRef.current) {
                cseElementRef.current.execute(searchQuery);
                imageQueueRef.current = [];
                processedUrlsRef.current = new Set();
                setProgress({ current: 0, total: 0 });
                addLog(`Executing search for: "${searchQuery}"`);
            } else {
                setTimeout(render, 100);
            }
        };

        render();
    }, [searchQuery, isCSELoaded, isAuthenticated, addLog]);

    // No background mutation observer. Images are collected strictly on-demand when processing starts.

    // Login screen
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
                    <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Admin Login</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Enter PIN</label>
                            <input
                                type="password"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                placeholder="******"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary-dark transition-colors"
                        >
                            Access Admin
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Search-Based AI Analysis</h1>
                        <p className="text-gray-500 mt-1">Search images from Google CSE and analyze them through AI to populate the cache.</p>
                    </div>
                    <button
                        onClick={() => setIsAuthenticated(false)}
                        className="flex items-center px-4 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5 mr-2" />
                        Logout
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Panel - Controls */}
                    <div className="lg:col-span-4 space-y-4 flex flex-col">
                        {/* Search Section */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">1. Search Images</h2>
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="Enter keyword (e.g., birthday cake)"
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                />
                                <button
                                    onClick={handleSearch}
                                    disabled={!isCSELoaded || status === 'processing'}
                                    className="flex items-center px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
                                >
                                    <Search className="w-5 h-5" />
                                </button>
                            </div>
                            {isCSELoaded ? (
                                <p className="text-sm text-green-600 mt-2 flex items-center">
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Search engine ready
                                </p>
                            ) : (
                                <p className="text-sm text-yellow-600 mt-2">Loading search engine...</p>
                            )}
                        </div>

                        {/* Process Section */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">2. Process & Analyze</h2>
                            <div className="flex space-x-2">
                                <button
                                    onClick={status === 'paused' ? handlePauseToggle : () => processImages(false)}
                                    disabled={status === 'processing' || !isCSELoaded}
                                    className="flex-1 flex items-center justify-center px-4 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {status === 'processing' && !isAutoModeRef.current ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                            Processing
                                        </>
                                    ) : status === 'paused' ? (
                                        <>
                                            <Play className="w-5 h-5 mr-2" />
                                            Resume
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-5 h-5 mr-2" />
                                            Single Page
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => processImages(true)}
                                    disabled={status !== 'idle' || !isCSELoaded}
                                    className="flex-[1.5] flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {status === 'processing' && isAutoModeRef.current ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                            Paginated (Page {currentPage})
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-5 h-5 mr-2" />
                                            Auto (1-10 Pages)
                                        </>
                                    )}
                                </button>
                            </div>

                            {status !== 'idle' && (
                                <>
                                    <button
                                        onClick={handlePauseToggle}
                                        className="px-4 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                                        title={status === 'paused' ? 'Resume' : 'Pause'}
                                    >
                                        {status === 'paused' ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                                    </button>
                                    <button
                                        onClick={handleStop}
                                        className="px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                                        title="Stop entirely"
                                    >
                                        <Square className="w-5 h-5" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Progress */}
                        <div className="mt-4">
                            <div className="flex justify-between text-sm text-gray-600 mb-2">
                                <span>Progress: {progress.current}/{progress.total}</span>
                                <span>{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                    className="bg-primary h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Image queue info */}
                        {imageQueueRef.current.length > 0 && (
                            <p className="text-sm text-gray-500 mt-3">
                                Images collected: {imageQueueRef.current.length}
                            </p>
                        )}
                    </div>

                    {/* Right Panel - Logs & Google CSE Results */}
                    <div className="lg:col-span-8 space-y-6 flex flex-col">
                        {/* Logs Panel */}
                        <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 h-[300px] flex flex-col overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                                <span className="text-gray-300 font-mono text-sm">Execution Logs</span>
                                <span className="flex items-center space-x-2">
                                    <span className="h-3 w-3 rounded-full bg-red-500"></span>
                                    <span className="h-3 w-3 rounded-full bg-yellow-500"></span>
                                    <span className="h-3 w-3 rounded-full bg-green-500"></span>
                                </span>
                            </div>
                            <div className="p-4 flex-1 overflow-y-auto font-mono text-sm space-y-2">
                                {logs.length === 0 ? (
                                    <div className="text-gray-600 italic">Waiting... Search for images to begin.</div>
                                ) : (
                                    logs.map((log, i) => (
                                        <div
                                            key={i}
                                            className={`${log.includes('ERROR') ? 'text-red-400' : log.includes('Success') || log.includes('Cached successfully') ? 'text-green-400' : log.includes('Skipping') || log.includes('Already in cache') ? 'text-yellow-400' : log.includes('Found new image') ? 'text-blue-400' : 'text-gray-300'}`}
                                        >
                                            {log}
                                        </div>
                                    ))
                                )}
                                <div ref={logsEndRef} />
                            </div>
                        </div>

                        {/* Google CSE Results */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[700px]">
                            <div id={CSE_CONTAINER_ID} className="min-h-[600px] p-4"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
