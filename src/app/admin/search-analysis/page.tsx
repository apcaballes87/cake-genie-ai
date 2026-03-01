'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cacheAnalysisResult, findSimilarAnalysisByHash } from '@/services/supabaseService';
import { fileToBase64 } from '@/services/geminiService';
import { Search, Play, Pause, Square } from 'lucide-react';
import { toast } from 'react-hot-toast';

const ADMIN_PIN = '231323';
const CSE_CONTAINER_ID = 'search-analysis-cse';

declare global {
    interface Window {
        __gcse?: { parsetags: string; callback: () => void };
        google?: any;
    }
}

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
            if (!ctx) return reject('No canvas context');
            ctx.drawImage(img, 0, 0, size, size);
            const pixelData = ctx.getImageData(0, 0, size, size).data;
            const grayscale: number[] = [];
            let total = 0;
            for (let i = 0; i < pixelData.length; i += 4) {
                const lum = 0.299 * pixelData[i] + 0.587 * pixelData[i + 1] + 0.114 * pixelData[i + 2];
                grayscale.push(lum);
                total += lum;
            }
            const avg = total / grayscale.length;
            let hash = 0n;
            grayscale.forEach((lum, i) => { if (lum > avg) hash |= 1n << BigInt(i); });
            resolve(hash.toString(16).padStart(16, '0'));
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = imageSrc;
    });
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function SearchAnalysisPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pin, setPin] = useState('');

    // Search state
    const [keyword, setKeyword] = useState('');
    const [activeKeyword, setActiveKeyword] = useState('');
    const [isCSELoaded, setIsCSELoaded] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Detected images from CSE results
    const [detectedImages, setDetectedImages] = useState<string[]>([]);
    const detectedSetRef = useRef<Set<string>>(new Set());

    // Processing state
    const [status, setStatus] = useState<'idle' | 'processing' | 'paused'>('idle');
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const isPausedRef = useRef(false);
    const isStoppedRef = useRef(false);

    // CSE refs
    const cseElementRef = useRef<any>(null);
    const cseContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs to bottom
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const addLog = useCallback((msg: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);
    }, []);

    // Load Google CSE script once authenticated
    useEffect(() => {
        if (!isAuthenticated) return;

        if (window.google?.search?.cse) {
            setIsCSELoaded(true);
            return;
        }

        // Script may already be injected by the /search page
        const existingScript = document.getElementById('google-cse-script') || document.getElementById('search-analysis-cse-script');
        if (existingScript) {
            const iv = setInterval(() => {
                if (window.google?.search?.cse) { setIsCSELoaded(true); clearInterval(iv); }
            }, 100);
            const t = setTimeout(() => clearInterval(iv), 10000);
            return () => { clearInterval(iv); clearTimeout(t); };
        }

        if (!window.__gcse) {
            window.__gcse = {
                parsetags: 'explicit',
                callback: () => { if (window.google?.search?.cse) setIsCSELoaded(true); }
            };
        }

        const script = document.createElement('script');
        script.src = 'https://cse.google.com/cse.js?cx=825ca1503c1bd4d00';
        script.async = true;
        script.id = 'search-analysis-cse-script';
        document.head.appendChild(script);
    }, [isAuthenticated]);

    // MutationObserver — auto-collect image URLs as CSE renders results
    useEffect(() => {
        if (!isAuthenticated) return;
        const container = cseContainerRef.current;
        if (!container) return;

        const observer = new MutationObserver(() => {
            let changed = false;
            container.querySelectorAll('.gs-image-box img, .gs-image img').forEach(el => {
                const src = (el as HTMLImageElement).src;
                if (src && src.startsWith('http') && !detectedSetRef.current.has(src)) {
                    detectedSetRef.current.add(src);
                    changed = true;
                }
            });
            if (changed) setDetectedImages([...detectedSetRef.current]);
        });

        observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
        return () => observer.disconnect();
    }, [isAuthenticated]);

    const handleSearch = useCallback(() => {
        const q = keyword.trim();
        if (!q || !isCSELoaded) return;

        // Reset image list for new search
        detectedSetRef.current = new Set();
        setDetectedImages([]);
        setActiveKeyword(q);
        setIsSearching(true);
        addLog(`Searching for: "${q}"...`);

        const run = () => {
            try {
                let el = cseElementRef.current;
                if (!el && window.google?.search?.cse?.element) {
                    el = window.google.search.cse.element.render({
                        div: CSE_CONTAINER_ID,
                        tag: 'searchresults-only',
                        gname: 'search-analysis',
                        attributes: { searchType: 'image', disableWebSearch: true },
                    });
                    cseElementRef.current = el;
                }
                if (el) {
                    el.execute(q);
                    setTimeout(() => setIsSearching(false), 1500);
                } else {
                    setTimeout(run, 100);
                }
            } catch (e) {
                addLog('Error: Failed to execute search.');
                setIsSearching(false);
            }
        };

        run();
    }, [keyword, isCSELoaded, addLog]);

    const handlePauseToggle = () => {
        if (status === 'processing') {
            isPausedRef.current = true;
            setStatus('paused');
            addLog('Paused.');
        } else if (status === 'paused') {
            isPausedRef.current = false;
            setStatus('processing');
            addLog('Resumed.');
        }
    };

    const handleStop = () => {
        if (status !== 'idle') {
            isStoppedRef.current = true;
            isPausedRef.current = false;
            setStatus('idle');
        }
    };

    const startAnalysis = async () => {
        if (!detectedImages.length) {
            toast.error('No images detected. Please search first.');
            return;
        }

        setStatus('processing');
        isPausedRef.current = false;
        isStoppedRef.current = false;
        setProgress(0);
        addLog(`Starting analysis of ${detectedImages.length} images for "${activeKeyword}"...`);

        let processed = 0, skipped = 0, errors = 0;
        const total = detectedImages.length;

        for (let i = 0; i < total; i++) {
            if (isStoppedRef.current) { addLog('Stopped by user.'); break; }
            while (isPausedRef.current) {
                if (isStoppedRef.current) break;
                await delay(500);
            }
            if (isStoppedRef.current) { addLog('Stopped by user.'); break; }

            const imgUrl = detectedImages[i];
            addLog(`[${i + 1}/${total}] Fetching image...`);

            try {
                // 1. Fetch via proxy
                const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(imgUrl)}`);
                if (!res.ok) throw new Error(`Proxy ${res.status}`);
                const blob = await res.blob();
                if (!blob.type.startsWith('image/')) throw new Error('Not an image');

                // 2. Convert to base64
                const file = new File([blob], 'img.jpg', { type: blob.type });
                const imgData = await fileToBase64(file);
                const dataUri = `data:${imgData.mimeType};base64,${imgData.data}`;

                // 3. Generate perceptual hash
                const pHash = await generatePerceptualHash(dataUri);
                addLog(`[${i + 1}/${total}] pHash: ${pHash.slice(0, 8)}... — checking cache...`);

                // 4. Skip if already cached
                const cached = await findSimilarAnalysisByHash(pHash);
                if (cached) {
                    addLog(`[${i + 1}/${total}] Already in cache. Skipping.`);
                    skipped++;
                    setProgress(Math.round(((i + 1) / total) * 100));
                    await delay(300);
                    continue;
                }

                // 5. AI analysis
                addLog(`[${i + 1}/${total}] Not cached — sending to Gemini AI...`);
                const aiRes = await fetch('/api/ai/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageData: imgData.data, mimeType: imgData.mimeType }),
                });
                if (!aiRes.ok) throw new Error(`AI error: ${await aiRes.text()}`);
                const result = await aiRes.json();

                // 6. Set keyword if AI didn't produce one
                if (!result.keyword) result.keyword = activeKeyword;

                // 7. Save to cache
                await cacheAnalysisResult(pHash, result, imgUrl);
                addLog(`[${i + 1}/${total}] ✓ Saved to cache (keyword: "${result.keyword}")`);
                processed++;

                // Rate-limit to avoid hammering the AI API
                await delay(1500);
            } catch (err: any) {
                addLog(`[${i + 1}/${total}] ERROR: ${err.message}`);
                errors++;
            }

            setProgress(Math.round(((i + 1) / total) * 100));
        }

        setStatus('idle');
        addLog(`Done! Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
        errors === 0
            ? toast.success(`${processed} new items cached!`)
            : toast.error(`Completed with ${errors} errors. Check logs.`);
    };

    // ── PIN screen ──────────────────────────────────────────────────────────────
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
                    <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Admin Login</h1>
                    <form
                        onSubmit={e => {
                            e.preventDefault();
                            pin === ADMIN_PIN ? setIsAuthenticated(true) : toast.error('Invalid PIN');
                        }}
                        className="space-y-4"
                    >
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Enter PIN</label>
                            <input
                                type="password"
                                value={pin}
                                onChange={e => setPin(e.target.value)}
                                placeholder="••••••"
                                autoFocus
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                        >
                            Access Admin
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ── Main page ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Search-Based AI Analysis</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Search for cake images, then run Gemini AI analysis and save results to the cache.
                    </p>
                </div>
                <button
                    onClick={() => setIsAuthenticated(false)}
                    className="text-sm text-gray-400 hover:text-gray-600"
                >
                    Logout
                </button>
            </div>

            {/* Two-column split layout */}
            <div className="flex flex-1 overflow-hidden">

                {/* ── LEFT: Google CSE search results ───────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                    {/* Search bar */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="Enter a cake keyword (e.g. princess cake, floral cake…)"
                            disabled={!isCSELoaded || status !== 'idle'}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={!isCSELoaded || isSearching || !keyword.trim() || status !== 'idle'}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm shrink-0"
                        >
                            {isSearching
                                ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                : <Search className="w-4 h-4" />
                            }
                            {isCSELoaded ? 'Search' : 'Loading…'}
                        </button>
                    </div>

                    {/* Google CSE renders its image grid here */}
                    <div ref={cseContainerRef} id={CSE_CONTAINER_ID} className="min-h-[400px]" />
                </div>

                {/* ── RIGHT: Controls + Execution logs ──────────────────────── */}
                <div className="w-96 shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">

                    {/* Controls */}
                    <div className="p-5 border-b border-gray-100 space-y-4">
                        <h2 className="font-semibold text-gray-800">Analysis Controls</h2>

                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Images detected</span>
                            <span className={`font-bold tabular-nums ${detectedImages.length ? 'text-green-600' : 'text-gray-400'}`}>
                                {detectedImages.length}
                            </span>
                        </div>

                        {activeKeyword && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600">Keyword:</span>
                                <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                    {activeKeyword}
                                </span>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={status === 'paused' ? handlePauseToggle : startAnalysis}
                                disabled={status === 'processing' || detectedImages.length === 0}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                            >
                                {status === 'processing' ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                        Processing ({progress}%)
                                    </>
                                ) : status === 'paused' ? (
                                    <><Play className="w-4 h-4" /> Resume</>
                                ) : (
                                    <><Play className="w-4 h-4" /> Start Analysis</>
                                )}
                            </button>

                            {status !== 'idle' && (
                                <>
                                    <button
                                        onClick={handlePauseToggle}
                                        title={status === 'paused' ? 'Resume' : 'Pause'}
                                        className="px-3 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                                    >
                                        {status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={handleStop}
                                        title="Stop"
                                        className="px-3 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                    >
                                        <Square className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Progress bar */}
                        {status !== 'idle' && (
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-primary h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Terminal-style log output */}
                    <div className="flex-1 bg-gray-950 flex flex-col overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between shrink-0">
                            <span className="text-gray-300 font-mono text-xs">Execution Logs</span>
                            <div className="flex items-center gap-3">
                                {logs.length > 0 && (
                                    <button
                                        onClick={() => setLogs([])}
                                        className="text-gray-600 hover:text-gray-400 text-xs font-mono"
                                    >
                                        clear
                                    </button>
                                )}
                                <div className="flex gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5">
                            {logs.length === 0 ? (
                                <p className="text-gray-600 italic">Search for cakes to begin…</p>
                            ) : (
                                logs.map((log, i) => (
                                    <div
                                        key={i}
                                        className={
                                            log.includes('ERROR') ? 'text-red-400' :
                                            log.includes('✓') || log.includes('Done!') ? 'text-green-400' :
                                            log.includes('Already in cache') ? 'text-yellow-400' :
                                            'text-gray-300'
                                        }
                                    >
                                        {log}
                                    </div>
                                ))
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
