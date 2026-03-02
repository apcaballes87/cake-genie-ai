'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Play, Pause, Square, CheckCircle2, LogOut } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cacheAnalysisResult, findSimilarAnalysisByHash } from '@/services/supabaseService';
import { fileToBase64 } from '@/services/geminiService';

const ADMIN_PIN = '231323';
const CSE_CONTAINER_ID = 'admin-search-container';
const CSE_CX = '825ca1503c1bd4d00';

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

    // Refs for process control
    const isPausedRef = useRef(false);
    const isStoppedRef = useRef(false);
    const cseElementRef = useRef<any>(null);
    const imageQueueRef = useRef<string[]>([]);
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
    const processImages = async () => {
        const queue = [...imageQueueRef.current];
        if (!queue.length) {
            toast.error('No images found. Search first and wait for results to load.');
            return;
        }

        setStatus('processing');
        isPausedRef.current = false;
        isStoppedRef.current = false;
        addLog(`Starting analysis of ${queue.length} images...`);

        let done = 0;
        let errors = 0;
        let skipped = 0;

        for (let i = 0; i < queue.length; i++) {
            if (isStoppedRef.current) {
                addLog('Stopped by user.');
                break;
            }

            while (isPausedRef.current) {
                if (isStoppedRef.current) break;
                await delay(500);
            }

            if (isStoppedRef.current) break;

            const imageUrl = queue[i];
            processedUrlsRef.current.add(imageUrl);

            // Highlight current image in CSE grid
            highlightCurrentImage(imageUrl, true);
            addLog(`[${i + 1}/${queue.length}] Processing image...`);

            try {
                // 1. Try the original URL first (including Facebook URLs)
                const imageToFetch = imageUrl;

                // Fetch via proxy
                const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageToFetch)}`;
                const response = await fetch(proxyUrl);

                // If original URL fails, try gstatic thumbnail as fallback
                if (!response.ok || response.status !== 200) {
                    const thumbnailUrl = getGstaticThumbnail();
                    if (thumbnailUrl) {
                        addLog(`[${i + 1}/${queue.length}] Main URL failed, trying thumbnail...`);
                        const retryUrl = `/api/proxy-image?url=${encodeURIComponent(thumbnailUrl)}`;
                        const retryResponse = await fetch(retryUrl);
                        if (!retryResponse.ok) throw new Error(`Proxy error: ${retryResponse.status}`);
                        const retryBlob = await retryResponse.blob();
                        if (!retryBlob.type.startsWith('image/')) throw new Error('Not an image');
                        const file = new File([retryBlob], 'search-image.webp', { type: retryBlob.type });
                        const imageData = await fileToBase64(file);
                        const imageSrc = `data:${imageData.mimeType};base64,${imageData.data}`;
                        const pHash = await generatePerceptualHash(imageSrc);
                        const cached = await findSimilarAnalysisByHash(pHash, imageUrl);
                        if (cached) {
                            addLog(`[${i + 1}/${queue.length}] Already in cache — skipped.`);
                            skipped++;
                        } else {
                            const aiResponse = await fetch('/api/ai/analyze', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ imageData: imageData.data, mimeType: imageData.mimeType })
                            });
                            if (!aiResponse.ok) throw new Error(`AI error: ${await aiResponse.text()}`);
                            const analysisResult = await aiResponse.json();
                            await cacheAnalysisResult(pHash, analysisResult, imageUrl);
                            addLog(`[${i + 1}/${queue.length}] Cached successfully (thumbnail).`);
                            done++;
                        }
                        await delay(1500);
                        highlightCurrentImage(imageUrl, false);
                        setProgress({ current: i + 1, total: queue.length });
                        continue;
                    }
                    throw new Error(`Proxy error: ${response.status}`);
                }

                const blob = await response.blob();
                if (!blob.type.startsWith('image/')) throw new Error('Not an image');

                const file = new File([blob], 'search-image.webp', { type: blob.type });
                const imageData = await fileToBase64(file);
                const imageSrc = `data:${imageData.mimeType};base64,${imageData.data}`;

                // 2. Generate pHash
                const pHash = await generatePerceptualHash(imageSrc);

                // 3. Check cache
                const cached = await findSimilarAnalysisByHash(pHash, imageUrl);
                if (cached) {
                    addLog(`[${i + 1}/${queue.length}] Already in cache — skipped.`);
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

                    // 5. Save to cache
                    await cacheAnalysisResult(pHash, analysisResult, imageUrl);
                    addLog(`[${i + 1}/${queue.length}] Cached successfully.`);
                    done++;
                }

                await delay(1500); // rate limit
            } catch (err: any) {
                addLog(`[${i + 1}/${queue.length}] ERROR: ${err.message}`);
                errors++;
            } finally {
                highlightCurrentImage(imageUrl, false);
                setProgress({ current: i + 1, total: queue.length });
            }
        }

        setStatus('idle');
        addLog(`Done! Processed: ${done}, Skipped: ${skipped}, Errors: ${errors}`);

        // Reset progress and image queue after completion
        imageQueueRef.current = [];
        processedUrlsRef.current = new Set();
        setProgress({ current: 0, total: 0 });

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
                    attributes: { searchType: 'image', disableWebSearch: true }
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

    // MutationObserver to collect images from CSE
    useEffect(() => {
        if (!isAuthenticated) return;

        const container = document.getElementById(CSE_CONTAINER_ID);
        if (!container) return;

        const collectImages = () => {
            // Collect ALL image URLs - we'll try original first, fallback to gstatic during processing
            container.querySelectorAll('.gs-image-box img, .gs-imageResult img, .gsc-imageResult img').forEach((img) => {
                const url = (img as HTMLImageElement).src;
                if (url?.startsWith('http') && !processedUrlsRef.current.has(url) && !imageQueueRef.current.includes(url)) {
                    imageQueueRef.current.push(url);
                    processedUrlsRef.current.add(url);
                    setProgress(prev => ({ ...prev, total: prev.total + 1 }));
                    addLog(`Found image: ${url.substring(0, 50)}...`);
                }
            });
        };

        containerObserverRef.current = new MutationObserver(collectImages);
        containerObserverRef.current.observe(container, { childList: true, subtree: true });

        // Initial collection
        setTimeout(collectImages, 1000);

        return () => {
            containerObserverRef.current?.disconnect();
        };
    }, [isAuthenticated, addLog]);

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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Panel - Controls & Logs */}
                    <div className="lg:col-span-1 space-y-4">
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
                                    onClick={status === 'paused' ? handlePauseToggle : processImages}
                                    disabled={status === 'processing' || !isCSELoaded}
                                    className="flex-1 flex items-center justify-center px-4 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {status === 'processing' ? (
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
                                            Start Analysis
                                        </>
                                    )}
                                </button>

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

                        {/* Logs Panel */}
                        <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 h-[400px] flex flex-col overflow-hidden">
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
                    </div>

                    {/* Right Panel - Google CSE Results */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[700px] overflow-hidden">
                            <div id={CSE_CONTAINER_ID} className="min-h-[600px]"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
