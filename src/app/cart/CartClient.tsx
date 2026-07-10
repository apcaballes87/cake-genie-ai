'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCart, useCartActions, readFromLocalStorage, batchSaveToLocalStorage, batchRemoveFromLocalStorage } from '@/contexts/CartContext';
import { useAddresses, useAddAddress } from '@/hooks/useAddresses';
import { showSuccess, showError, showInfo } from '@/lib/utils/toast';
import { Loader2, CloseIcon } from '@/components/icons';
import { MapPin, Users, User, ChevronDown, CalendarDays, CreditCard } from 'lucide-react';
import { CartItem, CartItemDetails } from '@/types';
import { CakeGenieAddress } from '@/lib/database.types';
import { CartSkeleton } from '@/components/LoadingSkeletons';
import { getDeliveryFeeByCity } from '@/constants';
import { createOrderFromCart, createSplitOrderFromCart, getAvailableDeliveryDates, getBlockedDatesInRange, AvailableDate, BlockedDateInfo, createGuestUser, createOrderContribution } from '@/services/supabaseService';
import { upgradeAnonymousToEmailAccount } from '@/services/accountActivation';
import { createXenditPayment } from '@/services/xenditService';
import {
    getAnalyticsValueBucket,
    trackBeginCheckout,
    trackAddPaymentInfo,
    trackCartRequirementMissing,
    trackCheckoutCreateOrderFailed,
    trackCheckoutPaymentHandoffFailed,
    trackCheckoutPlaceOrderClicked,
    trackCheckoutRedirectStarted,
} from '@/lib/analytics';
import { GA4_MEASUREMENT_ID } from '@/lib/analyticsRoutes';
import { prepareBuyerAttributionForCheckout } from '@/lib/buyerAttribution';
import { AddressForm, StaticMap } from '@/components/AddressForm';
import { SplitWithFriendsModal } from '@/components/SplitWithFriendsModal';
import { SplitOrderShareModal } from '@/components/SplitOrderShareModal';
import { useGoogleMapsLoader, GoogleMapsLoaderProvider } from '@/contexts/GoogleMapsLoaderContext';
import { calculateCartAvailability } from '@/lib/utils/availability';
import { getDisabledTimeSlotReason, getDisabledTimeSlotsForLeadTime, getLeadTimeDaysFromManilaToday, isDateAvailableForLeadTime } from '@/lib/utils/deliveryLeadTime';
import CartItemCard from '@/components/CartItemCard';
import { useQuery } from '@tanstack/react-query';
import { useAvailabilitySettings } from '@/hooks/useAvailabilitySettings';
import { validateDiscountCode, getUserDiscountCodes } from '@/services/discountService';
import type { DiscountValidationResult } from '@/types';
import { useSmartBack, useRecordNavigation } from '@/hooks/useSmartBack';
import { usePendingOrderRecovery } from '@/hooks/usePendingOrderRecovery';
import { useCancelOrder } from '@/hooks/useOrders';
import PaymentErrorBoundary from '@/components/PaymentErrorBoundary';
import CartDateOption from './CartDateOption';

const getErrorMessage = (error: unknown, fallback: string) => (
    error instanceof Error ? error.message : fallback
);
type AddressCreateInput = Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'>;
type RegistrationDocument = {
    label: string;
    imageUrl: string;
};

const EVENT_TIME_SLOTS_MAP: { slot: string; startHour: number; endHour: number }[] = [
    { slot: "10AM - 12NN", startHour: 10, endHour: 12 },
    { slot: "12NN - 2PM", startHour: 12, endHour: 14 },
    { slot: "2PM - 4PM", startHour: 14, endHour: 16 },
    { slot: "4PM - 6PM", startHour: 16, endHour: 18 },
    { slot: "6PM - 8PM", startHour: 18, endHour: 20 },
];
const EVENT_TIME_SLOTS = EVENT_TIME_SLOTS_MAP.map(item => item.slot);

