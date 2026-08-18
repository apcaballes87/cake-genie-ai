'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Package, MapPin, Heart, LogOut, ChevronRight, ArrowLeft, PartyPopper, CalendarDays } from 'lucide-react';
import MobileBottomNav from '@/components/MobileBottomNav';
import { getPartyBudget } from '@/services/partyBudgetService';
import type { SavedPartyBudget } from '@/lib/partyBudget';

const AccountClient: React.FC = () => {
    const router = useRouter();
    const { user, isAuthenticated, isLoading, signOut } = useAuth();
    const [partyBudget, setPartyBudget] = React.useState<SavedPartyBudget | null>(null);

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
    };

    // Redirect if not authenticated
    React.useEffect(() => {
        if (!isLoading && (!isAuthenticated || user?.is_anonymous)) {
            router.push('/login');
        }
    }, [isAuthenticated, isLoading, user, router]);

    React.useEffect(() => {
        if (!isAuthenticated || !user || user.is_anonymous) return;
        let isActive = true;

        getPartyBudget(user.id)
            .then((savedBudget) => {
                if (isActive) setPartyBudget(savedBudget);
            })
            .catch(() => {
                if (isActive) setPartyBudget(null);
            });

        return () => {
            isActive = false;
        };
    }, [isAuthenticated, user]);

    if (isLoading || !isAuthenticated || user?.is_anonymous) {
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
        // {
        //     icon: Image,
        //     label: 'My Stickers',
        //     path: '/account/stickers',
        // },
        {
            icon: Heart,
            label: 'My Saved',
            path: '/saved',
        },
        {
            icon: PartyPopper,
            label: 'My Party Budget',
            path: '/party-budget-calculator',
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
                <h1 className="text-3xl font-bold text-slate-900">My <span className="text-purple-400">Account</span></h1>
            </div>

            {/* User Email */}
            <div className="mb-6">
                <p className="text-sm text-slate-600">{user?.email}</p>
            </div>

            {partyBudget ? (
                <section className="mb-6 rounded-2xl border border-purple-200 bg-purple-50/60 p-5" aria-labelledby="saved-party-budget-title">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-purple-700">
                                <PartyPopper className="h-5 w-5" />
                                <h2 id="saved-party-budget-title" className="font-bold">My Party Budget</h2>
                            </div>
                            <p className="mt-3 text-2xl font-black text-slate-900">
                                {new Intl.NumberFormat('en-PH', {
                                    style: 'currency',
                                    currency: partyBudget.currency,
                                    maximumFractionDigits: 0,
                                }).format(partyBudget.total_amount)}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                                <span>{partyBudget.guest_count} guests</span>
                                {partyBudget.party_date ? (
                                    <span className="inline-flex items-center gap-1.5">
                                        <CalendarDays className="h-4 w-4" />
                                        {new Date(`${partyBudget.party_date}T00:00:00`).toLocaleDateString('en-PH', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        })}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.push('/party-budget-calculator')}
                            className="shrink-0 rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                        >
                            View budget
                        </button>
                    </div>
                </section>
            ) : null}

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
