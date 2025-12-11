import React from 'react';
import LazyImage from '@/components/LazyImage';
import { Heart, Cake, Star } from 'lucide-react';

interface ProductCardProps {
    id: number | string;
    name: string;
    price: number;
    image: string;
    rating?: number;
    cakeType?: string;
    tag?: string | null;
}

export function ProductCard({ id, name, price, image, rating = 5.0, cakeType = 'Custom Design', tag }: ProductCardProps) {
    return (
        <div className="bg-white p-3 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 border border-gray-100 transition-all duration-300 group cursor-pointer h-full flex flex-col">
            <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                <LazyImage
                    src={image}
                    alt={name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    sizes="(max-width: 490px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                />

                {/* Overlay Gradient on Hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>

                <button className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-red-50 hover:text-red-500 transition-colors z-10">
                    <Heart size={16} className="text-gray-600" />
                </button>

                {tag && (
                    <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md text-gray-900 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-bold shadow-sm z-10">
                        {tag}
                    </span>
                )}
            </div>

            <div className="px-1 flex flex-col flex-1">
                <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight mb-1 line-clamp-2 group-hover:text-purple-600 transition-colors">
                    {name}
                </h3>
                <p className="text-xs text-gray-500 flex items-center gap-1 mb-auto">
                    <Cake size={12} /> {cakeType}
                </p>
                <div className="flex justify-between items-end border-t border-gray-50 pt-3 mt-3">
                    <span className="font-black text-gray-900 text-base md:text-lg">₱{price.toLocaleString()}</span>
                    <div className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">
                        <Star size={12} fill="currentColor" /> {rating.toFixed(1)}
                    </div>
                </div>
            </div>
        </div>
    );
}
