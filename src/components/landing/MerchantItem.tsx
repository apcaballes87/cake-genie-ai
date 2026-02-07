'use client';

import { useRouter } from 'next/navigation';
import LazyImage from '@/components/LazyImage';
import type { CakeGenieMerchant } from '@/lib/database.types';

interface MerchantItemProps {
    merchant: CakeGenieMerchant;
}

export const MerchantItem = ({ merchant }: MerchantItemProps) => {
    const router = useRouter();

    const handleClick = () => {
        router.push(`/shop/${merchant.slug}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
        }
    };

    return (
        <button
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className="flex flex-col items-center shrink-0 group"
            aria-label={`Visit ${merchant.business_name}`}
            tabIndex={0}
        >
            <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden bg-linear-to-br from-purple-100 to-pink-100 ring-2 ring-transparent group-hover:ring-purple-400 transition-all duration-300 shadow-sm group-hover:shadow-md">
                {merchant.profile_image_url ? (
                    <LazyImage
                        src={merchant.profile_image_url}
                        alt={merchant.business_name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        fill
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-purple-500 to-pink-500 text-white font-bold text-lg md:text-xl">
                        {merchant.business_name.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>
            <span className="mt-2 text-xs font-medium text-gray-700 group-hover:text-purple-600 transition-colors max-w-[64px] md:max-w-[80px] line-clamp-2 text-center leading-tight">
                {merchant.business_name}
            </span>
        </button>
    );
};

export default MerchantItem;
