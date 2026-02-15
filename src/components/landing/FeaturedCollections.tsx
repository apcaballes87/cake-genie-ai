import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Cake, Heart, Star, Sparkles, Gift, Crown } from 'lucide-react';

export interface FeaturedCollectionItem {
    keyword: string;
    slug: string;
    count: number;
    sample_image: string;
}

interface FeaturedCollectionsProps {
    categories?: FeaturedCollectionItem[];
}

const getCategoryStyle = (index: number) => {
    const colors = [
        'bg-purple-100 text-purple-600',
        'bg-pink-100 text-pink-600',
        'bg-blue-100 text-blue-600',
        'bg-orange-100 text-orange-600',
        'bg-red-100 text-red-600',
        'bg-yellow-100 text-yellow-600',
        'bg-green-100 text-green-600',
        'bg-indigo-100 text-indigo-600',
    ];
    const icons = [Gift, Heart, Star, Cake, Heart, Sparkles, Crown];

    return {
        color: colors[index % colors.length],
        icon: icons[index % icons.length],
    };
};

export const FeaturedCollections: React.FC<FeaturedCollectionsProps> = ({ categories = [] }) => {
    // If no categories are provided (e.g. initial load or error), we could show a skeleton or return null.
    // However, to avoid layout shift, let's just render nothing or a safe fallback if absolutely needed.
    // For now, if empty, we hide the section.
    if (!categories || categories.length === 0) {
        return null;
    }

    // Limit to top 5 or 6 based on layout needs
    // Desktop layout logic in original code handles 5 items well, hiding others.
    const displayCategories = categories.slice(0, 10);

    return (
        <section className="mb-8">
            <div className="flex justify-between items-center mb-4 gap-2">
                <h2 className="text-[18px] md:text-[21px] font-bold text-gray-900 leading-tight">
                    Find the Perfect Cake by Theme
                </h2>
                <Link
                    href="/collections"
                    className="group flex items-center gap-1 md:gap-2 text-purple-600 font-semibold hover:text-purple-700 transition-colors text-[13px] md:text-base shrink-0"
                >
                    View all
                    <ArrowRight className="w-3 h-3 md:w-4 md:h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>

            <div className="flex overflow-x-auto gap-3 md:gap-6 pb-4 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                {displayCategories.map((cat, index) => {
                    const style = getCategoryStyle(index);
                    const Icon = style.icon;
                    const displayName = cat.keyword.charAt(0).toUpperCase() + cat.keyword.slice(1);

                    return (
                        <Link
                            key={cat.slug}
                            href={`/collections/${cat.slug}`}
                            className={`group relative rounded-xl md:rounded-2xl overflow-hidden aspect-4/5 shadow-sm md:shadow-md hover:shadow-xl transition-all duration-300 min-w-[30%] lg:min-w-[calc((100%-96px)/5)] snap-center shrink-0 ${index >= 5 ? 'lg:hidden' : ''}`}
                        >
                            <Image
                                src={cat.sample_image || '/images/placeholder-cake.jpg'}
                                alt={displayName}
                                fill
                                sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                                className="object-cover group-hover:scale-110 transition-transform duration-700"
                            />
                            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/90 via-black/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />

                            <div className="absolute top-2 right-2 md:top-4 md:right-4">
                                <div className={`${style.color} w-6 h-6 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-md transform group-hover:rotate-12 transition-transform duration-300`}>
                                    <Icon className="w-3 h-3 md:w-5 md:h-5" />
                                </div>
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 p-3 md:p-6 translate-y-1 md:translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                <h3 className="text-white font-bold text-[12px] mb-0.5 md:mb-1 leading-tight">{displayName}</h3>
                                <p className="text-white/80 text-[11px] font-medium flex items-center gap-1 md:gap-2 leading-none">
                                    {cat.count} Designs
                                    <ArrowRight className="w-2 h-2 md:w-3 md:h-3 opacity-0 group-hover:opacity-100 transition-opacity delay-100 hidden md:inline" />
                                </p>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </section >
    );
};
