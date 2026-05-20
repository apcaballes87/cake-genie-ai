'use client';

import React from 'react';
import { ImagePlus, Sparkles, ShieldCheck } from 'lucide-react';
import { ImageUploader } from '@/components/ImageUploader';

interface CustomizingEmptyLandingStateProps {
    onImageSelect: (file: File) => void;
}

export const CustomizingEmptyLandingState: React.FC<CustomizingEmptyLandingStateProps> = ({ onImageSelect }) => {
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
                    
                    {/* Single-line Trust Badge - Positioned ABOVE 'Bring Your Cake Ideas to Life' */}
                    <div className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-x-2 gap-y-1 text-[11px] md:text-xs font-semibold text-slate-600 bg-purple-50/50 border border-purple-100/50 rounded-full px-4 py-1.5 self-center lg:self-start">
                        <div className="flex items-center gap-1 shrink-0">
                            <span className="font-bold text-slate-800">4.8</span>
                            <span className="text-amber-400 text-sm leading-none">★★★★★</span>
                            <span className="text-slate-500 font-normal">based on customer reviews</span>
                        </div>
                        <span className="text-slate-300">•</span>
                        <span className="text-green-600 shrink-0">Verified Purchase ✓</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-purple-600 font-bold shrink-0">FREE Delivery within Cebu City</span>
                    </div>

                    {/* Elegant Value Proposition Header */}
                    <div className="space-y-4">
                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
                            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
                                Bring Your Cake Ideas to Life
                            </span>
                        </h2>
                        <p className="text-slate-600 text-sm md:text-base leading-relaxed font-medium">
                            Upload any cake design from Pinterest, Instagram, or Google. Our AI will instantly customize the design, calculate guaranteed pricing, and match you with Cebu's top expert bakers.
                        </p>
                    </div>

                    {/* Premium Feature Pillars */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-2">
                        {[
                            {
                                title: "Any Cake Design",
                                description: "Pinterest pins, Instagram posts, or sketches.",
                                icon: <ImagePlus size={18} className="text-purple-600" />
                            },
                            {
                                title: "Instant AI Pricing",
                                description: "Real-time pricing options based on complexity.",
                                icon: <Sparkles size={18} className="text-pink-600" />
                            },
                            {
                                title: "Guaranteed Delivery",
                                description: "Expert Cebu bakers, safely hand-delivered.",
                                icon: <ShieldCheck size={18} className="text-indigo-600" />
                            }
                        ].map((feat, i) => (
                            <div key={i} className="flex gap-3 items-start p-4 bg-white border border-slate-100 rounded-2xl shadow-xs text-left">
                                <div className="p-2 bg-slate-50 rounded-xl shrink-0 mt-0.5">
                                    {feat.icon}
                                </div>
                                <div className="space-y-0.5">
                                    <h3 className="font-bold text-slate-800 text-xs md:text-sm">{feat.title}</h3>
                                    <p className="text-slate-500 text-[11px] leading-relaxed">{feat.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};
