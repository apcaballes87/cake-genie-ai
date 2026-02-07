'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getDesignContributions, createContribution, BillContribution } from '@/services/shareService';
import { showSuccess, showError, showInfo } from '@/lib/utils/toast';
import { ContributionSuccessModal } from '@/components/ContributionSuccessModal';
import { useAuth } from '@/contexts/AuthContext';
import { useCartActions } from '@/contexts/CartContext';
import { CustomizationDetails } from '@/lib/database.types';
import { ShoppingCart, Edit, Heart, Users, Loader2, CreditCard, MessageCircle } from 'lucide-react';

export interface SharedDesign {
    design_id: string;
    customized_image_url: string;
    original_image_url: string;
    title: string;
    description: string;
    alt_text: string;
    cake_type: string;
    cake_size: string;
    cake_flavor: string;
    cake_thickness: string;
    icing_colors: { name: string; hex: string }[];
    accessories: string[];
    base_price: number;
    final_price: number;
    availability_type: 'rush' | 'same-day' | 'normal';
    creator_name: string | null;
    bill_sharing_enabled?: boolean;
    bill_sharing_message?: string;
    suggested_split_count?: number;
    amount_collected?: number;
    url_slug?: string;
    payment_status?: string;
    auto_order_enabled: boolean;
    order_placed: boolean;
    order_id: string | null;
    delivery_address: string | null;
    delivery_city: string | null;
    event_date: string | null;
    event_time: string | null;
    recipient_name: string | null;
    created_by_user_id?: string;
    customization_details: string | CustomizationDetails;
    organizer?: {
        full_name: string | null;
        email: string | null;
        phone: string | null;
    } | null;
}

interface SharedDesignClientProps {
    design: SharedDesign;
}

