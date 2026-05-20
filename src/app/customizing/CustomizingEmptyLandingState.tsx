'use client';

import React from 'react';
import { ImagePlus, Sparkles, ShieldCheck } from 'lucide-react';
import { ImageUploader } from '@/components/ImageUploader';

interface CustomizingEmptyLandingStateProps {
    onImageSelect: (file: File) => void;
}

export const CustomizingEmptyLandingState: React.FC<CustomizingEmptyLandingStateProps> = ({ onImageSelect }) => {
    return (
        <div className="w-full max-w-5xl mx-auto py-10 md:py-16 px-4 flex flex-col items-center gap-10 md:gap-14 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Elegant Header with Text */}
            <div className="text-center space-y-4 max-w-3xl">
                <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
                    <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
                        Bring Your Cake Ideas to Life
                    </span>
                </h2>
                <p className="text-slate-600 text-sm md:text-lg max-w-2xl mx-auto leading-relaxed font-medium">
                    Upload any cake design from Pinterest, Instagram, or Google. Our AI will instantly customize the design, calculate guaranteed pricing, and match you with Cebu's top expert bakers.
                </p>
            </div>

            {/* Interactive Dynamic Upload Card */}
            <div className="w-full max-w-xl mx-auto">
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

            {/* Premium Feature Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-4">
                {[
                    {
                        title: "Any Cake Design",
                        description: "Pinterest pins, sketches, or reference images — our AI understands them all.",
                        icon: (
                            <div className="p-3 bg-purple-50 rounded-2xl text-purple-600 shrink-0">
                                <ImagePlus size={24} />
                            </div>
                        )
                    },
                    {
                        title: "Instant AI Pricing",
                        description: "Get real-time pricing options based on your cake size, flavors, and complexity.",
                        icon: (
                            <div className="p-3 bg-pink-50 rounded-2xl text-pink-600 shrink-0">
                                <Sparkles size={24} />
                            </div>
                        )
                    },
                    {
                        title: "Guaranteed Delivery",
                        description: "Handcrafted by local expert bakers and delivered safely to Cebu City & beyond.",
                        icon: (
                            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shrink-0">
                                <ShieldCheck size={24} />
                            </div>
                        )
                    }
                ].map((feat, i) => (
                    <div key={i} className="flex flex-col items-center md:items-start text-center md:text-left p-6 bg-white border border-slate-100 rounded-3xl gap-3 shadow-xs">
                        {feat.icon}
                        <h3 className="font-bold text-slate-800 text-sm md:text-base">{feat.title}</h3>
                        <p className="text-slate-500 text-xs leading-relaxed">{feat.description}</p>
                    </div>
                ))}
            </div>

            {/* Verified reviews & free delivery badge */}
            <div className="flex flex-col items-center justify-center gap-2 max-w-md w-full border-t border-slate-100 pt-8">
                <div className="flex items-center gap-1.5 text-xs md:text-sm text-slate-700">
                    <span className="font-bold">4.8</span>
                    <span className="text-amber-400 text-base md:text-lg">★★★★★</span>
                    <span className="text-slate-500 font-normal">based on customer reviews</span>
                </div>
                <span className="inline-flex flex-wrap justify-center items-center gap-1 text-[10px] md:text-xs font-semibold text-green-600">
                    Verified Purchase ✓ <span className="text-slate-300 mx-1.5">•</span> <span className="text-slate-500 font-normal">FREE Delivery within Cebu City</span>
                </span>
            </div>
        </div>
    );
};
