import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../contexts/CartContext';
import { useAddresses } from '../../hooks/useAddresses';
import { showSuccess, showError } from '../../lib/utils/toast';
import { Loader2, CloseIcon, TrashIcon } from '../../components/icons';
import { MapPin, Search, X } from 'lucide-react';
import { CartItem, CartItemDetails, CakeType } from '../../types';
import { CakeGenieAddress } from '../../lib/database.types';
import { CartSkeleton } from '../../components/LoadingSkeletons';
import { CITIES_AND_BARANGAYS } from '../../constants';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import DetailItem from '../../components/UI/DetailItem';
import { createOrderFromCart } from '../../services/supabaseService';
import { createXenditPayment } from '../../services/xenditService';
import AddressForm, { StaticMap } from '../../components/AddressForm';
import { useGoogleMapsLoader } from '../../contexts/GoogleMapsLoaderContext';
import { calculateCartAvailability, AvailabilityType } from '../../lib/utils/availability';
import AvailabilityBanner from '../../components/AvailabilityBanner';


// FIX: Declare the global 'google' object to satisfy TypeScript.
declare const google: any;

interface CartPageProps {
  items: CartItem[];
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


const CartPage: React.FC<CartPageProps> = ({ items, isLoading: isCartLoading, onRemoveItem, onClose, onContinueShopping, onAuthRequired }) => {
    const { user } = useAuth();
    const isRegisteredUser = user && !user.is_anonymous;
    const { 
      cartItems,
      setDeliveryDetails, 
      eventDate, setEventDate, 
      eventTime, setEventTime,
      deliveryInstructions, setDeliveryInstructions,
      selectedAddressId, setSelectedAddressId
    } = useCart();
    
    const { data: savedAddresses = [], isLoading: isAddressesLoading } = useAddresses(user?.id);
    
    const [isAddingAddress, setIsAddingAddress] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [isCreatingPayment, setIsCreatingPayment] = useState(false);

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

    const subtotal = items.reduce((acc, item) => item.status === 'complete' ? acc + item.totalPrice : acc, 0);
    const deliveryFee = 150;
    const total = subtotal + deliveryFee;

    const cartAvailability = useMemo(() => {
        if (isCartLoading || items.length === 0) return 'normal';
        return calculateCartAvailability(items);
    }, [items, isCartLoading]);

    const { minDate, disabledSlots } = useMemo(() => {
        const now = new Date();
        let calculatedMinDate = new Date();
        let readyTime: Date | null = null;
        const newDisabledSlots: string[] = [];
    
        const lastSlotEndHour = EVENT_TIME_SLOTS_MAP.length > 0 ? EVENT_TIME_SLOTS_MAP[EVENT_TIME_SLOTS_MAP.length - 1].endHour : 24;
    
        switch (cartAvailability) {
            case 'normal':
                calculatedMinDate.setDate(now.getDate() + 1);
                break;
            case 'same-day':
                readyTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // +3 hours
                if (readyTime.getHours() >= lastSlotEndHour) {
                    calculatedMinDate.setDate(now.getDate() + 1);
                    readyTime = null;
                }
                break;
            case 'rush':
                readyTime = new Date(now.getTime() + 30 * 60 * 1000); // +30 mins
                if (readyTime.getHours() >= lastSlotEndHour) {
                    calculatedMinDate.setDate(now.getDate() + 1);
                    readyTime = null;
                }
                break;
        }
    
        const minDateString = calculatedMinDate.toISOString().split('T')[0];
        const todayString = now.toISOString().split('T')[0];
        const tomorrowString = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString().split('T')[0];
    
        if (eventDate === todayString && readyTime) {
            EVENT_TIME_SLOTS_MAP.forEach(timeSlot => {
                const slotEndDate = new Date(eventDate);
                slotEndDate.setHours(timeSlot.endHour, 0, 0, 0);
                if (slotEndDate < readyTime) {
                    newDisabledSlots.push(timeSlot.slot);
                }
            });
        }
    
        if (cartAvailability === 'normal' && eventDate === tomorrowString) {
            const currentHour = now.getHours();
            let firstAvailableStartHour = 10;
            if (currentHour >= 15) {
                firstAvailableStartHour = 18;
            } else {
                const applicableSlot = [...EVENT_TIME_SLOTS_MAP].reverse().find(slot => currentHour >= slot.startHour);
                if (applicableSlot) {
                    firstAvailableStartHour = applicableSlot.startHour;
                }
            }
            EVENT_TIME_SLOTS_MAP.forEach(slot => {
                if (slot.startHour < firstAvailableStartHour) {
                    newDisabledSlots.push(slot.slot);
                }
            });
        }
    
        return { minDate: minDateString, disabledSlots: newDisabledSlots };
    }, [cartAvailability, eventDate]);

    useEffect(() => {
        if (eventDate && eventDate < minDate) {
            setEventDate(minDate);
        }
        if (eventTime && disabledSlots.includes(eventTime)) {
            setEventTime('');
        }
    }, [minDate, disabledSlots, eventDate, eventTime, setEventDate, setEventTime]);
    
    // Effect to manage address selection
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
            ) : items.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-slate-500">Your cart is empty.</p>
                    <button onClick={onContinueShopping} className="mt-4 text-purple-600 font-semibold hover:underline">
                        Continue Shopping
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                        {items.map(item => {
                            const tierLabels = item.details.flavors.length === 2 
                                ? ['Top Tier', 'Bottom Tier'] 
                                : ['Top Tier', 'Middle Tier', 'Bottom Tier'];
                            const colorLabelMap: Record<string, string> = {
                                side: 'Side',
                                top: 'Top',
                                borderTop: 'Top Border',
                                borderBase: 'Base Border',
                                drip: 'Drip',
                                gumpasteBaseBoardColor: 'Base Board'
                            };

                            if (item.status === 'pending') {
                                return (
                                    <div key={item.id} className="flex flex-col gap-4 p-4 bg-white rounded-lg border border-slate-200">
                                        <div className="flex gap-4 w-full">
                                            <div className="relative w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-md bg-slate-100 overflow-hidden">
                                                <img 
                                                    src={item.image!} 
                                                    alt="Original cake design" 
                                                    className="absolute inset-0 w-full h-full object-cover opacity-40" 
                                                />
                                                <div className="absolute inset-0 bg-slate-900/30 flex flex-col items-center justify-center p-2">
                                                    <LoadingSpinner />
                                                    <p className="text-xs text-white font-semibold mt-2 text-center shadow-sm">Updating design...</p>
                                                </div>
                                            </div>
                                            <div className="flex-grow">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h2 className="font-semibold text-slate-800">{item.size}</h2>
                                                        <p className="text-lg font-bold text-purple-600 mt-1">₱{item.totalPrice.toLocaleString()}</p>
                                                    </div>
                                                    <button onClick={() => onRemoveItem(item.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors" aria-label="Remove item">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <details className="w-full">
                                            <summary className="text-xs font-semibold text-slate-600 cursor-pointer">View Customization Details</summary>
                                            <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-1.5 text-xs text-slate-500">
                                               <DetailItem label="Type" value={`${item.type}, ${item.thickness}, ${item.size}`} />
                                                {item.details.flavors.length === 1 ? (
                                                    <DetailItem label="Flavor" value={item.details.flavors[0]} />
                                                ) : (
                                                    item.details.flavors.map((flavor, idx) => (
                                                        <DetailItem key={idx} label={`${tierLabels[idx]} Flavor`} value={flavor} />
                                                    ))
                                                )}
                                               {item.details.mainToppers.length > 0 && <DetailItem label="Main Toppers" value={item.details.mainToppers.map(t => t.description).join(', ')} />}
                                               {item.details.supportElements.length > 0 && <DetailItem label="Support" value={item.details.supportElements.map(s => s.description).join(', ')} />}
                                               {item.details.cakeMessages.map((msg, idx) => (
                                                  <DetailItem key={idx} label={`Message #${idx+1}`} value={`'${msg.text}' (${msg.color})`} />
                                               ))}
                                               {item.details.icingDesign.drip && <DetailItem label="Icing" value="Has Drip Effect" />}
                                               {item.details.icingDesign.gumpasteBaseBoard && <DetailItem label="Icing" value="Gumpaste Base Board" />}
                                               {Object.entries(item.details.icingDesign.colors).map(([loc, color]) => (
                                                   <DetailItem key={loc} label={`${colorLabelMap[loc] || loc.charAt(0).toUpperCase() + loc.slice(1)} Color`} value={color} />
                                               ))}
                                               {item.details.additionalInstructions && <DetailItem label="Instructions" value={item.details.additionalInstructions} />}
                                            </div>
                                        </details>
                                    </div>
                                );
                            }
                            
                            if (item.status === 'error') {
                                return (
                                     <div key={item.id} className="flex flex-col gap-3 p-4 bg-red-50 rounded-lg border border-red-200 text-red-800">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">Design Update Failed</p>
                                                <p className="text-xs mt-1">{item.errorMessage}</p>
                                            </div>
                                            <button onClick={() => onRemoveItem(item.id)} className="p-1.5 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 transition-colors" aria-label="Remove item">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                             <div key={item.id} className="flex flex-col gap-4 p-4 bg-white rounded-lg border border-slate-200">
                                <div className="flex gap-4 w-full">
                                    <button
                                        type="button"
                                        onClick={() => item.image && setZoomedImage(item.image)}
                                        className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md transition-transform hover:scale-105"
                                        aria-label="Enlarge cake image"
                                    >
                                        <img src={item.image!} alt="Cake Design" className="w-full h-full object-cover rounded-md" />
                                    </button>
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h2 className="font-semibold text-slate-800">{item.size}</h2>
                                                <p className="text-lg font-bold text-purple-600 mt-1">₱{item.totalPrice.toLocaleString()}</p>
                                            </div>
                                            <button onClick={() => onRemoveItem(item.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors" aria-label="Remove item">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <details className="w-full">
                                    <summary className="text-xs font-semibold text-slate-600 cursor-pointer">View Customization Details</summary>
                                    <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-1.5 text-xs text-slate-500">
                                       <DetailItem label="Type" value={`${item.type}, ${item.thickness}, ${item.size}`} />
                                        {item.details.flavors.length === 1 ? (
                                            <DetailItem label="Flavor" value={item.details.flavors[0]} />
                                        ) : (
                                            item.details.flavors.map((flavor, idx) => (
                                                <DetailItem key={idx} label={`${tierLabels[idx]} Flavor`} value={flavor} />
                                            ))
                                        )}
                                       {item.details.mainToppers.length > 0 && <DetailItem label="Main Toppers" value={item.details.mainToppers.map(t => t.description).join(', ')} />}
                                       {item.details.supportElements.length > 0 && <DetailItem label="Support" value={item.details.supportElements.map(s => s.description).join(', ')} />}
                                       {item.details.cakeMessages.map((msg, idx) => (
                                          <DetailItem key={idx} label={`Message #${idx+1}`} value={`'${msg.text}' (${msg.color})`} />
                                       ))}
                                       {item.details.icingDesign.drip && <DetailItem label="Icing" value="Has Drip Effect" />}
                                       {item.details.icingDesign.gumpasteBaseBoard && <DetailItem label="Icing" value="Gumpaste Base Board" />}
                                       {Object.entries(item.details.icingDesign.colors).map(([loc, color]) => (
                                           <DetailItem key={loc} label={`${colorLabelMap[loc] || loc.charAt(0).toUpperCase() + loc.slice(1)} Color`} value={color} />
                                       ))}
                                       {item.details.additionalInstructions && <DetailItem label="Instructions" value={item.details.additionalInstructions} />}
                                    </div>
                                </details>
                            </div>
                        )})}
                    </div>

                    <div className="pt-6 border-t border-slate-200 space-y-6">
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-slate-700">Delivery Details</h2>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="eventDate" className="block text-sm font-medium text-slate-600 mb-1">Date of Event</label>
                                    <input type="date" id="eventDate" value={eventDate} onChange={(e) => setEventDate(e.target.value)} min={minDate} className={inputStyle} />
                                </div>
                                <div>
                                    <label htmlFor="eventTime" className="block text-sm font-medium text-slate-600 mb-1">Time of Event</label>
                                    <select id="eventTime" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className={inputStyle}>
                                        <option value="">Select a time slot</option>
                                        {EVENT_TIME_SLOTS.map(slot => (
                                            <option key={slot} value={slot} disabled={disabledSlots.includes(slot)}>
                                                {slot}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            
                            <AvailabilityBanner 
                                availability={cartAvailability} 
                                isLoading={isCartLoading} 
                                isUpdating={items.some(item => item.status === 'pending')} 
                            />

                            
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
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Subtotal</span>
                                    <span className="text-slate-800 font-semibold">₱{subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Delivery Fee</span>
                                    <span className="text-slate-800 font-semibold">₱{deliveryFee.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="border-t pt-3 mt-2">
                                <div className="flex justify-between text-lg font-bold">
                                    <span className="text-slate-800">Total</span>
                                    <span className="text-pink-600 text-xl">₱{total.toLocaleString()}</span>
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