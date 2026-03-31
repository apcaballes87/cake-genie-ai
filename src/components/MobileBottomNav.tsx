'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Cake, ImagePlus, User, Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle } from './icons';

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
        if (pathname === '/saved') return 'saved';
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

    const handleChatClick = () => {
        if (window.Tawk_API) {
            window.Tawk_API.showWidget();
            window.Tawk_API.popup();
        }
    };

    const handleSavedClick = () => {
        if (isAuthenticated && !user?.is_anonymous) {
            router.push('/saved');
        } else {
            router.push('/login?redirect=/saved');
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
                onClick={handleChatClick}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'chat' ? 'text-purple-600' : 'hover:text-gray-500'}`}
            >
                <MessageCircle className={`w-[22px] h-[22px] ${activeTab === 'chat' ? 'text-purple-600' : 'text-gray-300'}`} />
                <span className="text-[9px] font-bold">Chat</span>
            </button>

            <button
                onClick={handleSavedClick}
                className={`flex flex-col items-center gap-1 transition-colors relative ${activeTab === 'saved' ? 'text-purple-600' : 'hover:text-gray-500'}`}
            >
                <div className="relative">
                    <Heart size={22} strokeWidth={activeTab === 'saved' ? 2.5 : 2} className={activeTab === 'saved' ? 'text-purple-600' : ''} fill={activeTab === 'saved' ? 'currentColor' : 'none'} />
                </div>
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

