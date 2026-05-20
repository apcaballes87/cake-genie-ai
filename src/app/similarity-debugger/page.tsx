"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { showSuccess, showError, showInfo } from '../../lib/utils/toast';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { getSupabaseClient } from '../../lib/supabase/client';

interface MatchResult {
  match: boolean;
  confidence: number;
  good_matches: number;
  ransac_inliers: number;
  inlier_ratio: number;
  matched_image_id: string | null;
  matched_image_url: string | null;
  analysis_json: any | null;
  drawn_matches_b64: string | null;
  candidates_evaluated: number;
  execution_time_ms: number;
}

const TEST_IMAGES = [
  {
    name: 'Cinnamoroll Cake (Original)',
    url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/analysis-cache/cinnamoroll-birthday-cake-037ffffeffba0000.webp',
    type: 'original',
    desc: 'The uncropped reference design.',
  },
  {
    name: 'Cinnamoroll Cake (Cropped)',
    url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/analysis-cache/cinnamoroll-birthday-cake-037ffffeffba0000.webp',
    type: 'cropped',
    desc: 'Simulated 70% center-cropped region.',
  },
  {
    name: 'Cinnamoroll Cake (Compressed)',
    url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/analysis-cache/cinnamoroll-birthday-cake-037ffffeffba0000.webp',
    type: 'compressed',
    desc: 'Simulated highly-compressed low-quality JPEG.',
  },
  {
    name: 'Unindexed 3-Tier (False Positive)',
    url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/3tier.webp',
    type: 'false_positive',
    desc: 'A completely different, unindexed cake design.',
  }
];

