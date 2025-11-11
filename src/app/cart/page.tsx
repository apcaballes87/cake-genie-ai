import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCart, useCartActions, readFromLocalStorage, batchSaveToLocalStorage, batchRemoveFromLocalStorage } from '../../contexts/CartContext';
import { useAddresses } from '../../hooks/useAddresses';
import { showSuccess, showError, showInfo } from '../../lib/utils/toast';
import { Loader2, CloseIcon, TrashIcon } from '../../components/icons';
import { MapPin, Search, X } from 'lucide-react';
import { CartItem, CartItemDetails, CakeType } from '../../types';
import { CakeGenieAddress } from '../../lib/database.types';
import { CartSkeleton } from '../../components/LoadingSkeletons';
import { CITIES_AND_BARANGAYS } from '../../constants';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import DetailItem from '../../components/UI/DetailItem';
import { createOrderFromCart, getAvailableDeliveryDates, getBlockedDatesInRange, AvailableDate, BlockedDateInfo } from '../../services/supabaseService';
import { createXenditPayment } from '../../services/xenditService';
import AddressForm, { StaticMap } from '../../components/AddressForm';
import { useGoogleMapsLoader } from '../../contexts/GoogleMapsLoaderContext';
import { calculateCartAvailability, AvailabilityType } from '../../lib/utils/availability';
import CartItemCard from '../../components/CartItemCard';
import { useQuery } from '@tanstack/react-query';
import { useAvailabilitySettings } from '../../hooks/useAvailabilitySettings';
import { validateDiscountCode, getUserDiscountCodes } from '../../services/discountService';
import type { DiscountValidationResult } from '../../types';
import { useCanonicalUrl } from '../../hooks';


// FIX: Declare the global 'google' object to satisfy TypeScript.
declare const google: any;

interface CartPageProps {
  pendingItems: CartItem[];
  isLoading: boolean;
  onRemoveItem: (id: string) => void;
  onClose: () => void;
  onContinueShopping: () => void;
  onAuthRequired: () => void;
}

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