export default function SharedDesignClient({ design: initialDesign }: SharedDesignClientProps) {
    const router = useRouter();
    const { user } = useAuth();
    const { addToCartOptimistic } = useCartActions();

    const [design] = useState<SharedDesign>(initialDesign);

    // State for bill sharing
    const [contributorName, setContributorName] = useState('');
    const [contributorEmail, setContributorEmail] = useState('');
    const [contributionAmount, setContributionAmount] = useState('');
    const [isSubmittingContribution, setIsSubmittingContribution] = useState(false);
    const [contributions, setContributions] = useState<BillContribution[]>([]);
    const [isLoadingContributions, setIsLoadingContributions] = useState(true);
    const [showContributionForm, setShowContributionForm] = useState(false);

    // State for success modal
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successDiscountCode, setSuccessDiscountCode] = useState('');
    const [successAmount, setSuccessAmount] = useState(0);

    // State for payment verification
    const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
    const [verificationMessage, setVerificationMessage] = useState('');

    const amountCollected = useMemo(() => {
        const paidContributionsTotal = contributions.reduce((sum, c) => sum + c.amount, 0);
        return Math.max(design?.amount_collected || 0, paidContributionsTotal);
    }, [contributions, design?.amount_collected]);

    const remainingAmount = (design?.final_price || 0) - amountCollected;
    const isFullyFunded = remainingAmount <= 0;
    const progress = design ? Math.min(100, (amountCollected / design.final_price) * 100) : 0;

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '') {
            setContributionAmount('');
            return;
        }

        if (!/^\d*\.?\d{0,2}$/.test(value)) {
            return;
        }

        const amount = parseFloat(value);

        if (isNaN(amount)) {
            return;
        }

        const clampedRemaining = parseFloat(remainingAmount.toFixed(2));
        if (clampedRemaining > 0.001 && amount > clampedRemaining) {
            setContributionAmount(clampedRemaining.toString());
            showInfo(`Amount capped at the remaining ₱${clampedRemaining.toFixed(2)}`);
        } else {
            setContributionAmount(value);
        }
    };

    useEffect(() => {
        const fetchContributions = async () => {
            if (design?.bill_sharing_enabled) {
                setIsLoadingContributions(true);
                const contribs = await getDesignContributions(design.design_id);
                setContributions(contribs);
                setIsLoadingContributions(false);
            }
        };
        if (design) {
            fetchContributions();
        }
    }, [design]);

    const handlePaymentVerification = useCallback(async (contributionId: string) => {
        setIsVerifyingPayment(true);
        setVerificationMessage('Verifying your payment...');

        try {
            const params = new URLSearchParams(window.location.search);
            const amount = parseFloat(params.get('amount') || '0');
            const code = params.get('code') || 'FRIEND100';

            const { pollPaymentStatus } = await import('@/services/paymentVerificationService');

            const result = await pollPaymentStatus(contributionId);

            if (result.success && result.status === 'paid') {
                setVerificationMessage('✅ Payment confirmed! Thank you!');
                setSuccessAmount(amount);
                setSuccessDiscountCode(code);

                if (design?.bill_sharing_enabled) {
                    const contribs = await getDesignContributions(design.design_id);
                    setContributions(contribs);
                }

                setTimeout(() => {
                    setIsVerifyingPayment(false);
                    setShowSuccessModal(true);

                    if (design?.url_slug || design?.design_id) {
                        window.history.replaceState(null, '', `/designs/${design.url_slug || design.design_id}`);
                    }
                }, 2000);
            } else {
                setVerificationMessage('⏰ Payment verification is taking longer than expected. Please refresh the page in a moment.');
                setSuccessAmount(amount);
                setSuccessDiscountCode(code);

                setTimeout(() => {
                    setIsVerifyingPayment(false);
                    setShowSuccessModal(true);
                }, 3000);
            }
        } catch (error) {
            console.error('Verification error:', error);
            setVerificationMessage('❌ Unable to verify payment automatically. Please refresh the page.');
            setIsVerifyingPayment(false);
        }
    }, [design]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        if (params.get('contribution') === 'success') {
            const contributionId = params.get('contribution_id');
            if (contributionId) {
                handlePaymentVerification(contributionId);
            }
        } else if (params.get('contribution') === 'failed') {
            showError('Your contribution failed. Please try again.');
            if (design?.url_slug || design?.design_id) {
                window.history.replaceState(null, '', `/designs/${design.url_slug || design.design_id}`);
            }
        }
    }, [design, handlePaymentVerification]);

    useEffect(() => {
        if (user && !user.is_anonymous) {
            const name = user.user_metadata?.full_name ||
                `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() ||
                user.email?.split('@')[0] ||
                '';
            setContributorName(name);
            setContributorEmail(user.email || '');
        }
    }, [user]);

    const handleNavigateHome = () => {
        router.push('/');
    };

    const handleAuthRequired = () => {
        router.push('/login');
    };

    const handleContribute = async () => {
        if (!design) return;

        if (!user || user.is_anonymous) {
            showError('Please sign in to contribute');
            handleAuthRequired();
            return;
        }

        if (!contributorName.trim()) {
            showError('Please enter your name');
            return;
        }
        if (!contributorEmail.trim() || !contributorEmail.includes('@')) {
            showError('Please enter a valid email');
            return;
        }
        const amount = parseFloat(contributionAmount);
        if (isNaN(amount) || amount <= 0) {
            showError('Please enter a valid amount');
            return;
        }
        const remaining = design.final_price - (amountCollected || 0);
        if (amount > remaining) {
            showError(`Amount cannot exceed remaining ₱${remaining.toFixed(2)}`);
            return;
        }

        setIsSubmittingContribution(true);

        const result = await createContribution(
            design.design_id,
            contributorName,
            contributorEmail,
            amount,
            user.id
        );

        setIsSubmittingContribution(false);

        if (result.success && result.paymentUrl) {
            window.location.href = result.paymentUrl;
        } else {
            showError(result.error || 'Failed to create contribution');
        }
    };

    const handlePurchaseClick = async () => {
        if (!design) return;

        try {
            // Parse customization details if it's a string
            let details: CustomizationDetails;
            if (typeof design.customization_details === 'string') {
                try {
                    details = JSON.parse(design.customization_details);
                } catch (e) {
                    console.error('Failed to parse customization details:', e);
                    showError('Error loading design details. Please try again.');
                    return;
                }
            } else {
                details = design.customization_details;
            }

            // Construct cart item
            // Note: We don't have addon_price in SharedDesign, assuming 0 or calculated in final_price
            // final_price = base_price + addon_price
            const addonPrice = design.final_price - design.base_price;

            await addToCartOptimistic({
                user_id: user?.id || null,
                session_id: null, // Will be handled by addToCartOptimistic/service
                merchant_id: null, // Will be set when ordering from a specific merchant shop
                cake_type: design.cake_type,
                cake_thickness: design.cake_thickness,
                cake_size: design.cake_size,
                base_price: design.base_price,
                addon_price: addonPrice,
                final_price: design.final_price,
                quantity: 1,
                original_image_url: design.original_image_url || design.customized_image_url, // Fallback if missing
                customized_image_url: design.customized_image_url,
                customization_details: details,
            });

            showSuccess('Design added to cart!');
            router.push('/cart');

        } catch (error) {
            console.error('Error adding to cart:', error);
            showError('Failed to add design to cart.');
        }
    };

    const handleStartWithDesign = () => {
        // Navigate to customizing with reference to this design image URL
        if (design) {
            // Pass the design image URL as a query parameter so the customizing page can fetch and load it
            const encodedUrl = encodeURIComponent(design.customized_image_url);
            router.push(`/customizing?ref=${encodedUrl}`);
        }
    };

    return (
        <div className="mt-auto pt-6 space-y-3">
            {/* Bill Sharing Section */}
            {design.bill_sharing_enabled && (
                <div className="mb-4 p-4 bg-linear-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-200">
                    <div className="flex items-center gap-2 mb-3">
                        <Heart className="w-5 h-5 text-pink-500" />
                        <h3 className="font-bold text-slate-800">Split the Bill!</h3>
                    </div>

                    {design.organizer && (design.organizer.email || design.organizer.phone) && (
                        <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200 text-sm">
                            <p className="font-semibold text-slate-700">Organized by: {design.organizer.full_name || design.creator_name}</p>
                            <div className="mt-2 space-y-1 text-xs text-slate-600">
                                {design.organizer.phone && <p><strong>Contact No:</strong> {design.organizer.phone}</p>}
                                {design.organizer.email && <p><strong>Email:</strong> {design.organizer.email}</p>}
                            </div>
                            <p className="text-xs text-slate-500 mt-2 italic">
                                Message them if you have any questions about this bill sharing request.
                            </p>
                        </div>
                    )}

                    {/* Creator's Message */}
                    {design.bill_sharing_message && (
                        <div className="mb-3 p-3 bg-white rounded-lg border border-pink-100">
                            <div className="flex items-start gap-2">
                                <MessageCircle className="w-4 h-4 text-pink-500 mt-0.5 shrink-0" />
                                <p className="text-sm text-slate-700 italic">{design.bill_sharing_message}</p>
                            </div>
                        </div>
                    )}

                    {/* Progress Bar */}
                    <div className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">Collected</span>
                            <span className="font-bold text-pink-600">
                                ₱{amountCollected.toLocaleString()} / ₱{design.final_price.toLocaleString()}
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                                className="bg-linear-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Contributors List */}
                    {design.bill_sharing_enabled && (
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                <Users size={16} />
                                Contributions ({contributions.length})
                            </h3>
                            <button
                                onClick={async () => {
                                    if (design) {
                                        setIsLoadingContributions(true);
                                        const contribs = await getDesignContributions(design.design_id);
                                        setContributions(contribs);
                                        setIsLoadingContributions(false);
                                        showSuccess("Contributions list updated!");
                                    }
                                }}
                                className="text-xs text-pink-600 hover:text-pink-800 font-medium flex items-center gap-1"
                                disabled={isLoadingContributions}
                            >
                                {isLoadingContributions ? <Loader2 size={14} className="animate-spin" /> : '🔄 Refresh'}
                            </button>
                        </div>
                    )}

                    {/* Show "Fully Paid & Order Placed" message */}
                    {isFullyFunded && design.order_placed && (
                        <div className="text-center py-3 px-4 bg-linear-to-r from-green-100 to-emerald-100 border-2 border-green-400 rounded-xl mb-3">
                            <div className="text-3xl mb-2">✅</div>
                            <p className="font-bold text-green-800 mb-1">Fully Paid & Order Placed!</p>
                            <p className="text-sm text-green-700">
                                This cake has been automatically ordered and will be delivered on{' '}
                                {design.event_date && new Date(design.event_date + 'T00:00:00').toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                                {design.event_time && ` at ${design.event_time}`}
                            </p>
                            {design.recipient_name && (
                                <p className="text-sm text-green-600 mt-1">
                                    🎂 For: {design.recipient_name}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Show "Fully Paid - Order Processing" message */}
                    {isFullyFunded && !design.order_placed && design.auto_order_enabled && (
                        <div className="text-center py-3 px-4 bg-linear-to-r from-blue-100 to-indigo-100 border-2 border-blue-400 rounded-xl mb-3">
                            <div className="text-3xl mb-2">⏳</div>
                            <p className="font-bold text-blue-800 mb-1">Fully Paid!</p>
                            <p className="text-sm text-blue-700">
                                Your order is being processed automatically. You&apos;ll receive confirmation shortly!
                            </p>
                        </div>
                    )}

                    {/* Hide contribution form if order is placed */}
                    {!design.order_placed && !isFullyFunded ? (
                        <>
                            {(!user || user.is_anonymous) && !design.order_placed && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm mb-3">
                                    <p className="font-bold text-blue-800">💡 Sign in to contribute</p>
                                    <p className="text-xs text-blue-700 mt-1">
                                        Create a free account to help fund this cake and unlock the ability to design your own custom cakes!
                                    </p>
                                </div>
                            )}

                            {!showContributionForm ? (
                                <button
                                    onClick={() => {
                                        if (!user || user.is_anonymous) {
                                            showError('Please sign in to contribute');
                                            handleAuthRequired();
                                            return;
                                        }
                                        setShowContributionForm(true);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base"
                                >
                                    <CreditCard className="w-5 h-5" />
                                    {(!user || user.is_anonymous) ? 'Sign In to Contribute' : 'Contribute Now'}
                                </button>
                            ) : (
                                <div className="space-y-3 mt-3">
                                    {/* Suggested Amounts */}
                                    {design.suggested_split_count && design.suggested_split_count > 0 && (
                                        <div>
                                            <p className="text-xs text-slate-600 mb-2">
                                                Suggested amount (split between {design.suggested_split_count} people):
                                            </p>
                                            <div className="flex gap-2 flex-wrap">
                                                {(() => {
                                                    const remaining = remainingAmount;
                                                    const suggestedAmount = Math.ceil(design.final_price / design.suggested_split_count!);
                                                    const halfAmount = Math.ceil(suggestedAmount / 2);

                                                    return (
                                                        <>
                                                            {halfAmount > 0 && halfAmount <= remaining && (
                                                                <button
                                                                    onClick={() => setContributionAmount(halfAmount.toString())}
                                                                    className="px-3 py-1.5 text-sm bg-white border-2 border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 font-medium"
                                                                >
                                                                    ₱{halfAmount.toLocaleString()} (Half)
                                                                </button>
                                                            )}
                                                            {suggestedAmount > 0 && suggestedAmount <= remaining && (
                                                                <button
                                                                    onClick={() => setContributionAmount(suggestedAmount.toString())}
                                                                    className="px-3 py-1.5 text-sm bg-linear-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:shadow-md font-medium"
                                                                >
                                                                    ₱{suggestedAmount.toLocaleString()} (Equal)
                                                                </button>
                                                            )}
                                                            {remaining > 0 && remaining <= suggestedAmount * 1.5 && (
                                                                <button
                                                                    onClick={() => setContributionAmount(remaining.toString())}
                                                                    className="px-3 py-1.5 text-sm bg-white border-2 border-green-300 text-green-600 rounded-lg hover:bg-green-50 font-medium"
                                                                >
                                                                    ₱{remaining.toLocaleString()} (All)
                                                                </button>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    <input
                                        type="text"
                                        placeholder="Your name"
                                        value={contributorName}
                                        onChange={(e) => setContributorName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        readOnly={!!(user && !user.is_anonymous)}
                                    />
                                    <input
                                        type="email"
                                        placeholder="Your email"
                                        value={contributorEmail}
                                        onChange={(e) => setContributorEmail(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        readOnly={!!(user && !user.is_anonymous)}
                                    />

                                    <input
                                        type="number"
                                        placeholder={`Custom amount (max ₱${remainingAmount.toFixed(2)})`}
                                        value={contributionAmount}
                                        onChange={handleAmountChange}
                                        min="1"
                                        max={remainingAmount.toFixed(2)}
                                        step="0.01"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleContribute}
                                            disabled={isSubmittingContribution}
                                            className="flex-1 bg-linear-to-r from-pink-500 to-purple-500 text-white font-bold py-2 px-4 rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                                        >
                                            {isSubmittingContribution ? 'Processing...' : `Pay ₱${parseFloat(contributionAmount || '0').toLocaleString()}`}
                                        </button>
                                        <button
                                            onClick={() => setShowContributionForm(false)}
                                            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}

                </div>
            )}

            {/* Only show purchase buttons if order not placed from bill sharing */}
            {!design.order_placed && (
                <>
                    {!design.bill_sharing_enabled && (
                        <button
                            onClick={handlePurchaseClick}
                            className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base"
                        >
                            <ShoppingCart className="w-5 h-5" />
                            Purchase This Design
                        </button>
                    )}
                    <button
                        onClick={handleStartWithDesign}
                        className="w-full flex items-center justify-center gap-2 text-center bg-white border-2 border-purple-500 text-purple-600 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-purple-50 transition-all text-base"
                    >
                        <Edit className="w-5 h-5" />
                        Customize This Design
                    </button>
                </>
            )}

            <ContributionSuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                contributionAmount={successAmount}
                discountCode={successDiscountCode}
                onStartDesigning={() => {
                    setShowSuccessModal(false);
                    handleNavigateHome();
                }}
            />
            {/* Payment Verification Overlay */}
            {isVerifyingPayment && (
                <>
                    <div className="fixed inset-0 bg-black/50 z-40 animate-fade-in" />
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-scale-in">
                            <div style={{ animation: 'spin 1s linear infinite', borderBottomColor: '#ec4899' }} className="rounded-full h-16 w-16 border-4 border-t-pink-500 border-r-pink-500 border-l-pink-500 mx-auto mb-4"></div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">
                                Verifying Payment
                            </h3>
                            <p className="text-slate-600 text-sm">
                                {verificationMessage}
                            </p>
                            <p className="text-xs text-slate-500 mt-4">
                                This usually takes just a few seconds...
                            </p>
                        </div>
                    </div>
                </>
            )}
            <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s ease-out; }
      `}</style>
        </div>
    );
}
