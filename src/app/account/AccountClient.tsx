'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Package, MapPin, Image, Heart, LogOut, ChevronRight, ArrowLeft } from 'lucide-react';
import MobileBottomNav from '@/components/MobileBottomNav';

const AccountClient: React.FC = () => {
    const router = useRouter();
    const { user, isAuthenticated, signOut } = useAuth();

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
    };

    // Redirect if not authenticated
    React.useEffect(() => {
        if (!isAuthenticated || user?.is_anonymous) {
            router.push('/login');
        }
    }, [isAuthenticated, user, router]);

    if (!isAuthenticated || user?.is_anonymous) {
        return null;
    }

    const menuItems = [
        {
            icon: Package,
            label: 'My Orders',
            path: '/account/orders',
        },
        {
            icon: MapPin,
            label: 'My Addresses',
            path: '/account/addresses',
        },
        {
            icon: Image,
            label: 'My Stickers',
            path: '/account/stickers',
        },
        {
            icon: Heart,
            label: 'My Saved',
            path: '/saved',
        },
        {
            icon: LogOut,
            label: 'Logout',
            path: null,
            action: handleSignOut,
        }
    ];

    return (
        <div className="w-full max-w-3xl mx-auto pb-24 md:pb-8 px-4">
            {/* Header - matching orders/addresses pattern */}
            <div className="flex items-center gap-4 mb-6 pt-4">
                <button onClick={() => router.push('/')} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                    <ArrowLeft />
                </button>
                <h1 className="text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">My Account</h1>
            </div>

            {/* User Email */}
            <div className="mb-6">
                <p className="text-sm text-slate-600">{user?.email}</p>
            </div>

            {/* Menu Items */}
            <div className="space-y-4">
                {menuItems.map((item, index) => {
                    const Icon = item.icon;
                    const isLast = index === menuItems.length - 1;

                    return (
                        <button
                            key={item.label}
                            onClick={() => item.action ? item.action() : router.push(item.path!)}
                            className={`w-full bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between group hover:shadow-md transition-all ${isLast ? 'border-red-200 hover:border-red-300' : 'hover:border-slate-300'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Icon className={`w-5 h-5 ${isLast ? 'text-red-500' : 'text-slate-600'}`} />
                                <span className={`font-semibold ${isLast ? 'text-red-500' : 'text-slate-800'}`}>
                                    {item.label}
                                </span>
                            </div>
                            <ChevronRight className={`w-5 h-5 ${isLast ? 'text-red-400' : 'text-slate-400'} group-hover:translate-x-1 transition-transform`} />
                        </button>
                    );
                })}
            </div>
            <MobileBottomNav />
        </div>
    );
};

export default AccountClient;
