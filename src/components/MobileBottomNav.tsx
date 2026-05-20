'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Cake, ImagePlus, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle } from './icons';

const ChatModal = dynamic(() => import('./ChatModal'), {
    ssr: false,
});

interface MobileBottomNavProps {
    onUploadClick?: () => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onUploadClick }) => {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, user } = useAuth();
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [showCloudIndicator, setShowCloudIndicator] = useState(false);

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
    const navItemClass = (tab: string) =>
        `flex flex-col items-center gap-1 transition-colors ${activeTab === tab ? 'text-purple-600 genie-icon' : 'text-gray-300 hover:text-purple-500'}`;

    // Show cloud indicator 2 seconds after component mounts
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowCloudIndicator(true);
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    const handleUploadClick = () => {
        if (onUploadClick) {
            onUploadClick();
        } else {
            // If no upload handler provided, navigate to home and trigger upload there
            router.push('/?upload=true');
        }
    };

    const handleChatClick = () => {
        setIsChatModalOpen(true);
        setShowCloudIndicator(false);
    };

    return (
        <>
            <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-lg border-t border-purple-100 py-3 px-6 flex justify-around items-center text-gray-300 z-50 pb-safe shadow-[0_-10px_30px_-24px_rgba(88,28,135,0.55)]">
                <button
                    onClick={() => router.push('/')}
                    className={navItemClass('home')}
                >
                    <Home size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                    <span className="text-[9px] font-bold">Home</span>
                </button>

                <button
                    onClick={() => router.push('/customizing')}
                    className={navItemClass('customize')}
                >
                    <Cake size={22} strokeWidth={activeTab === 'customize' ? 2.5 : 2} />
                    <span className="text-[9px] font-bold">Customize</span>
                </button>

                <button
                    onClick={handleUploadClick}
                    className={navItemClass('getprice')}
                >
                    <ImagePlus size={22} strokeWidth={activeTab === 'getprice' ? 2.5 : 2} />
                    <span className="text-[9px] font-bold">Get Price</span>
                </button>

                <button
                    onClick={handleChatClick}
                    className={`${navItemClass('chat')} relative`}
                >
                    {showCloudIndicator && (
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2" style={{ animation: 'fadeInFast 0.3s ease-out' }}>
                            <div className="relative bg-gradient-to-br from-purple-100 to-pink-50 border border-purple-200 rounded-lg px-2 py-1 shadow-md whitespace-nowrap">
                                <p className="text-[8px] font-medium text-purple-700">Hi! If you need help we&apos;re here</p>
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-purple-100"></div>
                            </div>
                        </div>
                    )}
                    <MessageCircle className={`w-[22px] h-[22px] ${activeTab === 'chat' ? 'genie-icon' : 'text-gray-300'}`} />
                    <span className="text-[9px] font-bold">Chat</span>
                </button>

                <button
                    onClick={() => router.push(isAuthenticated && !user?.is_anonymous ? '/account' : '/login')}
                    className={navItemClass('profile')}
                >
                    <User size={22} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
                    <span className="text-[9px] font-bold">Profile</span>
                </button>
            </nav>

            <style>{`@keyframes fadeInFast { from { opacity: 0; transform: translate(-50%, 5px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>

            {isChatModalOpen ? (
                <ChatModal
                    isOpen={isChatModalOpen}
                    onClose={() => setIsChatModalOpen(false)}
                    userId={user?.id}
                    userEmail={user?.email}
                    userName={user?.email?.split('@')[0]}
                />
            ) : null}
        </>
    );
};

export default MobileBottomNav;
