'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCart, useCartActions, readFromLocalStorage, batchSaveToLocalStorage, batchRemoveFromLocalStorage } from '@/contexts/CartContext';
import { useAddresses, useAddAddress } from '@/hooks/useAddresses';
import { showSuccess, showError, showInfo } from '@/lib/utils/toast';
import { Loader2, CloseIcon, TrashIcon } from '@/components/icons';
import { MapPin, Search, X, Users } from 'lucide-react';
import { PaymentModeToggle } from '@/components/PaymentModeToggle';
import { CartItem, CartItemDetails, CakeType } from '@/types';
import { CakeGenieAddress } from '@/lib/database.types';
import { CartSkeleton } from '@/components/LoadingSkeletons';
import { CITIES_AND_BARANGAYS, getDeliveryFeeByCity } from '@/constants';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import DetailItem from '@/components/UI/DetailItem';
import { createOrderFromCart, createSplitOrderFromCart, getAvailableDeliveryDates, getBlockedDatesInRange, AvailableDate, BlockedDateInfo, createGuestUser } from '@/services/supabaseService';
import { upgradeAnonymousToEmailAccount } from '@/services/accountActivation';
import { createXenditPayment } from '@/services/xenditService';
import AddressForm, { StaticMap } from '@/components/AddressForm';
import { SplitWithFriendsModal } from '@/components/SplitWithFriendsModal';
import { SplitOrderShareModal } from '@/components/SplitOrderShareModal';
import { useGoogleMapsLoader } from '@/contexts/GoogleMapsLoaderContext';
import { calculateCartAvailability, AvailabilityType } from '@/lib/utils/availability';
import CartItemCard from '@/components/CartItemCard';
import { useQuery } from '@tanstack/react-query';
import { useAvailabilitySettings } from '@/hooks/useAvailabilitySettings';
import { validateDiscountCode, getUserDiscountCodes } from '@/services/discountService';
import type { DiscountValidationResult } from '@/types';

// FIX: Declare the global 'google' object to satisfy TypeScript.
declare const google: any;

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

