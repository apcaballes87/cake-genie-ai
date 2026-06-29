'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { submitCreatorApplication, type CreatorSubmission } from './actions';
import { isAppError, getErrorMessage } from '@/lib/errors';
import { Camera, Gift, Percent, Video } from 'lucide-react';
import { Footer } from '@/components/Footer';

export default function CreatorsLandingPage() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isScrolled, setIsScrolled] = useState(false);

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
            <nav className={`sticky top-0 z-50 w-full border-b transition-all duration-200 ${isScrolled ? 'border-purple-100 bg-white/[0.95] shadow-sm' : 'border-transparent bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between py-[11px] md:py-[14px]">
                        <Link href="/" className="flex items-center gap-2 shrink-0">
                            <img
                                src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/genie-logo-header-360.webp"
                                alt="Genie Logo"
                                className="h-[38px] md:h-[41px] w-auto object-contain"
                            />
                        </Link>
                        <div className="flex items-center gap-3">
                            <Link href="/collections" className="text-sm font-bold text-slate-600 hover:text-purple-650 transition-colors">
                                Browse Cakes
                            </Link>
                            <Link href="/" className="genie-btn-secondary px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
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
                                        <h4 className="font-semibold text-gray-900">20% Commission</h4>
                                        <p className="text-sm text-gray-600">Earn 20% commission on cakes sold through your unique promo code. Plus, your audience gets 20% off!</p>
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
                                            Your unique 20% off promo code (automatically generated) *
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
                                                <li>Your audience gets <strong>20% OFF</strong> when they use your code at checkout.</li>
                                                <li>You get <strong>20% COMMISSION</strong> for every successful order using your code.</li>
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
            <Footer />
        </div>
    );
}