export const SimilarityDebugger: React.FC = () => {
  const supabase = getSupabaseClient();

  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [matchingMode, setMatchingMode] = useState<'default' | 'strict' | 'loose'>('default');
  const [minGoodMatches, setMinGoodMatches] = useState<number>(30);
  const [minRansacInliers, setMinRansacInliers] = useState<number>(18);
  const [minInlierRatio, setMinInlierRatio] = useState<number>(0.25);
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [backendStatus, setBackendStatus] = useState<{ status: string; database: string; indexed_images: number } | null>(null);

  // Check Backend Status on mount
  const checkBackend = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/status');
      if (!response.ok) {
        throw new Error('Backend offline');
      }
      const data = await response.json();
      setBackendStatus(data);
    } catch (err) {
      console.warn('FastAPI backend seems offline. Run the Python uvicorn server on port 8000.');
      setBackendStatus({ status: 'offline', database: 'unknown', indexed_images: 0 });
    }
  }, []);

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, [checkBackend]);

  // Handle mode switches
  const handleModeChange = useCallback((mode: 'default' | 'strict' | 'loose') => {
    setMatchingMode(mode);
    if (mode === 'default') {
      setMinGoodMatches(30);
      setMinRansacInliers(18);
      setMinInlierRatio(0.25);
    } else if (mode === 'strict') {
      setMinGoodMatches(35);
      setMinRansacInliers(30);
      setMinInlierRatio(0.35);
    } else if (mode === 'loose') {
      setMinGoodMatches(20);
      setMinRansacInliers(12);
      setMinInlierRatio(0.20);
    }
  }, []);

  // Set file and preview
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null); // Clear previous results
  }, []);

  // Trigger FastAPI similarity matching
  const triggerMatching = useCallback(async (fileToMatch: File | null) => {
    const file = fileToMatch || selectedFile;
    if (!file) {
      showError('Please upload or select an image first.');
      return;
    }

    setIsMatching(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Sync configurations with backend first
      await fetch('http://localhost:8000/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: matchingMode,
          min_good_matches: minGoodMatches,
          min_ransac_inliers: minRansacInliers,
          min_inlier_ratio: minInlierRatio,
        }),
      });

      // Execute matching call
      const matchUrl = `http://localhost:8000/api/match?mode=${matchingMode}&visualize=true`;
      const response = await fetch(matchUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve similarity matches from server');
      }

      const matchData: MatchResult = await response.json();
      setResult(matchData);
      
      if (matchData.match) {
        showSuccess(`Match detected with ${matchData.confidence * 100}% confidence!`);
      } else {
        showInfo('No matching image found in the database cache.');
      }
    } catch (err) {
      console.error(err);
      showError(err instanceof Error ? err.message : 'An error occurred during verification.');
    } finally {
      setIsMatching(false);
    }
  }, [selectedFile, matchingMode, minGoodMatches, minRansacInliers, minInlierRatio]);

  // Upload or select a pre-packed test URL
  const selectTestUrl = useCallback(async (imgUrl: string, type: string) => {
    setIsMatching(true);
    setResult(null);
    try {
      // For crop/compress simulation on the client
      const response = await fetch(imgUrl);
      if (!response.ok) throw new Error('Failed to fetch test image');
      const blob = await response.blob();
      
      let finalBlob = blob;
      
      // Real client-side canvas crop/compression simulation
      if (type === 'cropped' || type === 'compressed') {
        if (type === 'cropped') {
          showInfo('Simulating image crop (70% center crop)...');
        } else {
          showInfo('Simulating high JPEG compression...');
        }
        
        // Load image into an Image object
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        // Create object URL for blob to avoid CORS
        const blobUrl = URL.createObjectURL(blob);
        img.src = blobUrl;
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (type === 'cropped') {
            // Crop middle 70% region
            const cropWidth = img.width * 0.7;
            const cropHeight = img.height * 0.7;
            const cropX = img.width * 0.15;
            const cropY = img.height * 0.15;
            
            canvas.width = cropWidth;
            canvas.height = cropHeight;
            ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
            
            finalBlob = await new Promise<Blob>((resolve) => {
              canvas.toBlob((b) => resolve(b || blob), 'image/webp', 0.85);
            });
          } else if (type === 'compressed') {
            // Full dimensions but highly compressed JPEG quality 0.05
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            finalBlob = await new Promise<Blob>((resolve) => {
              canvas.toBlob((b) => resolve(b || blob), 'image/jpeg', 0.05);
            });
          }
        }
        
        URL.revokeObjectURL(blobUrl);
      }

      const file = new File([finalBlob], `test-${type}.${type === 'compressed' ? 'jpg' : 'webp'}`, { 
        type: type === 'compressed' ? 'image/jpeg' : 'image/webp' 
      });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      
      // Trigger match directly after a short delay
      setTimeout(() => triggerMatching(file), 500);
    } catch (err) {
      console.error(err);
      showError('Failed to load test image.');
      setIsMatching(false);
    }
  }, [triggerMatching]);

  const handleMatchClick = () => triggerMatching(null);

  const handleKeyDownMatch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerMatching(null);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
            Genie Similarity Debugger Console
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Visual testing for crop, resize, compression, and RANSAC homography similarity verification.
          </p>
        </div>
        
        {/* Backend Status indicator */}
        <div className="mt-4 md:mt-0 flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">FastAPI Backend Status</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${backendStatus?.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-sm font-bold text-slate-200">
                {backendStatus?.status === 'online' ? 'ONLINE' : 'OFFLINE (Start backend)'}
              </span>
            </div>
          </div>
          {backendStatus?.status === 'online' && (
            <div className="border-l border-slate-800 pl-3 flex flex-col">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Indexed Entries</span>
              <span className="text-sm font-black text-purple-400">{backendStatus.indexed_images} Images</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Controls, Upload, Pre-packaged suite (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Controls Box */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              <span className="text-purple-400">⚙️</span> Match Config & Thresholds
            </h2>
            
            {/* Mode Selectors */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {(['loose', 'default', 'strict'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border uppercase tracking-wider transition-all duration-200 ${
                    matchingMode === mode
                      ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/40 font-black'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Threshold Sliders */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 font-medium">Min Good ORB Matches</span>
                  <span className="text-purple-400 font-mono font-bold">{minGoodMatches}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={minGoodMatches}
                  onChange={(e) => setMinGoodMatches(parseInt(e.target.value))}
                  className="w-full accent-purple-500 bg-slate-850 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 font-medium">Min RANSAC Inliers</span>
                  <span className="text-pink-400 font-mono font-bold">{minRansacInliers}</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="50"
                  value={minRansacInliers}
                  onChange={(e) => setMinRansacInliers(parseInt(e.target.value))}
                  className="w-full accent-pink-500 bg-slate-850 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 font-medium">Min Inlier Ratio</span>
                  <span className="text-red-400 font-mono font-bold">{(minInlierRatio * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  step="5"
                  value={minInlierRatio * 100}
                  onChange={(e) => setMinInlierRatio(parseInt(e.target.value) / 100)}
                  className="w-full accent-red-500 bg-slate-850 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Upload Box */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col">
            <h2 className="text-lg font-bold text-slate-200 mb-3 flex items-center gap-2">
              <span className="text-pink-400">🖼️</span> Upload Query Image
            </h2>
            
            <label className="border-2 border-dashed border-slate-800 hover:border-purple-500/50 bg-slate-950/40 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group">
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <span className="text-4xl mb-2 group-hover:scale-110 transition-transform">📤</span>
              <span className="text-sm font-semibold text-slate-300">Drag & drop or browse</span>
              <span className="text-xs text-slate-500 mt-1">Supports JPEG, WebP, PNG</span>
            </label>

            {previewUrl && (
              <div className="mt-5 border border-slate-800 p-2.5 rounded-xl bg-slate-950/80">
                <p className="text-xs text-slate-500 font-bold mb-1.5 uppercase">Query Image Preview</p>
                <img src={previewUrl} alt="Query preview" className="w-full h-44 object-cover rounded-lg border border-slate-900" />
                <button
                  onClick={handleMatchClick}
                  onKeyDown={handleKeyDownMatch}
                  tabIndex={0}
                  disabled={isMatching || backendStatus?.status !== 'online'}
                  className="w-full mt-3 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-800 disabled:to-slate-800 text-white font-extrabold rounded-xl transition-all duration-300 shadow-md shadow-purple-950/40 uppercase text-xs tracking-wider flex items-center justify-center gap-2"
                >
                  {isMatching ? <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : '🔍'} Verify Similarity
                </button>
              </div>
            )}
          </div>

          {/* Test Suite Box */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <h2 className="text-lg font-bold text-slate-200 mb-3 flex items-center gap-2">
              <span className="text-emerald-400">🧪</span> Test Suite
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Instantly test similarity matching with preloaded edge cases.
            </p>
            <div className="flex flex-col gap-2.5">
              {TEST_IMAGES.map((test, index) => (
                <button
                  key={index}
                  onClick={() => selectTestUrl(test.url, test.type)}
                  className="w-full text-left bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/60 p-3 rounded-xl transition-all duration-200 group flex justify-between items-center"
                >
                  <div>
                    <h3 className="text-xs font-black text-slate-200 group-hover:text-purple-400 transition-colors uppercase tracking-wider">{test.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-normal">{test.desc}</p>
                  </div>
                  <span className="text-slate-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-all">➔</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* CENTER COLUMN: Visual matches viewer (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl flex-grow flex flex-col min-h-[450px]">
            <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              <span className="text-cyan-400">🗺️</span> Visual keypoint alignments
            </h2>
            
            <div className="flex-grow border border-slate-850 rounded-xl bg-slate-950/80 flex flex-col items-center justify-center overflow-hidden p-4 relative">
              {isMatching && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-6">
                  <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin mb-4"></div>
                  <h3 className="text-lg font-extrabold text-purple-400 tracking-wide uppercase">RANSAC Homography Matching...</h3>
                  <p className="text-xs text-slate-500 mt-2 max-w-xs">
                    Computing query tile hashes, retrieving candidates, running Hamming distance matcher, and filtering spatial outliers...
                  </p>
                </div>
              )}

              {result ? (
                result.match && result.drawn_matches_b64 ? (
                  <div className="w-full h-full flex flex-col items-center">
                    <img
                      src={result.drawn_matches_b64}
                      alt="Visual keypoint matches alignment"
                      className="w-full max-h-[450px] object-contain rounded-lg border border-slate-900 shadow-xl"
                    />
                    <div className="mt-3 flex gap-4 text-xs font-semibold text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Good Inliers (Spatial Match)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-rose-500 rounded-full"></span> Keypoints Discarded by RANSAC
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 max-w-xs">
                    <span className="text-5xl block mb-3">🔍</span>
                    <h3 className="text-lg font-extrabold text-slate-300 uppercase tracking-wider">No Verified Match</h3>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Features were computed but RANSAC validation did not satisfy thresholds.
                    </p>
                  </div>
                )
              ) : (
                <div className="text-center p-8 max-w-xs">
                  <span className="text-6xl block mb-3 animate-pulse">📷</span>
                  <h3 className="text-lg font-extrabold text-slate-500 uppercase tracking-wider">Awaiting query image</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Upload an image or select a test case to analyze the spatial keypoints.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Metrics Dashboard & Cake Details (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Match Verdict HUD */}
          <div className={`rounded-2xl p-5 border text-center shadow-xl transition-all duration-300 ${
            result
              ? result.match
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100 shadow-emerald-950/20'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-100 shadow-rose-950/20'
              : 'bg-slate-900/60 border-slate-800/80 text-slate-400'
          }`}>
            <span className="text-xs uppercase font-black tracking-widest text-slate-500 block mb-1">Verification Verdict</span>
            {result ? (
              result.match ? (
                <div>
                  <h3 className="text-2xl font-black text-emerald-400 tracking-wide uppercase animate-pulse">MATCH VERIFIED</h3>
                  <div className="mt-3 flex items-baseline justify-center gap-1.5">
                    <span className="text-4xl font-extrabold text-emerald-300 font-mono">{(result.confidence * 100).toFixed(0)}%</span>
                    <span className="text-xs text-emerald-500 font-black">Confidence</span>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-2xl font-black text-rose-400 tracking-wide uppercase">REJECTED</h3>
                  <p className="text-xs text-rose-500 mt-1 leading-normal">Outlier thresholds failed.</p>
                </div>
              )
            ) : (
              <h3 className="text-xl font-bold text-slate-500 tracking-wide uppercase">NO DATA</h3>
            )}
          </div>

          {/* Metrics Panel */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <h2 className="text-sm font-black text-slate-400 mb-4 uppercase tracking-wider">Diagnostic Telemetry</h2>
            
            <div className="grid grid-cols-1 gap-4 font-mono">
              {/* Inliers metric */}
              <div className="bg-slate-950/60 border border-slate-850 p-3.5 rounded-xl">
                <span className="text-slate-500 text-xs font-semibold block uppercase">RANSAC Inliers</span>
                <div className="flex justify-between items-baseline mt-1.5">
                  <span className="text-xl font-black text-slate-200">{result?.ransac_inliers || 0}</span>
                  <span className="text-xs text-slate-500">Target: ≥ {minRansacInliers}</span>
                </div>
              </div>

              {/* Inlier Ratio metric */}
              <div className="bg-slate-950/60 border border-slate-850 p-3.5 rounded-xl">
                <span className="text-slate-500 text-xs font-semibold block uppercase">Inlier Ratio</span>
                <div className="flex justify-between items-baseline mt-1.5">
                  <span className="text-xl font-black text-slate-200">
                    {result ? `${(result.inlier_ratio * 100).toFixed(0)}%` : '0%'}
                  </span>
                  <span className="text-xs text-slate-500">Target: ≥ {(minInlierRatio * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Good matches metric */}
              <div className="bg-slate-950/60 border border-slate-850 p-3.5 rounded-xl">
                <span className="text-slate-500 text-xs font-semibold block uppercase">Good Matches</span>
                <div className="flex justify-between items-baseline mt-1.5">
                  <span className="text-xl font-black text-slate-200">{result?.good_matches || 0}</span>
                  <span className="text-xs text-slate-500">Target: ≥ {minGoodMatches}</span>
                </div>
              </div>

              {/* Speed metric */}
              <div className="bg-slate-950/60 border border-slate-850 p-3.5 rounded-xl">
                <span className="text-slate-500 text-xs font-semibold block uppercase">Latency Speed</span>
                <div className="flex justify-between items-baseline mt-1.5">
                  <span className="text-xl font-black text-purple-400">
                    {result ? `${result.execution_time_ms.toFixed(0)} ms` : '0 ms'}
                  </span>
                  <span className="text-xs text-slate-500">Candidates: {result?.candidates_evaluated || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Matched Cake Details */}
          {result?.match && result.analysis_json && (
            <div className="bg-gradient-to-br from-purple-950/40 via-slate-900/60 to-slate-900/60 backdrop-blur-md border border-purple-500/20 rounded-2xl p-5 shadow-xl">
              <h2 className="text-sm font-black text-purple-400 mb-3.5 uppercase tracking-wider">Matched Cake Info</h2>
              
              <div className="space-y-3.5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Cake Type</span>
                  <p className="text-sm font-extrabold text-slate-200 mt-0.5">{result.analysis_json.type || 'Custom Cake'}</p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Dimensions</span>
                  <p className="text-sm font-extrabold text-slate-200 mt-0.5">
                    {result.analysis_json.layers?.length || 1} Layer(s) / {result.analysis_json.thickness || 'Standard'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Base Estimate Price</span>
                  <p className="text-lg font-black text-purple-300 mt-0.5">
                    ₱{result.analysis_json.estimatedPrice || '0.00'}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
export default SimilarityDebugger;
