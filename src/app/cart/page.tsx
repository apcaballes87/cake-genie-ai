import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../contexts/CartContext';
import { useAddresses, useAddAddress } from '../../hooks/useAddresses';
import { showSuccess, showError } from '../../lib/utils/toast';
import { Loader2, CloseIcon, TrashIcon } from '../../components/icons';
import { CartItem, CartItemDetails } from '../../types';
import { CakeGenieAddress } from '../../lib/database.types';
import { CartSkeleton } from '../../components/LoadingSkeletons';
import { CITIES_AND_BARANGAYS } from '../../constants';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import DetailItem from '../../components/UI/DetailItem';

interface CartPageProps {
  items: CartItem[];
  isLoading: boolean;
  onRemoveItem: (id: string) => void;
  onClose: () => void;
  onContinueShopping: () => void;
  onProceedToCheckout: () => void;
  onAuthRequired: () => void;
}

type AvailabilityType = 'rush' | 'same-day' | 'normal';

const EVENT_TIME_SLOTS_MAP: { slot: string; startHour: number; endHour: number }[] = [
    { slot: "10AM - 12NN", startHour: 10, endHour: 12 },
    { slot: "12NN - 2PM", startHour: 12, endHour: 14 },
    { slot: "2PM - 4PM", startHour: 14, endHour: 16 },
    { slot: "4PM - 6PM", startHour: 16, endHour: 18 },
    { slot: "6PM - 8PM", startHour: 18, endHour: 20 },
];
const EVENT_TIME_SLOTS = EVENT_TIME_SLOTS_MAP.map(item => item.slot);

// Determines the most restrictive availability based on items in the cart.
function getCartAvailability(items: CartItem[]): AvailabilityType {
    if (items.some(item => item.status !== 'complete')) return 'normal';

    const availabilities = items.map(item => {
        const accessories = [...item.details.mainToppers, ...item.details.supportElements];
        const hasGumpaste = accessories.some(acc => ['gumpaste', 'figure', 'fondant figure', 'sculpted', 'hand-made'].some(kw => acc.toLowerCase().includes(kw)));
        if (hasGumpaste) return 'normal';
        
        const hasPrintout = accessories.some(acc => ['printout', 'edible image', 'photo topper'].some(kw => acc.toLowerCase().includes(kw)));
        if (hasPrintout) return 'same-day';

        const isComplexIcing = item.details.icingDesign.drip || Object.keys(item.details.icingDesign.colors).length > 2;
        const hasManyAccessories = accessories.length > 1;

        if (isComplexIcing || hasManyAccessories) return 'same-day';
        
        return 'rush';
    });

    if (availabilities.includes('normal')) return 'normal';
    if (availabilities.includes('same-day')) return 'same-day';
    return 'rush';
}