const CartPage: React.FC<CartPageProps> = ({ pendingItems, isLoading: isCartLoading, onRemoveItem, onClose, onContinueShopping, onAuthRequired }) => {
    // Add canonical URL for SEO
    useCanonicalUrl('/cart');
    
    const { user } = useAuth();
    const isRegisteredUser = !!(user && !user.is_anonymous);
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
    } = useCartActions();
    
    const { data: savedAddresses = [], isLoading: isAddressesLoading } = useAddresses(user?.id);
    const { settings: availabilitySettings, loading: isLoadingSettings } = useAvailabilitySettings();

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
        }));
        return [...pendingItems, ...mappedSupabaseItems];
    }, [pendingItems, cartItems]);
    
    const [isAddingAddress, setIsAddingAddress] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [isCreatingPayment, setIsCreatingPayment] = useState(false);
    const [partiallyBlockedSlots, setPartiallyBlockedSlots] = useState<BlockedDateInfo[]>([]);
    const [tooltip, setTooltip] = useState<{ date: string; reason: string; } | null>(null);

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
          if(!options?.silent) { showSuccess(result.message || 'Discount applied!'); }
        } else {
          setAppliedDiscount(null);
          batchRemoveFromLocalStorage('cart_applied_discount');
          if(!options?.silent) { showError(result.message || 'Invalid discount code'); }
        }
    }, [discountCode, subtotal, appliedDiscount, handleRemoveDiscount]);
    
    const { 
      isLoaded: isMapsLoaded, 
      loadError: mapsLoadError 
    } = useGoogleMapsLoader();

    useEffect(() => {
        if (mapsLoadError) {
            showError('Could not load map services. Please refresh the page.');
            console.error('Google Maps Load Error:', mapsLoadError);
        }
    }, [mapsLoadError]);

    const deliveryFee = 150;
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

            if (diffDays >= 0 && diffDays < leadTimeDays) {
                const isFullyBlockedByBackend = !dateInfo.is_rush_available && !dateInfo.is_same_day_available && !dateInfo.is_standard_available;
                if (isFullyBlockedByBackend && diffDays > 0) {
                    return { ...dateInfo, is_rush_available: true, is_same_day_available: true };
                }
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
    
    const selectedAddress = useMemo(() => {
        return isRegisteredUser && selectedAddressId ? savedAddresses.find(a => a.address_id === selectedAddressId) : null;
    }, [isRegisteredUser, selectedAddressId, savedAddresses]);

    const handleNewAddressSuccess = (newAddress?: CakeGenieAddress) => {
        if (newAddress) {
            setSelectedAddressId(newAddress.address_id);
        }
        setIsAddingAddress(false);
    };

    const handleSubmitOrder = async () => {
        if (!isRegisteredUser) {
            showError('Please sign in or create an account to place an order.');
            onAuthRequired();
            return;
        }
        try {
          if (!selectedAddress) {
            showError('Please select a delivery address');
            return;
          }
          if (!eventDate || !eventTime) {
            showError('Please select delivery date and time');
            return;
          }
      
          setIsPlacingOrder(true);
          
          const orderResult = await createOrderFromCart({
            cartItems,
            eventDate,
            eventTime,
            deliveryInstructions,
            deliveryAddressId: selectedAddressId,
            discountAmount: appliedDiscount?.discountAmount,
            discountCodeId: appliedDiscount?.codeId,
          });
      
          if (!orderResult.success || !orderResult.order) {
            throw new Error(orderResult.error?.message || 'Failed to create order');
          }
      
          const orderId = orderResult.order.order_id;
          
          showSuccess('Order created! Redirecting to payment...');
          
          const paymentItems = cartItems.map(item => ({
            name: `${item.cake_type} - ${item.cake_size}`,
            quantity: item.quantity,
            price: item.final_price,
          }));
      
          setIsCreatingPayment(true);
          
          const paymentResult = await createXenditPayment({
            orderId: orderId,
            amount: total,
            customerEmail: user?.email,
            customerName: user?.user_metadata?.first_name || user?.email?.split('@')[0],
            items: paymentItems,
          });
      
          if (paymentResult.success && paymentResult.paymentUrl) {
            clearCart();
            setAppliedDiscount(null);
            setDiscountCode('');
            window.location.href = paymentResult.paymentUrl;
          } else {
            throw new Error(paymentResult.error || 'Failed to create payment link');
          }
      
        } catch (error: any) {
          console.error('Order/Payment error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
          showError(error.message || 'Failed to process order. Please try again.');
          setIsPlacingOrder(false);
          setIsCreatingPayment(false);
        }
    };

    const inputStyle = "w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-slate-50 disabled:cursor-not-allowed";
    
    const AddressAutocomplete = ({ onPlaceSelect, initialValue }: { onPlaceSelect: (place: any) => void, initialValue: string }) => {
        const inputRef = useRef<HTMLInputElement>(null);
    
        useEffect(() => {
            if (!inputRef.current) return;
    
            const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
                componentRestrictions: { country: "ph" },
                fields: ["address_components", "geometry", "icon", "name"],
            });
    
            autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                onPlaceSelect(place);
            });
        }, [onPlaceSelect]);
    
        return (
            <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                    ref={inputRef}
                    type="text"
                    defaultValue={initialValue}
                    className={`${inputStyle} pl-10`}
                    placeholder="Search for your address..."
                />
            </div>
        );
    };

    return (
        <>
        <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
             <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-fast { animation: fadeInFast 0.2s ease-out; } @keyframes fadeInFast { from { opacity: 0; } to { opacity: 1; } }`}</style>
            
            {zoomedImage && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in-fast"
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
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">Your Cart</h1>
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Close cart">
                    <CloseIcon />
                </button>
            </div>

            {isCartLoading ? (
                <div className="py-4"><CartSkeleton count={2} /></div>
            ) : allItems.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-slate-500">Your cart is empty.</p>
                    <button onClick={onContinueShopping} className="mt-4 text-purple-600 font-semibold hover:underline">
                        Continue Shopping
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                        {allItems.map(item => (
                            <CartItemCard 
                                key={item.id}
                                item={item}
                                onRemove={onRemoveItem}
                                onZoom={setZoomedImage}
                            />
                        ))}
                    </div>

                    <div className="pt-6 border-t border-slate-200 space-y-6">
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
                                        <div className="h-16 flex items-center"><Loader2 className="animate-spin text-slate-400"/></div>
                                    ) : (
                                        <div className="relative">
                                            <div className="flex gap-2 overflow-x-auto overflow-y-visible pt-12 -mt-12 pb-2 -mb-2 scrollbar-hide">
                                                {correctedDates.slice(0, 14).map(dateInfo => {
                                                    const { isDisabled, reason } = getDateStatus(dateInfo);
                                                    const isSelected = eventDate === dateInfo.available_date;
                                                    const dateObj = new Date(dateInfo.available_date + 'T00:00:00');
                                                    const day = dateObj.toLocaleDateString('en-US', { day: 'numeric' });
                                                    const month = dateObj.toLocaleDateString('en-US', { month: 'short' });

                                                    return (
                                                        <div key={dateInfo.available_date} className="relative flex-shrink-0">
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
                                                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-[200px] px-3 py-1.5 bg-slate-800 text-white text-xs text-center font-semibold rounded-md z-10 animate-fade-in-fast shadow-lg">
                                                                    {tooltip.reason}
                                                                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
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
                                                        className={`flex-shrink-0 text-center rounded-lg p-2 border-2 transition-all duration-200
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
                            ) : isRegisteredUser ? (
                                <>
                                    {savedAddresses.length > 0 && !isAddingAddress && (
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

                                    {isAddingAddress && user ? (
                                        <div className="mt-4">
                                            <AddressForm userId={user.id} onSuccess={handleNewAddressSuccess} onCancel={() => setIsAddingAddress(false)} />
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
                                <div className="p-4 bg-slate-100 rounded-lg text-center space-y-3">
                                    <div>
                                        <p className="text-sm text-slate-600 font-medium">Please sign in to select or add a delivery address.</p>
                                        <p className="text-xs text-slate-500 mt-1">Your cart will be saved upon login.</p>
                                    </div>
                                    <button 
                                        onClick={onAuthRequired}
                                        className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold py-2 px-6 rounded-full shadow-md hover:shadow-lg transition-all text-sm"
                                    >
                                        Sign In / Create Account
                                    </button>
                                </div>
                            )}
                            
                            <div>
                                <label htmlFor="deliveryInstructions" className="block text-sm font-medium text-slate-600 mb-1">Delivery Instructions (Optional)</label>
                                <textarea id="deliveryInstructions" value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} className={inputStyle} placeholder="e.g., landmark, contact person" rows={2}></textarea>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-200 space-y-4">
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
                                    {isValidatingCode ? <Loader2 className="animate-spin w-4 h-4"/> : 'Apply'}
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

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <button onClick={onContinueShopping} className="w-full text-center bg-white border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-slate-50 transition-all text-base">
                                    Continue Shopping
                                </button>
                                <button
                                    onClick={handleSubmitOrder}
                                    disabled={isPlacingOrder || isCreatingPayment || !selectedAddress || !eventDate || !eventTime}
                                    className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-full font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
                                    `Place Order - ₱${total.toFixed(2)}`
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
    );
};

export default React.memo(CartPage);