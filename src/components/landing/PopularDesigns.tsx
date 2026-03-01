'use client';

import Link from 'next/link';
import LazyImage from '@/components/LazyImage';
import { Heart, Cake, Star, Zap, Clock, CalendarDays } from 'lucide-react';
import Masonry from 'react-masonry-css';

export interface PopularDesign {
    slug: string;
    keywords: string;
    original_image_url: string;
    price: number;
    alt_text?: string;
    availability?: string;
}

interface PopularDesignsProps {
    designs: PopularDesign[];
}

export const PopularDesigns = ({ designs }: PopularDesignsProps) => {
    if (!designs || designs.length === 0) return null;

    return (
        <section className="py-4 md:py-6">
            <div className="flex justify-between items-end mb-4 md:mb-6">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">Popular Cake Designs</h2>
                    <p className="text-gray-500 text-sm md:text-base">Trending designs loved by our community</p>
                </div>
                <Link href="/customizing" className="px-5 py-2.5 bg-white text-purple-600 font-semibold rounded-full border border-purple-200 shadow-sm hover:shadow-md hover:bg-purple-50 transition-all hidden md:block">View All</Link>
            </div>

            <Masonry
                breakpointCols={{
                    default: 6,
                    1280: 5,
                    1024: 4,
                    768: 3,
                    490: 2,
                    0: 2
                }}
                className="flex w-auto -ml-4 md:-ml-5 lg:-ml-6"
                columnClassName="pl-4 md:pl-5 lg:pl-6 bg-clip-padding"
            >
                {designs.map((design) => (
                    <div key={design.slug} className="mb-4 md:mb-5 lg:mb-6">
                        <Link
                            href={`/customizing/${design.slug}`}
                            className="group relative cursor-pointer flex flex-col h-full"
                        >
                            <div className="relative mb-1.5 rounded-2xl overflow-hidden bg-gray-100 shrink-0">
                                <LazyImage
                                    src={design.original_image_url}
                                    alt={design.alt_text || `${design.keywords} cake design`}
                                    width={0}
                                    height={0}
                                    sizes="(max-width: 490px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 17vw"
                                    style={{ width: '100%', height: 'auto' }}
                                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                                />

                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>

                                {/* Availability Badge */}
                                {design.availability && (
                                    <div className="absolute top-2.5 left-2.5 z-10">
                                        <span className={`backdrop-blur-sm text-[10px] md:text-xs font-extrabold px-2.5 py-1 rounded-full shadow-sm ${design.availability === 'rush'
                                            ? 'bg-green-600/95 text-white'
                                            : design.availability === 'same-day'
                                                ? 'bg-blue-600/95 text-white'
                                                : 'bg-white/95 text-gray-800'
                                            }`}>
                                            {design.availability === 'same-day' ? 'Same Day' : design.availability === 'rush' ? 'Rush' : 'Pre-order'}
                                        </span>
                                    </div>
                                )}

                                {/* Heart Button */}
                                <div className="absolute top-2.5 right-2.5 w-8 h-8 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm z-10 bg-white/90 text-gray-400 hover:text-red-500 transition-colors">
                                    <Heart size={16} />
                                </div>

                                {/* Price and Rating Overlays */}
                                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex justify-between items-end z-10 pointer-events-none">
                                    <div className="bg-white/95 backdrop-blur-sm text-gray-900 font-extrabold text-[11px] md:text-sm px-2.5 py-1 rounded-full shadow-sm pointer-events-auto">
                                        ₱{design.price.toLocaleString()}
                                    </div>
                                    <div className="bg-white/95 backdrop-blur-sm flex items-center gap-1 font-bold text-gray-900 text-xs md:text-sm px-2.5 py-1 rounded-full shadow-sm pointer-events-auto">
                                        <Star size={12} className="text-orange-500" fill="currentColor" />
                                        <span>4.9</span>
                                    </div>
                                </div>
                            </div>

                            <div className="px-0 pb-1 pt-0.5 flex flex-col flex-1">
                                <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight mb-1 line-clamp-2 group-hover:text-purple-600 transition-colors">
                                    {(() => {
                                        const title = design.keywords.split(',')[0].trim();
                                        return title.toLowerCase().endsWith('cake') ? title : `${title} Cake`;
                                    })()}
                                </h3>
                                <p className="text-xs text-gray-500 mb-1">
                                    Custom Design
                                </p>
                            </div>
                        </Link>
                    </div>
                ))}
            </Masonry>

            <div className="text-center mt-8 md:hidden">
                <Link
                    href="/customizing"
                    className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-full border border-purple-200 shadow-sm hover:shadow-md hover:bg-purple-50 transition-all inline-flex items-center gap-2"
                >
                    View All Designs
                </Link>
            </div>
        </section>
    );
};
