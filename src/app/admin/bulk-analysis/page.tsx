'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { getSupabaseClient } from '@/lib/supabase/client';
import { cacheAnalysisResult, findSimilarAnalysisByHash } from '@/services/supabaseService';
import { fileToBase64 } from '@/services/geminiService';
import { Upload, Download, Play, AlertCircle, CheckCircle2, Copy, Pause, Square } from 'lucide-react';
import { toast } from 'react-hot-toast';

const ADMIN_PIN = '231323';

// Helper for pHash
async function generatePerceptualHash(imageSrc: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Important for CORS
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

export default function BulkAnalysisAdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pin, setPin] = useState('');

    const [csvData, setCsvData] = useState<any[]>([]);
    const [status, setStatus] = useState<'idle' | 'processing' | 'paused'>('idle');
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);

    const isPausedRef = useRef(false);
    const isStoppedRef = useRef(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin === ADMIN_PIN) {
            setIsAuthenticated(true);
        } else {
            toast.error('Invalid PIN');
        }
    };

    const addLog = (msg: string) => {
        setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
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
            // the loop will catch this and exit
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setCsvData(results.data as any[]);
                addLog(`Loaded ${results.data.length} rows from CSV`);
            },
            error: (error) => {
                toast.error(`Error parsing CSV: ${error.message}`);
            }
        });
    };

    const processBulkAnalysis = async () => {
        if (!csvData.length) {
            toast.error('No CSV data loaded');
            return;
        }

        setStatus('processing');
        isPausedRef.current = false;
        isStoppedRef.current = false;
        setProgress(0);
        addLog('Starting bulk processing...');

        const updatedData = [...csvData];
        let processedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < updatedData.length; i++) {
            if (isStoppedRef.current) {
                addLog('Process stopped by user.');
                break;
            }
            while (isPausedRef.current) {
                if (isStoppedRef.current) break;
                await delay(500);
            }
            if (isStoppedRef.current) {
                addLog('Process stopped by user.');
                break;
            }

            const row = updatedData[i];
            const title = row['title'] || row['Title'] || '';
            const analysisDone = row['Analysis Done?'] || row['Analysis Done'] || '';
            const linkImage = row['Link Image'] || row['Image URL'] || '';

            // Skip already done or cupcakes
            const isCupcake = title.toLowerCase().includes('cupcake') || title.toLowerCase().includes('cupcakes');
            const isDone = analysisDone.toString().toLowerCase() === 'true';

            if (isCupcake || isDone || !linkImage) {
                if (isCupcake) addLog(`Row ${i + 1}: Skipping "${title}" (Cupcake)`);
                else if (isDone) addLog(`Row ${i + 1}: Skipping "${title}" (Already Done)`);
                else addLog(`Row ${i + 1}: Skipping (No Image)`);

                setProgress(Math.round(((i + 1) / updatedData.length) * 100));
                continue;
            }

            addLog(`Row ${i + 1}: Processing "${title}"...`);

            try {
                // 1. Fetch image via proxy and get Base64
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(linkImage)}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

                const blob = await response.blob();
                if (!blob.type.startsWith('image/')) {
                    throw new Error('Fetched content is not an image');
                }

                const file = new File([blob], 'product-image.webp', { type: blob.type || 'image/webp' });
                const imageData = await fileToBase64(file);
                const imageSrc = `data:${imageData.mimeType};base64,${imageData.data}`;

                // 2. Generate Hash
                const pHash = await generatePerceptualHash(imageSrc);

                // 3. Call AI endpoint
                const aiResponse = await fetch('/api/ai/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageData: imageData.data,
                        mimeType: imageData.mimeType
                    }),
                });

                if (!aiResponse.ok) {
                    const errText = await aiResponse.text();
                    throw new Error(`AI Api Error: ${errText}`);
                }

                const analysisResult = await aiResponse.json();

                // 4. Override title and save to cache
                analysisResult.seo_title = title;
                // Optionally update alt_text or descriptions if needed, but the prompt said overwrite title

                await cacheAnalysisResult(pHash, analysisResult, linkImage);

                // 5. Update row 
                updatedData[i]['Analysis Done?'] = 'true';
                updatedData[i]['Analysis Done'] = 'true'; // Set both just in case

                addLog(`Row ${i + 1}: Successfully processed and cached.`);
                processedCount++;

                // 6. Wait to prevent rate limiting (1.5s as per plan)
                await delay(1500);

            } catch (error: any) {
                addLog(`Row ${i + 1} ERROR: ${error.message}`);
                errorCount++;
            }

            setProgress(Math.round(((i + 1) / updatedData.length) * 100));
        }

        setCsvData(updatedData);
        setStatus('idle');
        addLog(`Finished! Processed: ${processedCount}, Errors: ${errorCount}`);

        if (errorCount === 0) {
            toast.success('Bulk processing completed successfully!');
        } else {
            toast.error(`Completed with ${errorCount} errors. Check logs.`);
        }
    };

    const handleDownload = () => {
        if (!csvData.length) return;
        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `bulk_analysis_results_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Bulk AI Analysis</h1>
                        <p className="text-gray-500 mt-1">Upload a CSV to process cake product images through Gemini AI automatically.</p>
                    </div>
                    <button
                        onClick={() => setIsAuthenticated(false)}
                        className="text-sm text-gray-400 hover:text-gray-600"
                    >
                        Logout
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Controls Panel */}
                    <div className="md:col-span-1 space-y-4">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">1. Upload CSV</h2>
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                ref={fileInputRef}
                                className="hidden"
                                id="csv-upload"
                            />
                            <label
                                htmlFor="csv-upload"
                                className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors"
                            >
                                <Upload className="w-5 h-5 mr-2 text-gray-500" />
                                <span className="text-gray-600 font-medium">Select CSV File</span>
                            </label>
                            {csvData.length > 0 && (
                                <p className="text-sm text-green-600 mt-2 flex items-center">
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Loaded {csvData.length} records
                                </p>
                            )}
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">2. Process & Analyze</h2>
                            <div className="flex space-x-2">
                                <button
                                    onClick={status === 'paused' ? handlePauseToggle : processBulkAnalysis}
                                    disabled={status === 'processing' || csvData.length === 0}
                                    className="flex-1 flex items-center justify-center px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {status === 'processing' ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                            Processing ({progress}%)
                                        </>
                                    ) : status === 'paused' ? (
                                        <>
                                            <Play className="w-5 h-5 mr-2" />
                                            Resume Analysis
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-5 h-5 mr-2" />
                                            Start Bulk Analysis
                                        </>
                                    )}
                                </button>

                                {status !== 'idle' && (
                                    <>
                                        <button
                                            onClick={handlePauseToggle}
                                            className="px-4 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                                            title={status === 'paused' ? "Resume" : "Pause"}
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

                            {status !== 'idle' && (
                                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
                                    <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">3. Save Output</h2>
                            <button
                                onClick={handleDownload}
                                disabled={csvData.length === 0 || status !== 'idle'}
                                className="w-full flex items-center justify-center px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download className="w-5 h-5 mr-2" />
                                Download Updated CSV
                            </button>
                        </div>
                    </div>

                    {/* Logs Panel */}
                    <div className="md:col-span-2">
                        <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 h-[600px] flex flex-col overflow-hidden">
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
                                    <div className="text-gray-600 italic">Waiting... Load a CSV to begin.</div>
                                ) : (
                                    logs.map((log, i) => (
                                        <div
                                            key={i}
                                            className={`${log.includes('ERROR') ? 'text-red-400' : log.includes('Success') ? 'text-green-400' : log.includes('Skipping') ? 'text-yellow-400' : 'text-gray-300'}`}
                                        >
                                            {log}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
