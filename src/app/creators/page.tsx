'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { submitCreatorApplication, type CreatorSubmission } from './actions';
import { isAppError, getErrorMessage } from '@/lib/errors';
import { Camera, Gift, Percent, Video, Menu, Search } from 'lucide-react';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { COMMON_ASSETS } from '@/constants';

export default function CreatorsLandingPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isOccasionOpen, setIsOccasionOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const categoriesList = [
        { id: 'Birthday', name: 'Birthday' },
        { id: 'Wedding', name: 'Wedding' },
        { id: 'Anniversary', name: 'Anniversary' },
        { id: 'Bento', name: 'Bento' },
        { id: 'Custom', name: 'Custom' },
        { id: 'Cupcakes', name: 'Cupcakes' },
        { id: 'Dedication', name: 'Dedication' },
        { id: 'Baptismal', name: 'Baptismal' },
    ];

    const handleSearch = (query: string) => {
        router.push(`/search?q=${encodeURIComponent(query)}`);
    };

    useEffect(() => {
        let rafId = 0;
        let pending = false;

        const updateScrollState = () => {
            if (pending) return;
            pending = true;
            rafId = window.requestAnimationFrame(() => {
                pending = false;
                setIsScrolled(window.scrollY > 12);
            });
        };

        rafId = window.requestAnimationFrame(() => {
            setIsScrolled(window.scrollY > 12);
        });
        window.addEventListener('scroll', updateScrollState, { passive: true });
        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener('scroll', updateScrollState);
        };
    }, []);

    // Form state
    const [formData, setFormData] = useState<CreatorSubmission>({
        name: '',
        email: '',
        contact_number: '',
        address: '',
        content_niche: '',
        tiktok_handle: '',
        tiktok_followers: undefined,
        instagram_handle: '',
        instagram_followers: undefined,
        facebook_handle: '',
        facebook_followers: undefined,
        promo_code: '',
        agreed_to_terms: false,
    });

    const generatePromoCode = (handle: string) => {
        return handle.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;

        setFormData((prev) => {
            const nextData = {
                ...prev,
                [name]: type === 'checkbox' ? checked : type === 'number' ? (value ? parseInt(value) : undefined) : value,
            };

            // Auto-generate promo code if a handle changed
            if (['tiktok_handle', 'instagram_handle', 'facebook_handle'].includes(name)) {
                const handleToUse = nextData.tiktok_handle || nextData.instagram_handle || nextData.facebook_handle;
                if (handleToUse) {
                    nextData.promo_code = generatePromoCode(handleToUse);
                }
            }

            return nextData;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setIsSubmitting(true);

        try {
            const result = await submitCreatorApplication(formData);
            if (result && result.success) {
                setSuccess(true);
            }
        } catch (err) {
            if (isAppError(err)) {
                setErrorMsg(err.message);
            } else {
                setErrorMsg(getErrorMessage(err));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-transparent">
                <div className="max-w-md w-full bg-white/95 rounded-3xl shadow-xl border border-purple-100/50 p-8 text-center space-y-6">
                    <div className="w-16 h-16 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <Gift className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-gray-900">Application Received!</h2>
                    <p className="text-gray-600 leading-relaxed text-sm">
                        Thank you for applying to the <span className="text-purple-600 font-bold">Genie.ph</span> Creator UGC Collab!
                        We will reach out to you via email or phone with more details about the collaboration shortly.
                    </p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="mt-4 w-full genie-btn-primary font-bold py-3.5 rounded-xl shadow-md"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-transparent">
            {/* Sticky Navigation Navbar */}
            <nav className={`sticky top-0 z-80 w-full border-b transition-all duration-200 ${(isScrolled || isSearchFocused) ? 'border-purple-100 bg-white/[0.95] shadow-sm' : 'border-transparent bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="w-full flex items-center justify-between py-2.5 md:py-[14px] relative">
                        {/* Left Side: Menu & Desktop Logo */}
                        <div className="flex items-center gap-2 md:gap-4 shrink-0">
                            <button
                                onClick={() => setIsMenuOpen(true)}
                                className="p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors"
                                aria-label="Open menu"
                            >
                                <Menu size={24} />
                            </button>

                            {/* Desktop Logo - visible when not scrolled */}
                            <Link
                                href="/"
                                className={`hidden md:block shrink-0 transition-all duration-300 ${isScrolled ? 'opacity-0 pointer-events-none absolute -translate-x-4' : 'opacity-100 translate-x-0'}`}
                            >
                                <img
                                    src={COMMON_ASSETS.logo}
                                    alt="Genie Logo"
                                    width={135}
                                    height={43}
                                    className="h-[35px] md:h-[41px] w-auto object-contain"
                                />
                            </Link>
                        </div>

                        {/* Mobile Centered Logo - only visible when not scrolled */}
                        <div className={`md:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${(isScrolled || isSearchFocused) ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}>
                            <Link href="/" className="flex items-center">
                                <img
                                    src={COMMON_ASSETS.logo}
                                    alt="Genie Logo"
                                    width={105}
                                    height={32}
                                    className="h-[27px] md:h-[32px] w-auto object-contain"
                                />
                            </Link>
                        </div>

                        {/* Search Bar - transition between states */}
                        <div className={`flex-1 mx-2 md:mx-4 transition-all duration-300 ${(isScrolled || isSearchFocused) ? 'opacity-100 translate-x-0' : 'hidden md:block md:opacity-100 md:translate-x-0 opacity-0 translate-x-4 pointer-events-none md:pointer-events-auto'}`}>
                            <SearchAutocomplete
                                inputRef={searchInputRef}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setIsSearchFocused(false)}
                                onSearch={handleSearch}
                                onUploadClick={() => {}}
                                placeholder="Search for other designs..."
                                value={searchQuery}
                                onChange={setSearchQuery}
                                showUploadButton={false}
                                inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-purple-100 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                            />
                        </div>

                        {/* Right Side: Actions & Links */}
                        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                            {/* Mobile Search Icon - visible only when NOT scrolled and NOT focused */}
                            {!(isScrolled || isSearchFocused) && (
                                <button
                                    onClick={() => {
                                        setIsSearchFocused(true);
                                        window.scrollTo({ top: 50, behavior: 'smooth' });
                                        setTimeout(() => {
                                            searchInputRef.current?.focus();
                                        }, 50);
                                    }}
                                    className="md:hidden p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors"
                                    aria-label="Search"
                                >
                                    <Search size={20} />
                                </button>
                            )}
                            <Link href="/collections" className="hidden md:inline-block text-sm font-bold text-slate-600 hover:text-purple-650 transition-colors shrink-0">
                                Browse Cakes
                            </Link>
                            <Link href="/" className="genie-btn-secondary px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold shadow-sm shrink-0">
                                Order Now
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-grow pb-12">
                {/* Hero Image Container (smaller, rounded frame, not full edge-to-edge) */}
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-12">
                    <div className="relative h-[25vh] sm:h-[35vh] md:h-[40vh] lg:h-[45vh] max-h-[450px] rounded-3xl overflow-hidden shadow-md border border-purple-100/50">
                        <img 
                            src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/creators-collab-ugc-hero-image.webp" 
                            alt="Genie.ph Creator Collaboration" 
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-purple-50/20 opacity-30 pointer-events-none" />
                    </div>
                </div>

                {/* Header Section */}
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 mb-12">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 font-bold text-xs tracking-wider uppercase">
                        Creator Collaboration
                    </span>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
                        Join the <span className="text-purple-600 font-extrabold">Genie.ph</span> Creator Network
                    </h1>
                    <p className="text-lg md:text-xl text-gray-650 max-w-2xl mx-auto leading-relaxed">
                        Genie.ph is a Cebu-based startup and marketplace connecting you to the best local bakers. Our platform provides instant price quotes for any cake design. Just upload a photo, get a price in seconds, and watch it update as you customize. Join us in sharing how easy it is to bring dream cakes to life!
                    </p>
                </div>

                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Perks Section (Left Sidebar) */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white/95 rounded-3xl border border-purple-100/50 shadow-md p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Gift className="w-5 h-5 text-purple-600" />
                                Your Perks
                            </h3>
                            <ul className="space-y-4">
                                <li className="flex gap-3">
                                    <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-700 font-bold text-sm">1</div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">Free Bento Cake</h4>
                                        <p className="text-sm text-gray-600">Receive a complimentary bento cake for your content creation.</p>
                                    </div>
                                </li>
                                <li className="flex gap-3">
                                    <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-700 font-bold text-sm">2</div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">50% Off Voucher</h4>
                                        <p className="text-sm text-gray-600">Get a massive discount on your next personal custom cake order.</p>
                                    </div>
                                </li>
                                <li className="flex gap-3">
                                    <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-700 font-bold text-sm">3</div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">15% Commission</h4>
                                        <p className="text-sm text-gray-650">Earn 15% commission on cakes sold through your unique promo code. Plus, your audience gets 10% off!</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Application Form (Right Content) */}
                    <div className="lg:col-span-2">
                        <div className="bg-white/95 rounded-3xl border border-purple-100/50 shadow-md p-6 sm:p-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Apply Now</h2>

                            {errorMsg && (
                                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-md">
                                    <p className="font-medium">{errorMsg}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">

                                {/* Personal Details */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Personal Details</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                                            <input
                                                required
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all text-gray-800"
                                                placeholder="Juan Dela Cruz"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                                            <input
                                                required
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all text-gray-800"
                                                placeholder="juan@example.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
                                            <input
                                                required
                                                type="tel"
                                                name="contact_number"
                                                value={formData.contact_number}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all text-gray-800"
                                                placeholder="09123456789"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address *</label>
                                            <input
                                                required
                                                type="text"
                                                name="address"
                                                value={formData.address}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all text-gray-800"
                                                placeholder="Complete address for cake delivery"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Content Details */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Content Profile</h3>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Content Niche / Type *</label>
                                        <input
                                            required
                                            type="text"
                                            name="content_niche"
                                            value={formData.content_niche}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all text-gray-800"
                                            placeholder="e.g. Food, Lifestyle, Events, Parenting"
                                        />
                                        <p className="mt-1.5 text-xs text-gray-500 italic">Helps us prioritize fit.</p>
                                    </div>
                                </div>

                                {/* Social Media Handles */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end border-b pb-2">
                                        <h3 className="text-lg font-semibold text-gray-800">Social Media</h3>
                                        <span className="text-xs text-gray-500">Provide at least one handle</span>
                                    </div>

                                    {/* TikTok */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">TikTok Handle</label>
                                            <div className="relative">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">@</span>
                                                <input
                                                    type="text"
                                                    name="tiktok_handle"
                                                    value={formData.tiktok_handle}
                                                    onChange={handleInputChange}
                                                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all text-gray-800"
                                                    placeholder="username"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">TikTok Followers (optional)</label>
                                            <input
                                                type="number"
                                                name="tiktok_followers"
                                                value={formData.tiktok_followers || ''}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all text-gray-800"
                                                placeholder="e.g. 10000"
                                            />
                                        </div>
                                    </div>

                                    {/* Instagram */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Instagram Handle</label>
                                            <div className="relative">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">@</span>
                                                <input
                                                    type="text"
                                                    name="instagram_handle"
                                                    value={formData.instagram_handle}
                                                    onChange={handleInputChange}
                                                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all text-gray-800"
                                                    placeholder="username"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Instagram Followers (optional)</label>
                                            <input
                                                type="number"
                                                name="instagram_followers"
                                                value={formData.instagram_followers || ''}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all text-gray-800"
                                                placeholder="e.g. 5000"
                                            />
                                        </div>
                                    </div>

                                    {/* Facebook */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Facebook Page/Profile</label>
                                            <input
                                                type="text"
                                                name="facebook_handle"
                                                value={formData.facebook_handle}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all text-gray-800"
                                                placeholder="Page name or URL"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Facebook Followers (optional)</label>
                                            <input
                                                type="number"
                                                name="facebook_followers"
                                                value={formData.facebook_followers || ''}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all text-gray-800"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Custom Promo Code</h3>
                                    <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-100">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Your unique 10% off promo code (automatically generated) *
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                required
                                                readOnly
                                                type="text"
                                                name="promo_code"
                                                value={formData.promo_code}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed outline-none uppercase font-mono"
                                                placeholder="Automatically generated from your handle"
                                            />
                                        </div>
                                        <div className="mt-4 space-y-2">
                                            <p className="text-sm font-bold text-purple-700">How it works:</p>
                                            <ul className="text-xs text-gray-650 space-y-1.5 list-disc pl-4">
                                                <li>Your audience gets <strong>10% OFF</strong> when they use your code at checkout.</li>
                                                <li>You get <strong>15% COMMISSION</strong> for every successful order using your code.</li>
                                                <li>Share your unique link: <code className="bg-purple-100 px-1.5 py-0.5 rounded text-purple-700 font-mono">genie.ph/YOURCODE</code></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Terms Consent */}
                                <div className="pt-4 border-t">
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <div className="flex items-center h-6">
                                            <input
                                                required
                                                type="checkbox"
                                                name="agreed_to_terms"
                                                checked={formData.agreed_to_terms}
                                                onChange={handleInputChange}
                                                className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-400 transition-colors"
                                            />
                                        </div>
                                        <div className="text-sm">
                                            <p className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors">
                                                The "Voucher" Consent *
                                            </p>
                                            <p className="text-gray-500 mt-1">
                                                I agree to create 1 TikTok/Reel showcasing my Genie.ph custom cake in exchange for the perks listed above.
                                            </p>
                                        </div>
                                    </label>
                                </div>

                                {/* Submit Button */}
                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`w-full py-4 rounded-xl font-bold text-lg text-white transition-all shadow-md hover:shadow-lg flex justify-center items-center gap-2
                                            ${isSubmitting ? 'bg-purple-300 cursor-not-allowed' : 'genie-btn-primary hover:-translate-y-0.5'}`}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Submitting Application...
                                            </>
                                        ) : (
                                            <>
                                                Apply for Collab <Camera className="w-5 h-5" />
                                            </>
                                        )}
                                    </button>
                                </div>

                            </form>
                        </div>
                    </div>
                </div>
            </main>
            <LandingFooter />

            {/* Sidebar Slide-out Menu Overlay */}
            <div
                className={`fixed inset-0 z-[90] transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsMenuOpen(false)}
                aria-hidden="true"
                style={{ background: 'rgba(0,0,0,0.45)' }}
            />

            {/* Drawer Panel */}
            <aside
                className={`fixed top-0 left-0 z-[100] h-full w-72 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
                aria-label="Side navigation"
            >
                {/* Drawer Header */}
                <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-purple-50">
                    <img
                        src={COMMON_ASSETS.logo}
                        alt="Genie Logo"
                        width={140}
                        height={50}
                        className="h-12 w-auto object-contain"
                    />
                    <button
                        onClick={() => setIsMenuOpen(false)}
                        className="p-2 rounded-full text-slate-500 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                        aria-label="Close menu"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 overflow-y-auto py-4 px-3">
                    {/* Browse Cakes */}
                    <Link
                        href="/collections"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors font-medium text-[15px] group"
                    >
                        <span className="text-xl w-7 text-center leading-none">🎂</span>
                        <span className="group-hover:translate-x-0.5 transition-transform duration-150">Browse Cakes</span>
                    </Link>

                    {/* Shop by Occasion — collapsible accordion */}
                    <div>
                        <button
                            onClick={() => setIsOccasionOpen(prev => !prev)}
                            className="w-full flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors font-medium text-[15px]"
                            aria-expanded={isOccasionOpen}
                        >
                            <span className="text-xl w-7 text-center leading-none">🎉</span>
                            <span className="flex-1 text-left">Shop by Occasion</span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width={16} height={16}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`transition-transform duration-300 ${isOccasionOpen ? 'rotate-180' : 'rotate-0'}`}
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>

                        <div
                            className="overflow-hidden transition-all duration-300 ease-in-out"
                            style={{ maxHeight: isOccasionOpen ? `${categoriesList.length * 52}px` : '0px' }}
                        >
                            <div className="pl-10 pb-1 flex flex-col gap-0.5">
                                {categoriesList.map((cat) => (
                                    <Link
                                        key={cat.id}
                                        href={`/search?q=${encodeURIComponent(cat.name)}`}
                                        onClick={() => setIsMenuOpen(false)}
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors text-[14px] font-medium"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-300 shrink-0" />
                                        {cat.name}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Other nav links */}
                    {[
                        { label: 'Cold Caking', href: '/coldcaking', emoji: '🧊' },
                        { label: 'How to Order', href: '/how-to-order', emoji: '📋' },
                        { label: 'Payment Options', href: '/payment-options', emoji: '💳' },
                        { label: 'Delivery Rates', href: '/delivery-rates', emoji: '🚚' },
                        { label: 'About Us', href: '/about', emoji: 'ℹ️' },
                        { label: 'Contact', href: '/contact', emoji: '📞' },
                    ].map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors font-medium text-[15px] group"
                        >
                            <span className="text-xl w-7 text-center leading-none">{item.emoji}</span>
                            <span className="group-hover:translate-x-0.5 transition-transform duration-150">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* Drawer Footer */}
                <div className="px-5 py-5 border-t border-purple-50">
                    <p className="text-[10px] text-gray-400 text-center" suppressHydrationWarning>&copy; {new Date().getFullYear()} Genie.ph — Your Cake Wish, Granted.</p>
                </div>
            </aside>
        </div>
    );
}
