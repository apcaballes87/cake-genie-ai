'use client';

import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks';
import { showSuccess, showError } from '@/lib/utils/toast';
import { CakeGenieOrder, CakeGenieOrderItem, PaymentStatus, OrderStatus } from '@/lib/database.types';
import { useOrders, useUploadPaymentProof, useCancelOrder } from '@/hooks/useOrders';
import { Loader2, ArrowLeft, ChevronDown, Package, Clock, CreditCard, Check, CheckCircle, UploadCloud, Trash2, X, Users, Star } from 'lucide-react';
import { OrdersSkeleton, Skeleton } from '@/components/LoadingSkeletons';
import { ImageZoomModal } from '@/components/ImageZoomModal';
import DetailItem from '@/components/UI/DetailItem';
import AiChatHistoryDetails from '@/components/AiChatHistoryDetails';
import LazyImage from '@/components/LazyImage';
import BillShareCard from '@/components/BillShareCard';
import MobileBottomNav from '@/components/MobileBottomNav';
import ReviewForm from '@/components/ReviewForm';
import { useOrderReviews } from '@/hooks/useReviews';
import { createXenditPayment } from '@/services/xenditService';


interface EnrichedOrder extends CakeGenieOrder {
    cakegenie_order_items?: any[]; // Can be items or count object
    cakegenie_addresses?: any;
}

// Combined type for the unified list
type CreationItem = (EnrichedOrder & { type: 'order' }) | (any & { type: 'bill_sharing' });

// --- Status Badge Component ---
const statusStyles: Record<OrderStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    in_progress: "bg-indigo-100 text-indigo-800",
    ready_for_delivery: "bg-purple-100 text-purple-800",
    out_for_delivery: "bg-cyan-100 text-cyan-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
};

const paymentStatusStyles: Record<PaymentStatus, string> = {
    pending: "bg-orange-100 text-orange-800",
    verifying: "bg-purple-100 text-purple-800",
    paid: "bg-green-100 text-green-800",
    partial: "bg-blue-100 text-blue-800",
    refunded: "bg-gray-100 text-gray-800",
    failed: "bg-red-100 text-red-800"
};

const orderStatusTextMap: Partial<Record<OrderStatus, string>> = {
    pending: "Order Pending",
    confirmed: "Order Confirmed",
    in_progress: "In Progress",
    ready_for_delivery: "Ready for Delivery",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
};

const paymentStatusTextMap: Partial<Record<PaymentStatus, string>> = {
    pending: "Payment Pending",
    verifying: "Payment Verifying",
    paid: "Paid",
    partial: "Partial Payment",
    refunded: "Refunded",
    failed: "Payment Failed",
};

