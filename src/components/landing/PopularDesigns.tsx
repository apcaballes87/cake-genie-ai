import Link from 'next/link';
import LazyImage from '@/components/LazyImage';
import { Heart, Cake, Star, Zap, Clock, CalendarDays } from 'lucide-react';

export interface PopularDesign {
    slug: string;
    keywords: string;
    original_image_url: string;
    price: number;
    alt_text: string;
}

interface PopularDesignsProps {
    designs: PopularDesign[];
}

export const PopularDesigns = ({ designs }: PopularDesignsProps) => {
    if (!designs || designs.length === 0) return null;

    return (
        <section className="py-8">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">Popular Cake Designs</h2>
                    <p className="text-gray-500 text-sm md:text-base">Trending designs loved by our community</p>
                </div>
                <Link href="/customizing" className="text-purple-600 text-sm font-bold hover:underline hidden md:block">View All</Link>
            </div>

            <div className="grid grid-cols-2 min-[490px]:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
                {designs.map((design) => (
                    <Link
                        key={design.slug}
                        href={`/customizing/${design.slug}`}
                        className="bg-white p-3 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 border border-gray-100 transition-all duration-300 group block relative"
                    >
                        <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-gray-100">
                            <LazyImage
                                src={design.original_image_url}
                                alt={design.alt_text || `${design.keywords} cake design`}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                fill
                            />

                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>

                            {/* Heart Button - Visual only for now as it links to detail page */}
                            <div className="absolute top-3 right-3 w-8 h-8 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm transition-all z-10 bg-white/90 text-gray-600 hover:bg-red-50 hover:text-red-500">
                                <Heart size={16} />
                            </div>
                        </div>

                        <div className="px-1">
                            <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight mb-1 line-clamp-2 group-hover:text-purple-600 transition-colors">
                                {(() => {
                                    const title = design.keywords.split(',')[0].trim();
                                    return title.toLowerCase().endsWith('cake') ? title : `${title} Cake`;
                                })()}
                            </h3>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Cake size={12} /> Custom Design
                            </p>
                            <div className="flex justify-between items-end border-t border-gray-50 pt-3 mt-3">
                                <span className="font-black text-gray-900 text-base md:text-lg">₱{design.price.toLocaleString()}</span>
                                <div className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">
                                    <Star size={12} fill="currentColor" /> 5.0
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="text-center mt-8 md:hidden">
                <Link
                    href="/customizing"
                    className="inline-block border border-purple-300 text-purple-600 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-purple-50 transition-colors"
                >
                    View All Designs
                </Link>
            </div>
        </section>
    );
};
