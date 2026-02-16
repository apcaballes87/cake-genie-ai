import React from 'react';
import Link from 'next/link';
import { LazyImage } from '@/components/LazyImage';
import { ArrowRight } from 'lucide-react';

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
        'bg-purple-100/10',
        'bg-pink-100/10',
        'bg-blue-100/10',
        'bg-orange-100/10',
        'bg-red-100/10',
        'bg-yellow-100/10',
        'bg-green-100/10',
        'bg-indigo-100/10',
    ];

    return {
        color: colors[index % colors.length],
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
                </Link>
            </div>

            <div className="flex overflow-x-auto gap-3 md:gap-6 pb-4 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                {displayCategories.map((cat, index) => {
                    const style = getCategoryStyle(index);
                    const displayName = cat.keyword.charAt(0).toUpperCase() + cat.keyword.slice(1);

                    return (
                        <Link
                            key={cat.slug}
                            href={`/collections/${cat.slug}`}
                            className={`group relative rounded-xl md:rounded-2xl overflow-hidden aspect-4/5 shadow-sm md:shadow-md hover:shadow-xl transition-all duration-300 min-w-[30%] lg:min-w-[calc((100%-96px)/5)] snap-center shrink-0 ${index >= 5 ? 'lg:hidden' : ''}`}
                        >
                            <LazyImage
                                src={cat.sample_image || 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/placeholder-cake.jpg'}
                                alt={displayName}
                                fill
                                sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                                imageClassName="object-cover group-hover:scale-110 transition-transform duration-700"
                            />
                            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/90 via-black/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />

                            {/* subtle tint overlay */}
                            <div className={`absolute inset-0 ${style.color} opacity-20`} />

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

