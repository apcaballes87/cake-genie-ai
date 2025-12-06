'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Cake, ImagePlus, Heart, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface MobileBottomNavProps {
    onUploadClick?: () => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onUploadClick }) => {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, user } = useAuth();

    // Determine active tab based on current path
    const getActiveTab = (): string => {
        if (pathname === '/') return 'home';
        if (pathname === '/customizing') return 'customize';
        if (pathname === '/search') return 'search';
        if (pathname?.startsWith('/account')) return 'profile';
        return 'home';
    };

    const activeTab = getActiveTab();

    const handleUploadClick = () => {
        if (onUploadClick) {
            onUploadClick();
        } else {
            // If no upload handler provided, navigate to home and trigger upload there
            router.push('/?upload=true');
        }
    };

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-lg border-t border-gray-100 py-4 px-6 flex justify-between items-center text-gray-300 z-50 pb-safe">
            <button
                onClick={() => router.push('/')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-purple-600' : 'hover:text-gray-500'}`}
            >
                <Home size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                <span className="text-[9px] font-bold">Home</span>
            </button>

            <button
                onClick={() => router.push('/customizing')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'customize' ? 'text-purple-600' : 'hover:text-gray-500'}`}
            >
                <Cake size={22} strokeWidth={activeTab === 'customize' ? 2.5 : 2} />
                <span className="text-[9px] font-bold">Customize</span>
            </button>

            <button
                onClick={handleUploadClick}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'getprice' ? 'text-purple-600' : 'hover:text-gray-500'}`}
            >
                <ImagePlus size={22} strokeWidth={activeTab === 'getprice' ? 2.5 : 2} />
                <span className="text-[9px] font-bold">Get Price</span>
            </button>

            <button
                onClick={() => { }}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'wishlist' ? 'text-purple-600' : 'hover:text-gray-500'}`}
            >
                <Heart size={22} strokeWidth={activeTab === 'wishlist' ? 2.5 : 2} />
                <span className="text-[9px] font-bold">Saved</span>
            </button>

            <button
                onClick={() => router.push(isAuthenticated && !user?.is_anonymous ? '/account' : '/login')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-purple-600' : 'hover:text-gray-500'}`}
            >
                <User size={22} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
                <span className="text-[9px] font-bold">Profile</span>
            </button>
        </nav>
    );
};

export default MobileBottomNav;