export default function CartClient() {
    const router = useRouter();
    const { user, signInAnonymously } = useAuth();
    const isRegisteredUser = !!(user && !user.is_anonymous);
    const isAuthenticated = !!user;
    const isAnonymous = !!user?.is_anonymous;

    const [guestEmail, setGuestEmail] = useState(() => readFromLocalStorage('cart_guest_email') || '');
    const [isGuestLoading, setIsGuestLoading] = useState(false);

    const handleGuestCheckout = async () => {
        setIsGuestLoading(true);
        try {
            const { error } = await signInAnonymously();
            if (error) throw error;
            // User state will update automatically via useAuth
        } catch (error: any) {
            showError(error.message || 'Failed to start guest checkout');
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
        const mappedSupabaseItems: CartItem[] = cartItems.map(item => ({
            id: item.cart_item_id,
            image: item.customized_image_url,
            status: 'complete',
            type: item.cake_type,
            thickness: item.cake_thickness,
            size: item.cake_size,
            totalPrice: item.final_price * item.quantity,
            details: item.customization_details as CartItemDetails,
            merchant_id: item.merchant_id,
            merchant_name: item.merchant?.business_name,
        }));
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
    const [tooltip, setTooltip] = useState<{ date: string; reason: string; } | null>(null);

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

    // Split with Friends State
    const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
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

    // Persist guest address to localStorage
    useEffect(() => {
        if (guestAddress) {
            batchSaveToLocalStorage('cart_guest_address', JSON.stringify(guestAddress));
        } else {
            batchRemoveFromLocalStorage('cart_guest_address');
        }
    }, [guestAddress]);

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
        const result = await validateDiscountCode(code, subtotal);
        setIsValidatingCode(false);

        if (result.valid) {
            setAppliedDiscount(result);
            setDiscountCode(code); // Set code state only on success
            batchSaveToLocalStorage('cart_discount_code', code);
            batchSaveToLocalStorage('cart_applied_discount', JSON.stringify(result));
            if (!options?.silent) { showSuccess(result.message || 'Discount applied!'); }
        } else {
            setAppliedDiscount(null);
            batchRemoveFromLocalStorage('cart_applied_discount');
            if (!options?.silent) { showError(result.message || 'Invalid discount code'); }
        }
    }, [discountCode, subtotal, appliedDiscount, handleRemoveDiscount]);

    const {
        isLoaded: isMapsLoaded,
        loadError: mapsLoadError
    } = useGoogleMapsLoader();

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

        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
            { location: { lat, lng } },
            (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
                if (status === 'OK' && results && results[0]) {
                    // Look for city in address components
                    const cityComponent = results[0].address_components.find(c =>
                        c.types.includes('locality') || c.types.includes('administrative_area_level_2')
                    );
                    if (cityComponent) {
                        setDerivedCity(cityComponent.long_name);
                    }
                }
            }
        );
    }, [selectedAddress, guestAddress, isMapsLoaded]);

    // Calculate dynamic delivery fee based on city
    const deliveryFee = useMemo(() => {
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
    }, [selectedAddress, guestAddress, derivedCity, pendingAddressData, isAddingAddress]);

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

    const { data: availableDates = [], isLoading: isLoadingDates } = useQuery<AvailableDate[]>({
        queryKey: ['available-dates', availabilitySettings?.minimum_lead_time_days],
        queryFn: () => {
            const startDate = new Date(); // Always start from today
            const year = startDate.getFullYear();
            const month = String(startDate.getMonth() + 1).padStart(2, '0');
            const day = String(startDate.getDate()).padStart(2, '0');
            return getAvailableDeliveryDates(`${year}-${month}-${day}`, 30);
        },
        enabled: !isLoadingSettings, // Only run when settings are loaded
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const { data: blockedDatesMap, isLoading: isLoadingBlockedDates } = useQuery({
        queryKey: ['blocked-dates-range'],
        queryFn: () => {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + 30);

            const format = (d: Date) => d.toISOString().split('T')[0];

            return getBlockedDatesInRange(format(startDate), format(endDate));
        },
        staleTime: 5 * 60 * 1000,
    });

    // Effect to re-validate discount when cart total changes
    const isInitialMount = useRef(true);
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            // On initial load, if a discount code is loaded from localStorage,
            // revalidate it against the current cart total.
            if (discountCode) {
                handleApplyDiscount(discountCode, { silent: true });
            }
            return;
        }

        // On subsequent subtotal changes, if a code is applied, re-validate it silently.
        if (appliedDiscount) {
            handleApplyDiscount(discountCode, { silent: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subtotal]);

    const correctedDates = useMemo(() => {
        if (isLoadingDates || !availabilitySettings) return availableDates;

        if (cartAvailability === 'normal') {
            return availableDates;
        }

        const leadTimeDays = availabilitySettings.minimum_lead_time_days || 0;
        if (leadTimeDays === 0) {
            return availableDates;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return availableDates.map(dateInfo => {
            const date = new Date(dateInfo.available_date + 'T00:00:00');
            const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            // For rush and same-day orders, we want to ensure dates within the standard lead time
            // are available (unless explicitly blocked by 'blockedDatesMap' which is checked in getDateStatus).
            // The backend might default these to unavailable based on standard lead times.
            if (diffDays >= 0 && diffDays < leadTimeDays) {
                return { ...dateInfo, is_rush_available: true, is_same_day_available: true };
            }
            return dateInfo;
        });
    }, [availableDates, isLoadingDates, cartAvailability, availabilitySettings]);

    const handleDateSelect = useCallback((date: string) => {
        setEventDate(date);
        const blocks = blockedDatesMap?.[date] || [];
        const partials = blocks.filter(b => !b.is_all_day);
        setPartiallyBlockedSlots(partials);
    }, [setEventDate, blockedDatesMap]);

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

        // Check availability flags from the RPC, but *only* for rush and same-day.
        // The client-side logic above is the source of truth for 'normal' orders.
        let leadTimeDisabledByRpc = false;
        if (cartAvailability === 'rush') {
            leadTimeDisabledByRpc = !dateInfo.is_rush_available;
        } else if (cartAvailability === 'same-day') {
            leadTimeDisabledByRpc = !dateInfo.is_same_day_available;
        }

        if (leadTimeDisabledByRpc) {
            let reason = "Date unavailable for this order's lead time.";
            return { isDisabled: true, reason };
        }

        return { isDisabled: false, reason: null };
    }, [blockedDatesMap, cartAvailability, availabilitySettings]);

    const disabledSlots = useMemo(() => {
        const newDisabledSlots: string[] = [];
        const now = new Date();
        const todayString = now.toISOString().split('T')[0];

        if (eventDate === todayString) {
            let readyTime: Date | null = null;
            if (cartAvailability === 'same-day') {
                readyTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // +3 hours
            } else if (cartAvailability === 'rush') {
                readyTime = new Date(now.getTime() + 30 * 60 * 1000); // +30 mins
            }

            if (readyTime) {
                EVENT_TIME_SLOTS_MAP.forEach(timeSlot => {
                    const slotEndDate = new Date(eventDate);
                    slotEndDate.setHours(timeSlot.endHour, 0, 0, 0);
                    if (slotEndDate < readyTime) {
                        newDisabledSlots.push(timeSlot.slot);
                    }
                });
            } else {
                const currentHour = now.getHours();
                EVENT_TIME_SLOTS_MAP.forEach(timeSlot => {
                    if (timeSlot.endHour <= currentHour) {
                        newDisabledSlots.push(timeSlot.slot);
                    }
                });
            }
        }

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
    }, [cartAvailability, eventDate, partiallyBlockedSlots]);

    useEffect(() => {
        if (eventTime && disabledSlots.includes(eventTime)) {
            setEventTime('');
        }
    }, [eventTime, disabledSlots, setEventTime]);

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

    const getMissingRequirements = () => {
        const missing: string[] = [];
        if (!eventDate) missing.push('Date of Event');
        if (!eventTime) missing.push('Time of Event');

        if (isAnonymous && !guestEmail) missing.push('Email Address');

        if (isAddingAddress || (isAnonymous && !guestAddress)) {
            if (!isPendingAddressValid) missing.push('Delivery Address');
        } else {
            if (!isAnonymous && !selectedAddress) missing.push('Delivery Address');
            if (isAnonymous && !guestAddress) missing.push('Delivery Address');
        }

        return missing;
    };

    const handleSubmitOrder = async () => {
        if (!isAuthenticated) {
            showError('Please sign in or continue as guest to place an order.');
            return;
        }

        const missing = getMissingRequirements();
        if (missing.length > 0) {
            showError(`Please fill in: ${missing.join(', ')}`);
            return;
        }

        setIsPlacingOrder(true);
        try {
            // Handle Address Saving/Creation if needed
            let effectiveDeliveryAddressId = isAnonymous ? null : selectedAddress?.address_id || null;
            let effectiveGuestAddress = isAnonymous ? guestAddress : undefined;

            if (isAddingAddress || (isAnonymous && !guestAddress)) {
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
                    setGuestAddress(effectiveGuestAddress); // Update state for UI
                } else {
                    // Save new address for registered user
                    if (!user?.id) throw new Error("User ID missing.");
                    const newAddr = await addAddressMutation.mutateAsync({
                        userId: user.id,
                        addressData: pendingAddressData as any // Type assertion as pendingData is Partial
                    });
                    if (!newAddr) throw new Error("Failed to save address.");
                    effectiveDeliveryAddressId = newAddr.address_id;
                    setSelectedAddressId(newAddr.address_id); // Update state
                }
                setIsAddingAddress(false); // Close form
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
                guestAddress: isAnonymous && effectiveGuestAddress ? {
                    recipientName: effectiveGuestAddress.recipient_name,
                    recipientPhone: effectiveGuestAddress.recipient_phone,
                    streetAddress: effectiveGuestAddress.street_address,
                    city: effectiveGuestAddress.city,
                    latitude: effectiveGuestAddress.latitude,
                    longitude: effectiveGuestAddress.longitude
                } : undefined
            });

            if (!success || !order) {
                throw error || new Error('Failed to create order.');
            }

            // 2. Create Payment
            const emailToUse = isAnonymous ? guestEmail : user?.email || 'customer@example.com';
            const nameToUse = isAnonymous ? effectiveGuestAddress?.recipient_name : user?.user_metadata?.first_name || selectedAddress?.recipient_name || 'Customer';

            const { paymentUrl, error: paymentError } = await createXenditPayment({
                orderId: order.order_id,
                amount: order.total_amount,
                customerEmail: emailToUse,
                customerName: nameToUse || 'Customer'
            });

            if (paymentError) throw new Error(paymentError);

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

                // Clear cart and guest data, then redirect
                setIsRedirecting(true);
                clearCart();
                setAppliedDiscount(null);
                setDiscountCode('');
                setGuestEmail('');
                setGuestAddress(null);
                batchRemoveFromLocalStorage('cart_guest_email');
                batchRemoveFromLocalStorage('cart_guest_address');
                window.location.href = paymentUrl;
            } else {
                throw new Error('Payment URL not generated.');
            }

        } catch (error: any) {
            console.error('Checkout error:', error);
            showError(error.message || 'An error occurred during checkout.');
        } finally {
            setIsPlacingOrder(false);
        }
    };

    const handleSplitWithFriends = async (splitCount: number, splitMessage: string) => {
        if (!isAuthenticated) {
            showError('Please sign in or continue as guest to place an order.');
            return;
        }

        const missing = getMissingRequirements();
        if (missing.length > 0) {
            showError(`Please fill in: ${missing.join(', ')}`);
            return;
        }

        setIsPlacingOrder(true);
        try {
            // Handle Address Saving/Creation if needed
            let effectiveDeliveryAddressId = isAnonymous ? null : selectedAddress?.address_id || null;
            let effectiveGuestAddress = isAnonymous ? guestAddress : undefined;

            if (isAddingAddress || (isAnonymous && !guestAddress)) {
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
                        addressData: pendingAddressData as any
                    });
                    if (!newAddr) throw new Error("Failed to save address.");
                    effectiveDeliveryAddressId = newAddr.address_id;
                    setSelectedAddressId(newAddr.address_id);
                }
                setIsAddingAddress(false);
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
                guestAddress: isAnonymous && effectiveGuestAddress ? {
                    recipientName: effectiveGuestAddress.recipient_name,
                    recipientPhone: effectiveGuestAddress.recipient_phone,
                    streetAddress: effectiveGuestAddress.street_address,
                    city: effectiveGuestAddress.city,
                    latitude: effectiveGuestAddress.latitude,
                    longitude: effectiveGuestAddress.longitude
                } : undefined
            });

            if (!success || !order) {
                throw error || new Error('Failed to create split order.');
            }

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

        } catch (error: any) {
            console.error('Split order error:', error);
            showError(error.message || 'Failed to create split order.');
        } finally {
            setIsPlacingOrder(false);
        }
    };

    const inputStyle = "w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-slate-50 disabled:cursor-not-allowed";

    const onRemoveItem = async (id: string) => {
        try {
            await removeItemOptimistic(id);
            showSuccess('Item removed from cart');
        } catch (error) {
            console.error('Failed to remove item:', error);
            showError('Failed to remove item');
        }
    };

    const handleClose = () => {
        router.push('/');
    };

    const handleContinueShopping = () => {
        router.push('/');
    };

    return (
        <>
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
                        className="w-full h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            <div className="px-4 md:px-8 py-4 md:py-8">
                <div className="max-w-4xl mx-auto bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
                    <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-fast { animation: fadeInFast 0.2s ease-out; } @keyframes fadeInFast { from { opacity: 0; } to { opacity: 1; } } `}</style>

                    <div className="flex justify-between items-center px-4 pt-4 pb-3 border-b border-slate-200">
                        <h1 className="text-2xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">Your Bag</h1>
                        <button onClick={handleClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Close cart">
                            <CloseIcon />
                        </button>
                    </div>

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
                            <p className="text-slate-500">Your bag is empty.</p>
                            <button onClick={handleContinueShopping} className="mt-4 text-purple-600 font-semibold hover:underline">
                                Continue Shopping
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4 px-4">
                            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                                {Object.entries(groupedItems).map(([merchantName, items]) => (
                                    <div key={merchantName} className="mb-6 last:mb-0">
                                        <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
                                            <div className="bg-slate-100 p-1.5 rounded-full">
                                                <Users size={16} className="text-slate-500" />
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                                                {merchantName}
                                            </h3>
                                        </div>
                                        <div className="space-y-3">
                                            {items.map(item => (
                                                <CartItemCard
                                                    key={item.id}
                                                    item={item}
                                                    onRemove={onRemoveItem}
                                                    onZoom={setZoomedImage}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-slate-200 space-y-4">
                                <h2 className="text-lg font-semibold text-slate-700">Delivery Details</h2>

                                {!isLoadingSettings && (
                                    (availabilitySettings && availabilitySettings.minimum_lead_time_days > 0 && cartAvailability === 'normal') ? (
                                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 animate-fade-in">
                                            <strong>Note:</strong> We are observing a minimum lead time of <strong>{availabilitySettings.minimum_lead_time_days} day(s)</strong>. The first available date has been adjusted.
                                        </div>
                                    ) : availabilityWasOverridden ? (
                                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 animate-fade-in">
                                            <strong>Note:</strong> Due to high demand, availability has been adjusted. Your order will now be processed as a <strong>'{cartAvailability.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}'</strong> order.
                                        </div>
                                    ) : null
                                )}

                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label htmlFor="eventDate" className="block text-sm font-medium text-slate-600 mb-1">Date of Event</label>
                                            {isLoadingDates || isLoadingBlockedDates ? (
                                                <div className="h-16 flex items-center"><Loader2 className="animate-spin text-slate-400" /></div>
                                            ) : (
                                                <div className="relative overflow-visible">
                                                    <div className="flex gap-2 overflow-x-auto pt-16 -mt-16 pb-2 -mb-2 scrollbar-hide" style={{ overflowY: 'visible' }}>
                                                        {correctedDates.slice(0, 14).map((dateInfo, index) => {
                                                            const { isDisabled, reason } = getDateStatus(dateInfo);
                                                            const isSelected = eventDate === dateInfo.available_date;
                                                            const dateObj = new Date(dateInfo.available_date + 'T00:00:00');
                                                            const day = dateObj.toLocaleDateString('en-US', { day: 'numeric' });
                                                            const month = dateObj.toLocaleDateString('en-US', { month: 'short' });

                                                            // Determine tooltip position based on index
                                                            const totalDates = correctedDates.slice(0, 14).length;
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
                                                                <div key={dateInfo.available_date} className="relative shrink-0">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => !isDisabled && handleDateSelect(dateInfo.available_date)}
                                                                        onMouseEnter={() => isDisabled && reason && setTooltip({ date: dateInfo.available_date, reason })}
                                                                        onMouseLeave={() => setTooltip(null)}
                                                                        className={`w-16 text-center rounded-lg p-2 border-2 transition-all duration-200
                                                                    ${isSelected ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-200' : 'border-slate-200 bg-white'}
                                                                    ${isDisabled ? 'opacity-50 bg-slate-50 cursor-not-allowed' : 'hover:border-pink-400'}
    `}
                                                                    >
                                                                        <span className="block text-xs font-semibold text-slate-500">{month}</span>
                                                                        <span className="block text-xl font-bold text-slate-800">{day}</span>
                                                                        <span className="block text-[10px] font-medium text-slate-500">{dateInfo.day_of_week.substring(0, 3)}</span>
                                                                    </button>
                                                                    {tooltip && tooltip.date === dateInfo.available_date && (
                                                                        <div className={`absolute bottom-full mb-2 ${tooltipPositionClass} w-max max-w-[200px] px-3 py-1.5 bg-slate-800 text-white text-xs text-center font-semibold rounded-md z-100 animate-fade-in-fast shadow-lg pointer-events-none whitespace-normal`}>
                                                                            {tooltip.reason}
                                                                            <div className={`absolute ${arrowPositionClass} top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800`}></div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label htmlFor="eventTime" className="block text-sm font-medium text-slate-600 mb-1">Time of Event</label>
                                            <div className="relative">
                                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                    {EVENT_TIME_SLOTS.map(slot => {
                                                        const isDisabled = disabledSlots.includes(slot);
                                                        const isSelected = eventTime === slot;
                                                        return (
                                                            <button
                                                                key={slot}
                                                                type="button"
                                                                onClick={() => !isDisabled && setEventTime(slot)}
                                                                disabled={isDisabled}
                                                                className={`shrink-0 text-center rounded-lg p-2 border-2 transition-all duration-200
                                                            ${isSelected ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-200' : 'border-slate-200 bg-white'}
                                                            ${isDisabled ? 'opacity-50 bg-slate-50 cursor-not-allowed' : 'hover:border-pink-400'}
    `}
                                                            >
                                                                <span className="block text-xs font-semibold text-slate-800 px-2">{slot}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {cartAvailability === 'normal' && <p className="text-xs text-slate-500 -mt-2">Your cart items require a 1-day lead time. Order by 3 PM for next-day delivery.</p>}
                                    {cartAvailability === 'same-day' && <p className="text-xs text-slate-500 -mt-2">Your cart contains items available for same-day delivery (3-hour lead time).</p>}
                                    {cartAvailability === 'rush' && <p className="text-xs text-slate-500 -mt-2">All items in your cart are available for rush delivery (30-min lead time).</p>}


                                    {isAddressesLoading ? (
                                        <div className="flex justify-center items-center h-24"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
                                    ) : isAuthenticated ? (
                                        <>
                                            {/* Guest Email Input */}
                                            {user?.is_anonymous && (
                                                <div className="mb-6 p-4 bg-pink-50 border border-pink-100 rounded-lg animate-fade-in">
                                                    <h3 className="text-sm font-bold text-pink-800 mb-3">Guest Contact Info</h3>
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
                                                        <p className="text-xs text-slate-500 mt-1">We'll send your receipt and order status here.</p>
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
                                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                                                            <p className="font-semibold text-slate-700">{selectedAddress.recipient_name}</p>
                                                            <p className="text-slate-500">{selectedAddress.recipient_phone}</p>
                                                            <p className="text-slate-500 mt-1">{selectedAddress.street_address}</p>
                                                            {selectedAddress.latitude && selectedAddress.longitude && (
                                                                <StaticMap latitude={selectedAddress.latitude} longitude={selectedAddress.longitude} />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Guest Address Display */}
                                            {isAnonymous && guestAddress && !isAddingAddress && (
                                                <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm relative group">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold text-slate-700">{guestAddress.recipient_name}</p>
                                                                <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold uppercase rounded-full tracking-wider">Guest</span>
                                                            </div>
                                                            <p className="text-slate-500">{guestAddress.recipient_phone}</p>
                                                            <p className="text-slate-500 mt-1">{guestAddress.street_address}</p>
                                                            {guestAddress.city && <p className="text-slate-500">{guestAddress.city}</p>}
                                                        </div>
                                                        <button
                                                            onClick={() => setIsAddingAddress(true)}
                                                            className="text-pink-600 text-xs font-bold hover:underline uppercase tracking-wide"
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
                                                    <AddressForm
                                                        userId={user.id}
                                                        onSuccess={isAnonymous ? handleGuestAddressSuccess : handleNewAddressSuccess}
                                                        onCancel={() => !user.is_anonymous && setIsAddingAddress(false)}
                                                        isGuest={isAnonymous}
                                                        hideActions={true}
                                                        onFormChange={handleFormChange}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="mt-2">
                                                    <button type="button" onClick={() => setIsAddingAddress(true)} className="w-full text-center text-sm font-semibold text-pink-600 hover:text-pink-700 py-2 rounded-lg hover:bg-pink-50 transition-colors">
                                                        + Add a New Address
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-6">
                                            <div className="text-center space-y-3">
                                                <h3 className="font-semibold text-slate-800">Have an account?</h3>
                                                <p className="text-sm text-slate-600">Sign in to access your saved addresses and loyalty points.</p>
                                                <button
                                                    onClick={() => router.push('/login')}
                                                    className="w-full bg-white border border-slate-300 text-slate-700 font-semibold py-2.5 px-6 rounded-lg shadow-sm hover:bg-slate-50 hover:shadow transition-all text-sm"
                                                >
                                                    Sign In / Create Account
                                                </button>
                                            </div>

                                            <div className="relative flex items-center py-2">
                                                <div className="grow border-t border-slate-300"></div>
                                                <span className="shrink-0 mx-4 text-slate-400 text-xs font-medium uppercase tracking-wider">Or continue as guest</span>
                                                <div className="grow border-t border-slate-300"></div>
                                            </div>

                                            <div className="text-center space-y-3">
                                                <h3 className="font-semibold text-slate-800">New to Cake Genie?</h3>
                                                <p className="text-sm text-slate-600">You can checkout without creating an account.</p>
                                                <button
                                                    onClick={handleGuestCheckout}
                                                    disabled={isGuestLoading}
                                                    className="w-full bg-linear-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all text-sm disabled:opacity-70 disabled:hover:scale-100 flex justify-center items-center"
                                                >
                                                    {isGuestLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting up guest session...</> : 'Continue as Guest'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label htmlFor="deliveryInstructions" className="block text-sm font-medium text-slate-600 mb-1">Delivery Instructions (Optional)</label>
                                        <textarea id="deliveryInstructions" value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} className={inputStyle} placeholder="e.g., landmark, contact person" rows={2}></textarea>
                                    </div>
                                </div>

                                <div className="pt-4 pb-4 border-t border-slate-200 space-y-4">
                                    {/* Discount Code Section */}
                                    <div className="border-t border-gray-200 pt-4 mt-4">
                                        <h3 className="text-sm font-semibold text-gray-700 mb-3">
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
                                                            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-pink-100 hover:text-pink-700 border border-slate-200 transition-colors font-mono"
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
                                                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg uppercase font-mono focus:outline-none focus:ring-2 focus:ring-pink-500"
                                                    maxLength={20}
                                                />
                                                <button
                                                    onClick={() => handleApplyDiscount()}
                                                    disabled={isValidatingCode || !discountCode.trim()}
                                                    className="px-4 py-2 bg-pink-600 text-white text-sm font-semibold rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    {isValidatingCode ? <Loader2 className="animate-spin w-4 h-4" /> : 'Apply'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-semibold text-green-800">
                                                            ✅ Code Applied: <span className="font-mono">{discountCode}</span>
                                                        </p>
                                                        <p className="text-xs text-green-700 mt-1">
                                                            Saving ₱{appliedDiscount.discountAmount?.toFixed(2)}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={handleRemoveDiscount}
                                                        className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Price Breakdown with Discount */}
                                    <div className="space-y-2 mt-4">
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>Subtotal:</span>
                                            <span>₱{subtotal.toFixed(2)}</span>
                                        </div>

                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>Delivery Fee:</span>
                                            <span>₱{deliveryFee.toFixed(2)}</span>
                                        </div>

                                        {appliedDiscount && (
                                            <div className="flex justify-between text-sm text-green-600 font-semibold">
                                                <span>Discount ({discountCode}):</span>
                                                <span>-₱{discountAmount.toFixed(2)}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2 mt-2">
                                            <span>Total:</span>
                                            <span>₱{total.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <h3 className="text-sm font-semibold text-gray-500 mb-3 text-center">We Accept</h3>
                                        <div className="flex flex-wrap gap-2 items-center justify-center">
                                            {paymentMethods.map(method => (
                                                <img key={method.name} src={method.logoUrl} alt={method.name} title={method.name} className="h-10 w-16 object-contain rounded-md bg-white p-1 border border-slate-200 shadow-sm" />
                                            ))}
                                        </div>
                                    </div>

                                    <p className="text-xs text-center text-slate-500 pt-1">
                                        For the safety of your cake, all deliveries are made via <strong>Lalamove Car</strong> to ensure it arrives in perfect condition.
                                    </p>

                                    {getMissingRequirements().length > 0 && (
                                        <div className="text-center p-2 mb-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium animate-fade-in">
                                            Please complete: {getMissingRequirements().join(', ')}
                                        </div>
                                    )}

                                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                        <button
                                            onClick={handleSubmitOrder}
                                            disabled={
                                                isPlacingOrder ||
                                                isCreatingPayment ||
                                                getMissingRequirements().length > 0
                                            }
                                            className="flex-1 bg-linear-to-r from-pink-500 to-purple-600 text-white py-4 rounded-full font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
                                            onClick={() => setIsSplitModalOpen(true)}
                                            disabled={
                                                isPlacingOrder ||
                                                isCreatingPayment ||
                                                getMissingRequirements().length > 0
                                            }
                                            className="flex-1 py-4 px-4 bg-white border-2 border-pink-500 text-pink-500 font-bold rounded-full hover:bg-pink-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Users className="w-5 h-5" />
                                            <span>Split with Friends</span>
                                        </button>
                                    </div>

                                    {/* Split with Friends explanation */}
                                    <p className="text-xs text-center text-slate-500 mt-2">
                                        Share a payment link with friends, they chip in via GCash
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <SplitWithFriendsModal
                isOpen={isSplitModalOpen}
                onClose={() => setIsSplitModalOpen(false)}
                onConfirm={handleSplitWithFriends}
                totalAmount={total}
                isLoading={isPlacingOrder}
            />

            {splitOrderDetails && (
                <SplitOrderShareModal
                    isOpen={isShareModalOpen}
                    onClose={() => {
                        setIsShareModalOpen(false);
                        handleClose(); // Close cart
                    }}
                    shareLink={splitOrderDetails.shareLink}
                    orderNumber={splitOrderDetails.orderNumber}
                    splitCount={splitOrderDetails.splitCount}
                    totalAmount={splitOrderDetails.totalAmount}
                />
            )}
        </>
    );
}
