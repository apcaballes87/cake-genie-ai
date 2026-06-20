'use client';

import React, { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { CakeGenieOrder, CakeGenieOrderItem } from '@/lib/database.types';
import { getPaymentStatus, verifyXenditPayment } from '@/services/xenditService';
import { trackPurchase } from '@/lib/analytics';

type ConfirmationPaymentStatus = 'loading' | 'paid' | 'partial' | 'pending' | 'expired' | 'failed';

function normalizeConfirmationPaymentStatus(status: string | null | undefined): ConfirmationPaymentStatus | null {
    const normalized = status?.toLowerCase();

    if (!normalized) {
        return null;
    }

    if (normalized === 'verifying') {
        return 'pending';
    }

    if (normalized === 'payment_mismatch') {
        return 'failed';
    }

    if (
        normalized === 'paid' ||
        normalized === 'partial' ||
        normalized === 'pending' ||
        normalized === 'expired' ||
        normalized === 'failed'
    ) {
        return normalized;
    }

    return null;
}

const OrderConfirmationContent: React.FC = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const orderId = searchParams.get('order_id');
    const contributionId = searchParams.get('contribution_id');

    const [order, setOrder] = useState<(CakeGenieOrder & { cakegenie_order_items: CakeGenieOrderItem[] }) | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = getSupabaseClient();

    const [paymentStatus, setPaymentStatus] = useState<ConfirmationPaymentStatus>('loading');
    const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

    // Deduplication key — prevents re-firing the purchase event on page refresh
    const purchaseEventKey = orderId ? `ga4_purchase_fired_${orderId}` : null;

    const onContinueShopping = () => router.push('/');
    const onGoToOrders = () => router.push('/account/orders');

    const fetchOrder = useCallback(async () => {
        if (!orderId) {
            setLoading(false);
            return null;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('cakegenie_orders')
                .select('*, cakegenie_order_items(*)')
                .eq('order_id', orderId)
                .single();

            if (error) throw error;

            setOrder(data);
            setPaymentMethod(data.payment_method || null);

            const normalizedStatus = normalizeConfirmationPaymentStatus(data.payment_status);
            if (normalizedStatus) {
                setPaymentStatus((currentStatus) => {
                    if (normalizedStatus !== 'pending' || currentStatus === 'loading') {
                        return normalizedStatus;
                    }
                    return currentStatus;
                });
            }

            return data;
        } catch (error) {
            console.error('[OrderConfirmationPage] Error fetching order:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            setOrder(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, [orderId, supabase]);

    useEffect(() => {
        void fetchOrder();
    }, [fetchOrder]);

    // Proactive verification on page load
    useEffect(() => {
        const verifyOnLoad = async () => {
            if (!orderId) return;

            const result = await verifyXenditPayment(orderId, contributionId || undefined);

            if (result.success && result.status) {
                const normalizedStatus = normalizeConfirmationPaymentStatus(result.status);
                if (normalizedStatus) {
                    setPaymentStatus(normalizedStatus);
                }
            }

            await fetchOrder();
        };

        void verifyOnLoad();
    }, [contributionId, fetchOrder, orderId]);

    // Polling mechanism as a fallback
    useEffect(() => {
        const checkPayment = async () => {
            if (!orderId) return;

            try {
                if (contributionId) {
                    const verificationResult = await verifyXenditPayment(orderId, contributionId);
                    const normalizedStatus = normalizeConfirmationPaymentStatus(verificationResult.status);
                    if (normalizedStatus) {
                        setPaymentStatus(normalizedStatus);
                    }
                    await fetchOrder();
                    return;
                }

                const paymentData = await getPaymentStatus(orderId);

                if (paymentData) {
                    const normalizedStatus = normalizeConfirmationPaymentStatus(paymentData.status);
                    if (normalizedStatus) {
                        setPaymentStatus(normalizedStatus);
                    }
                    setPaymentMethod(paymentData.payment_method);
                } else {
                    await fetchOrder();
                }
            } catch (error) {
                console.error('Error checking payment status during poll:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
                await fetchOrder();
            }
        };

        // Don't start polling immediately; wait for the initial verification to attempt first.
        // The interval will start after a short delay.
        const intervalId = setInterval(() => {
            if (paymentStatus === 'pending' || paymentStatus === 'loading') {
                void checkPayment();
            }
        }, 5000);

        return () => clearInterval(intervalId);
    }, [contributionId, fetchOrder, orderId, paymentStatus]);

    // Fire the GA4 purchase event exactly once when payment is confirmed as 'paid' or 'partial'.
    // The sessionStorage guard prevents duplicate events on page refresh.
    useEffect(() => {
        if ((paymentStatus !== 'paid' && paymentStatus !== 'partial') || !order || !purchaseEventKey) return;

        try {
            if (sessionStorage.getItem(purchaseEventKey)) return;
        } catch (error) {
            console.warn(
                '[OrderConfirmationPage] sessionStorage.getItem failed:',
                error,
            );
        }

        const orderItems = (order.cakegenie_order_items || []).map((item: CakeGenieOrderItem) => ({
            item_id: `${item.cake_type}_${item.cake_size}`,
            item_name: `Custom Cake - ${item.cake_type}`,
            item_category: item.cake_type,
            price: item.final_price,
            quantity: item.quantity,
        }));

        trackPurchase({
            transactionId: order.order_number,
            value: order.total_amount,
            coupon: order.discount_code_id ?? undefined,
            items: orderItems,
        });

        // Mark as fired so refreshing the page doesn't re-send the event.
        // Guarded with try/catch because sessionStorage access can fail,
        // but analytics dedup should never block the confirmation page.
        try {
            sessionStorage.setItem(purchaseEventKey, '1');
        } catch (error) {
            console.warn(
                '[OrderConfirmationPage] sessionStorage.setItem failed:',
                error,
            );
        }

        // Clear cart state from sessionStorage after successful payment.
        // Wrapped in try/catch because sessionStorage access can THROW
        // (Safari Private Browsing, cross-origin iframes, quota hits)
        // and a thrown exception here would prevent the user from
        // seeing the "Order Placed Successfully!" confirmation —
        // strictly worse than leaving the snapshot in storage.
        try {
            sessionStorage.removeItem('pending_payment_cart');
            sessionStorage.removeItem('pending_payment_order_id');
            sessionStorage.removeItem('pending_payment_guest_email');
            // Also clear the dismissed-flag for THIS order so a
            // future abandoned order (different order_id) can
            // show its banner fresh.
            sessionStorage.removeItem(
                `pending_payment_dismissed_for_${orderId}`,
            );
        } catch (error) {
            console.warn(
                '[OrderConfirmationPage] sessionStorage.removeItem failed:',
                error,
            );
        }
    }, [paymentStatus, order, purchaseEventKey, orderId]);

    if (loading) {
        return (
            <div className="w-full max-w-3xl mx-auto flex justify-center items-center p-10 min-h-[400px]">
                <LoadingSpinner />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 text-center animate-fade-in mt-10">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Order Not Found</h2>
                <p className="text-gray-600 mb-6">We couldn't find the requested order. It may have been cancelled or there was an issue.</p>
                <button
                    onClick={onGoToOrders}
                    className="genie-btn-primary text-white px-6 py-3 rounded-full font-semibold shadow-md hover:shadow-lg transition-all inline-flex justify-center items-center"
                >
                    Back to My Orders
                </button>
            </div>
        );
    }

    const displayId = order.order_number || (typeof order.order_id === 'string' ? order.order_id.split('-')[0].toUpperCase() : 'N/A');
    const remainingBalance = Math.max(
        Number(order.total_amount) - Number(order.amount_collected || 0),
        0
    );
    const headlineText = paymentStatus === 'partial'
        ? 'Downpayment Received'
        : paymentStatus === 'paid'
            ? 'Order Placed Successfully!'
            : 'Order Placed';
    const subtitleText = paymentStatus === 'partial'
        ? 'Your booking is confirmed after the 50% downpayment.'
        : 'Your order is now being processed.';

    return (
        <div className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 text-center animate-fade-in mt-10">
            <div className="mx-auto w-16 h-16 flex items-center justify-center bg-green-100 rounded-full">
                <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-4">
                {headlineText === 'Order Placed Successfully!' ? (
                    <>Order Placed <span className="text-purple-400">Successfully!</span></>
                ) : (
                    <>{headlineText}<span className="text-purple-400">.</span></>
                )}
            </h1>
            <p className="text-slate-600 mt-2">{subtitleText}</p>

            <div className="mt-4 bg-slate-100 p-3 rounded-lg">
                <p className="text-sm text-slate-500">Your Order Number is:</p>
                <p className="text-lg font-mono font-bold text-slate-800 tracking-wider">{displayId}</p>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 text-left">
                <h3 className="text-lg font-semibold mb-4 text-slate-800">Payment Status</h3>

                {paymentStatus === 'loading' && (
                    <div className="flex items-center gap-3 text-slate-600">
                        <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <div>
                            <p className="font-medium">Verifying payment...</p>
                            <p className="text-sm text-slate-500">Please wait</p>
                        </div>
                    </div>
                )}

                {paymentStatus === 'paid' && (
                    <div className="flex items-center gap-3 text-green-600 bg-green-50 p-4 rounded-lg">
                        <svg className="w-8 h-8 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <p className="font-semibold text-lg">Payment Confirmed! 🎉</p>
                            <p className="text-sm text-green-700">
                                Your payment has been successfully processed
                                {paymentMethod && ` via ${paymentMethod}`}.
                            </p>
                            <p className="text-sm text-green-700 mt-1">
                                We'll start preparing your custom cake right away!
                            </p>
                        </div>
                    </div>
                )}

                {paymentStatus === 'partial' && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-green-600 bg-green-50 p-4 rounded-lg text-left">
                            <svg className="w-8 h-8 shrink-0 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className="font-semibold text-lg text-green-800">Downpayment Confirmed! 🎉</p>
                                <p className="text-sm text-green-700 mt-1">
                                    Your 50% downpayment has been successfully processed
                                    {paymentMethod && ` via ${paymentMethod}`}.
                                </p>
                                <p className="text-sm text-green-700 mt-2">
                                    We will start preparing your custom cake. The remaining balance of <strong>₱{remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> must be paid before your scheduled delivery or pickup time.
                                </p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left">
                            <p className="text-sm font-semibold text-amber-900">Important before delivery</p>
                            <p className="mt-2 text-sm text-amber-800">
                                Delivery or release of your order will only proceed after full payment has been received.
                            </p>
                            <p className="mt-2 text-sm text-amber-800">
                                To complete your payment, go to <strong>My Orders</strong> and tap <strong>Pay Remaining Balance</strong>.
                            </p>
                        </div>
                    </div>
                )}

                {paymentStatus === 'pending' && (
                    <div className="flex items-center gap-3 text-yellow-600 bg-yellow-50 p-4 rounded-lg">
                        <svg className="w-8 h-8 shrink-0 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <p className="font-semibold text-lg">Awaiting Payment</p>
                            <p className="text-sm text-yellow-700">
                                We're waiting for confirmation from the payment provider.
                            </p>
                            <p className="text-sm text-yellow-700 mt-1">
                                This page will update automatically.
                            </p>
                        </div>
                    </div>
                )}

                {paymentStatus === 'expired' && (
                    <div className="flex items-center gap-3 text-orange-600 bg-orange-50 p-4 rounded-lg">
                        <svg className="w-8 h-8 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <p className="font-semibold text-lg">Payment Link Expired</p>
                            <p className="text-sm text-orange-700">
                                Your payment link has expired.
                            </p>
                            <p className="text-sm text-orange-700 mt-1">
                                Please go to "My Orders" to try paying again or contact support.
                            </p>
                        </div>
                    </div>
                )}

                {paymentStatus === 'failed' && (
                    <div className="flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-lg">
                        <svg className="w-8 h-8 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <p className="font-semibold text-lg">Payment Failed</p>
                            <p className="text-sm text-red-700">
                                There was an issue processing your payment.
                            </p>
                            <p className="text-sm text-red-700 mt-1">
                                Please try again from "My Orders" or contact support.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col sm:flex-row-reverse gap-3 mt-8">
                <button onClick={onGoToOrders} className="w-full genie-btn-primary font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base flex items-center justify-center">
                    Check My Orders
                </button>
                <button onClick={onContinueShopping} className="w-full text-center bg-white border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-slate-50 transition-all text-base">
                    Shop for More Cakes
                </button>
            </div>
        </div>
    );
};

export default function OrderConfirmationPage() {
    return (
        <div className="min-h-screen bg-linear-to-br from-pink-50 via-purple-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
            <Suspense fallback={<LoadingSpinner />}>
                <OrderConfirmationContent />
            </Suspense>
        </div>
    );
}