const CartPage: React.FC<CartPageProps> = ({ items, isLoading, onRemoveItem, onClose, onContinueShopping, onProceedToCheckout, onAuthRequired }) => {
    const { user } = useAuth();
    const isRegisteredUser = user && !user.is_anonymous;
    const { 
      setDeliveryDetails, 
      eventDate, setEventDate, 
      eventTime, setEventTime,
      deliveryInstructions, setDeliveryInstructions,
      selectedAddressId, setSelectedAddressId
    } = useCart();
    const { data: savedAddresses = [], isLoading: isAddressesLoading } = useAddresses(user?.id);
    const addAddressMutation = useAddAddress();
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const subtotal = items.reduce((acc, item) => item.status === 'complete' ? acc + item.totalPrice : acc, 0);
    const deliveryFee = 150;
    const total = subtotal + deliveryFee;

    // --- Delivery Details State ---
    const [showNewAddressForm, setShowNewAddressForm] = useState(false);
    
    // Form fields for "Add New Address" form for LOGGED IN users
    const [newRecipientName, setNewRecipientName] = useState('');
    const [newRecipientPhone, setNewRecipientPhone] = useState('');
    const [newStreetAddress, setNewStreetAddress] = useState('');
    const [newCity, setNewCity] = useState('');
    const [newBarangay, setNewBarangay] = useState('');
    const [newLandmark, setNewLandmark] = useState('');

    const cartAvailability = useMemo(() => {
        if (isLoading || items.length === 0) return 'normal';
        return getCartAvailability(items);
    }, [items, isLoading]);

    const { minDate, disabledSlots } = useMemo(() => {
        const now = new Date();
        let calculatedMinDate = new Date();
        let readyTime: Date | null = null;
        
        const lastSlotEndHour = EVENT_TIME_SLOTS_MAP.length > 0 ? EVENT_TIME_SLOTS_MAP[EVENT_TIME_SLOTS_MAP.length - 1].endHour : 24;

        switch(cartAvailability) {
            case 'normal':
                calculatedMinDate.setDate(now.getDate() + 2);
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
        const todayString = new Date().toISOString().split('T')[0];
        const newDisabledSlots: string[] = [];
        
        if (eventDate === todayString && readyTime) {
            EVENT_TIME_SLOTS_MAP.forEach(timeSlot => {
                const slotEndDate = new Date(eventDate);
                slotEndDate.setHours(timeSlot.endHour, 0, 0, 0);

                if (slotEndDate < readyTime) {
                    newDisabledSlots.push(timeSlot.slot);
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
    
    // Effect to manage address selection and form visibility
    useEffect(() => {
        if (isRegisteredUser && !isAddressesLoading) {
            const persistedIdIsValid = savedAddresses.some(addr => addr.address_id === selectedAddressId);
            
            if (persistedIdIsValid) {
                // All good
            } else if (savedAddresses.length > 0) {
                const defaultAddress = savedAddresses.find(addr => addr.is_default);
                setSelectedAddressId(defaultAddress ? defaultAddress.address_id : savedAddresses[0].address_id);
            } else {
                setShowNewAddressForm(true);
            }
        }
    }, [isRegisteredUser, savedAddresses, isAddressesLoading, selectedAddressId, setSelectedAddressId]);
    
    const selectedAddress = useMemo(() => {
        return isRegisteredUser && selectedAddressId ? savedAddresses.find(a => a.address_id === selectedAddressId) : null;
    }, [isRegisteredUser, selectedAddressId, savedAddresses]);

    const handleSaveAddress = async () => {
        if (!isRegisteredUser || !newRecipientName || !newRecipientPhone || !newStreetAddress || !newCity) {
            showError("Please fill in all required address fields.");
            return;
        }
        
        const newAddressData: Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'> = {
            recipient_name: newRecipientName,
            recipient_phone: newRecipientPhone,
            street_address: newStreetAddress,
            barangay: newBarangay || null,
            city: newCity,
            province: 'Cebu',
            postal_code: null,
            address_label: '',
            landmark: newLandmark || null,
            is_default: savedAddresses.length === 0,
            country: 'Philippines',
        };

        addAddressMutation.mutate({ userId: user.id, addressData: newAddressData }, {
            onSuccess: (newAddress) => {
                showSuccess("Address saved successfully!");
                if (newAddress) {
                    setSelectedAddressId(newAddress.address_id);
                }
                setShowNewAddressForm(false);
            },
            onError: (error: any) => {
                showError(error.message || "Failed to save address.");
            }
        });
    };
    
    const handleProceedToCheckout = () => {
      if (!eventDate || !eventTime) {
        showError('Please select event date and time.');
        return;
      }
      
      if (isRegisteredUser) {
        if (!selectedAddress) {
          showError('Please select or add a delivery address.');
          return;
        }
        setDeliveryDetails({
            eventDate,
            eventTime,
            addressId: selectedAddress.address_id,
            addressData: selectedAddress,
            deliveryInstructions,
        });
        onProceedToCheckout();
      } else {
        showError('Please sign in or create an account to proceed.');
        onAuthRequired();
      }
    };

    const inputStyle = "w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-slate-50 disabled:cursor-not-allowed";
    
    const renderNewUserAddressForm = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="newRecipientName" className="block text-sm font-medium text-slate-600 mb-1">Recipient Name <span className="text-red-500">*</span></label>
                    <input type="text" id="newRecipientName" value={newRecipientName} onChange={(e) => setNewRecipientName(e.target.value)} className={inputStyle} />
                </div>
                <div>
                    <label htmlFor="newRecipientPhone" className="block text-sm font-medium text-slate-600 mb-1">Phone Number <span className="text-red-500">*</span></label>
                    <input type="text" id="newRecipientPhone" value={newRecipientPhone} onChange={(e) => setNewRecipientPhone(e.target.value)} className={inputStyle} />
                </div>
            </div>
            <div>
                <label htmlFor="newDeliveryAddress" className="block text-sm font-medium text-slate-600 mb-1">House No. / Street / Subdivision <span className="text-red-500">*</span></label>
                <input type="text" id="newDeliveryAddress" value={newStreetAddress} onChange={(e) => setNewStreetAddress(e.target.value)} className={inputStyle} placeholder="e.g., 123 Flower St., Happy Village" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">City & Barangay <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <select id="newCity" value={newCity} onChange={(e) => { setNewCity(e.target.value); setNewBarangay(''); }} className={inputStyle}>
                            <option value="">Select City</option>
                            {Object.keys(CITIES_AND_BARANGAYS).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <select id="newBarangay" value={newBarangay} onChange={(e) => setNewBarangay(e.target.value)} className={inputStyle} disabled={!newCity}>
                            <option value="">Select Barangay</option>
                            {newCity && CITIES_AND_BARANGAYS[newCity as keyof typeof CITIES_AND_BARANGAYS]?.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                </div>
            </div>
            <div>
                <label htmlFor="newLandmark" className="block text-sm font-medium text-slate-600 mb-1">Landmark (Optional)</label>
                <input type="text" id="newLandmark" value={newLandmark} onChange={(e) => setNewLandmark(e.target.value)} className={inputStyle} />
            </div>
            <div className="flex justify-end gap-2">
                {showNewAddressForm && savedAddresses.length > 0 && (
                    <button onClick={() => setShowNewAddressForm(false)} className="text-sm font-semibold text-slate-600 px-4 py-2 rounded-md hover:bg-slate-100">Cancel</button>
                )}
                <button onClick={handleSaveAddress} disabled={addAddressMutation.isPending} className="flex items-center justify-center text-sm font-semibold bg-pink-100 text-pink-700 px-4 py-2 rounded-md hover:bg-pink-200 disabled:opacity-50">
                    {addAddressMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save New Address
                </button>
            </div>
        </div>
    );
    
    return (
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

            {isLoading ? (
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
                                               {item.details.mainToppers.length > 0 && <DetailItem label="Main Toppers" value={item.details.mainToppers.join(', ')} />}
                                               {item.details.supportElements.length > 0 && <DetailItem label="Support" value={item.details.supportElements.join(', ')} />}
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
                                       {item.details.mainToppers.length > 0 && <DetailItem label="Main Toppers" value={item.details.mainToppers.join(', ')} />}
                                       {item.details.supportElements.length > 0 && <DetailItem label="Support" value={item.details.supportElements.join(', ')} />}
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
                            
                            {cartAvailability === 'normal' && <p className="text-xs text-slate-500 -mt-2">Your cart contains items requiring at least 2 days lead time.</p>}
                            {cartAvailability === 'same-day' && <p className="text-xs text-slate-500 -mt-2">Your cart contains items available for same-day delivery (3-hour lead time).</p>}
                            {cartAvailability === 'rush' && <p className="text-xs text-slate-500 -mt-2">All items in your cart are available for rush delivery (30-min lead time).</p>}

                            
                            {isAddressesLoading ? (
                                <div className="flex justify-center items-center h-24"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
                            ) : isRegisteredUser ? (
                                savedAddresses.length > 0 && !showNewAddressForm ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="addressSelect" className="block text-sm font-medium text-slate-600 mb-1">Delivery Address</label>
                                            <select 
                                                id="addressSelect" 
                                                value={selectedAddressId}
                                                onChange={(e) => {
                                                    if (e.target.value === 'add_new') {
                                                        setShowNewAddressForm(true);
                                                        setSelectedAddressId('');
                                                        // Clear fields for new entry
                                                        setNewRecipientName(''); setNewRecipientPhone(''); setNewStreetAddress(''); setNewCity(''); setNewBarangay(''); setNewLandmark('');
                                                    } else {
                                                        setSelectedAddressId(e.target.value);
                                                    }
                                                }}
                                                className={inputStyle}
                                            >
                                                <option value="" disabled>-- Select a saved address --</option>
                                                {savedAddresses.map(addr => (
                                                    <option key={addr.address_id} value={addr.address_id}>
                                                        {addr.address_label ? `${addr.address_label} (${addr.street_address})` : addr.street_address}
                                                    </option>
                                                ))}
                                                <option value="add_new">+ Add a new address</option>
                                            </select>
                                        </div>
                                        {selectedAddress && (
                                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                                                <p className="font-semibold text-slate-700">{selectedAddress.recipient_name}</p>
                                                <p className="text-slate-500">{selectedAddress.recipient_phone}</p>
                                                <p className="text-slate-500 mt-1">{[selectedAddress.street_address, selectedAddress.barangay, selectedAddress.city].filter(Boolean).join(', ')}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    renderNewUserAddressForm()
                                )
                            ) : (
                                <div className="p-4 bg-slate-100 rounded-lg text-center">
                                    <p className="text-sm text-slate-600 font-medium">Please sign in to add a delivery address.</p>
                                    <p className="text-xs text-slate-500 mt-1">Your cart will be saved.</p>
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
                            
                            <p className="text-xs text-center text-slate-500 pt-1">
                                For the safety of your cake, all deliveries are made via <strong>Lalamove Car</strong> to ensure it arrives in perfect condition.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button onClick={onContinueShopping} className="w-full text-center bg-white border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-slate-50 transition-all text-base">
                                    Continue Shopping
                                </button>
                                <button onClick={handleProceedToCheckout} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base">
                                    Proceed to Checkout
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(CartPage);