const StatusBadge: React.FC<{ status: OrderStatus | PaymentStatus; type: 'order' | 'payment' }> = ({ status, type }) => {
    const styles = type === 'order' ? statusStyles : paymentStatusStyles;
    let text: string;

    if (type === 'order' && orderStatusTextMap[status as OrderStatus]) {
        text = orderStatusTextMap[status as OrderStatus]!;
    } else if (type === 'payment' && paymentStatusTextMap[status as PaymentStatus]) {
        text = paymentStatusTextMap[status as PaymentStatus]!;
    } else {
        text = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    return (
        <span className={`px-2 py-1 text-[10px] sm:text-xs whitespace-nowrap font-medium rounded-full ${styles[status as keyof typeof styles]}`}>
            {text}
        </span>
    );
};

const orderProgressSteps: Array<{ status: Exclude<OrderStatus, 'cancelled'>; label: string }> = [
    { status: 'pending', label: 'Pending' },
    { status: 'confirmed', label: 'Confirmed' },
    { status: 'in_progress', label: 'In Progress' },
    { status: 'ready_for_delivery', label: 'Ready for Delivery' },
    { status: 'out_for_delivery', label: 'Out for Delivery' },
    { status: 'delivered', label: 'Delivered' },
];

export const OrderStatusStepper: React.FC<{ status: OrderStatus }> = ({ status }) => {
    const isCancelled = status === 'cancelled';
    const currentStepIndex = orderProgressSteps.findIndex((step) => step.status === status);
    const cardStyle = isCancelled ? 'border-slate-200 bg-slate-50' : 'border-purple-100 bg-purple-50/40';

    return (
        <section aria-label="Order progress" className={`mb-5 rounded-lg border p-4 ${cardStyle}`}>
            <div className="flex items-center justify-between gap-3 mb-3">
                <h4 className={`text-sm font-semibold ${isCancelled ? 'text-slate-500' : 'text-slate-800'}`}>Order Progress</h4>
                {isCancelled && (
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Order Cancelled
                    </span>
                )}
            </div>
            <ol className="space-y-1">
                {orderProgressSteps.map((step, index) => {
                    const isCurrent = !isCancelled && index === currentStepIndex;
                    const isReached = !isCancelled && currentStepIndex >= index;
                    const isLast = index === orderProgressSteps.length - 1;
                    const lineStyle = !isCancelled && currentStepIndex > index ? 'bg-purple-300' : 'bg-slate-200';
                    const markerStyle = isCancelled
                        ? 'border-slate-300 bg-slate-100 text-slate-400'
                        : isCurrent
                            ? 'border-purple-600 bg-purple-600 text-white'
                            : isReached
                                ? 'border-purple-200 bg-purple-100 text-purple-700'
                                : 'border-slate-200 bg-white text-slate-400';
                    const labelStyle = isCancelled
                        ? 'text-slate-400'
                        : isCurrent
                            ? 'font-semibold text-purple-800'
                            : isReached
                                ? 'font-medium text-slate-700'
                                : 'text-slate-400';

                    return (
                        <li key={step.status} className="relative flex min-h-8 items-start gap-3" data-status={step.status}>
                            {!isLast && (
                                <span aria-hidden="true" className={`absolute left-3 top-6 h-[calc(100%-0.25rem)] w-px ${lineStyle}`} />
                            )}
                            <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${markerStyle}`}>
                                {isReached ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                            </span>
                            <span className={`pt-0.5 text-sm ${labelStyle}`} aria-current={isCurrent ? 'step' : undefined}>
                                {step.label}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
};

type PaymentSummaryOrder = Pick<
    CakeGenieOrder,
    'total_amount' | 'discount_amount' | 'delivery_fee' | 'payment_status'
> & {
    amount_collected?: CakeGenieOrder['amount_collected'];
};

type PaymentSummaryState = 'paid' | 'due' | 'verifying' | 'refunded';

interface PaymentSummaryValues {
    total: number;
    discount: number;
    deliveryFee: number;
    amountPaid: number | null;
    balance: number | null;
    state: PaymentSummaryState;
}

const toNonNegativeAmount = (value: unknown): number => {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.max(amount, 0) : 0;
};

const formatOrderCurrency = (amount: number): string => (
    `₱${amount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
);

export const getOrderPaymentSummary = (order: PaymentSummaryOrder): PaymentSummaryValues => {
    const total = toNonNegativeAmount(order.total_amount);
    const discount = toNonNegativeAmount(order.discount_amount);
    const deliveryFee = toNonNegativeAmount(order.delivery_fee);

    if (order.payment_status === 'verifying') {
        return { total, discount, deliveryFee, amountPaid: null, balance: null, state: 'verifying' };
    }

    if (order.payment_status === 'refunded') {
        return { total, discount, deliveryFee, amountPaid: null, balance: null, state: 'refunded' };
    }

    const amountPaid = order.payment_status === 'paid'
        ? total
        : order.payment_status === 'partial'
            ? Math.min(toNonNegativeAmount(order.amount_collected), total)
            : 0;
    const balance = Math.max(total - amountPaid, 0);

    return {
        total,
        discount,
        deliveryFee,
        amountPaid,
        balance,
        state: balance > 0 ? 'due' : 'paid',
    };
};

export const OrderPaymentSummary: React.FC<{ order: PaymentSummaryOrder }> = ({ order }) => {
    const summary = getOrderPaymentSummary(order);
    const hasBalanceDue = summary.balance !== null && summary.balance > 0;
    const cardStyle = summary.state === 'due'
        ? 'border-amber-200 bg-amber-50/60'
        : summary.state === 'verifying'
            ? 'border-blue-200 bg-blue-50/60'
            : summary.state === 'refunded'
                ? 'border-slate-200 bg-slate-50'
                : 'border-green-200 bg-green-50/60';
    const stateLabel = summary.state === 'due'
        ? 'Balance due'
        : summary.state === 'verifying'
            ? 'Payment under review'
            : summary.state === 'refunded'
                ? 'Refunded'
                : 'Paid in full';
    const stateStyle = summary.state === 'due'
        ? 'text-amber-800 bg-amber-100'
        : summary.state === 'verifying'
            ? 'text-blue-800 bg-blue-100'
            : summary.state === 'refunded'
                ? 'text-slate-700 bg-slate-200'
                : 'text-green-800 bg-green-100';

    return (
        <div className={`mt-3 rounded-lg border p-3 ${cardStyle}`}>
            <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Payment summary</p>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold whitespace-nowrap ${stateStyle}`}>
                    {stateLabel}
                </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                <div>
                    <dt className="text-slate-500">Total amount</dt>
                    <dd className="mt-0.5 font-semibold text-slate-800">{formatOrderCurrency(summary.total)}</dd>
                </div>
                <div>
                    <dt className="text-slate-500">Discount</dt>
                    <dd className="mt-0.5 font-semibold text-green-700">
                        {summary.discount > 0 ? `-${formatOrderCurrency(summary.discount)}` : formatOrderCurrency(0)}
                    </dd>
                </div>
                <div>
                    <dt className="text-slate-500">Delivery fee</dt>
                    <dd className="mt-0.5 font-semibold text-slate-800">{formatOrderCurrency(summary.deliveryFee)}</dd>
                </div>
                <div>
                    <dt className="text-slate-500">Amount paid</dt>
                    <dd className="mt-0.5 font-semibold text-slate-800">
                        {summary.state === 'verifying'
                            ? 'Under review'
                            : summary.state === 'refunded'
                                ? 'Refunded'
                                : formatOrderCurrency(summary.amountPaid ?? 0)}
                    </dd>
                </div>
                {summary.state === 'verifying' && (
                    <div>
                        <dt className="text-slate-500">Balance due</dt>
                        <dd className="mt-0.5 font-semibold text-blue-800">Under review</dd>
                    </div>
                )}
                {hasBalanceDue && summary.balance !== null && (
                    <div>
                        <dt className="text-amber-700">Balance due</dt>
                        <dd className="mt-0.5 font-bold text-amber-900">{formatOrderCurrency(summary.balance)}</dd>
                    </div>
                )}
            </dl>
        </div>
    );
};

// --- Payment Upload Form ---
const PaymentUploadForm: React.FC<{ order: EnrichedOrder; onUploadSuccess: (updatedOrder: CakeGenieOrder) => void }> = ({ order, onUploadSuccess }) => {
    const { user } = useAuth();
    const uploadMutation = useUploadPaymentProof();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
                showError("File is too large. Maximum size is 5MB.");
                return;
            }
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!file || !user) {
            showError("Please select a file to upload.");
            return;
        }
        uploadMutation.mutate({ orderId: order.order_id, userId: user.id, file }, {
            onSuccess: (updatedOrder) => {
                showSuccess("Payment proof uploaded successfully!");
                if (updatedOrder) {
                    onUploadSuccess(updatedOrder);
                }
            },
            onError: (err: any) => {
                showError(err.message || "Failed to upload payment proof.");
            }
        });
    };

    return (
        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-800">Upload Payment Proof (Manual)</h4>
            <p className="text-xs text-slate-500 mt-1">For manual bank transfers, submit a clear image of your receipt.</p>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
                <div className="flex items-center gap-4">
                    <label htmlFor={`file-upload-${order.order_id}`} className="grow cursor-pointer">
                        <div className="flex items-center justify-center w-full px-4 py-3 text-sm text-slate-600 bg-white border-2 border-dashed border-slate-300 rounded-lg hover:bg-slate-100 transition-colors">
                            <UploadCloud className="w-5 h-5 mr-2 text-slate-400" />
                            <span>{file ? file.name : 'Choose a file...'}</span>
                        </div>
                        <input id={`file-upload-${order.order_id}`} type="file" className="hidden" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleFileChange} />
                    </label>
                    {preview && <LazyImage src={preview} alt="Preview" className="w-12 h-12 object-cover rounded-md" />}
                </div>
                <button type="submit" disabled={!file || uploadMutation.isPending} className="genie-btn-primary w-full py-2 px-4 rounded-lg shadow-sm active:scale-[0.99] transition-transform text-sm">
                    {uploadMutation.isPending ? <><Loader2 className="animate-spin mr-2 w-4 h-4" /> Submitting...</> : 'Submit Proof'}
                </button>
            </form>
        </div>
    );
};

// --- Pay Order Button Component ---
const PayOrderButton: React.FC<{ order: EnrichedOrder }> = ({ order }) => {
    const { user } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);

    const handlePayOrder = async () => {
        if (!user) {
            showError("Please sign in to pay for your order.");
            return;
        }

        setIsProcessing(true);
        try {
            const recipientName = order.cakegenie_addresses?.recipient_name || user.user_metadata?.first_name || 'Customer';
            const customerEmail = user.email || 'customer@example.com';

            const { paymentUrl, error: paymentError } = await createXenditPayment({
                orderId: order.order_id,
                amount: order.total_amount,
                customerEmail: customerEmail,
                customerName: recipientName
            });

            if (paymentError) throw new Error(paymentError);

            if (paymentUrl) {
                window.location.href = paymentUrl;
            } else {
                throw new Error('Payment URL not generated.');
            }
        } catch (error: any) {
            console.error('Payment error:', error);
            showError(error.message || 'Failed to create payment. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Pay Order Online</h4>
            <p className="text-xs text-slate-500 mb-3">Pay securely via GCash, Credit Card, or other methods.</p>
            <button
                onClick={handlePayOrder}
                disabled={isProcessing}
                className="genie-btn-primary w-full py-3.5 px-4 rounded-xl shadow-lg active:scale-[0.99] transition-transform text-sm"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Redirecting to Payment...
                    </>
                ) : (
                    <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Pay ₱{order.total_amount.toLocaleString()}
                    </>
                )}
            </button>
        </div>
    );
};

const PayBalanceButton: React.FC<{ order: EnrichedOrder }> = ({ order }) => {
    const { user } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);

    const handlePayBalance = async () => {
        if (!user) {
            showError("Please sign in to pay the remaining balance.");
            return;
        }

        setIsProcessing(true);
        try {
            const recipientName = order.cakegenie_addresses?.recipient_name || user.user_metadata?.first_name || 'Customer';
            const customerEmail = user.email || 'customer@example.com';
            
            const remainingBalance = Number(order.total_amount) - (Number(order.amount_collected) || 0);

            // Import and call createOrderContribution from supabaseService
            const { createOrderContribution } = await import('@/services/supabaseService');

            const { paymentUrl, error: paymentError } = await createOrderContribution({
                orderId: order.order_id,
                amount: remainingBalance,
                contributorName: recipientName || 'Customer',
                contributorEmail: customerEmail,
                successRedirectUrl: `${window.location.origin}/order-confirmation?order_id=${order.order_id}`,
                failureRedirectUrl: `${window.location.origin}/account/orders?payment_failed=true&order_id=${order.order_id}`
            });

            if (paymentError) throw new Error(paymentError);

            if (paymentUrl) {
                window.location.href = paymentUrl;
            } else {
                throw new Error('Payment URL not generated.');
            }
        } catch (error: any) {
            console.error('Payment error:', error);
            showError(error.message || 'Failed to create payment. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const remainingBalance = Number(order.total_amount) - (Number(order.amount_collected) || 0);

    return (
        <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Pay Remaining Balance</h4>
            <p className="text-xs text-slate-500 mb-3">Pay your remaining balance securely online.</p>
            <button
                onClick={handlePayBalance}
                disabled={isProcessing || remainingBalance <= 0}
                className="genie-btn-primary w-full py-3.5 px-4 rounded-xl shadow-lg active:scale-[0.99] transition-transform text-sm"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Redirecting to Payment...
                    </>
                ) : (
                    <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Pay Balance ₱{remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </>
                )}
            </button>
        </div>
    );
};


// --- Order Details Expansion ---

export const OrderDetails: React.FC<{ order: EnrichedOrder; onOrderUpdate: (updatedOrder: EnrichedOrder) => void; onReviewSubmitted?: () => void }> = ({ order, onOrderUpdate, onReviewSubmitted }) => {
    const { user } = useAuth();
    const [zoomedItem, setZoomedItem] = useState<CakeGenieOrderItem | null>(null);

    // Use the order data directly from the prop - already fetched in the main query
    const details = order;

    if (!details) {
        return <div className="p-4 text-center text-sm text-red-600">Could not load order details.</div>;
    }

    const deliveryDate = new Date(details.delivery_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const colorLabelMap: Record<string, string> = {
        side: 'Side', top: 'Top', borderTop: 'Top Border', borderBase: 'Base Border', drip: 'Drip', gumpasteBaseBoardColor: 'Base Board'
    };

    return (
        <>
            <div className="space-y-4">
                <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-2">Items</h4>
                    <div className="space-y-4">
                        {details.cakegenie_order_items?.map((item: any) => {
                            const customization = item.customization_details as any;
                            const tierLabels = customization?.flavors?.length === 2
                                ? ['Top Tier', 'Bottom Tier']
                                : customization?.flavors?.length === 3
                                    ? ['Top Tier', 'Middle Tier', 'Bottom Tier']
                                    : ['Flavor'];

                            return (
                                <div key={item.item_id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setZoomedItem(item)}
                                            className="w-24 h-24 shrink-0 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 transition-transform hover:scale-105"
                                            aria-label="Enlarge cake image"
                                        >
                                            <LazyImage 
                                                src={item.customized_image_url} 
                                                alt={item.cake_type} 
                                                fill={false}
                                                width={96}
                                                height={96}
                                                className="w-full h-full object-cover" 
                                            />
                                        </button>
                                        <div className="grow">
                                            <p className="font-semibold text-slate-800">{item.cake_type}</p>
                                            <p className="text-sm text-slate-500">{item.cake_size}</p>
                                            <p className="text-lg font-black text-slate-900 mt-1">₱{item.final_price.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    {customization && (
                                        <details className="mt-3">
                                            <summary className="text-xs font-semibold text-purple-600 cursor-pointer">View Customization Details</summary>
                                            <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-1.5 text-xs text-slate-500">
                                                <DetailItem label="Type" value={`${item.cake_type}, ${item.cake_thickness}, ${item.cake_size}`} />
                                                {(!customization.flavors || customization.flavors.length <= 1) ? (
                                                    <DetailItem label="Flavor" value={customization.flavors?.[0] || 'N/A'} />
                                                ) : (
                                                    customization.flavors.map((flavor: string, idx: number) => (
                                                        <DetailItem key={idx} label={`${tierLabels[idx]} Flavor`} value={flavor} />
                                                    ))
                                                )}
                                                {customization.mainToppers?.length > 0 && <DetailItem label="Main Toppers" value={customization.mainToppers.map((t: any) => t.description).join(', ')} />}
                                                {customization.supportElements?.length > 0 && <DetailItem label="Support" value={customization.supportElements.map((s: any) => s.description).join(', ')} />}
                                                {customization.cakeMessages?.map((msg: any, idx: number) => (
                                                    <DetailItem
                                                        key={idx}
                                                        label={`Message #${idx + 1}`}
                                                        value={
                                                            <div className="flex items-center justify-end gap-2">
                                                                <span>'{msg.text}'</span>
                                                                <div
                                                                    className="w-4 h-4 rounded-md border border-slate-200 shadow-sm"
                                                                    style={{ backgroundColor: msg.color }}
                                                                />
                                                                <span>{msg.color}</span>
                                                            </div>
                                                        }
                                                    />
                                                ))}
                                                {customization.icingDesign?.drip && <DetailItem label="Icing" value="Has Drip Effect" />}
                                                {customization.icingDesign?.gumpasteBaseBoard && <DetailItem label="Icing" value="Gumpaste Base Board" />}
                                                {Object.entries(customization.icingDesign?.colors || {}).map(([loc, color]: [string, any]) => (
                                                    <DetailItem
                                                        key={loc}
                                                        label={`${colorLabelMap[loc] || loc.charAt(0).toUpperCase() + loc.slice(1)} Color`}
                                                        value={
                                                            <div className="flex items-center justify-end gap-2">
                                                                <div
                                                                    className="w-4 h-4 rounded-md border border-slate-200 shadow-sm"
                                                                    style={{ backgroundColor: color as string }}
                                                                />
                                                                <span>{color as string}</span>
                                                            </div>
                                                        }
                                                    />
                                                ))}
                                                {customization.additionalInstructions && <DetailItem label="Instructions" value={customization.additionalInstructions} />}
                                                <AiChatHistoryDetails historySource={customization} />
                                            </div>
                                        </details>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
                <OrderStatusStepper status={details.order_status} />
                <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-2">Delivery Details</h4>
                    <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                        <p><span className="font-semibold text-slate-600">Date:</span> {deliveryDate} ({details.delivery_time_slot})</p>
                        {details.cakegenie_addresses && (
                            <>
                                <p><span className="font-semibold text-slate-600">To:</span> {details.cakegenie_addresses.recipient_name}</p>
                                <p className="text-slate-500">{`${details.cakegenie_addresses.street_address}, ${details.cakegenie_addresses.barangay}, ${details.cakegenie_addresses.city}`}</p>
                            </>
                        )}
                    </div>
                </div>

                {details.payment_status === 'pending' && (
                    <div className="space-y-4">
                        {/* Pay Order Button */}
                        <PayOrderButton order={details} />

                        {/* Divider with OR */}
                        <div className="relative flex items-center py-2">
                            <div className="grow border-t border-slate-300"></div>
                            <span className="shrink-0 mx-4 text-slate-400 text-xs font-medium uppercase tracking-wider">Or pay manually</span>
                            <div className="grow border-t border-slate-300"></div>
                        </div>

                        <PaymentUploadForm order={details} onUploadSuccess={onOrderUpdate} />
                    </div>
                )}

                {details.payment_status === 'partial' && details.split_message === 'downpayment_50' && (
                    <div className="space-y-4">
                        <PayBalanceButton order={details} />
                    </div>
                )}


                {details.payment_status === 'verifying' && (
                    <div className="p-3 text-center bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                        <CheckCircle className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                        <p className="font-semibold">Payment proof submitted.</p>
                        <p>We are currently reviewing your payment. Please wait for confirmation.</p>
                    </div>
                )}
                {details.payment_proof_url && details.payment_status !== 'pending' && (
                    <a href={details.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:text-purple-700 hover:underline text-center block mt-2">View Submitted Proof</a>
                )}
            </div>
            <ImageZoomModal
                isOpen={!!zoomedItem}
                onClose={() => setZoomedItem(null)}
                originalImage={zoomedItem?.original_image_url || null}
                customizedImage={zoomedItem?.customized_image_url || null}
            />
        </>
    );
};


// --- Order Card Component ---
interface OrderCardProps {
    order: EnrichedOrder;
    onOrderUpdate: (updatedOrder: EnrichedOrder) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onOrderUpdate }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { user } = useAuth();
    const cancelMutation = useCancelOrder();
    const [copied, setCopied] = useState(false);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [selectedItemForReview, setSelectedItemForReview] = useState<any>(null);

    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // The query now returns the full items array, so we use .length for the count.
    const itemCount = order.cakegenie_order_items?.length ?? 0;

    // Check if order is eligible for review (delivery date is today or has passed, & not cancelled)
    const isReviewEligible = (() => {
        if (!order.delivery_date || order.order_status === 'cancelled') return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deliveryDate = new Date(order.delivery_date + 'T00:00:00');
        return today >= deliveryDate;
    })();

    // Fetch existing reviews to check if already reviewed
    const { data: existingReviews = [], refetch: refetchReviews } = useOrderReviews(
        isReviewEligible ? order.order_id : undefined
    );

    // Check if all items are already reviewed
    const allItemsReviewed = isReviewEligible && order.cakegenie_order_items?.every(
        (item: any) => existingReviews.some((r) => r.order_item_id === item.item_id)
    );

    const handleCancelOrder = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) {
            showError("You must be logged in to cancel orders.");
            return;
        }

        cancelMutation.mutate({ orderId: order.order_id, userId: user.id }, {
            onSuccess: (updatedOrder) => {
                if (updatedOrder) {
                    onOrderUpdate(updatedOrder as EnrichedOrder);
                }
            }
        });
    };

    const handleCopyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        const link = `${window.location.origin}/contribute/${order.order_id}`;
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            showSuccess('Link copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // Split Order Calculations
    const isSplitOrder = order.is_split_order && order.split_message !== 'downpayment_50';
    const collected = order.amount_collected || 0;
    const total = order.total_amount;
    const progress = Math.min((collected / total) * 100, 100);
    const remaining = Math.max(total - collected, 0);
    const isFullyFunded = remaining <= 0;
    const detailsRegionId = `order-details-${order.order_id}`;

    const handleToggleExpand = () => {
        setIsExpanded((prev) => !prev);
    };

    const handleToggleExpandKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        handleToggleExpand();
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-controls={detailsRegionId}
                className="p-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
                onClick={handleToggleExpand}
                onKeyDown={handleToggleExpandKeyDown}
            >
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="font-mono text-sm font-bold text-slate-800">#{order.order_number}</p>
                            {isSplitOrder && (
                                <span className="px-2 py-0.5 text-[10px] sm:text-xs whitespace-nowrap font-bold uppercase tracking-wider bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                                    Split Order
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Placed on {orderDate}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-black text-slate-900">₱{order.total_amount.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">{itemCount} item(s)</p>
                    </div>
                </div>

                <OrderPaymentSummary order={order} />

                {/* Split Order Progress Bar (Visible in collapsed view too) */}
                {isSplitOrder && (
                    <div className="mt-3 mb-1">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-600 font-medium">Collected: ₱{collected.toLocaleString()}</span>
                            <span className="text-slate-500">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${isFullyFunded ? 'bg-green-500' : 'bg-purple-600'}`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 text-right">
                            {isFullyFunded ? 'Fully Funded' : `₱${remaining.toLocaleString()} remaining`}
                        </p>
                    </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <StatusBadge status={order.order_status} type="order" />
                            <StatusBadge status={order.payment_status} type="payment" />
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Share Button for Split Orders */}
                            {isSplitOrder && !isFullyFunded && (
                                <button
                                    onClick={handleCopyLink}
                                    className="p-2 sm:px-3 sm:py-1.5 text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-2"
                                    title="Copy Contribution Link"
                                >
                                    {copied ? <CheckCircle className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                                    <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
                                </button>
                            )}

                            {/* Cancel Button — only when order is pending AND delivery date hasn't arrived */}
                            {order.order_status === 'pending' && !isReviewEligible && (
                                <button
                                    onClick={handleCancelOrder}
                                    disabled={cancelMutation.isPending}
                                    title="Cancel Order"
                                    type="button"
                                    className="p-2 sm:px-3 sm:py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {cancelMutation.isPending && cancelMutation.variables?.orderId === order.order_id ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="hidden sm:inline">Cancelling...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4" />
                                            <span className="hidden sm:inline">Cancel</span>
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Write Review Button — on/after delivery date, not yet reviewed */}
                            {isReviewEligible && !allItemsReviewed && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedItemForReview(null);
                                        setShowReviewForm(true);
                                    }}
                                    className="px-2 py-1.5 sm:px-3 text-xs sm:text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm"
                                >
                                    <Star className="w-4 h-4" />
                                    <span>Write Review</span>
                                </button>
                            )}

                            {/* Already Reviewed Badge */}
                            {isReviewEligible && allItemsReviewed && (
                                <div className="flex items-center gap-1 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                    <span className="text-xs font-semibold text-green-700">Reviewed</span>
                                </div>
                            )}

                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div id={detailsRegionId} className="px-4 pb-4 border-t border-slate-200 animate-fade-in">
                    <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

                    {/* Expanded Split Order Details */}
                    {isSplitOrder && (
                        <div className="mb-6 mt-4 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="text-sm font-bold text-purple-900">Split Order Details</h4>
                                    <p className="text-xs text-purple-700 mt-0.5">Share the link below with friends to collect contributions.</p>
                                </div>
                                <button
                                    onClick={handleCopyLink}
                                    className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-purple-200 shadow-sm"
                                >
                                    {copied ? <CheckCircle className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                                    {copied ? 'Copied!' : 'Copy Link'}
                                </button>
                            </div>

                            <div className="bg-white p-2 rounded-lg border border-purple-100 flex items-center justify-between gap-2">
                                <code className="text-xs text-slate-600 truncate flex-1">
                                    {`${window.location.origin}/contribute/${order.order_id}`}
                                </code>
                            </div>
                        </div>
                    )}

                    <OrderDetails order={order} onOrderUpdate={onOrderUpdate} onReviewSubmitted={() => onOrderUpdate(order)} />
                </div>
            )}

            {/* Review Form Modal — triggered from collapsed card button */}
            {showReviewForm && user && (
                <ReviewForm
                    isOpen={showReviewForm}
                    onClose={() => {
                        setShowReviewForm(false);
                        setSelectedItemForReview(null);
                    }}
                    orderId={order.order_id}
                    orderItemId={selectedItemForReview?.item_id}
                    merchantId={order.merchant_id || ''}
                    productId={selectedItemForReview?.product_id}
                    userId={user.id}
                    orderNumber={order.order_number}
                    itemName={selectedItemForReview?.cake_type || order.cakegenie_order_items?.[0]?.cake_type}
                    itemImageUrl={selectedItemForReview?.customized_image_url || order.cakegenie_order_items?.[0]?.customized_image_url}
                    onReviewSubmitted={() => {
                        refetchReviews();
                        onOrderUpdate(order);
                    }}
                />
            )}
        </div>
    );
};


// --- Main Page Component ---
export default function OrdersClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const userId = user?.id;
    const paymentFailed = searchParams.get('payment_failed') === 'true';
    const [currentPage, setCurrentPage] = useState(1);
    const [allOrders, setAllOrders] = useState<EnrichedOrder[]>([]);
    const [billShareDesigns, setBillShareDesigns] = useState<any[]>([]);
    const ORDERS_PER_PAGE = 5;

    const { data: pageData, isLoading: pageLoading, isFetching, error } = useOrders(userId, {
        limit: ORDERS_PER_PAGE,
        offset: (currentPage - 1) * ORDERS_PER_PAGE,
        includeItems: true,
    });

    useEffect(() => {
        if (error) {
            showError(error instanceof Error ? error.message : "Could not fetch your orders.");
        }
    }, [error]);

    useEffect(() => {
        if (paymentFailed) {
            showError('Payment failed. Please try again.');
        }
    }, [paymentFailed]);

    const totalOrderCount = pageData?.totalOrderCount || 0;
    const totalItemCount = (pageData?.totalOrderCount || 0) + (pageData?.designs?.length || 0);

    useEffect(() => {
        if (pageData) {
            if (currentPage === 1) {
                setAllOrders(pageData.orders || []);
                setBillShareDesigns(pageData.designs || []);
            } else {
                setAllOrders(prevOrders => {
                    // Merge orders while preserving order and avoiding duplicates
                    const existingOrderIds = new Set(prevOrders.map(o => o.order_id));
                    const newOrders = (pageData.orders || []).filter(o => !existingOrderIds.has(o.order_id));
                    // Append to the end for pagination (older orders go at the bottom)
                    return [...prevOrders, ...newOrders];
                });
            }
        }
    }, [pageData]); // Removed currentPage dependency to prevent extra re-runs

    const combinedItems = useMemo<CreationItem[]>(() => {
        const ordersWithType: CreationItem[] = allOrders.map(o => ({ ...o, type: 'order' }));
        const designsWithType: CreationItem[] = billShareDesigns.map(d => ({ ...d, type: 'bill_sharing' }));
        return [...ordersWithType, ...designsWithType].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [allOrders, billShareDesigns]);

    useEffect(() => {
        setCurrentPage(1);
        setAllOrders([]);
        setBillShareDesigns([]);
    }, [userId]);

    const handleLoadMore = () => {
        if (!isFetching && allOrders.length < totalOrderCount) {
            setCurrentPage(p => p + 1);
        }
    };

    const handleOrderUpdate = useCallback((updatedOrder: EnrichedOrder) => {
        setAllOrders(currentOrders =>
            currentOrders.map(order =>
                order.order_id === updatedOrder.order_id ? { ...order, ...updatedOrder } : order
            )
        );
    }, []);

    const handleDesignUpdate = useCallback((updatedDesign: any) => {
        setBillShareDesigns(currentDesigns =>
            currentDesigns.map(design =>
                design.design_id === updatedDesign.design_id ? { ...design, ...updatedDesign } : design
            )
        );
    }, []);

    const initialLoading = authLoading || (pageLoading && combinedItems.length === 0);

    if (initialLoading) {
        return (
            <div className="w-full max-w-3xl mx-auto py-8 px-4">
                <div className="flex items-center gap-4 mb-6">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-8 w-40" />
                </div>
                <OrdersSkeleton count={3} />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="w-full max-w-3xl mx-auto py-8 px-4 text-center">
                <p className="text-slate-600">You must be logged in to view your orders.</p>
                <button onClick={() => router.push('/')} className="mt-4 text-purple-650 text-purple-600 font-semibold hover:underline">Go Back</button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto pb-24 md:pb-8 px-4">
            <div className="flex items-center gap-4 mb-6 pt-4">
                <button onClick={() => router.push('/account')} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                    <ArrowLeft />
                </button>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My <span className="text-purple-400">Orders</span></h1>
            </div>

            <div className="space-y-4">
                {combinedItems.length > 0 ? (
                    combinedItems.map(item => {
                        if (item.type === 'order') {
                            return <OrderCard key={item.order_id} order={item} onOrderUpdate={handleOrderUpdate} />;
                        }
                        if (item.type === 'bill_sharing') {
                            return <BillShareCard key={item.design_id} design={item} onDesignUpdate={handleDesignUpdate} />;
                        }
                        return null;
                    })
                ) : (
                    <div className="text-center py-16 bg-white/50 rounded-2xl">
                        <Package className="w-12 h-12 mx-auto text-slate-400" />
                        <p className="text-slate-500 mt-4">You haven't placed any orders or created any designs yet.</p>
                        <button onClick={() => router.push('/')} className="mt-4 text-purple-600 font-semibold hover:underline">Start Designing</button>
                    </div>
                )}
            </div>

            <div className="mt-6 text-center">
                <p className="text-sm text-slate-500 mb-4">Showing {combinedItems.length} of {totalItemCount} items.</p>
                {allOrders.length < totalOrderCount && (
                    <button
                        onClick={handleLoadMore}
                        disabled={isFetching}
                        className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-full border border-purple-200 shadow-sm hover:shadow-md hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                    >
                        {isFetching ? (
                            <>
                                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                                Loading...
                            </>
                        ) : (
                            'Load More Orders'
                        )}
                    </button>
                )}
            </div>

            <MobileBottomNav />
        </div>
    );
}
