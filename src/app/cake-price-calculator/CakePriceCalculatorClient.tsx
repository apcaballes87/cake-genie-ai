'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { compressImage, validateImageFile } from '@/lib/utils/imageOptimization';
import { showError, showInfo } from '@/lib/utils/toast';
import { Loader2 } from '@/components/icons';
import { ArrowLeft, Upload, Camera, ChevronDown, ChevronUp } from 'lucide-react';

// Configuration
const BUCKET_NAME = 'uploadopenai';
const IMG_MAX_LONG_EDGE = 1800;
const IMG_TARGET_MAX_BYTES = 1_200_000;

const CakePriceCalculatorClient: React.FC = () => {
    const router = useRouter();
    const supabase = createClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    // Ensure anonymous auth for Supabase storage access
    const ensureAuth = useCallback(async () => {
        try {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                await supabase.auth.signInAnonymously();
            }
        } catch (e) {
            console.warn('Auth warning:', e);
        }
    }, [supabase]);

    // Downscale and compress image
    const downscaleAndCompress = useCallback(async (file: File): Promise<{ blob: Blob; ext: string }> => {
        try {
            // Skip for non-images or GIFs
            if (!file.type.startsWith('image/')) {
                return { blob: file, ext: (file.name.split('.').pop() || 'bin').toLowerCase() };
            }
            if (file.type === 'image/gif') {
                return { blob: file, ext: 'gif' };
            }

            // Check if compression is needed
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

            const longEdge = Math.max(img.width, img.height);
            if (longEdge <= IMG_MAX_LONG_EDGE && file.size <= IMG_TARGET_MAX_BYTES) {
                return { blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase() };
            }

            // Use the existing compressImage utility
            const compressedFile = await compressImage(file, {
                maxSizeMB: IMG_TARGET_MAX_BYTES / 1_000_000,
                maxWidthOrHeight: IMG_MAX_LONG_EDGE,
                useWebWorker: true,
                fileType: 'image/webp',
            });

            return { blob: compressedFile, ext: 'webp' };
        } catch (e) {
            console.warn('Downscale failed, uploading original:', e);
            return { blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase() };
        }
    }, []);

    // Handle file upload
    const handleFileUpload = useCallback(async (file: File) => {
        // Validate file
        const validation = validateImageFile(file);
        if (!validation.valid && validation.error) {
            showError(validation.error);
            return;
        }

        setIsProcessing(true);
        setProcessingStatus('Optimizing image...');

        try {
            await ensureAuth();

            // Compress image
            const { blob, ext } = await downscaleAndCompress(file);
            setProcessingStatus('Uploading...');

            // Generate unique filename
            const path = `${Date.now()}.${ext || 'jpg'}`;

            // Upload to Supabase
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(path, blob);

            if (uploadError) {
                throw uploadError;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(uploadData.path);

            const publicUrl = urlData.publicUrl;
            setUploadedImageUrl(publicUrl);
            setProcessingStatus('Image uploaded successfully!');

            // Start countdown for redirect
            setCountdown(2);
        } catch (err) {
            console.error('Upload failed:', err);
            showError('Upload failed. Please try again.');
            setIsProcessing(false);
            setProcessingStatus('');
        }
    }, [supabase, ensureAuth, downscaleAndCompress]);

    // Countdown and redirect effect
    useEffect(() => {
        if (countdown === null || countdown < 0) return;

        if (countdown === 0 && uploadedImageUrl) {
            // Redirect to customizing page
            const encodedUrl = encodeURIComponent(uploadedImageUrl);
            router.push(`/customizing?ref=${encodedUrl}&source=shopify`);
            return;
        }

        const timer = setTimeout(() => {
            setCountdown(prev => (prev !== null ? prev - 1 : null));
        }, 1000);

        return () => clearTimeout(timer);
    }, [countdown, uploadedImageUrl, router]);

    // Drag & drop handlers
    const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isProcessing) setIsDragging(true);
    }, [isProcessing]);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (isProcessing) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    }, [isProcessing, handleFileUpload]);

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            handleFileUpload(e.target.files[0]);
        }
    }, [handleFileUpload]);

    const handleUploadClick = useCallback(() => {
        if (!isProcessing) {
            fileInputRef.current?.click();
        }
    }, [isProcessing]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleUploadClick();
        }
    }, [handleUploadClick]);

    const toggleFaq = useCallback((index: number) => {
        setExpandedFaq(prev => prev === index ? null : index);
    }, []);

    const faqs = [
        { q: 'How accurate is the instant price?', a: 'It reflects base size + detected add-ons. If your design changes, price updates automatically.' },
        { q: 'Lead time?', a: 'Usually 2–5 days. Rush options depend on design complexity and schedule.' },
        { q: 'Do you deliver to my area?', a: 'Yes, within Cebu City and Cavite (via Lalamove only + fees vary by distance - NO Motorcycle Deliveries). Pickup is available.' },
        { q: 'Can I tweak the design after uploading?', a: 'Yes. You can change size, icing, and add-ons before checkout; the price updates instantly.' },
        { q: 'What if my photo has elements we can\'t produce?', a: 'We\'ll flag it and suggest the closest feasible alternative—before you pay.' },
    ];

    return (
        <div className="min-h-screen bg-linear-to-b from-pink-50 to-white">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-pink-100">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button
                        onClick={() => router.push('/')}
                        className="p-2 hover:bg-pink-50 rounded-full transition-colors"
                        aria-label="Go back to home"
                    >
                        <ArrowLeft className="w-5 h-5 text-pink-600" />
                    </button>
                    <h1 className="text-xl font-bold text-pink-600">Cake Price Calculator</h1>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-xl mx-auto px-4 py-8">
                {/* Heading Section */}
                <div className="text-center mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-pink-600 mb-2">
                        Cake Price Calculator for Customized Cakes
                    </h2>
                    <p className="text-slate-600">
                        Upload your design to get an instant quote via our AI Customizer
                    </p>
                </div>

                {/* Upload Section */}
                <div className="mb-8">
                    {!isProcessing ? (
                        <div
                            role="button"
                            tabIndex={0}
                            aria-label="Upload a cake image"
                            onClick={handleUploadClick}
                            onKeyDown={handleKeyDown}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className={`
                                p-8 md:p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all
                                ${isDragging
                                    ? 'border-pink-500 bg-pink-100'
                                    : 'border-pink-300 bg-pink-50 hover:bg-pink-100 hover:border-pink-400'
                                }
                            `}
                        >
                            <div className="flex flex-col items-center text-pink-600 gap-3">
                                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center">
                                    <Camera className="w-8 h-8" />
                                </div>
                                <span className="font-semibold text-lg">Drag & drop or click to upload photo</span>
                                <span className="text-sm text-pink-400">Supports: WEBP, PNG, JPG</span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 md:p-12 bg-white rounded-2xl shadow-lg text-center">
                            {uploadedImageUrl ? (
                                <>
                                    <div className="mb-4">
                                        <img
                                            src={uploadedImageUrl}
                                            alt="Uploaded cake design"
                                            className="max-w-full max-h-48 mx-auto rounded-lg shadow-md"
                                        />
                                    </div>
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 className="animate-spin w-8 h-8 text-pink-500" />
                                        <p className="font-semibold text-pink-600">
                                            Preparing your design for AI customization...
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            Redirecting in <span className="font-bold text-pink-600">{countdown}</span> seconds
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="animate-spin w-10 h-10 text-pink-500" />
                                    <p className="font-semibold text-pink-600">{processingStatus}</p>
                                </div>
                            )}
                        </div>
                    )}

                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/webp,image/png,image/jpeg,image/jpg"
                        onChange={handleFileInputChange}
                    />
                </div>

                {/* SEO Content Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6 md:p-8 space-y-6">
                    <p className="text-slate-700 leading-relaxed">
                        Skip the back-and-forth on Messenger. Upload a cake photo, see the{' '}
                        <strong className="text-pink-600">price instantly</strong>, and order online!
                        Available for delivery or pickup in{' '}
                        <strong>Cebu City</strong> and <strong>Cavite</strong>.
                    </p>

                    <ul className="space-y-2 text-slate-700">
                        <li className="flex items-start gap-2">
                            <span className="text-pink-500 mt-1">•</span>
                            Instant quotes for custom and decorated cakes
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-pink-500 mt-1">•</span>
                            Detailed explanation of designs (toppers, drip, macarons, etc.)
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-pink-500 mt-1">•</span>
                            Fast checkout with delivery or pickup options
                        </li>
                    </ul>

                    <div>
                        <h3 className="font-bold text-slate-800 text-lg mb-2">
                            Custom Cakes in Cebu and Molino Cavite
                        </h3>
                        <p className="text-slate-700 leading-relaxed">
                            We serve Cebu City with made-to-order cakes for birthdays, weddings, and events.
                            Typical lead time is <strong>2–5 days</strong> depending on complexity.
                            Pickup at our Cebu Branches or book a lalamove delivery across Mega Cebu.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-bold text-slate-800 text-lg mb-2">How It Works</h3>
                        <ol className="space-y-2 text-slate-700 list-decimal list-inside">
                            <li>Upload an image of any cake design above.</li>
                            <li>We will redirect you to our AI tool to pick size, icing and height.</li>
                            <li>See the price instantly and add to cart for delivery or pickup.</li>
                        </ol>
                    </div>

                    {/* FAQs */}
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg mb-4">Frequently Asked Questions</h3>
                        <div className="space-y-2">
                            {faqs.map((faq, index) => (
                                <div key={index} className="border-b border-slate-100 pb-2">
                                    <button
                                        onClick={() => toggleFaq(index)}
                                        className="w-full flex items-center justify-between text-left py-2 font-semibold text-pink-600 hover:text-pink-700 transition-colors"
                                        aria-expanded={expandedFaq === index}
                                    >
                                        <span>{faq.q}</span>
                                        {expandedFaq === index ? (
                                            <ChevronUp className="w-5 h-5 shrink-0" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 shrink-0" />
                                        )}
                                    </button>
                                    {expandedFaq === index && (
                                        <p className="text-slate-600 text-sm pl-4 pb-2">{faq.a}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CakePriceCalculatorClient;
