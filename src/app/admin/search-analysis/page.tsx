'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Play, Pause, Square, CheckCircle2, LogOut } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cacheAnalysisResult, findSimilarAnalysisByHash } from '@/services/supabaseService';
import { fileToBase64 } from '@/services/geminiService';
import type { GoogleCSE, GoogleCSEElement } from '@/types';
import {
    generateImageFingerprintWithLegacyCandidates,
    toFingerprintLookup,
} from '@/lib/utils/serverFingerprint.client';

const ADMIN_PIN = '231323';
const CSE_CONTAINER_ID = 'admin-search-container';
const CSE_CX = '825ca1503c1bd4d00';
const SEARCH_ANALYSIS_BETWEEN_AI_ITEMS_DELAY_MS = 5000;
type SearchAnalysisBatchRun = {
    id: string;
    status: string;
    is_compatibility_probe: boolean;
    submitted_count: number;
    completed_count: number;
    failed_count: number;
    retryable_count: number;
    created_at: string;
};

// Global window type extension for Google CSE
declare global {
    interface Window {
        __gcse?: {
            parsetags: string;
            callback: () => void;
        };
        google?: GoogleCSE;
    }
}

function loadImageFromObjectUrl(objectUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image for AI normalization.'));
        img.src = objectUrl;
    });
}

