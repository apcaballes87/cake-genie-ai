'use client';

import React from 'react';
import { Upload, ArrowRight } from 'lucide-react';

const DEFAULT_CAKE_IMAGE_URL = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/sign/cold-caking/Gemini_Generated_Image_4bvnuq4bvnuq4bvn.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84NDdlNTI3ZS1lZWU5LTRmM2EtODk3Ny05Y2RhMWUwZDUzNDEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjb2xkLWNha2luZy9HZW1pbmlfR2VuZXJhdGVkX0ltYWdlXzRidm51cTRidm51cTRidm4ucG5nIiwiaWF0IjoxNzc0NzM4MTU0LCJleHAiOjQ4OTY4MDIxNTR9.XiyRdgTAwitqtgC8mFa4L42dfHfzGcWwEM8Oz5g6lX4';

interface ColdCakingHeroProps {
    onUploadClick: () => void;
}

export const ColdCakingHero = React.memo(({ onUploadClick }: ColdCakingHeroProps) => {
    return (
        <section className="w-full">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 md:pt-6 md:pb-4">
                {/* Mobile Hero */}
                <div className="md:hidden w-full flex flex-col">
                    <div className="relative w-full rounded-3xl overflow-hidden mb-4 shadow-lg">
                        <img
                            src={DEFAULT_CAKE_IMAGE_URL}
                            alt="Cold Caking - Edible photo cake with custom print"
                            className="w-full h-auto object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-5">
                            <p className="text-[10px] font-bold text-purple-300 uppercase tracking-[0.15em] mb-1.5">
                                The boldest outreach tactic of 2026
                            </p>
                            <h1 className="text-2xl font-extrabold text-white leading-tight tracking-tight mb-2">
                                Cold Caking
                            </h1>
                            <p className="text-xs text-white/80 leading-relaxed">
                                Print your pitch deck, seed memo, or any message directly onto a cake. Get noticed. Get the meeting.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onUploadClick}
                        className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3.5 rounded-full font-bold transition-all shadow-md active:scale-[0.98] text-xs whitespace-nowrap w-full"
                    >
                        <Upload size={16} className="shrink-0" />
                        Upload your pitch here
                        <ArrowRight size={14} className="shrink-0" />
                    </button>
                    <p className="text-[10px] text-slate-500 text-center mt-1.5">
                        We&apos;ll print it on top of the cake
                    </p>
                </div>

                {/* Desktop Hero */}
                <div className="hidden md:block w-full relative rounded-3xl overflow-hidden shadow-lg">
                    <img
                        src={DEFAULT_CAKE_IMAGE_URL}
                        alt="Cold Caking - Edible photo cake with custom print"
                        className="w-full h-auto object-cover max-h-[480px]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
                    <div className="absolute inset-0 p-10 lg:p-14 flex flex-col justify-center w-[55%] lg:w-[50%]">
                        <p className="text-xs lg:text-sm font-bold text-purple-300 uppercase tracking-[0.15em] mb-3">
                            The boldest outreach tactic of 2026
                        </p>
                        <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-[1.08] tracking-tight mb-4">
                            Cold Caking
                        </h1>
                        <p className="text-sm lg:text-base text-white/80 leading-relaxed mb-6 max-w-md">
                            Print your pitch deck, seed memo, or any message directly onto a cake. A startup founder sent 7 pitch cakes to top VCs — and got 5 meetings. Now it&apos;s your turn.
                        </p>
                        <div className="flex flex-col items-start gap-1.5">
                            <button
                                onClick={onUploadClick}
                                className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3.5 lg:px-8 lg:py-4 rounded-full font-bold transition-all shadow-lg active:scale-[0.98] text-sm lg:text-base whitespace-nowrap"
                            >
                                <Upload size={15} className="shrink-0" />
                                Upload your pitch here
                                <ArrowRight size={14} className="shrink-0" />
                            </button>
                            <p className="text-xs text-white/60 ml-2">
                                We&apos;ll print it on top of the cake
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
});

ColdCakingHero.displayName = 'ColdCakingHero';