const paymentMethods = [
    { name: 'GCash', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/gcash.jpg' },
    { name: 'Maya', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/maya.jpg' },
    { name: 'ShopeePay', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/shopeepay.jpg' },
    { name: 'Visa', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/visa.jpg' },
    { name: 'Mastercard', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/mastercard.jpg' },
    { name: 'BPI', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/bpi.jpg' },
    { name: 'BDO', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/bdo.jpg' },
    { name: 'Palawan', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/palawan.jpg' },
];

const PICKUP_LOCATIONS = [
    {
        id: 'treehouse',
        name: 'Cebu (Treehouse)',
        branchName: 'Cakes and Memories Bakeshop – Treehouse',
        street_address: 'Unit 3, Treehouse Building, R. Aboitiz St. Camputhaw, Cebu City, Cebu',
        city: 'Cebu City',
        latitude: 10.3124792,
        longitude: 123.8929501,
        province: 'Cebu',
        country: 'Philippines',
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3925.012!2d123.8929501!3d10.3124792!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a999df1bf0044f%3A0x5dfb51cb83a184c6!2sCakes%20and%20Memories%20Bakeshop%20-%20Treehouse!5e0!3m2!1sen!2sph!4v1708950000000!5m2!1sen!2sph",
        googleMapsUrl: "https://www.google.com/maps/place/Cakes+and+Memories+Bakeshop+-+Treehouse/@10.3124792,123.8929501,17z"
    },
    {
        id: 'molino',
        name: 'Bacoor (Molino)',
        branchName: 'Cakes and Memories Bacoor (Molino)',
        street_address: 'Avenida Rizal, Beside Iglesia ni Cristo Chapel, Bahayang Pag-asa Subdivision, Molino 3, Bacoor, 4126 Cavite',
        city: 'Bacoor',
        latitude: 14.3983397,
        longitude: 120.9770755,
        province: 'Cavite',
        country: 'Philippines',
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3866.4523!2d120.9744868!3d14.3983397!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397d3d1ee9a1573%3A0x982617c076bfc62b!2sCakes%20and%20Memories%20Bakeshop!5e0!3m2!1sen!2sph!4v1710430000000!5m2!1sen!2sph",
        googleMapsUrl: "https://www.google.com/maps/place/Cakes+and+Memories+Bakeshop/@14.3983397,120.9770755,17z/data=!3m1!4b1!4m6!3m5!1s0x3397d3d1ee9a1573:0x982617c076bfc62b!8m2!3d14.3983397!4d120.9770755!16s%2Fg%2F11xjgyvws"
    }
];

// --- Pending Order Recovery Banner ---
// Shown when the user returns to the cart from Xendit (via the back
// button or the failure URL) and an unfinished order is detected.
interface PendingOrderRecoveryBannerProps {
    snapshot: {
        orderId: string;
        itemCount: number;
        totalAmount: number;
        createdAt: number;
    };
    onResume: () => void;
    onDiscard: () => void;
    isResuming: boolean;
    isDiscarding: boolean;
}

function formatTimeAgo(timestampMs: number): string {
    const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
    if (diffSec < 60) return 'just now';
    const minutes = Math.floor(diffSec / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
}

function PendingOrderRecoveryBanner({
    snapshot,
    onResume,
    onDiscard,
    isResuming,
    isDiscarding,
}: PendingOrderRecoveryBannerProps) {
    const itemLabel = snapshot.itemCount === 1 ? '1 item' : `${snapshot.itemCount} items`;
    const timeLabel = formatTimeAgo(snapshot.createdAt);
    const orderLabel = snapshot.orderId.slice(0, 8).toUpperCase();

    return (
        <div
            role="alert"
            data-testid="cart-recovery-banner"
            className="mx-4 mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 animate-fade-in"
        >
            <div className="flex items-start gap-3">
                <div className="shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                    <svg
                        className="w-5 h-5 text-amber-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                        You have an incomplete order from {timeLabel}.
                    </p>
                    <p className="text-xs text-amber-800 mt-1">
                        Order #{orderLabel} · {itemLabel} totaling{' '}
                        <span className="font-semibold">₱{snapshot.totalAmount.toLocaleString()}</span>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={onResume}
                            disabled={isResuming || isDiscarding}
                            data-testid="cart-recovery-resume"
                            className="genie-btn-primary text-white text-xs font-semibold px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isResuming ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Redirecting...
                                </>
                            ) : (
                                'Resume payment'
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onDiscard}
                            disabled={isResuming || isDiscarding}
                            data-testid="cart-recovery-discard"
                            className="text-amber-900 bg-white/70 hover:bg-white border border-amber-200 text-xs font-semibold px-4 py-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isDiscarding ? 'Discarding...' : 'Discard'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface DownpaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    totalAmount: number;
    eventDate: string;
    isLoading: boolean;
}

const DownpaymentModal: React.FC<DownpaymentModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    totalAmount,
    eventDate,
    isLoading
}) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const previousActiveElement = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.body.style.overflow;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (!isLoading) {
                    onClose();
                }
                return;
            }

            if (event.key !== 'Tab' || !dialogRef.current) {
                return;
            }

            const focusableElements = Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            );

            if (focusableElements.length === 0) {
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        document.body.style.overflow = 'hidden';
        confirmButtonRef.current?.focus();
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            previousActiveElement?.focus();
        };
    }, [isOpen, isLoading, onClose]);

    const downpayment = totalAmount / 2;
    const balance = totalAmount / 2;
    const formattedDate = eventDate
        ? new Date(`${eventDate}T00:00:00+08:00`).toLocaleDateString('en-US', {
              timeZone: 'Asia/Manila',
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
          })
        : '';

    if (!isOpen) return null;

    const handleBackdropClick = () => {
        if (!isLoading) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
            onClick={handleBackdropClick}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="downpayment-modal-title"
                aria-describedby="downpayment-modal-description"
                className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-scale-in border border-slate-100"
                onClick={(event) => event.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-purple-50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-full">
                            <CreditCard size={20} />
                        </div>
                        <h2 id="downpayment-modal-title" className="text-lg font-bold text-slate-800">50% Downpayment Option</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
                        aria-label="Close modal"
                    >
                        <CloseIcon />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm text-slate-600">
                            <span>Total Order Value:</span>
                            <span className="font-semibold text-slate-800">₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100/50 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-purple-800">Pay Now (50% Downpayment):</span>
                                <span className="text-lg font-black text-purple-900">₱{downpayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-purple-200/50 text-xs text-purple-700">
                                <span>Remaining Balance (50%):</span>
                                <span className="font-bold">₱{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    <div id="downpayment-modal-description" className="text-sm text-slate-600 space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="font-medium text-slate-800 text-xs sm:text-sm">Payment Terms:</p>
                        <ul className="list-disc pl-4 space-y-1 text-xs">
                            <li>To secure your order, a 50% non-refundable downpayment is required today.</li>
                            <li>The remaining balance of <strong>₱{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> must be paid on or before your scheduled fulfillment date of <strong>{formattedDate}</strong>.</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <button
                            ref={confirmButtonRef}
                            type="button"
                            onClick={onConfirm}
                            disabled={isLoading}
                            className="w-full genie-btn-primary py-3.5 px-4 font-bold rounded-full transition-all active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Processing Order...</span>
                                </>
                            ) : (
                                <>
                                    <CreditCard size={18} />
                                    <span>Pay Downpayment Now</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="w-full py-3 text-slate-500 hover:text-slate-700 font-semibold text-sm transition-colors text-center"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

function CartClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { goBack } = useSmartBack('cart');
    const recordNavigation = useRecordNavigation();

    // Record that the user is on the cart page so the context tracks it.
    useEffect(() => {
        recordNavigation('cart', null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Detect an unfinished Xendit payment — either via the explicit
    // `?payment_failed=true&order_id=...` failure URL or via a plain
    // browser-back (no query params). The hook + handlers live further
    // down so they can reference the user + isCreatingPayment state
    // declared below.
    const paymentFailed = searchParams.get('payment_failed') === 'true';
    const pendingOrderId = searchParams.get('order_id');

    const urlDiscount = searchParams.get('discount');
    const { user, signInAnonymously } = useAuth();
    const isRegisteredUser = !!(user && !user.is_anonymous);
    const isAuthenticated = !!user;
    const isAnonymous = !!user?.is_anonymous;

    const [guestEmail, setGuestEmail] = useState(() => readFromLocalStorage('cart_guest_email') || '');
    const [isGuestLoading, setIsGuestLoading] = useState(false);
    const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');

    const handleGuestCheckout = async () => {
        setIsGuestLoading(true);
        try {
            const { error } = await signInAnonymously();
            if (error) throw error;
            // User state will update automatically via useAuth
        } catch (error: unknown) {
            showError(getErrorMessage(error, 'Failed to start guest checkout'));
        } finally {
            setIsGuestLoading(false);
        }
    };

    const {
        cartItems,
        eventDate,
        eventTime,
        deliveryInstructions,
        selectedAddressId,
        cartTotal: subtotal,
    } = useCart();
    const {
        setEventDate,
        setEventTime,
        setDeliveryInstructions,
        setSelectedAddressId,
        clearCart,
        removeItemOptimistic,
    } = useCartActions();

    const { data: savedAddresses = [], isLoading: isAddressesLoading } = useAddresses(user?.id);
    const { settings: availabilitySettings, loading: isLoadingSettings } = useAvailabilitySettings();

    // Pending items would come from context in Next.js - for now empty
    const pendingItems: CartItem[] = [];
    const isCartLoading = false;

    const allItems = useMemo<CartItem[]>(() => {
        const mappedSupabaseItems: CartItem[] = cartItems.map(item => {
            // If the image is still a base64 data URI or has the isPending flag, the background AI edit + upload is
            // still in flight. Show a 'pending' spinner overlay until it resolves.
            const isImagePending = item.isPending || (item.customized_image_url?.startsWith('data:') ?? false);
            return {
                id: item.cart_item_id,
                image: item.customized_image_url,
                status: isImagePending ? 'pending' : 'complete',
                type: item.cake_type,
                thickness: item.cake_thickness,
                size: item.cake_size,
                totalPrice: item.final_price * item.quantity,
                details: item.customization_details as CartItemDetails,
                merchant_id: item.merchant_id,
                merchant_name: item.merchant?.business_name,
            };
        });
        return [...pendingItems, ...mappedSupabaseItems];
    }, [pendingItems, cartItems]);


    // Group items by merchant
    const groupedItems = useMemo(() => {
        const groups: Record<string, CartItem[]> = {};
        allItems.forEach(item => {
            const merchantName = item.merchant_name || 'Cake Genie';
            if (!groups[merchantName]) {
                groups[merchantName] = [];
            }
            groups[merchantName].push(item);
        });
        return groups;
    }, [allItems]);

    const [isAddingAddress, setIsAddingAddress] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [isCreatingPayment, setIsCreatingPayment] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [partiallyBlockedSlots, setPartiallyBlockedSlots] = useState<BlockedDateInfo[]>([]);
    const [unavailableDateFeedback, setUnavailableDateFeedback] = useState<{ date: string; reason: string; } | null>(null);
    const [unavailableTimeFeedback, setUnavailableTimeFeedback] = useState<{ slot: string; reason: string; } | null>(null);

    // --- Pending order recovery (Xendit browser-back) ---
    // The hook reads the sessionStorage snapshot written by
    // handleSubmitOrder right before redirecting to Xendit and exposes
    // a banner that lets the user resume or discard the order.
    const {
        recoveryBanner,
        dismiss: dismissRecovery,
        clearSnapshot: clearPendingSnapshot,
        acceptAutoRestore,
        isHydrated: isRecoveryHydrated,
    } = usePendingOrderRecovery({
        paymentFailed,
        paymentFailedOrderId: pendingOrderId,
    });

    const cancelOrderMutation = useCancelOrder();

    // Inline restore toast for the unambiguous ?payment_failed=true path.
    // We don't refetch the cart — the data-layer task preserves cart
    // rows, and the snapshot is the source of truth when the user
    // lands here before the React state has caught up.
    const [restoredOrderNumber, setRestoredOrderNumber] = useState<string | null>(null);

    useEffect(() => {
        if (!isRecoveryHydrated) return;
        if (!recoveryBanner || !recoveryBanner.autoRestore) return;

        if (recoveryBanner.cartItems.length > 0) {
            const cacheData = {
                value: JSON.stringify(recoveryBanner.cartItems),
                timestamp: Date.now(),
            };
            try {
                localStorage.setItem('cart_items_cache', JSON.stringify(cacheData));
            } catch (e) {
                console.error('Failed to restore cart to localStorage cache:', e);
            }
        }

        setRestoredOrderNumber(recoveryBanner.orderId);
        clearPendingSnapshot();
        // We intentionally keep the banner mounted for the inline toast
        // — clear the recoveryBanner state only AFTER the snapshot is
        // wiped, so the user still sees the "items restored" message.
        dismissRecovery();
        // Suppress unused-locals: acceptAutoRestore is the public API for
        // opting into the auto-restore path; we use the side-effect path
        // here so the user sees the inline toast.
        void acceptAutoRestore;
    }, [isRecoveryHydrated, recoveryBanner, clearPendingSnapshot, dismissRecovery, acceptAutoRestore]);

    const handleResumePayment = useCallback(async () => {
        if (!recoveryBanner || isCreatingPayment || isRedirecting) return;
        setIsCreatingPayment(true);
        setIsRedirecting(true);
        try {
            const snap = recoveryBanner;
            // We don't have a getSingleOrder helper in scope here, so we
            // fall back to the snapshot's running total. The Xendit edge
            // function will reject stale amounts if any drift has
            // happened, surfacing a clean error to the user.
            const amount = snap.totalAmount;
            const emailToUse =
                (typeof window !== 'undefined'
                    ? window.sessionStorage.getItem('pending_payment_guest_email')
                    : null) || user?.email || 'customer@example.com';
            const nameToUse =
                user?.user_metadata?.first_name ||
                user?.user_metadata?.full_name ||
                'Customer';

            const { paymentUrl, error: paymentError } = await createXenditPayment({
                orderId: snap.orderId,
                amount,
                customerEmail: emailToUse,
                customerName: nameToUse,
            });

            if (paymentError) throw new Error(paymentError);
            if (paymentUrl) {
                // Refresh the snapshot timestamp before redirecting so
                // a future browser-back still finds it (e.g. Xendit
                // times out before the failure redirect).
                if (typeof window !== 'undefined') {
                    window.sessionStorage.setItem(
                        'pending_payment_order_id',
                        snap.orderId,
                    );
                    window.sessionStorage.setItem(
                        'pending_payment_cart',
                        JSON.stringify(snap.cartItems),
                    );
                }
                window.location.href = paymentUrl;
            } else {
                throw new Error('Payment URL not generated.');
            }
        } catch (error: unknown) {
            console.error('Resume payment error:', error);
            showError(getErrorMessage(error, 'Failed to resume payment.'));
            setIsCreatingPayment(false);
            setIsRedirecting(false);
        }
    }, [recoveryBanner, isCreatingPayment, isRedirecting, user]);

    const handleDiscardPendingOrder = useCallback(async () => {
        if (!recoveryBanner) return;
        const orderId = recoveryBanner.orderId;
        const userId = user?.id;

        try {
            if (userId) {
                await cancelOrderMutation.mutateAsync({ orderId, userId });
            }
        } catch (error) {
            // Cancellation may legitimately fail (already paid, already
            // cancelled, etc.). We still want to clear the local
            // snapshot so the banner stops showing — the server is the
            // source of truth, not the local cache.
            console.warn('cancelOrder failed for recovered pending order:', error);
        } finally {
            clearPendingSnapshot();
            dismissRecovery();
        }
    }, [recoveryBanner, user, cancelOrderMutation, clearPendingSnapshot, dismissRecovery]);

    // Month picker state
    const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>(null);
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const monthPickerRef = useRef<HTMLDivElement>(null);

    // Close month picker on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
                setIsMonthPickerOpen(false);
            }
        };
        if (isMonthPickerOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMonthPickerOpen]);

    // Generate list of available months (current + next 5 months)
    const availableMonths = useMemo(() => {
        const months: { year: number; month: number; label: string }[] = [];
        const now = new Date();
        for (let i = 0; i < 6; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            months.push({
                year: d.getFullYear(),
                month: d.getMonth(),
                label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            });
        }
        return months;
    }, []);

    // Guest Address State
    const [guestAddress, setGuestAddress] = useState<CakeGenieAddress | null>(() => {
        const saved = readFromLocalStorage('cart_guest_address');
        try {
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error('Failed to parse saved guest address', e);
            return null;
        }
    });

    // Pickup Recipient State
    const [selectedPickupIndex, setSelectedPickupIndex] = useState(0);
    const [pickupRecipientName, setPickupRecipientName] = useState(() => readFromLocalStorage('cart_pickup_name') || '');
    const [pickupRecipientPhone, setPickupRecipientPhone] = useState(() => readFromLocalStorage('cart_pickup_phone') || '');

    // Split with Friends State
    const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isDownpaymentModalOpen, setIsDownpaymentModalOpen] = useState(false);
    const [registrationDocument, setRegistrationDocument] = useState<RegistrationDocument | null>(null);
    const [splitOrderDetails, setSplitOrderDetails] = useState<{
        shareLink: string;
        orderNumber: string;
        splitCount: number;
        totalAmount: number;
    } | null>(null);

    // Hydration fix: track if component has mounted on client
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    // Auto-open address form for guest users
    useEffect(() => {
        if (user?.is_anonymous && !isAddingAddress && savedAddresses.length === 0 && !guestAddress) {
            setIsAddingAddress(true);
        }
    }, [user, isAddingAddress, savedAddresses, guestAddress]);

    // Persist guest email to localStorage
    useEffect(() => {
        if (guestEmail) {
            console.log('[Cart] guestEmail updated:', guestEmail);
            batchSaveToLocalStorage('cart_guest_email', guestEmail);
        } else {
            batchRemoveFromLocalStorage('cart_guest_email');
        }
    }, [guestEmail]);

    // Persist pickup recipient info to localStorage
    useEffect(() => {
        if (pickupRecipientName) {
            batchSaveToLocalStorage('cart_pickup_name', pickupRecipientName);
        } else {
            batchRemoveFromLocalStorage('cart_pickup_name');
        }
    }, [pickupRecipientName]);

    useEffect(() => {
        if (pickupRecipientPhone) {
            batchSaveToLocalStorage('cart_pickup_phone', pickupRecipientPhone);
        } else {
            batchRemoveFromLocalStorage('cart_pickup_phone');
        }
    }, [pickupRecipientPhone]);

    // Persist guest address to localStorage

    // State for discount
    const [discountCode, setDiscountCode] = useState<string>(() => readFromLocalStorage('cart_discount_code') || '');
    const [appliedDiscount, setAppliedDiscount] = useState<DiscountValidationResult | null>(() => {
        const savedDiscount = readFromLocalStorage('cart_applied_discount');
        try {
            return savedDiscount ? JSON.parse(savedDiscount) : null;
        } catch (e) {
            console.error("Failed to parse saved discount", e);
            return null;
        }
    });
    const [isValidatingCode, setIsValidatingCode] = useState(false);
    const hasProcessedUrlDiscount = useRef(false);

    const { data: userDiscountCodes = [] } = useQuery({
        queryKey: ['user-discounts', user?.id],
        queryFn: () => getUserDiscountCodes(),
        enabled: isRegisteredUser,
    });

    const handleRemoveDiscount = useCallback(() => {
        setAppliedDiscount(null);
        setDiscountCode('');
        batchRemoveFromLocalStorage('cart_discount_code');
        batchRemoveFromLocalStorage('cart_applied_discount');
        showSuccess('Discount removed');
    }, []);

    const handleApplyDiscount = useCallback(async (codeToApply?: string, options?: { silent?: boolean }) => {
        const code = (codeToApply || discountCode).trim().toUpperCase();
        if (!code) {
            if (appliedDiscount) handleRemoveDiscount(); // Clear if user erases the code
            return;
        }

        setIsValidatingCode(true);
        console.log('🎫 [CartClient] Applying discount:', { code, subtotal });
        const result = await validateDiscountCode(code, subtotal);
        console.log('🎫 [CartClient] Discount result:', result);
        setIsValidatingCode(false);

        if (result.valid) {
            setAppliedDiscount(result);
            setDiscountCode(code); // Set code state only on success
            batchSaveToLocalStorage('cart_discount_code', code);
            batchSaveToLocalStorage('cart_applied_discount', JSON.stringify(result));
            if (!options?.silent) { showSuccess(result.message || 'Discount applied!'); }
        } else {
            // For silent re-validations, only keep cached discount for transient errors.
            // Business logic failures (minimum order, expired, usage limit, etc.) should
            // clear the discount since it's not valid for the current cart state.
            const transientErrors = [
                'An unexpected error occurred',
                'Could not verify user session',
                'Failed to add item to cart',
            ];
            const isTransientError = transientErrors.some(e => 
                result.message?.includes(e)
            );
            
            if (options?.silent && isTransientError) {
                console.warn('[CartClient] Silent discount revalidation failed (transient); keeping cached state.', {
                    code,
                    reason: result.message,
                });
                return;
            }
            
            // Clear discount for business logic failures or non-silent attempts
            setAppliedDiscount(null);
            batchRemoveFromLocalStorage('cart_applied_discount');
            if (!options?.silent) {
                showError(result.message || 'Invalid discount code');
            }
        }
    }, [discountCode, subtotal, appliedDiscount, handleRemoveDiscount]);

    const {
        isLoaded: isMapsLoaded,
        loadError: mapsLoadError
    } = useGoogleMapsLoader();

    // Process discount from URL query parameter
    useEffect(() => {
        if (!urlDiscount || hasProcessedUrlDiscount.current || subtotal <= 0) return;

        hasProcessedUrlDiscount.current = true;
        handleApplyDiscount(urlDiscount);
    }, [urlDiscount, handleApplyDiscount, subtotal]);

    // New state for address form refactor
    const [pendingAddressData, setPendingAddressData] = useState<Partial<CakeGenieAddress> | null>(null);
    const [isPendingAddressValid, setIsPendingAddressValid] = useState(false);

    useEffect(() => {
        if (mapsLoadError) {
            showError('Could not load map services. Please refresh the page.');
            console.error('Google Maps Load Error:', mapsLoadError);
        }
    }, [mapsLoadError]);

    // Get dynamic delivery fee based on city
    const selectedAddress = useMemo(() => {
        return isRegisteredUser && selectedAddressId ? savedAddresses.find(a => a.address_id === selectedAddressId) : null;
    }, [isRegisteredUser, selectedAddressId, savedAddresses]);

    // State to hold derived city from reverse geocoding (for legacy addresses without city)
    const [derivedCity, setDerivedCity] = useState<string | null>(null);
    const lastGeocodedAddressId = useRef<string | null>(null);

    // Reverse geocode to get city if address has lat/lng but no city
    useEffect(() => {
        const addressToCheck = selectedAddress || guestAddress;

        // Skip if no address or already has city
        if (!addressToCheck || addressToCheck.city) {
            setDerivedCity(null);
            lastGeocodedAddressId.current = null;
            return;
        }

        // Skip if no lat/lng
        if (!addressToCheck.latitude || !addressToCheck.longitude) {
            setDerivedCity(null);
            return;
        }

        // Skip if we already geocoded this address
        const addressKey = addressToCheck.address_id || `${addressToCheck.latitude}-${addressToCheck.longitude}`;
        if (lastGeocodedAddressId.current === addressKey) {
            return;
        }

        // Check if Google Maps is loaded
        if (!isMapsLoaded || !window.google) {
            return;
        }

        lastGeocodedAddressId.current = addressKey;

        // Convert lat/lng to numbers (they may be stored as strings in the database)
        const lat = Number(addressToCheck.latitude);
        const lng = Number(addressToCheck.longitude);

        if (isNaN(lat) || isNaN(lng)) {
            return;
        }

        try {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode(
                { location: { lat, lng } },
                (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
                    try {
                        if (status === 'OK' && results && results[0]) {
                            // Look for city in address components
                            const cityComponent = results[0].address_components.find(c =>
                                c.types.includes('locality') || c.types.includes('administrative_area_level_2')
                            );
                            if (cityComponent) {
                                setDerivedCity(cityComponent.long_name);
                            }
                        }
                    } catch (callbackErr) {
                        console.error('Error processing geocode result in cart:', callbackErr);
                    }
                }
            );
        } catch (err) {
            console.error('Geocoder initialization error in cart:', err);
        }
    }, [selectedAddress, guestAddress, isMapsLoaded]);

    // Calculate dynamic delivery fee based on city
    const deliveryFee = useMemo(() => {
        // Free delivery if discount code has free delivery enabled
        if (appliedDiscount?.freeDelivery) return 0;

        // No delivery fee for pickup orders
        if (fulfillmentType === 'pickup') return 0;

        // 1. Check pending address data (live updates while typing/selecting)
        if (isAddingAddress && pendingAddressData?.city) {
            return getDeliveryFeeByCity(pendingAddressData.city);
        }

        // 2. Check guest address (saved guest info)
        if (guestAddress?.city) {
            return getDeliveryFeeByCity(guestAddress.city);
        }

        // 3. Check selected saved address (registered user)
        if (selectedAddress?.city) {
            return getDeliveryFeeByCity(selectedAddress.city);
        }

        // 4. Fallback to derived city from reverse geocoding (legacy addresses)
        if (derivedCity) {
            return getDeliveryFeeByCity(derivedCity);
        }

        return 0;
    }, [fulfillmentType, selectedAddress, guestAddress, derivedCity, pendingAddressData, isAddingAddress, appliedDiscount]);

    const discountAmount = appliedDiscount?.discountAmount || 0;
    const total = subtotal + deliveryFee - discountAmount;

    const baseCartAvailability = useMemo(() => {
        if (isCartLoading || allItems.length === 0) return 'normal';
        return calculateCartAvailability(allItems);
    }, [allItems, isCartLoading]);

    const cartAvailability = useMemo(() => {
        if (!availabilitySettings) return baseCartAvailability;

        if (availabilitySettings.rush_same_to_standard_enabled) {
            if (baseCartAvailability === 'rush' || baseCartAvailability === 'same-day') {
                return 'normal';
            }
        }

        if (availabilitySettings.rush_to_same_day_enabled) {
            if (baseCartAvailability === 'rush') {
                return 'same-day';
            }
        }

        return baseCartAvailability;
    }, [baseCartAvailability, availabilitySettings]);

    const availabilityWasOverridden = cartAvailability !== baseCartAvailability;
    const leadTimeOptions = useMemo(() => ({
        availability: cartAvailability,
        minimumLeadTimeDays: availabilitySettings?.minimum_lead_time_days || 1,
    }), [cartAvailability, availabilitySettings?.minimum_lead_time_days]);

    // Calculate how many days to fetch based on selected month
    const fetchRange = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!selectedMonth) {
            // Default: 30 days from today
            return { startDate: today, numDays: 30 };
        }

        // Selected month: fetch from today (or start of that month if in the future) to end of that month
        const monthStart = new Date(selectedMonth.year, selectedMonth.month, 1);
        const monthEnd = new Date(selectedMonth.year, selectedMonth.month + 1, 0); // last day of month
        const effectiveStart = monthStart > today ? today : today;
        const diffMs = monthEnd.getTime() - effectiveStart.getTime();
        const numDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;

        return { startDate: effectiveStart, numDays: Math.max(numDays, 30) };
    }, [selectedMonth]);

    const { data: availableDates = [], isLoading: isLoadingDates } = useQuery<AvailableDate[]>({
        queryKey: ['available-dates', availabilitySettings?.minimum_lead_time_days, fetchRange.numDays],
        queryFn: () => {
            const startDate = fetchRange.startDate;
            const year = startDate.getFullYear();
            const month = String(startDate.getMonth() + 1).padStart(2, '0');
            const day = String(startDate.getDate()).padStart(2, '0');
            return getAvailableDeliveryDates(`${year}-${month}-${day}`, fetchRange.numDays);
        },
        enabled: !isLoadingSettings, // Only run when settings are loaded
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const { data: blockedDatesMap, isLoading: isLoadingBlockedDates } = useQuery({
        queryKey: ['blocked-dates-range', fetchRange.numDays],
        queryFn: () => {
            const startDate = fetchRange.startDate;
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + fetchRange.numDays);

            const format = (d: Date) => d.toISOString().split('T')[0];

            return getBlockedDatesInRange(format(startDate), format(endDate));
        },
        staleTime: 5 * 60 * 1000,
    });

    // Effect to re-validate discount when cart total changes
    const isInitialMount = useRef(true);
    useEffect(() => {
        console.log('🎫 [CartClient] Subtotal changed:', { subtotal, discountCode, hasAppliedDiscount: !!appliedDiscount });
        if (isInitialMount.current) {
            isInitialMount.current = false;
            // On initial load, if a discount code is loaded from localStorage,
            // revalidate it against the current cart total.
            if (discountCode) {
                handleApplyDiscount(discountCode, { silent: true });
            }
            return;
        }

        // On subsequent subtotal changes, re-validate if a code is applied OR if a
        // pending code exists (e.g. from localStorage that failed min_order_amount on empty cart).
        if (appliedDiscount || discountCode) {
            handleApplyDiscount(discountCode, { silent: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subtotal]);

    const correctedDates = useMemo(() => {
        if (isLoadingDates || !availabilitySettings) return availableDates;

        let dates = availableDates;

        if (cartAvailability !== 'normal') {
            const leadTimeDays = availabilitySettings.minimum_lead_time_days || 0;
            if (leadTimeDays > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                dates = availableDates.map(dateInfo => {
                    const date = new Date(dateInfo.available_date + 'T00:00:00');
                    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                    if (diffDays >= 0 && diffDays < leadTimeDays) {
                        return { ...dateInfo, is_rush_available: true, is_same_day_available: true };
                    }
                    return dateInfo;
                });
            }
        }

        return dates;
    }, [availableDates, isLoadingDates, cartAvailability, availabilitySettings]);

    // Filter dates to display based on selected month
    const displayedDates = useMemo(() => {
        if (!selectedMonth) {
            return correctedDates.slice(0, 14);
        }

        return correctedDates.filter(dateInfo => {
            const d = new Date(dateInfo.available_date + 'T00:00:00');
            return d.getMonth() === selectedMonth.month && d.getFullYear() === selectedMonth.year;
        });
    }, [correctedDates, selectedMonth]);

    // Get the label for the current month picker button
    const monthPickerLabel = useMemo(() => {
        if (!selectedMonth) return null;
        const d = new Date(selectedMonth.year, selectedMonth.month, 1);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }, [selectedMonth]);

    const handleDateSelect = useCallback((date: string) => {
        setEventDate(date);
        setUnavailableDateFeedback(null);
        setUnavailableTimeFeedback(null);
        const blocks = blockedDatesMap?.[date] || [];
        const partials = blocks.filter(b => !b.is_all_day);
        setPartiallyBlockedSlots(partials);
    }, [setEventDate, blockedDatesMap]);

    const showUnavailableDateFeedback = useCallback((date: string, reason: string, options?: { announce?: boolean }) => {
        setUnavailableDateFeedback({ date, reason });

        if (options?.announce) {
            showInfo(reason, {
                id: `cart-date-unavailable-${date}`,
                duration: 3500,
            });
        }
    }, []);

    const clearUnavailableDateFeedback = useCallback(() => {
        setUnavailableDateFeedback(null);
    }, []);

    const showUnavailableTimeFeedback = useCallback((slot: string, reason: string, options?: { announce?: boolean }) => {
        setUnavailableTimeFeedback({ slot, reason });

        if (options?.announce) {
            showInfo(reason, {
                id: `cart-time-unavailable-${slot}`,
                duration: 3500,
            });
        }
    }, []);

    const clearUnavailableTimeFeedback = useCallback(() => {
        setUnavailableTimeFeedback(null);
    }, []);

    const getDateStatus = useCallback((dateInfo: AvailableDate) => {
        const date = dateInfo.available_date;
        const blocksOnDate = blockedDatesMap?.[date];
        const isFullyBlocked = blocksOnDate?.some(block => block.is_all_day) ?? false;

        if (isFullyBlocked) {
            return {
                isDisabled: true,
                reason: blocksOnDate?.find(b => b.is_all_day)?.closure_reason || 'Fully Booked / Holiday'
            };
        }

        // Enforce minimum lead time for standard orders based on settings
        if (cartAvailability === 'normal' && availabilitySettings && availabilitySettings.minimum_lead_time_days > 0) {
            const leadTimeDays = availabilitySettings.minimum_lead_time_days;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selectedDate = new Date(dateInfo.available_date + 'T00:00:00');
            const diffDays = Math.ceil((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays < leadTimeDays) {
                const plural = leadTimeDays > 1 ? 's' : '';
                return {
                    isDisabled: true,
                    reason: `Requires a ${leadTimeDays} day${plural} lead time.`
                };
            }
        }

        if (!isDateAvailableForLeadTime(date, EVENT_TIME_SLOTS_MAP, leadTimeOptions)) {
            if (cartAvailability === 'normal') {
                const leadTimeDays = leadTimeOptions.minimumLeadTimeDays;
                const plural = leadTimeDays > 1 ? 's' : '';
                return {
                    isDisabled: true,
                    reason: `Requires a ${leadTimeDays} day${plural} lead time.`
                };
            }

            return {
                isDisabled: true,
                reason: "Date unavailable for this order's lead time."
            };
        }

        // Check availability flags from the RPC, but *only* for rush and same-day.
        // The client-side logic above is the source of truth for 'normal' orders.
        let leadTimeDisabledByRpc = false;
        if (cartAvailability === 'rush') {
            leadTimeDisabledByRpc = !dateInfo.is_rush_available;
        } else if (cartAvailability === 'same-day') {
            leadTimeDisabledByRpc = !dateInfo.is_same_day_available;
        }

        if (leadTimeDisabledByRpc) {
            const reason = "Date unavailable for this order's lead time.";
            return { isDisabled: true, reason };
        }

        return { isDisabled: false, reason: null };
    }, [blockedDatesMap, cartAvailability, availabilitySettings, leadTimeOptions]);

    const disabledSlots = useMemo(() => {
        const newDisabledSlots = eventDate
            ? getDisabledTimeSlotsForLeadTime(eventDate, EVENT_TIME_SLOTS_MAP, leadTimeOptions)
            : [];

        if (partiallyBlockedSlots.length > 0) {
            const parseTime = (timeStr: string): number => parseInt(timeStr.split(':')[0], 10);

            partiallyBlockedSlots.forEach(blockedSlot => {
                if (blockedSlot.blocked_time_start && blockedSlot.blocked_time_end) {
                    const blockStartHour = parseTime(blockedSlot.blocked_time_start);
                    const blockEndHour = parseTime(blockedSlot.blocked_time_end);

                    EVENT_TIME_SLOTS_MAP.forEach(timeSlot => {
                        // Check for overlap: (slot.start < block.end) and (slot.end > block.start)
                        if (timeSlot.startHour < blockEndHour && timeSlot.endHour > blockStartHour) {
                            newDisabledSlots.push(timeSlot.slot);
                        }
                    });
                }
            });
        }

        return [...new Set(newDisabledSlots)];
    }, [eventDate, leadTimeOptions, partiallyBlockedSlots]);

    const getTimeSlotUnavailableReason = useCallback((slot: string): string | null => {
        if (!eventDate) {
            return null;
        }

        const timeSlot = EVENT_TIME_SLOTS_MAP.find((candidate) => candidate.slot === slot);
        if (!timeSlot) {
            return null;
        }

        const matchingBlockedSlot = partiallyBlockedSlots.find((blockedSlot) => {
            if (!blockedSlot.blocked_time_start || !blockedSlot.blocked_time_end) {
                return false;
            }

            const blockStartHour = parseInt(blockedSlot.blocked_time_start.split(':')[0], 10);
            const blockEndHour = parseInt(blockedSlot.blocked_time_end.split(':')[0], 10);

            return timeSlot.startHour < blockEndHour && timeSlot.endHour > blockStartHour;
        });

        if (matchingBlockedSlot) {
            return matchingBlockedSlot.closure_reason || 'This time slot is no longer available. Please choose another time.';
        }

        return getDisabledTimeSlotReason(eventDate, timeSlot, leadTimeOptions);
    }, [eventDate, leadTimeOptions, partiallyBlockedSlots]);

    useEffect(() => {
        if (!eventDate || isLoadingDates || isLoadingBlockedDates) {
            return;
        }

        const selectedDateInfo = correctedDates.find((dateInfo) => dateInfo.available_date === eventDate);
        if (!selectedDateInfo) {
            return;
        }

        if (getDateStatus(selectedDateInfo).isDisabled) {
            setEventDate('');
            setEventTime('');
            setPartiallyBlockedSlots([]);
            setUnavailableTimeFeedback(null);
        }
    }, [
        correctedDates,
        eventDate,
        getDateStatus,
        isLoadingBlockedDates,
        isLoadingDates,
        setEventDate,
        setEventTime,
    ]);

    useEffect(() => {
        if (eventTime && disabledSlots.includes(eventTime)) {
            setEventTime('');
        }
    }, [eventTime, disabledSlots, setEventTime]);

    useEffect(() => {
        if (unavailableTimeFeedback && !disabledSlots.includes(unavailableTimeFeedback.slot)) {
            setUnavailableTimeFeedback(null);
        }
    }, [disabledSlots, unavailableTimeFeedback]);

    useEffect(() => {
        if (isRegisteredUser && !isAddressesLoading) {
            const persistedIdIsValid = savedAddresses.some(addr => addr.address_id === selectedAddressId);

            if (persistedIdIsValid) {
                // All good
            } else if (savedAddresses.length > 0) {
                const defaultAddress = savedAddresses.find(addr => addr.is_default);
                setSelectedAddressId(defaultAddress ? defaultAddress.address_id : savedAddresses[0].address_id);
            }
        }
    }, [isRegisteredUser, savedAddresses, isAddressesLoading, selectedAddressId, setSelectedAddressId]);

    const handleFormChange = useCallback((data: Partial<CakeGenieAddress>, isValid: boolean) => {
        setPendingAddressData(data);
        setIsPendingAddressValid(isValid);
    }, []);

    const addAddressMutation = useAddAddress();

    const handleNewAddressSuccess = (newAddress?: CakeGenieAddress) => {
        if (newAddress) {
            // Defensive check: If address ID starts with 'guest-', treat it as guest address
            if (newAddress.address_id.startsWith('guest-')) {
                setGuestAddress(newAddress);
            } else {
                setSelectedAddressId(newAddress.address_id);
            }
        }
        setIsAddingAddress(false);
        setPendingAddressData(null);
        setIsPendingAddressValid(false);
    };

    const handleGuestAddressSuccess = (newAddress?: CakeGenieAddress) => {
        if (newAddress) {
            setGuestAddress(newAddress);
            setIsAddingAddress(false);
            setPendingAddressData(null);
            setIsPendingAddressValid(false);
        }
    };

    const getMissingRequirements = (): { label: string; scrollId: string }[] => {
        const missing: { label: string; scrollId: string }[] = [];
        if (!eventDate) missing.push({ label: 'Date of Event', scrollId: 'cart-date-section' });
        if (!eventTime) missing.push({ label: 'Time of Event', scrollId: 'cart-time-section' });

        // Address is only required for delivery orders
        if (fulfillmentType === 'delivery') {
            if (isAnonymous && !guestEmail) missing.push({ label: 'Email Address', scrollId: 'guestEmail' });

            if (isAddingAddress || (isAnonymous && !guestAddress)) {
                if (!isPendingAddressValid) missing.push({ label: 'Delivery Address', scrollId: 'cart-address-section' });
            } else {
                if (!isAnonymous && !selectedAddress) missing.push({ label: 'Delivery Address', scrollId: 'cart-address-section' });
                if (isAnonymous && !guestAddress) missing.push({ label: 'Delivery Address', scrollId: 'cart-address-section' });
            }
        } else {
            // For pickup, still require email for anonymous users (for order receipt)
            if (isAnonymous && !guestEmail) missing.push({ label: 'Email Address', scrollId: 'guestEmailPickup' });
            if (!pickupRecipientName) missing.push({ label: 'Contact Name', scrollId: 'pickupRecipientName' });
            if (!pickupRecipientPhone) missing.push({ label: 'Contact Number', scrollId: 'pickupRecipientPhone' });
        }

        return missing;
    };

    const getCheckoutAnalyticsBase = (flowType: 'full_payment' | 'downpayment_50' | 'split_with_friends') => ({
        flowType,
        fulfillmentType,
        itemCount: cartItems.length,
        valueBucket: getAnalyticsValueBucket(total),
        isGuest: isAnonymous,
    });

    const handleSubmitOrder = async () => {
        const analyticsBase = getCheckoutAnalyticsBase('full_payment');
        trackCheckoutPlaceOrderClicked(analyticsBase);

        if (!isAuthenticated) {
            showError('Please sign in or continue as guest to place an order.');
            return;
        }

        const missing = getMissingRequirements();
        if (missing.length > 0) {
            trackCartRequirementMissing({
                ...analyticsBase,
                missingLabels: missing.map(m => m.label),
            });
            showError(`Please fill in: ${missing.map(m => m.label).join(', ')}`);
            return;
        }

        setIsPlacingOrder(true);
        try {
            // Handle Address Saving/Creation if needed
            let effectiveDeliveryAddressId = isAnonymous ? null : selectedAddress?.address_id || null;
            let effectiveGuestAddress = isAnonymous ? guestAddress : undefined;

            if (fulfillmentType === 'pickup') {
                // For pickup orders, use the selected bakeshop's address as the delivery location
                effectiveDeliveryAddressId = null;
                effectiveGuestAddress = {
                    ...PICKUP_LOCATIONS[selectedPickupIndex],
                    recipient_name: pickupRecipientName,
                    recipient_phone: pickupRecipientPhone,
                    address_id: 'pickup',
                    user_id: user?.id || '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                } as unknown as CakeGenieAddress;
            } else if (isAddingAddress || (isAnonymous && !guestAddress)) {
                if (!isPendingAddressValid || !pendingAddressData) {
                    throw new Error("Invalid address data.");
                }

                if (isAnonymous) {
                    // Create temporary guest address object
                    effectiveGuestAddress = {
                        ...pendingAddressData,
                        address_id: `guest-${Date.now()}`,
                        user_id: user?.id || '',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    } as unknown as CakeGenieAddress;
                    setGuestAddress(effectiveGuestAddress); // Update state for UI
                } else {
                    // Save new address for registered user
                    if (!user?.id) throw new Error("User ID missing.");
                    const newAddr = await addAddressMutation.mutateAsync({
                        userId: user.id,
                        addressData: pendingAddressData as AddressCreateInput
                    });
                    if (!newAddr) throw new Error("Failed to save address.");
                    effectiveDeliveryAddressId = newAddr.address_id;
                    setSelectedAddressId(newAddr.address_id); // Update state
                }
                setIsAddingAddress(false); // Close form
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('address_form_draft');
                }
            }


            // For anonymous users, create a user record first
            if (isAnonymous && user) {
                let emailToRegister = guestEmail.trim();

                // Fix for potential double email issue (e.g. test@example.comtest@example.com)
                if (emailToRegister.length > 10 && emailToRegister.includes('@')) {
                    const parts = emailToRegister.split('@');
                    if (parts.length > 2) {
                        const half = emailToRegister.substring(0, emailToRegister.length / 2);
                        if (half + half === emailToRegister) {
                            console.warn('Detected duplicated email, fixing:', emailToRegister);
                            emailToRegister = half;
                            setGuestEmail(half);
                        }
                    }
                }

                const { success: userCreated, error: userError, emailAlreadyExists } = await createGuestUser({
                    userId: user.id,
                    email: emailToRegister,
                    firstName: effectiveGuestAddress?.recipient_name || guestAddress?.recipient_name,
                    phoneNumber: effectiveGuestAddress?.recipient_phone || guestAddress?.recipient_phone,
                });

                if (!userCreated) {
                    if (emailAlreadyExists) {
                        // Email is already registered - prompt to sign in
                        showError('This email is already registered. Please sign in to continue.');
                        setIsPlacingOrder(false);
                        // Optionally trigger the sign-in modal
                        router.push('/login');
                        return;
                    }
                    throw new Error(userError?.message || 'Failed to create user account');
                }
            }

            // GA4: user has committed to checkout (address valid, about to create order)
            trackBeginCheckout(total, cartItems.length);
            const buyerAttribution = await prepareBuyerAttributionForCheckout(GA4_MEASUREMENT_ID);

            // 1. Create Order
            const { success, order, error } = await createOrderFromCart({
                cartItems,
                eventDate,
                eventTime,
                deliveryAddressId: effectiveDeliveryAddressId,
                deliveryInstructions,
                deliveryFee,
                discountAmount: appliedDiscount?.discountAmount,
                discountCodeId: appliedDiscount?.codeId,
                guestAddress: effectiveGuestAddress ? {
                    recipientName: effectiveGuestAddress.recipient_name,
                    recipientPhone: effectiveGuestAddress.recipient_phone,
                    streetAddress: effectiveGuestAddress.street_address,
                    city: effectiveGuestAddress.city,
                    latitude: effectiveGuestAddress.latitude,
                    longitude: effectiveGuestAddress.longitude
                } : undefined,
                buyerAttribution,
            });

            if (!success || !order) {
                trackCheckoutCreateOrderFailed(analyticsBase);
                throw error || new Error('Failed to create order.');
            }

            // 2. Create Payment
            setIsCreatingPayment(true);
            const emailToUse = isAnonymous ? guestEmail : user?.email || 'customer@example.com';
            const nameToUse = isAnonymous ? effectiveGuestAddress?.recipient_name : user?.user_metadata?.first_name || selectedAddress?.recipient_name || 'Customer';

            // GA4: payment handoff to Xendit
            trackAddPaymentInfo(order.total_amount, 'xendit');

            const { paymentUrl, error: paymentError } = await createXenditPayment({
                orderId: order.order_id,
                amount: order.total_amount,
                customerEmail: emailToUse,
                customerName: nameToUse || 'Customer'
            });

            if (paymentError) {
                trackCheckoutPaymentHandoffFailed(analyticsBase);
                throw new Error(paymentError);
            }

            if (paymentUrl) {
                // For anonymous users, upgrade to email account and send activation email
                if (isAnonymous && user && guestEmail) {
                    try {
                        const { success, error: upgradeError } = await upgradeAnonymousToEmailAccount({
                            email: guestEmail.trim(),
                            firstName: effectiveGuestAddress?.recipient_name,
                        });

                        if (!success) {
                            console.error('Failed to upgrade account:', upgradeError);
                            // Don't block the redirect - order is already created
                            // User can still access their order via email
                        } else {
                            console.log('Account upgraded successfully, activation email sent to:', guestEmail);
                        }
                    } catch (upgradeErr) {
                        console.error('Error during account upgrade:', upgradeErr);
                        // Don't block the redirect
                    }
                }

                // Save cart state to sessionStorage as backup before redirect
                // This allows cart recovery if payment fails
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('pending_payment_cart', JSON.stringify(cartItems));
                    sessionStorage.setItem('pending_payment_order_id', order.order_id);
                    sessionStorage.setItem('pending_payment_guest_email', guestEmail || '');
                }

                // Redirect to payment - don't clear cart yet
                // Cart will be cleared after payment confirmation on order-confirmation page
                trackCheckoutRedirectStarted(analyticsBase);
                setIsRedirecting(true);
                window.location.href = paymentUrl;
            } else {
                trackCheckoutPaymentHandoffFailed(analyticsBase);
                throw new Error('Payment URL not generated.');
            }

        } catch (error: unknown) {
            console.error('Checkout error:', error);
            showError(getErrorMessage(error, 'An error occurred during checkout.'));
        } finally {
            setIsPlacingOrder(false);
            setIsCreatingPayment(false);
        }
    };

    const getLeadTimeDays = (): number => {
        if (!eventDate) return 0;
        return getLeadTimeDaysFromManilaToday(eventDate);
    };

    const handleDownpaymentClick = () => {
        const analyticsBase = getCheckoutAnalyticsBase('downpayment_50');
        trackCheckoutPlaceOrderClicked(analyticsBase);

        if (!isAuthenticated) {
            showError('Please sign in or continue as guest to place an order.');
            return;
        }

        const missing = getMissingRequirements();
        if (missing.length > 0) {
            trackCartRequirementMissing({
                ...analyticsBase,
                missingLabels: missing.map(m => m.label),
            });
            showError(`Please fill in: ${missing.map(m => m.label).join(', ')}`);
            return;
        }

        const leadTimeDays = getLeadTimeDays();
        if (leadTimeDays < 3) {
            showError('A minimum of 3 days lead time is required for 50% downpayments.');
            return;
        }

        setIsDownpaymentModalOpen(true);
    };

    const handleConfirmDownpayment = async () => {
        setIsDownpaymentModalOpen(false);
        setIsPlacingOrder(true);
        const analyticsBase = getCheckoutAnalyticsBase('downpayment_50');
        try {
            // Handle Address Saving/Creation if needed
            let effectiveDeliveryAddressId = isAnonymous ? null : selectedAddress?.address_id || null;
            let effectiveGuestAddress = isAnonymous ? guestAddress : undefined;

            if (fulfillmentType === 'pickup') {
                // For pickup orders, use the selected bakeshop's address as the delivery location
                effectiveDeliveryAddressId = null;
                effectiveGuestAddress = {
                    ...PICKUP_LOCATIONS[selectedPickupIndex],
                    recipient_name: pickupRecipientName,
                    recipient_phone: pickupRecipientPhone,
                    address_id: 'pickup',
                    user_id: user?.id || '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                } as unknown as CakeGenieAddress;
            } else if (isAddingAddress || (isAnonymous && !guestAddress)) {
                if (!isPendingAddressValid || !pendingAddressData) {
                    throw new Error("Invalid address data.");
                }

                if (isAnonymous) {
                    // Create temporary guest address object
                    effectiveGuestAddress = {
                        ...pendingAddressData,
                        address_id: `guest-${Date.now()}`,
                        user_id: user?.id || '',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    } as unknown as CakeGenieAddress;
                    setGuestAddress(effectiveGuestAddress);
                } else {
                    // Save new address for registered user
                    if (!user?.id) throw new Error("User ID missing.");
                    const newAddr = await addAddressMutation.mutateAsync({
                        userId: user.id,
                        addressData: pendingAddressData as AddressCreateInput
                    });
                    if (!newAddr) throw new Error("Failed to save address.");
                    effectiveDeliveryAddressId = newAddr.address_id;
                    setSelectedAddressId(newAddr.address_id);
                }
                setIsAddingAddress(false);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('address_form_draft');
                }
            }

            // For anonymous users, create a user record first
            if (isAnonymous && user) {
                let emailToRegister = guestEmail.trim();

                // Fix for potential double email issue (e.g. test@example.comtest@example.com)
                if (emailToRegister.length > 10 && emailToRegister.includes('@')) {
                    const parts = emailToRegister.split('@');
                    if (parts.length > 2) {
                        const half = emailToRegister.substring(0, emailToRegister.length / 2);
                        if (half + half === emailToRegister) {
                            console.warn('Detected duplicated email, fixing:', emailToRegister);
                            emailToRegister = half;
                            setGuestEmail(half);
                        }
                    }
                }

                const { success: userCreated, error: userError, emailAlreadyExists } = await createGuestUser({
                    userId: user.id,
                    email: emailToRegister,
                    firstName: effectiveGuestAddress?.recipient_name || guestAddress?.recipient_name,
                    phoneNumber: effectiveGuestAddress?.recipient_phone || guestAddress?.recipient_phone,
                });

                if (!userCreated) {
                    if (emailAlreadyExists) {
                        showError('This email is already registered. Please sign in to continue.');
                        setIsPlacingOrder(false);
                        router.push('/login');
                        return;
                    }
                    throw new Error(userError?.message || 'Failed to create user account');
                }
            }

            // GA4: downpayment checkout commitment
            trackBeginCheckout(total, cartItems.length);
            const buyerAttribution = await prepareBuyerAttributionForCheckout(GA4_MEASUREMENT_ID);

            // Create split order
            const { success, order, error } = await createSplitOrderFromCart({
                cartItems,
                eventDate,
                eventTime,
                deliveryAddressId: effectiveDeliveryAddressId,
                deliveryInstructions,
                deliveryFee,
                discountAmount: appliedDiscount?.discountAmount,
                discountCodeId: appliedDiscount?.codeId,
                isSplitOrder: true,
                splitMessage: 'downpayment_50',
                splitCount: 2,
                guestAddress: effectiveGuestAddress ? {
                    recipientName: effectiveGuestAddress.recipient_name,
                    recipientPhone: effectiveGuestAddress.recipient_phone,
                    streetAddress: effectiveGuestAddress.street_address,
                    city: effectiveGuestAddress.city,
                    latitude: effectiveGuestAddress.latitude,
                    longitude: effectiveGuestAddress.longitude
                } : undefined,
                buyerAttribution,
            });

            if (!success || !order) {
                trackCheckoutCreateOrderFailed(analyticsBase);
                throw error || new Error('Failed to create order.');
            }

            // Create Payment/Contribution for downpayment (50%)
            setIsCreatingPayment(true);
            const emailToUse = isAnonymous ? guestEmail : user?.email || 'customer@example.com';
            const nameToUse = isAnonymous ? effectiveGuestAddress?.recipient_name : user?.user_metadata?.first_name || selectedAddress?.recipient_name || 'Customer';

            trackAddPaymentInfo(order.total_amount / 2, 'xendit-downpayment');

            const { paymentUrl, error: paymentError } = await createOrderContribution({
                orderId: order.order_id,
                amount: order.total_amount / 2,
                contributorName: nameToUse || 'Customer',
                contributorEmail: emailToUse,
                successRedirectUrl: `${window.location.origin}/order-confirmation?order_id=${order.order_id}`,
                failureRedirectUrl: `${window.location.origin}/cart?payment_failed=true&order_id=${order.order_id}`
            });

            if (paymentError) {
                trackCheckoutPaymentHandoffFailed(analyticsBase);
                throw new Error(paymentError);
            }

            if (paymentUrl) {
                // For anonymous users, upgrade to email account and send activation email
                if (isAnonymous && user && guestEmail) {
                    try {
                        const { success: upgraded, error: upgradeError } = await upgradeAnonymousToEmailAccount({
                            email: guestEmail.trim(),
                            firstName: effectiveGuestAddress?.recipient_name,
                        });

                        if (!upgraded) {
                            console.error('Failed to upgrade account:', upgradeError);
                        } else {
                            console.log('Account upgraded successfully, activation email sent to:', guestEmail);
                        }
                    } catch (upgradeErr) {
                        console.error('Error during account upgrade:', upgradeErr);
                    }
                }

                // Save cart state to sessionStorage as backup before redirect
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('pending_payment_cart', JSON.stringify(cartItems));
                    sessionStorage.setItem('pending_payment_order_id', order.order_id);
                    sessionStorage.setItem('pending_payment_guest_email', guestEmail || '');
                }

                trackCheckoutRedirectStarted(analyticsBase);
                setIsRedirecting(true);
                window.location.href = paymentUrl;
            } else {
                trackCheckoutPaymentHandoffFailed(analyticsBase);
                throw new Error('Payment URL not generated.');
            }
        } catch (error: unknown) {
            console.error('Downpayment checkout error:', error);
            showError(getErrorMessage(error, 'An error occurred during downpayment checkout.'));
        } finally {
            setIsPlacingOrder(false);
            setIsCreatingPayment(false);
        }
    };

    const canUseDownpayment = getLeadTimeDays() >= 3;

    const handleSplitWithFriends = async (splitCount: number, splitMessage: string) => {
        const analyticsBase = getCheckoutAnalyticsBase('split_with_friends');
        trackCheckoutPlaceOrderClicked(analyticsBase);

        if (!isAuthenticated) {
            showError('Please sign in or continue as guest to place an order.');
            return;
        }

        const missing = getMissingRequirements();
        if (missing.length > 0) {
            trackCartRequirementMissing({
                ...analyticsBase,
                missingLabels: missing.map(m => m.label),
            });
            showError(`Please fill in: ${missing.map(m => m.label).join(', ')}`);
            return;
        }

        setIsPlacingOrder(true);
        try {
            // Handle Address Saving/Creation if needed
            let effectiveDeliveryAddressId = isAnonymous ? null : selectedAddress?.address_id || null;
            let effectiveGuestAddress = isAnonymous ? guestAddress : undefined;

            if (fulfillmentType === 'pickup') {
                // For pickup orders, use the selected bakeshop's address as the delivery location
                effectiveDeliveryAddressId = null;
                effectiveGuestAddress = {
                    ...PICKUP_LOCATIONS[selectedPickupIndex],
                    recipient_name: pickupRecipientName,
                    recipient_phone: pickupRecipientPhone,
                    address_id: 'pickup',
                    user_id: user?.id || '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                } as unknown as CakeGenieAddress;
            } else if (isAddingAddress || (isAnonymous && !guestAddress)) {
                if (!isPendingAddressValid || !pendingAddressData) {
                    throw new Error("Invalid address data.");
                }

                if (isAnonymous) {
                    // Create temporary guest address object
                    effectiveGuestAddress = {
                        ...pendingAddressData,
                        address_id: `guest-${Date.now()}`,
                        user_id: user?.id || '',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    } as CakeGenieAddress;
                    setGuestAddress(effectiveGuestAddress);
                } else {
                    // Save new address for registered user
                    if (!user?.id) throw new Error("User ID missing.");
                    const newAddr = await addAddressMutation.mutateAsync({
                        userId: user.id,
                        addressData: pendingAddressData as AddressCreateInput
                    });
                    if (!newAddr) throw new Error("Failed to save address.");
                    effectiveDeliveryAddressId = newAddr.address_id;
                    setSelectedAddressId(newAddr.address_id);
                }
                setIsAddingAddress(false);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('address_form_draft');
                }
            }

            // For anonymous users, create a user record first
            if (isAnonymous && user) {
                let emailToRegister = guestEmail.trim();

                // Fix for potential double email issue (e.g. test@example.comtest@example.com)
                if (emailToRegister.length > 10 && emailToRegister.includes('@')) {
                    const parts = emailToRegister.split('@');
                    if (parts.length > 2) {
                        const half = emailToRegister.substring(0, emailToRegister.length / 2);
                        if (half + half === emailToRegister) {
                            console.warn('Detected duplicated email, fixing:', emailToRegister);
                            emailToRegister = half;
                            setGuestEmail(half);
                        }
                    }
                }

                const { success: userCreated, error: userError, emailAlreadyExists } = await createGuestUser({
                    userId: user.id,
                    email: emailToRegister,
                    firstName: effectiveGuestAddress?.recipient_name || guestAddress?.recipient_name,
                    phoneNumber: effectiveGuestAddress?.recipient_phone || guestAddress?.recipient_phone,
                });

                if (!userCreated) {
                    if (emailAlreadyExists) {
                        showError('This email is already registered. Please sign in to continue.');
                        setIsPlacingOrder(false);
                        router.push('/login');
                        return;
                    }
                    throw new Error(userError?.message || 'Failed to create user account');
                }
            }

            // GA4: split-order checkout commitment
            trackBeginCheckout(total, cartItems.length);
            const buyerAttribution = await prepareBuyerAttributionForCheckout(GA4_MEASUREMENT_ID);

            const { success, order, error } = await createSplitOrderFromCart({
                cartItems,
                eventDate,
                eventTime,
                deliveryAddressId: effectiveDeliveryAddressId,
                deliveryInstructions,
                deliveryFee,
                discountAmount: appliedDiscount?.discountAmount,
                discountCodeId: appliedDiscount?.codeId,
                isSplitOrder: true,
                splitMessage,
                splitCount,
                guestAddress: effectiveGuestAddress ? {
                    recipientName: effectiveGuestAddress.recipient_name,
                    recipientPhone: effectiveGuestAddress.recipient_phone,
                    streetAddress: effectiveGuestAddress.street_address,
                    city: effectiveGuestAddress.city,
                    latitude: effectiveGuestAddress.latitude,
                    longitude: effectiveGuestAddress.longitude
                } : undefined,
                buyerAttribution,
            });

            if (!success || !order) {
                trackCheckoutCreateOrderFailed(analyticsBase);
                throw error || new Error('Failed to create split order.');
            }

            // GA4: split orders don't go through Xendit directly but do commit a payment intent
            trackAddPaymentInfo(order.total_amount, 'split');

            // For anonymous users, upgrade to email account and send activation email
            if (isAnonymous && user && guestEmail) {
                try {
                    const { success, error: upgradeError } = await upgradeAnonymousToEmailAccount({
                        email: guestEmail.trim(),
                        firstName: effectiveGuestAddress?.recipient_name,
                    });

                    if (!success) {
                        console.error('Failed to upgrade account:', upgradeError);
                    } else {
                        console.log('Account upgraded successfully, activation email sent to:', guestEmail);
                    }
                } catch (upgradeErr) {
                    console.error('Error during account upgrade:', upgradeErr);
                }
            }

            // Generate share link
            const shareLink = `${window.location.origin}/contribute/${order.order_id}`;

            setSplitOrderDetails({
                shareLink,
                orderNumber: order.order_number,
                splitCount,
                totalAmount: order.total_amount
            });

            setIsSplitModalOpen(false);
            setIsShareModalOpen(true);
            clearCart();
            setAppliedDiscount(null);
            setDiscountCode('');
            // Clear guest data
            if (isAnonymous) {
                setGuestEmail('');
                setGuestAddress(null);
                batchRemoveFromLocalStorage('cart_guest_email');
                batchRemoveFromLocalStorage('cart_guest_address');
            }

        } catch (error: unknown) {
            console.error('Split order error:', error);
            showError(getErrorMessage(error, 'Failed to create split order.'));
        } finally {
            setIsPlacingOrder(false);
        }
    };

    const inputStyle = "w-full px-3 py-2 text-sm bg-white border border-purple-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:bg-slate-50 disabled:cursor-not-allowed";

    const onRemoveItem = useCallback(async (id: string) => {
        try {
            await removeItemOptimistic(id);
            showSuccess('Item removed from cart');
        } catch (error) {
            console.error('Failed to remove item:', error);
            showError('Failed to remove item');
        }
    }, [removeItemOptimistic]);

    const handleClose = () => {
        goBack();
    };

    const handleContinueShopping = () => {
        router.push('/');
    };

    return (
        <>
            {registrationDocument && (
                <div
                    className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    onClick={() => setRegistrationDocument(null)}
                    role="presentation"
                >
                    <div
                        className="relative max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-2 shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`${registrationDocument.label} document`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setRegistrationDocument(null)}
                            className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                            aria-label={`Close ${registrationDocument.label} document`}
                        >
                            <CloseIcon />
                        </button>
                        <img
                            src={registrationDocument.imageUrl}
                            alt={`${registrationDocument.label} registration document`}
                            className="block h-auto max-h-[86vh] w-full object-contain"
                        />
                    </div>
                </div>
            )}

            {zoomedImage && (
                <div
                    className="fixed inset-0 bg-black/90 backdrop-blur-sm z-9999 flex items-center justify-center animate-fade-in-fast"
                    onClick={() => setZoomedImage(null)}
                    aria-modal="true"
                    role="dialog"
                >
                    <button
                        onClick={() => setZoomedImage(null)}
                        className="absolute top-4 right-4 text-white p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors z-10"
                        aria-label="Close zoomed image"
                    >
                        <CloseIcon />
                    </button>
                    <img
                        src={zoomedImage}
                        alt="Zoomed cake design"
                        width={800}
                        height={800}
                        className="w-full h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            <div className="px-4 md:px-8 py-4 md:py-8 genie-page-bg min-h-screen">
                <div className="max-w-4xl mx-auto genie-card rounded-2xl animate-fade-in">
                    <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-fast { animation: fadeInFast 0.2s ease-out; } @keyframes fadeInFast { from { opacity: 0; } to { opacity: 1; } } `}</style>

                    <div className="flex justify-between items-center px-4 pt-4 pb-3 border-b border-purple-100">
                        <h1 className="text-2xl font-bold text-slate-900">Your <span className="text-purple-400">Cart</span></h1>
                        <button onClick={handleClose} className="p-2 genie-icon-button rounded-full transition-colors" aria-label="Close cart">
                            <CloseIcon />
                        </button>
                    </div>

                    {mounted && isRecoveryHydrated && recoveryBanner && !recoveryBanner.autoRestore && (
                        <PendingOrderRecoveryBanner
                            snapshot={recoveryBanner}
                            onResume={handleResumePayment}
                            onDiscard={handleDiscardPendingOrder}
                            isDiscarding={cancelOrderMutation.isPending}
                            isResuming={isCreatingPayment || isRedirecting}
                        />
                    )}

                    {mounted && isRecoveryHydrated && restoredOrderNumber && (
                        <div
                            role="status"
                            data-testid="cart-recovery-restore-toast"
                            className="mx-4 mt-4 flex items-start gap-3 p-3 rounded-lg border border-green-200 bg-green-50 text-green-800 text-sm animate-fade-in"
                        >
                            <svg
                                className="w-5 h-5 mt-0.5 shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                aria-hidden="true"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <div className="flex-1">
                                <p className="font-semibold">Your previous order did not complete — items restored.</p>
                                <p className="text-xs text-green-700 mt-0.5">
                                    Order #{restoredOrderNumber.slice(0, 8).toUpperCase()} is back in your cart.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRestoredOrderNumber(null)}
                                className="text-green-700 hover:text-green-900 text-xs font-semibold"
                                aria-label="Dismiss restore notice"
                            >
                                Dismiss
                            </button>
                        </div>
                    )}

                    {!mounted || isCartLoading ? (
                        <div className="p-4"><CartSkeleton count={2} /></div>
                    ) : isRedirecting ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4 animate-fade-in">
                            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
                            <h2 className="text-xl font-bold text-slate-800">Redirecting to Payment...</h2>
                            <p className="text-slate-500 mt-2">Please do not close this window.</p>
                        </div>
                    ) : allItems.length === 0 ? (
                        <div className="text-center py-16 px-4">
                            <p className="text-slate-500">Your cart is empty.</p>
                            <button onClick={handleContinueShopping} className="mt-4 genie-btn-secondary px-4 py-2 rounded-full text-sm font-semibold">
                                Continue Shopping
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4 px-4">
                            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                                {Object.entries(groupedItems).map(([merchantName, items]) => (
                                    <div key={merchantName} className="mb-6 last:mb-0">
                                        {merchantName !== 'Cake Genie' && (
                                            <div className="flex items-center gap-2 mb-3 pb-1 border-b border-purple-100">
                                                <div className="genie-icon-soft p-1.5 rounded-full">
                                                    <Users size={16} />
                                                </div>
                                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                                                    {merchantName}
                                                </h3>
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                            {items.map(item => (
                                                <CartItemCard
                                                    key={item.id}
                                                    item={item}
                                                    onRemove={onRemoveItem}
                                                    onZoom={setZoomedImage}
                                                    appliedDiscount={appliedDiscount}
                                                    subtotal={subtotal}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-purple-100 space-y-4">
                                <h2 className="text-lg font-semibold text-slate-700">Delivery Details</h2>

                                {!isLoadingSettings && (
                                    (availabilitySettings && availabilitySettings.minimum_lead_time_days > 0 && cartAvailability === 'normal') ? (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 animate-fade-in">
                                            <strong>Note:</strong> We are observing a minimum lead time of <strong>{availabilitySettings.minimum_lead_time_days} day(s)</strong>. The first available date has been adjusted.
                                        </div>
                                    ) : availabilityWasOverridden ? (
                                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800 animate-fade-in">
                                            <strong>Note:</strong> Due to high demand, availability has been adjusted. Your order will now be processed as a <strong>{cartAvailability.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong> order.
                                        </div>
                                    ) : null
                                )}

                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div id="cart-date-section">
                                            <div className="flex items-center gap-2 mb-1 relative z-10">
                                                <label htmlFor="eventDate" className="block text-sm font-medium text-slate-600">Date of Event</label>
                                                <div className="relative" ref={monthPickerRef}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsMonthPickerOpen(prev => !prev)}
                                                        className="genie-btn-ghost inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md transition-colors"
                                                        aria-label="Pick a month"
                                                        aria-expanded={isMonthPickerOpen}
                                                    >
                                                        <CalendarDays className="w-3 h-3" />
                                                        <span>{monthPickerLabel || 'Month'}</span>
                                                        <ChevronDown className={`w-3 h-3 transition-transform ${isMonthPickerOpen ? 'rotate-180' : ''}`} />
                                                    </button>
                                                    {isMonthPickerOpen && (
                                                        <div className="absolute top-full left-0 mt-1 genie-card rounded-lg z-50 min-w-[180px] py-1 animate-fade-in-fast">
                                                            <button
                                                                type="button"
                                                                onClick={() => { setSelectedMonth(null); setIsMonthPickerOpen(false); }}
                                                                className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${!selectedMonth ? 'bg-purple-50 text-purple-700' : 'text-slate-700 hover:bg-purple-50'
                                                                    }`}
                                                            >
                                                                Next 14 days
                                                            </button>
                                                            {availableMonths.map(m => {
                                                                const isActive = selectedMonth?.year === m.year && selectedMonth?.month === m.month;
                                                                return (
                                                                    <button
                                                                        key={`${m.year}-${m.month}`}
                                                                        type="button"
                                                                        onClick={() => { setSelectedMonth({ year: m.year, month: m.month }); setIsMonthPickerOpen(false); }}
                                                                        className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${isActive ? 'bg-purple-50 text-purple-700' : 'text-slate-700 hover:bg-purple-50'
                                                                            }`}
                                                                    >
                                                                        {m.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                {selectedMonth && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedMonth(null)}
                                                        className="genie-btn-ghost text-xs px-1 rounded transition-colors"
                                                        aria-label="Clear month filter"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                            {isLoadingDates || isLoadingBlockedDates ? (
                                                <div className="h-16 flex items-center"><Loader2 className="animate-spin genie-icon" /></div>
                                            ) : (
                                                <div className="relative overflow-visible">
                                                    <div className="flex gap-2 overflow-x-auto pt-16 -mt-16 pb-2 -mb-2 scrollbar-hide" style={{ overflowY: 'visible' }}>
                                                        {displayedDates.map((dateInfo, index) => {
                                                            const { isDisabled, reason } = getDateStatus(dateInfo);
                                                            const isSelected = eventDate === dateInfo.available_date;
                                                            const dateObj = new Date(dateInfo.available_date + 'T00:00:00');
                                                            const day = dateObj.toLocaleDateString('en-US', { day: 'numeric' });
                                                            const month = dateObj.toLocaleDateString('en-US', { month: 'short' });

                                                            // Determine tooltip position based on index
                                                            const totalDates = displayedDates.length;
                                                            let tooltipPositionClass = 'left-1/2 -translate-x-1/2'; // center (default)
                                                            let arrowPositionClass = 'left-1/2 -translate-x-1/2'; // center arrow

                                                            if (index === 0) {
                                                                // First date: align tooltip to left
                                                                tooltipPositionClass = 'left-0';
                                                                arrowPositionClass = 'left-8';
                                                            } else if (index === totalDates - 1) {
                                                                // Last date: align tooltip to right
                                                                tooltipPositionClass = 'right-0';
                                                                arrowPositionClass = 'right-8';
                                                            }

                                                            return (
                                                                <CartDateOption
                                                                    key={dateInfo.available_date}
                                                                    date={dateInfo.available_date}
                                                                    day={day}
                                                                    month={month}
                                                                    dayOfWeek={dateInfo.day_of_week}
                                                                    isSelected={isSelected}
                                                                    isDisabled={isDisabled}
                                                                    reason={reason}
                                                                    isTooltipVisible={unavailableDateFeedback?.date === dateInfo.available_date}
                                                                    tooltipPositionClass={tooltipPositionClass}
                                                                    arrowPositionClass={arrowPositionClass}
                                                                    onSelect={handleDateSelect}
                                                                    onUnavailableInteract={(date, unavailableReason) => showUnavailableDateFeedback(date, unavailableReason, { announce: true })}
                                                                    onUnavailableHoverStart={(date, unavailableReason) => showUnavailableDateFeedback(date, unavailableReason)}
                                                                    onUnavailableHoverEnd={clearUnavailableDateFeedback}
                                                                />
                                                            )
                                                        })}
                                                    </div>
                                                    {unavailableDateFeedback && (
                                                        <div
                                                            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 animate-fade-in"
                                                            role="status"
                                                            aria-live="polite"
                                                        >
                                                            <strong>Date unavailable:</strong> {unavailableDateFeedback.reason}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div id="cart-time-section">
                                            <label htmlFor="eventTime" className="block text-sm font-medium text-slate-600 mb-1">Time of Event</label>
                                            <div className="relative">
                                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                    {EVENT_TIME_SLOTS.map(slot => {
                                                        const isDisabled = disabledSlots.includes(slot);
                                                        const isSelected = eventTime === slot;
                                                        const unavailableReason = isDisabled ? getTimeSlotUnavailableReason(slot) : null;
                                                        return (
                                                            <div key={slot} className="relative shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEventTime(slot);
                                                                        clearUnavailableTimeFeedback();
                                                                    }}
                                                                    disabled={isDisabled}
                                                                    className={`w-full text-center rounded-lg p-2 border-2 transition-all duration-200
                                                            ${isSelected ? 'genie-control-selected text-purple-900' : 'border-purple-100 bg-white'}
                                                            ${isDisabled ? 'opacity-50 bg-slate-50 cursor-not-allowed' : 'hover:border-purple-300'}
    `}
                                                                >
                                                                    <span className="block text-xs font-semibold text-slate-800 px-2">{slot}</span>
                                                                </button>
                                                                {isDisabled && unavailableReason ? (
                                                                    <button
                                                                        type="button"
                                                                        className="absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2"
                                                                        aria-label={`${slot} unavailable. ${unavailableReason}`}
                                                                        onClick={() => showUnavailableTimeFeedback(slot, unavailableReason, { announce: true })}
                                                                        onFocus={() => showUnavailableTimeFeedback(slot, unavailableReason)}
                                                                        onBlur={clearUnavailableTimeFeedback}
                                                                        onMouseEnter={() => showUnavailableTimeFeedback(slot, unavailableReason)}
                                                                        onMouseLeave={clearUnavailableTimeFeedback}
                                                                    >
                                                                        <span className="sr-only">{unavailableReason}</span>
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            {unavailableTimeFeedback && (
                                                <div
                                                    className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 animate-fade-in"
                                                    role="status"
                                                    aria-live="polite"
                                                >
                                                    <strong>Time unavailable:</strong> {unavailableTimeFeedback.reason}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {cartAvailability === 'normal' && <p className="text-xs text-slate-500 -mt-2">Your cart items require a {availabilitySettings?.minimum_lead_time_days || 1}-day lead time. After the cutoff, lead time starts the next day at 10 AM.</p>}
                                    {cartAvailability === 'same-day' && <p className="text-xs text-slate-500 -mt-2">Your cart contains items available for same-day delivery (3-hour lead time). After the cutoff, lead time starts the next day at 10 AM.</p>}
                                    {cartAvailability === 'rush' && <p className="text-xs text-slate-500 -mt-2">All items in your cart are available for rush delivery (60-min lead time). After the cutoff, lead time starts the next day at 10 AM.</p>}

                                    {/* Fulfillment Type Toggle */}
                                    <div className="flex rounded-xl border border-purple-100 overflow-hidden shadow-sm bg-white/80">
                                        <button
                                            type="button"
                                            id="fulfillment-delivery"
                                            aria-label="Select delivery"
                                            onClick={() => setFulfillmentType('delivery')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all duration-200 ${fulfillmentType === 'delivery'
                                                ? 'genie-btn-primary text-white shadow-inner'
                                                : 'bg-white text-slate-600 hover:bg-purple-50'
                                                }`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 5v3h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
                                            Delivery
                                        </button>
                                        <div className="w-px bg-purple-100" />
                                        <button
                                            type="button"
                                            id="fulfillment-pickup"
                                            aria-label="Select pick-up"
                                            onClick={() => setFulfillmentType('pickup')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all duration-200 ${fulfillmentType === 'pickup'
                                                ? 'genie-btn-primary text-white shadow-inner'
                                                : 'bg-white text-slate-600 hover:bg-purple-50'
                                                }`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                            Pick-Up
                                        </button>
                                    </div>

                                    {fulfillmentType === 'pickup' ? (
                                        /* ---- PICK-UP UI ---- */
                                        <div className="space-y-4 animate-fade-in">
                                            {/* Pickup Location Selection */}
                                            <div className="space-y-3">
                                                <label className="block text-sm font-semibold text-slate-700">Select Pickup Branch <span className="text-red-500">*</span></label>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {PICKUP_LOCATIONS.map((location, index) => (
                                                        <button
                                                            key={location.name}
                                                            type="button"
                                                            onClick={() => setSelectedPickupIndex(index)}
                                                            className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${selectedPickupIndex === index
                                                                ? 'genie-control-selected'
                                                                : 'border-purple-100 bg-white hover:border-purple-300'
                                                                }`}
                                                        >
                                                            <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedPickupIndex === index ? 'border-purple-500 bg-purple-500' : 'border-purple-200'}`}>
                                                                {selectedPickupIndex === index && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                            </div>
                                                            <div>
                                                                <p className={`text-sm font-bold ${selectedPickupIndex === index ? 'text-purple-900' : 'text-slate-800'}`}>{location.name}</p>
                                                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{location.street_address}</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Selected Branch Details & Map */}
                                            <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl space-y-3">
                                                <div className="flex items-start gap-3">
                                                    <MapPin className="w-5 h-5 genie-icon mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-sm font-bold text-purple-800">{PICKUP_LOCATIONS[selectedPickupIndex].name}</p>
                                                        <p className="text-xs text-purple-600 mt-0.5">{PICKUP_LOCATIONS[selectedPickupIndex].street_address}, {PICKUP_LOCATIONS[selectedPickupIndex].city}</p>
                                                    </div>
                                                </div>
                                                <div className="rounded-xl overflow-hidden border border-purple-200 shadow-sm bg-white">
                                                    <iframe
                                                        title={`${PICKUP_LOCATIONS[selectedPickupIndex].name} location`}
                                                        src={PICKUP_LOCATIONS[selectedPickupIndex].mapEmbedUrl}
                                                        width="100%"
                                                        height="180"
                                                        style={{ border: 0 }}
                                                        allowFullScreen
                                                        loading="lazy"
                                                        referrerPolicy="no-referrer-when-downgrade"
                                                    />
                                                </div>
                                                <a
                                                    href={PICKUP_LOCATIONS[selectedPickupIndex].googleMapsUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="genie-link inline-flex items-center gap-1.5 text-xs font-semibold hover:underline transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                                    Open in Google Maps
                                                </a>
                                            </div>

                                            {/* Pickup Contact Information */}
                                            <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl space-y-4">
                                                <h3 className="text-sm font-bold text-purple-800 flex items-center gap-2">
                                                    <User className="w-4 h-4 genie-icon" />
                                                    Pickup Contact Person
                                                </h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                        <label htmlFor="pickupRecipientName" className="block text-xs font-semibold text-purple-700 mb-1">Recipient Name <span className="text-red-500">*</span></label>
                                                        <input
                                                            id="pickupRecipientName"
                                                            type="text"
                                                            value={pickupRecipientName}
                                                            onChange={(e) => setPickupRecipientName(e.target.value)}
                                                            className={`${inputStyle} text-sm py-2`}
                                                            placeholder="Who will pick up?"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label htmlFor="pickupRecipientPhone" className="block text-xs font-semibold text-purple-700 mb-1">Contact Number <span className="text-red-500">*</span></label>
                                                        <input
                                                            id="pickupRecipientPhone"
                                                            type="tel"
                                                            value={pickupRecipientPhone}
                                                            onChange={(e) => setPickupRecipientPhone(e.target.value)}
                                                            className={`${inputStyle} text-sm py-2`}
                                                            placeholder="Phone number"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Guest Email for pickup (still need receipt) */}
                                            {isAuthenticated && user?.is_anonymous && (
                                                <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg animate-fade-in">
                                                    <h3 className="text-sm font-bold text-purple-800 mb-3">Guest Contact Info</h3>
                                                    <div>
                                                        <label htmlFor="guestEmailPickup" className="block text-sm font-medium text-slate-600 mb-1">Email Address <span className="text-red-500">*</span></label>
                                                        <input
                                                            id="guestEmailPickup"
                                                            type="email"
                                                            value={guestEmail}
                                                            onChange={(e) => setGuestEmail(e.target.value)}
                                                            className={inputStyle}
                                                            placeholder="For order updates and receipt"
                                                            required
                                                        />
                                                        <p className="text-xs text-slate-500 mt-1">We&apos;ll send your receipt and order status here.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {!isAuthenticated && (
                                                <div className="p-5 genie-card rounded-xl space-y-4">
                                                    <div className="text-center space-y-3">
                                                        <h3 className="font-semibold text-slate-800">Almost there!</h3>
                                                        <p className="text-sm text-slate-600">Enter your email so we can send your receipt and order updates.</p>
                                                        <button
                                                            onClick={handleGuestCheckout}
                                                            disabled={isGuestLoading}
                                                            className="w-full genie-btn-primary font-bold py-3 px-6 rounded-xl text-sm disabled:opacity-70 disabled:hover:scale-100 flex justify-center items-center"
                                                        >
                                                            {isGuestLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Setting up...</> : 'Continue as Guest'}
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-center text-slate-400">
                                                        Have an account?{' '}
                                                        <button
                                                            onClick={() => router.push('/login')}
                                                            className="genie-link font-semibold hover:underline"
                                                            tabIndex={0}
                                                            aria-label="Sign in to your account"
                                                        >
                                                            Sign In
                                                        </button>
                                                    </p>
                                                </div>
                                            )}

                                            <div>
                                                <label htmlFor="pickupNotes" className="block text-sm font-medium text-slate-600 mb-1">Pick-Up Notes (Optional)</label>
                                                <textarea id="pickupNotes" value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} className={inputStyle} placeholder="e.g., I'll be coming at 2pm, any special requests" rows={2}></textarea>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ---- DELIVERY UI (existing) ---- */
                                        <div id="cart-address-section">
                                            {isAddressesLoading ? (
                                                <div className="flex justify-center items-center h-24"><Loader2 className="w-6 h-6 animate-spin genie-icon" /></div>
                                            ) : isAuthenticated ? (
                                                <>
                                                    {/* Guest Email Input */}
                                                    {user?.is_anonymous && (
                                                        <div className="mb-6 p-4 bg-purple-50 border border-purple-100 rounded-lg animate-fade-in">
                                                            <h3 className="text-sm font-bold text-purple-800 mb-3">Guest Contact Info</h3>
                                                            <div>
                                                                <label htmlFor="guestEmail" className="block text-sm font-medium text-slate-600 mb-1">Email Address <span className="text-red-500">*</span></label>
                                                                <input
                                                                    id="guestEmail"
                                                                    type="email"
                                                                    value={guestEmail}
                                                                    onChange={(e) => setGuestEmail(e.target.value)}
                                                                    className={inputStyle}
                                                                    placeholder="For order updates and receipt"
                                                                    required
                                                                />
                                                                <p className="text-xs text-slate-500 mt-1">We&apos;ll send your receipt and order status here.</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Saved Addresses (Only for registered users) */}
                                                    {!user?.is_anonymous && savedAddresses.length > 0 && !isAddingAddress && (
                                                        <div className="space-y-2">
                                                            <div>
                                                                <label htmlFor="addressSelect" className="block text-sm font-medium text-slate-600 mb-1">Delivery Address</label>
                                                                <select id="addressSelect" value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)} className={inputStyle}>
                                                                    <option value="" disabled>-- Select a saved address --</option>
                                                                    {savedAddresses.map(addr => (
                                                                        <option key={addr.address_id} value={addr.address_id}>
                                                                            {addr.address_label ? `${addr.address_label} (${addr.street_address})` : addr.street_address}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            {selectedAddress && (
                                                                <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-100 text-sm">
                                                                    <p className="font-semibold text-slate-700">{selectedAddress.recipient_name}</p>
                                                                    <p className="text-slate-500">{selectedAddress.recipient_phone}</p>
                                                                    {selectedAddress.latitude && selectedAddress.longitude ? (
                                                                        <a href={`https://www.google.com/maps?q=${selectedAddress.latitude},${selectedAddress.longitude}`} target="_blank" rel="noopener noreferrer" className="genie-link flex items-start gap-1.5 mt-1 hover:underline">
                                                                            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 genie-icon" />
                                                                            <span>{selectedAddress.street_address}</span>
                                                                        </a>
                                                                    ) : (
                                                                        <p className="text-slate-500 mt-1">{selectedAddress.street_address}</p>
                                                                    )}
                                                                    {selectedAddress.latitude && selectedAddress.longitude && (
                                                                        <StaticMap latitude={selectedAddress.latitude} longitude={selectedAddress.longitude} />
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Guest Address Display */}
                                                    {isAnonymous && guestAddress && !isAddingAddress && (
                                                        <div className="mb-4 p-3 bg-purple-50/60 rounded-lg border border-purple-100 text-sm relative group">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-semibold text-slate-700">{guestAddress.recipient_name}</p>
                                                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase rounded-full tracking-wider">Guest</span>
                                                                    </div>
                                                                    <p className="text-slate-500">{guestAddress.recipient_phone}</p>
                                                                    {guestAddress.latitude && guestAddress.longitude ? (
                                                                        <a href={`https://www.google.com/maps?q=${guestAddress.latitude},${guestAddress.longitude}`} target="_blank" rel="noopener noreferrer" className="genie-link flex items-start gap-1.5 mt-1 hover:underline">
                                                                            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 genie-icon" />
                                                                            <span>{guestAddress.street_address}</span>
                                                                        </a>
                                                                    ) : (
                                                                        <p className="text-slate-500 mt-1">{guestAddress.street_address}</p>
                                                                    )}
                                                                    {guestAddress.city && <p className="text-slate-500">{guestAddress.city}</p>}
                                                                </div>
                                                                <button
                                                                    onClick={() => setIsAddingAddress(true)}
                                                                    className="genie-link text-xs font-bold hover:underline uppercase tracking-wide"
                                                                >
                                                                    Edit
                                                                </button>
                                                            </div>
                                                            {guestAddress.latitude && guestAddress.longitude && (
                                                                <StaticMap latitude={guestAddress.latitude} longitude={guestAddress.longitude} />
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Address Form or Add Button */}
                                                    {(isAddingAddress || (user?.is_anonymous && !guestAddress)) && user ? (
                                                        <div className="mt-4">
                                                            <GoogleMapsLoaderProvider>
                                                                <AddressForm
                                                                    userId={user.id}
                                                                    onSuccess={isAnonymous ? handleGuestAddressSuccess : handleNewAddressSuccess}
                                                                    onCancel={() => setIsAddingAddress(false)}
                                                                    isGuest={isAnonymous}
                                                                    hideActions={!isAnonymous}
                                                                    onFormChange={handleFormChange}
                                                                />
                                                            </GoogleMapsLoaderProvider>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-2">
                                                            <button type="button" onClick={() => setIsAddingAddress(true)} className="w-full genie-btn-secondary text-center text-sm font-semibold py-2 rounded-lg transition-colors">
                                                                + Add a New Address
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="p-5 genie-card rounded-xl space-y-4">
                                                    <div className="text-center space-y-3">
                                                        <h3 className="font-semibold text-slate-800">Where should we deliver?</h3>
                                                        <p className="text-sm text-slate-600">Continue as guest to enter your delivery address and email.</p>
                                                        <button
                                                            onClick={handleGuestCheckout}
                                                            disabled={isGuestLoading}
                                                            className="w-full genie-btn-primary font-bold py-3 px-6 rounded-xl text-sm disabled:opacity-70 disabled:hover:scale-100 flex justify-center items-center"
                                                        >
                                                            {isGuestLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Setting up...</> : 'Continue as Guest'}
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-center text-slate-400">
                                                        Have an account?{' '}
                                                        <button
                                                            onClick={() => router.push('/login')}
                                                            className="genie-link font-semibold hover:underline"
                                                            tabIndex={0}
                                                            aria-label="Sign in to your account"
                                                        >
                                                            Sign In
                                                        </button>
                                                        {' '}to use saved addresses.
                                                    </p>
                                                </div>
                                            )}

                                            <div>
                                                <label htmlFor="deliveryInstructions" className="block text-sm font-medium text-slate-600 mb-1">Delivery Instructions (Optional)</label>
                                                <textarea id="deliveryInstructions" value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} className={inputStyle} placeholder="e.g., landmark, contact person" rows={2}></textarea>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 pb-4 border-t border-purple-100 space-y-4">
                                    {/* Discount Code Section */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 mb-3">
                                            Have a Discount Code?
                                        </h3>

                                        {userDiscountCodes.length > 0 && !appliedDiscount && (
                                            <div className="mb-3">
                                                <p className="text-xs text-slate-600 mb-2">Your available codes:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {userDiscountCodes.map(code => (
                                                        <button
                                                            key={code.code_id}
                                                            onClick={() => handleApplyDiscount(code.code)}
                                                            className="genie-btn-secondary px-3 py-1.5 text-xs rounded-lg transition-colors font-mono"
                                                        >
                                                            {code.code}
                                                            {code.discount_amount && ` (₱${code.discount_amount} off)`}
                                                            {code.discount_percentage && ` (${code.discount_percentage}% off)`}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {!appliedDiscount ? (
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={discountCode}
                                                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                                                    placeholder="Enter code"
                                                    className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-lg uppercase font-mono focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                                                    maxLength={20}
                                                />
                                                <button
                                                    onClick={() => handleApplyDiscount()}
                                                    disabled={isValidatingCode || !discountCode.trim()}
                                                    className="genie-btn-primary px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isValidatingCode ? <Loader2 className="animate-spin w-4 h-4" /> : 'Apply'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-semibold text-purple-800">
                                                            Code Applied: <span className="font-mono">{discountCode}</span>
                                                        </p>
                                                        <p className="text-xs text-purple-700 mt-1">
                                                            Saving ₱{appliedDiscount.discountAmount?.toFixed(2)}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={handleRemoveDiscount}
                                                        className="genie-btn-ghost px-2 py-1 rounded text-sm font-medium"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Price Breakdown with Discount */}
                                    <div className="space-y-2 mt-4">
                                        <div className="flex justify-between text-sm text-slate-600">
                                            <span>Subtotal:</span>
                                            <span>₱{subtotal.toFixed(2)}</span>
                                        </div>

                                        <div className="flex justify-between text-sm text-slate-600">
                                            <span>{fulfillmentType === 'pickup' ? 'Pick-Up Fee:' : 'Delivery Fee:'}</span>
                                            <span>
                                                {fulfillmentType === 'pickup'
                                                    ? 'Free'
                                                    : (!selectedAddress && !guestAddress && !pendingAddressData?.city && !derivedCity)
                                                        ? <span className="text-slate-400 italic">Depends on area</span>
                                                        : `₱${deliveryFee.toFixed(2)}`
                                                }
                                            </span>
                                        </div>

                                        {appliedDiscount && (
                                            <div className="flex justify-between text-sm text-purple-700 font-semibold">
                                                <span>Discount ({discountCode}):</span>
                                                <span>-₱{discountAmount.toFixed(2)}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between text-lg font-bold border-t border-purple-100 pt-2 mt-2">
                                            <span>Total:</span>
                                            <span>₱{total.toFixed(2)}</span>
                                        </div>
                                    </div>



                                    {fulfillmentType === 'pickup' && (
                                        <p className="text-xs text-center text-slate-500 pt-1">
                                            Pick-up is available at <strong>{PICKUP_LOCATIONS[selectedPickupIndex].branchName}</strong>. Please come within the selected time slot.
                                        </p>
                                    )}

                                    {getMissingRequirements().length > 0 && (
                                        <div className="text-center p-3 mb-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium animate-fade-in">
                                            <p className="mb-1.5">Please complete the following:</p>
                                            <div className="flex flex-wrap justify-center gap-1.5">
                                                {getMissingRequirements().map(item => (
                                                    <button
                                                        key={item.scrollId}
                                                        type="button"
                                                        onClick={() => {
                                                            const el = document.getElementById(item.scrollId);
                                                            if (el) {
                                                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                el.classList.add('ring-2', 'ring-red-400', 'ring-offset-2');
                                                                setTimeout(() => el.classList.remove('ring-2', 'ring-red-400', 'ring-offset-2'), 2000);
                                                            }
                                                        }}
                                                        className="px-2.5 py-1 bg-red-100 hover:bg-red-200 rounded-full text-red-700 font-semibold transition-colors underline underline-offset-2 cursor-pointer"
                                                        aria-label={`Scroll to ${item.label}`}
                                                    >
                                                        {item.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <PaymentErrorBoundary>
                                        <div className="flex flex-col gap-3 pt-2">
                                            <button
                                                onClick={handleSubmitOrder}
                                                disabled={
                                                    isPlacingOrder ||
                                                    isCreatingPayment ||
                                                    getMissingRequirements().length > 0
                                                }
                                                className="w-full genie-btn-primary py-4 rounded-full font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                            >
                                                {isCreatingPayment ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Redirecting to Payment...
                                                    </span>
                                                ) : isPlacingOrder ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Creating Order...
                                                    </span>
                                                ) : (
                                                    `Place Order - ₱${total.toFixed(2)} `
                                                )}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleDownpaymentClick}
                                                disabled={
                                                    isPlacingOrder ||
                                                    isCreatingPayment ||
                                                    getMissingRequirements().length > 0 ||
                                                    !canUseDownpayment
                                                }
                                                className="w-full genie-btn-secondary py-4 px-4 font-bold rounded-full transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed max-[413px]:text-[11px] max-[413px]:px-2 max-[413px]:gap-1"
                                            >
                                                <CreditCard className="w-5 h-5 max-[413px]:w-4 max-[413px]:h-4 shrink-0" />
                                                <span className="whitespace-nowrap">Place Order with 50% Downpayment</span>
                                            </button>
                                            {eventDate && !canUseDownpayment && (
                                                <p className="text-xs text-center text-slate-500 px-2">
                                                    50% downpayment is available only for fulfillment dates at least 3 calendar days away in the Philippines.
                                                </p>
                                            )}
                                        </div>
                                    </PaymentErrorBoundary>

                                    {/* Payment method logos moved under the button */}
                                    <div className="flex flex-col gap-4 items-center justify-center pt-2">
                                        <div className="flex flex-wrap gap-2 items-center justify-center">
                                            {paymentMethods.map(method => (
                                                <img key={method.name} src={method.logoUrl} alt={method.name} title={method.name} width={48} height={30} className="h-8 w-12 object-contain rounded-md bg-white p-1 border border-slate-200 shadow-sm opacity-80" />
                                            ))}
                                        </div>
                                        <div className="flex flex-wrap gap-6 items-center justify-center">
                                            <img
                                                src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/xendit-blue.webp"
                                                alt="Xendit"
                                                className="h-10 w-auto object-contain"
                                            />
                                            <img
                                                src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/securepayment-green.webp"
                                                alt="Secure Payment"
                                                className="h-10 w-auto object-contain"
                                            />
                                        </div>
                                        <nav aria-label="Checkout policies and contact" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                            <a href="/privacy" className="underline underline-offset-2 transition-colors hover:text-purple-600">
                                                Privacy Policy
                                            </a>
                                            <a href="/return-policy" className="underline underline-offset-2 transition-colors hover:text-purple-600">
                                                Return Policy
                                            </a>
                                            <a href="/contact" className="underline underline-offset-2 transition-colors hover:text-purple-600">
                                                Contact Us
                                            </a>
                                        </nav>
                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setRegistrationDocument({
                                                    label: 'DTI Registered',
                                                    imageUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/DTI%20Alalai%20ITS.jpg',
                                                })}
                                                className="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 shadow-sm transition-colors hover:bg-green-100"
                                            >
                                                DTI Registered
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRegistrationDocument({
                                                    label: 'BIR Registered',
                                                    imageUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/BIR%20Certificate%20of%20Registration%202303.jpg',
                                                })}
                                                className="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 shadow-sm transition-colors hover:bg-green-100"
                                            >
                                                BIR Registered
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <DownpaymentModal
                isOpen={isDownpaymentModalOpen}
                onClose={() => setIsDownpaymentModalOpen(false)}
                onConfirm={handleConfirmDownpayment}
                totalAmount={total}
                eventDate={eventDate}
                isLoading={isPlacingOrder}
            />
        </>
    );
}

// Wrap the exported component with GoogleMapsLoaderProvider
// This ensures Google Maps only loads when the cart page is visited
// Google Maps is lazy-loaded only when the address form is opened
function CartClientWithMaps() {
    return <CartClient />;
}

export default CartClientWithMaps;