async function normalizeImageForAi(blob: Blob): Promise<File> {
    const objectUrl = URL.createObjectURL(blob);

    try {
        const img = await loadImageFromObjectUrl(objectUrl);
        const maxDimension = 1600;
        const largestDimension = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
        const scale = largestDimension > maxDimension ? maxDimension / largestDimension : 1;
        const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
        const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context for AI normalization.');
        }

        ctx.drawImage(img, 0, 0, width, height);

        const normalizedBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        reject(new Error('Failed to convert image for AI.'));
                    }
                },
                'image/jpeg',
                0.86
            );
        });

        return new File([normalizedBlob], 'search-image.jpg', { type: 'image/jpeg' });
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
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
    const [studioQueueReadyItems, setStudioQueueReadyItems] = useState<Array<{ slug: string; seoTitle: string }>>([]);
    const [latestBatchRun, setLatestBatchRun] = useState<SearchAnalysisBatchRun | null>(null);
    const [batchHistory, setBatchHistory] = useState<SearchAnalysisBatchRun[]>([]);
    const [isBatchActionPending, setIsBatchActionPending] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const currentPageRef = useRef(1);
    const isAutoModeRef = useRef(false);
    const isOfflineCollectRef = useRef(false);

    // Refs for process control
    const isPausedRef = useRef(false);
    const isStoppedRef = useRef(false);
    const cseElementRef = useRef<GoogleCSEElement | null>(null);
    const imageQueueRef = useRef<string[]>([]);
    const processedUrlsRef = useRef<Set<string>>(new Set());
    const seenPHashesRef = useRef<Set<string>>(new Set());
    const batchRefreshInFlightRef = useRef(false);
    const offlineBatchSubmittedRef = useRef(false);

    const addLog = useCallback((msg: string) => {
        setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
    }, []);

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
        imageQueueRef.current = [];
        processedUrlsRef.current = new Set();
        seenPHashesRef.current = new Set();
        setStudioQueueReadyItems([]);
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
    const processImages = async (autoMode = false, offlineCollect = false) => {
        isAutoModeRef.current = autoMode;
        isOfflineCollectRef.current = offlineCollect;
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
                        } catch {
                            try {
                                clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                            } catch { }
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
            } catch (err) {
                const modalErrorMessage = err instanceof Error ? err.message : 'Unknown modal error';
                addLog(`[${i + 1}/${currentQueueLength}] Modal interaction failed: ${modalErrorMessage}`);
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

                const normalizedFile = await normalizeImageForAi(blob);
                addLog(
                    `[${i + 1}/${currentQueueLength}] Normalized ${blob.type || 'unknown'} to ${normalizedFile.type} (${(normalizedFile.size / 1024 / 1024).toFixed(2)} MB).`
                );

                const imageData = await fileToBase64(normalizedFile);
                const sourceFile = new File([blob], 'search-image-source', { type: blob.type || 'image/jpeg' });
                const sourceImageData = await fileToBase64(sourceFile);
                const sourceImageSrc = `data:${sourceImageData.mimeType};base64,${sourceImageData.data}`;
                const fingerprint = await generateImageFingerprintWithLegacyCandidates(normalizedFile, sourceImageSrc, { crossOrigin: 'anonymous' });
                const pHash = fingerprint.pHash;
                if (!pHash) {
                    throw new Error(fingerprint.error || 'Failed to generate server image hash.');
                }

                if (seenPHashesRef.current.has(pHash)) {
                    addLog(`[${i + 1}/${currentQueueLength}] Duplicate pHash in current run — skipped.`);
                    skipped++;
                    done++;
                    continue;
                }
                seenPHashesRef.current.add(pHash);

                const rejectionMessages: Record<string, string> = {
                    not_a_cake: "Not a cake",
                    multiple_cakes: "Multiple cakes",
                    cake_slice_only: "Cake slice only",
                    cupcakes_only: "Cupcakes only",
                    complex_sculpture: "Too complex",
                    large_wedding_cake: "Large wedding cake",
                    selfie: "Selfie",
                };

                // --- GATE 1: CACHE CHECK ---
                const cached = await findSimilarAnalysisByHash(toFingerprintLookup(fingerprint), targetImageUrl);
                if (cached) {
                    addLog(`[${i + 1}/${currentQueueLength}] Already in cache — skipped.`);
                    skipped++;
                } else {
                    if (isOfflineCollectRef.current) {
                        const queuedResponse = await fetch('/api/admin/search-analysis-batch', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'x-admin-pin': ADMIN_PIN },
                            body: JSON.stringify({
                                pHash,
                                fingerprintPipeline: fingerprint.pipeline,
                                sourceImageUrl: targetImageUrl,
                                imageData: imageData.data,
                                mimeType: imageData.mimeType,
                            }),
                        });
                        if (!queuedResponse.ok) throw new Error(`Queue error: ${queuedResponse.status} ${(await queuedResponse.text()).trim()}`);
                        addLog(`[${i + 1}/${currentQueueLength}] Cache miss uploaded and queued for offline analysis.`);
                        done++;
                        continue;
                    }
                    // --- AI ANALYSIS (rejection handled by analyze response) ---
                    const aiResponse = await fetch('/api/ai/analyze', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageData: imageData.data, mimeType: imageData.mimeType })
                    });

                    if (!aiResponse.ok) {
                        const aiErrorText = (await aiResponse.text()).trim();
                        throw new Error(
                            `AI error: ${aiResponse.status}${aiErrorText ? ` ${aiErrorText}` : ''}`
                        );
                    }
                    const analysisResult = await aiResponse.json();

                    // Check for rejection (e.g., if it's not a cake)
                    if (analysisResult.rejection?.isRejected) {
                        const reason = analysisResult.rejection.reason;
                        const reasonLabel = (reason && rejectionMessages[reason]) || reason || 'Not a cake';
                        addLog(`[${i + 1}/${currentQueueLength}] 🚫 REJECTED: ${reasonLabel}`);
                        skipped++;
                        done++;
                        continue;
                    }

                    // 5. Save to cache
                    const cachedResult = await cacheAnalysisResult(pHash, analysisResult, targetImageUrl, blob, {
                        triggerStudioEdit: false,
                        fingerprintPipeline: fingerprint.pipeline,
                    });
                    if (cachedResult) {
                        setStudioQueueReadyItems((prev) => [
                            ...prev,
                            {
                                slug: cachedResult.slug,
                                seoTitle: cachedResult.seo_title,
                            },
                        ]);
                        addLog(`[${i + 1}/${currentQueueLength}] Ready for Image Studio follow-up: ${cachedResult.slug}`);
                    }
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
                if (!isStoppedRef.current && i < currentQueueLength) {
                    await delay(SEARCH_ANALYSIS_BETWEEN_AI_ITEMS_DELAY_MS);
                }
            }
        }

        setStatus('idle');

        if (!isStoppedRef.current && isAutoModeRef.current && currentPageRef.current < 30) {
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

                processImages(true, isOfflineCollectRef.current);
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
            if (isOfflineCollectRef.current && !isStoppedRef.current && !offlineBatchSubmittedRef.current) {
                offlineBatchSubmittedRef.current = true;
                addLog('Submitting queued cache misses to the offline Gemini batch...');
                await submitOfflineBatch();
            }
        }

        if (errors === 0) {
            toast.success('Analysis complete!');
        } else {
            toast.error(`Completed with ${errors} errors.`);
        }
    };

    const refreshBatchStatus = useCallback(async (silent = false) => {
        if (batchRefreshInFlightRef.current) return;
        batchRefreshInFlightRef.current = true;
        setIsBatchActionPending(true);
        try {
            let response = await fetch('/api/admin/search-analysis-batch', { headers: { 'x-admin-pin': ADMIN_PIN } });
            let payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Failed to load batch status.');
            setBatchHistory(payload.history ?? []);
            if (payload.run?.status === 'submitted' || payload.run?.status === 'importing') {
                response = await fetch('/api/admin/search-analysis-batch', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'x-admin-pin': ADMIN_PIN },
                    body: JSON.stringify({ runId: payload.run.id }),
                });
                payload = await response.json();
                if (!response.ok) throw new Error(payload.error || 'Failed to reconcile batch.');
            }
            setLatestBatchRun(payload.run ?? null);
        } catch (error) {
            if (!silent) toast.error(error instanceof Error ? error.message : 'Failed to refresh batch.');
        } finally {
            batchRefreshInFlightRef.current = false;
            setIsBatchActionPending(false);
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        const delayMs = latestBatchRun?.status === 'importing' ? 1500 : 30000;
        const timer = window.setInterval(() => void refreshBatchStatus(true), delayMs);
        return () => window.clearInterval(timer);
    }, [isAuthenticated, latestBatchRun?.status, latestBatchRun?.completed_count, refreshBatchStatus]);

    async function submitOfflineBatch() {
        setIsBatchActionPending(true);
        try {
            const response = await fetch('/api/admin/search-analysis-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-pin': ADMIN_PIN },
                body: JSON.stringify({ limit: 1000 }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Failed to submit batch.');
            setLatestBatchRun(payload.run);
            toast.success(payload.run.is_compatibility_probe ? 'Compatibility test submitted.' : 'Offline batch submitted.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to submit batch.');
        } finally {
            setIsBatchActionPending(false);
        }
    }

    const collectMissesForOfflineBatch = () => {
        offlineBatchSubmittedRef.current = false;
        void processImages(true, true);
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
                            <button
                                onClick={collectMissesForOfflineBatch}
                                disabled={status !== 'idle' || !isCSELoaded}
                                className="mt-3 w-full flex items-center justify-center px-4 py-3 bg-sky-700 text-white rounded-lg font-medium hover:bg-sky-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {status === 'processing' && isOfflineCollectRef.current ? 'Collecting cache misses...' : 'Collect misses for offline batch (1-30 Pages)'}
                            </button>
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
                                            Auto (1-30 Pages)
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

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-800 mb-2">3. Offline Gemini Batch</h2>
                            <p className="text-sm text-gray-500 mb-4">
                                Submit queued cache misses asynchronously. The first submission is automatically limited to a small compatibility test.
                            </p>
                            <div className="space-y-2">
                                <button
                                    onClick={submitOfflineBatch}
                                    disabled={isBatchActionPending}
                                    className="w-full px-4 py-3 bg-emerald-700 text-white rounded-lg font-medium hover:bg-emerald-800 disabled:opacity-50"
                                >
                                    Batch analyze next 1000
                                </button>
                                <button
                                    onClick={() => void refreshBatchStatus()}
                                    disabled={isBatchActionPending}
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
                                >
                                    Refresh batch status
                                </button>
                            </div>
                            <div className="mt-4 text-sm text-gray-700 space-y-1">
                                <p>Latest stage: {latestBatchRun?.status ?? 'No run yet'}</p>
                                <p>Submitted: {latestBatchRun?.submitted_count ?? 0}</p>
                                <p>Completed: {latestBatchRun?.completed_count ?? 0}</p>
                                <p>Failed: {latestBatchRun?.failed_count ?? 0}</p>
                                <p>Retryable: {latestBatchRun?.retryable_count ?? 0}</p>
                                {latestBatchRun?.status === 'importing' && (
                                    <p className="text-emerald-700">Import continues automatically while this page is open.</p>
                                )}
                            </div>
                            {batchHistory.length > 0 && (
                                <div className="mt-4 overflow-x-auto text-xs text-gray-600">
                                    <table className="min-w-full">
                                        <thead><tr><th className="pr-3 text-left">Submitted</th><th className="pr-3 text-left">Status</th><th className="pr-3 text-right">Done</th><th className="text-right">Failed</th></tr></thead>
                                        <tbody>
                                            {batchHistory.map((run) => (
                                                <tr key={run.id}>
                                                    <td className="pr-3">{new Date(run.created_at).toLocaleString()}</td>
                                                    <td className="pr-3">{run.status}</td>
                                                    <td className="pr-3 text-right">{run.completed_count}</td>
                                                    <td className="text-right">{run.failed_count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
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

                        {/* Studio follow-up queue */}
                        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-violet-900">Image Studio follow-up</h3>
                                    <p className="text-sm text-violet-700 mt-1">
                                        New cache entries from this run are queued for a separate Image Studio pass.
                                    </p>
                                </div>
                                <span className="inline-flex items-center rounded-full bg-violet-600 px-3 py-1 text-sm font-semibold text-white">
                                    {studioQueueReadyItems.length}
                                </span>
                            </div>
                            {studioQueueReadyItems.length > 0 ? (
                                <div className="mt-3 space-y-2">
                                    <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                                        Ready on this search run
                                    </p>
                                    <div className="max-h-40 overflow-y-auto space-y-2">
                                        {studioQueueReadyItems.slice(-8).reverse().map((item) => (
                                            <div
                                                key={item.slug}
                                                className="rounded-lg border border-violet-200 bg-white px-3 py-2"
                                            >
                                                <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                                    {item.seoTitle}
                                                </p>
                                                <p className="text-xs text-violet-700 mt-1">{item.slug}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-violet-700 mt-3">
                                    Nothing newly queued yet on this run.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right Panel - Logs & Google CSE Results */}
                    <div className="lg:col-span-8 space-y-6 flex flex-col">
                        {/* Logs Panel */}
                        <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 h-[300px] flex flex-col overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                                <span className="text-gray-300 font-mono text-sm">Execution Logs</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500">Manual scroll</span>
                                    <span className="flex items-center space-x-2">
                                        <span className="h-3 w-3 rounded-full bg-red-500"></span>
                                        <span className="h-3 w-3 rounded-full bg-yellow-500"></span>
                                        <span className="h-3 w-3 rounded-full bg-green-500"></span>
                                    </span>
                                </div>
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
