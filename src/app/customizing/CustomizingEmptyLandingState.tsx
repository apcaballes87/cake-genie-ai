'use client';

import React from 'react';
import { ImagePlus, Zap, Truck } from 'lucide-react';
import { ImageUploader } from '@/components/ImageUploader';
import Link from 'next/link';
import { hasReviewSummary, type ReviewSummary } from '@/lib/reviews';

interface CustomizingEmptyLandingStateProps {
    onImageSelect: (file: File) => void;
    reviewSummary?: ReviewSummary | null;
}

export const CustomizingEmptyLandingState: React.FC<CustomizingEmptyLandingStateProps> = ({ onImageSelect, reviewSummary }) => {
    const hasLiveReviewSummary = hasReviewSummary(reviewSummary);
    const reviewAverageLabel = hasLiveReviewSummary ? reviewSummary.averageRating.toFixed(1) : 'Verified';
    const reviewAverageForStars = hasLiveReviewSummary ? reviewSummary.averageRating : 5;
    const reviewCountLabel = hasLiveReviewSummary
        ? `based on ${reviewSummary.total} Happy Customer${reviewSummary.total === 1 ? '' : 's'}.`
        : 'real customer feedback and order photos.';

    return (
        <div className="w-full max-w-6xl mx-auto py-8 md:py-16 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Split layout: Left Upload, Right Texts */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                
                {/* LEFT SIDE: Upload Container (col-span-5) */}
                <div className="w-full lg:col-span-5 flex justify-center">
                    <div className="w-full max-w-md">
                        <ImageUploader
                            isOpen={true}
                            variant="inline"
                            onClose={() => {}}
                            onImageSelect={onImageSelect}
                            source="customizing"
                            title="Upload Custom Cake Design"
                            className="w-full bg-white/95 border border-purple-100 rounded-[1.85rem] p-6 md:p-8 shadow-xl shadow-purple-900/5 hover:border-purple-300/80 transition-all duration-300"
                            iconImageSrc="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/upload-cake-image.webp"
                        />
                    </div>
                </div>

                {/* RIGHT SIDE: Texts (col-span-7) */}
                <div className="w-full lg:col-span-7 flex flex-col gap-6 text-center lg:text-left">
                    
                    {/* Trust Review Summary (1 line) */}
                    <Link href="/reviews" className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 text-xs text-gray-600 font-semibold self-center lg:self-start hover:text-purple-600 transition-colors duration-200">
                        <span>{reviewAverageLabel}</span>
                        <span className="flex items-center gap-0.5 text-yellow-500 leading-none">
                            {Array.from({ length: 5 }, (_, index) => {
                                const starValue = index + 1;
                                const isFilled = starValue <= Math.round(reviewAverageForStars);
                                return (
                                    <span key={index} aria-hidden="true" className={isFilled ? 'text-yellow-500' : 'text-slate-200'}>
                                        ★
                                    </span>
                                );
                            })}
                        </span>
                        <span>{reviewCountLabel}</span>
                        <span className="text-slate-300">|</span>
                        <span className="font-bold text-green-600">Verified ✓</span>
                    </Link>

                    {/* Sub-eyebrow & Main Big Headline */}
                    <div className="space-y-4">
                        <span className="block text-[11px] md:text-xs font-bold uppercase tracking-wider text-purple-600">
                            Best Online Cake Delivery for Rush Orders in Cebu
                        </span>
                        
                        <h2 className="text-[38px] min-[390px]:text-[44px] md:text-[54px] lg:text-[68px] font-black leading-[0.9] tracking-tight uppercase text-neutral-900">
                            Custom Cakes
                            <br />
                            For Today&apos;s
                            <br />
                            <span className="bg-linear-to-r from-purple-600 via-pink-500 to-amber-500 bg-clip-text text-transparent">
                                Celebrations
                            </span>
                        </h2>
                    </div>

                    {/* Bottom Row Highlights (1 line) */}
                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-2 gap-y-1.5 text-[11px] md:text-sm font-bold uppercase tracking-wide text-neutral-500 mt-2">
                        <div className="flex items-center gap-1.5">
                            <ImagePlus size={16} className="text-neutral-400 shrink-0" />
                            <span className="whitespace-nowrap">Any Cake Image</span>
                        </div>
                        <span className="text-neutral-300">•</span>
                        <div className="flex items-center gap-1.5">
                            <Zap size={16} className="text-neutral-400 shrink-0" />
                            <span className="whitespace-nowrap">Instant Pricing</span>
                        </div>
                        <span className="text-neutral-300">•</span>
                        <div className="flex items-center gap-1.5">
                            <Truck size={16} className="text-neutral-400 shrink-0" />
                            <span className="whitespace-nowrap">Same-day Delivery</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
