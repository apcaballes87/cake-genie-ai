'use client';

import React, { useState, FormEvent, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAddAddress, useUpdateAddress } from '@/hooks/useAddresses';
import { showSuccess, showError } from '@/lib/utils/toast';
import { CakeGenieAddress } from '@/lib/database.types';
import { Loader2, MapPin, X } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY } from '@/config';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMapsLoader, GoogleMapsLoaderProvider } from '@/contexts/GoogleMapsLoaderContext';
import LazyImage from './LazyImage';

declare const google: any;

// --- Static Map Component ---
export const StaticMap: React.FC<{ latitude: number; longitude: number }> = ({ latitude, longitude }) => {
    if (!GOOGLE_MAPS_API_KEY || !latitude || !longitude) return null;
    const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=300x150&markers=color:0xf472b6%7C${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
    const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    return (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block mt-4 rounded-lg overflow-hidden border border-slate-200 hover:border-pink-300 hover:shadow-md transition-all group">
            <LazyImage src={imageUrl} alt="Map location" width={300} height={150} className="w-full h-auto object-cover" />
            <div className="flex items-center justify-center gap-1.5 py-1.5 bg-slate-50 group-hover:bg-pink-50 transition-colors">
                <MapPin className="w-3 h-3 text-pink-500" />
                <span className="text-xs font-medium text-pink-600">Open in Google Maps</span>
            </div>
        </a>
    );
};

const SERVICEABLE_AREAS = [
    'Cebu City', 'Mandaue City', 'Talisay City', 'Lapu-Lapu City', 'Cordova', 'Liloan',
    'Mandaue', 'Talisay', 'Lapu-lapu', 'Consolacion'
];

const checkServiceability = (components: google.maps.GeocoderAddressComponent[]): { isServiceable: boolean; city: string | null } => {
    if (!components) return { isServiceable: false, city: null };

    let detectedCity: string | null = null;

    for (const c of components) {
        if (c.types.includes('locality') || c.types.includes('administrative_area_level_2')) {
            const name = c.long_name;
            const matchedArea = SERVICEABLE_AREAS.find(area =>
                name.toLowerCase().includes(area.toLowerCase())
            );
            if (matchedArea) {
                detectedCity = name;
                return { isServiceable: true, city: detectedCity };
            }
        }
    }

    return { isServiceable: false, city: null };
};

// --- Address Form's Map Picker Modal Component ---
const AddressPickerModal = ({ isOpen, onClose, onLocationSelect, initialCoords, initialStreetAddress }: { isOpen: boolean, onClose: () => void, onLocationSelect: (details: any) => void, initialCoords?: { lat: number, lng: number } | null, initialStreetAddress?: string | null }) => {
    const { isLoaded } = useGoogleMapsLoader();

    const [map, setMap] = useState<any | null>(null);
    const [center, setCenter] = useState(initialCoords || { lat: 10.3157, lng: 123.8854 });
    const [completeAddress, setCompleteAddress] = useState(''); // User-controlled input
    const [suggestedAddress, setSuggestedAddress] = useState(''); // Geocoding output
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [isServiceable, setIsServiceable] = useState(true);
    const [detectedCity, setDetectedCity] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const autocompleteRef = useRef<any | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen && initialStreetAddress) {
            setCompleteAddress(initialStreetAddress);
        }
    }, [isOpen, initialStreetAddress]);

    // Sync center with initialCoords when modal opens or coordinates change
    useEffect(() => {
        if (isOpen && initialCoords) {
            setCenter(initialCoords);
        }
    }, [isOpen, initialCoords]);

    const lastGeocodedLocation = useRef<{ lat: number; lng: number } | null>(null);
    const mapIdleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleReverseGeocode = useCallback((lat: number, lng: number) => {
        if (!isLoaded || !window.google) return;

        // Prevent re-geocoding the same location (approximate check)
        if (lastGeocodedLocation.current &&
            Math.abs(lastGeocodedLocation.current.lat - lat) < 0.0001 &&
            Math.abs(lastGeocodedLocation.current.lng - lng) < 0.0001) {
            return;
        }

        setIsGeocoding(true);
        try {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
                try {
                    if (status === 'OK' && results && results[0]) {
                        setSuggestedAddress(results[0].formatted_address);

                        // Check serviceability and extract city
                        const { isServiceable: isAllowed, city } = checkServiceability(results[0].address_components);
                        setIsServiceable(isAllowed);
                        setDetectedCity(city);

                        lastGeocodedLocation.current = { lat, lng };
                    } else {
                        console.error("Reverse geocoding failed:", status);
                        setSuggestedAddress('Could not determine address from map.');
                        setIsServiceable(false);
                        setDetectedCity(null);
                    }
                } catch (callbackErr) {
                    console.error('Error processing geocode result:', callbackErr);
                    setSuggestedAddress('Could not determine address from map.');
                    setIsServiceable(false);
                }
                setIsGeocoding(false);
            });
        } catch (err) {
            console.error('Geocoder initialization error:', err);
            setIsGeocoding(false);
        }
    }, [isLoaded]);

    const onMapIdle = useCallback(() => {
        if (mapIdleTimeoutRef.current) {
            clearTimeout(mapIdleTimeoutRef.current);
        }

        mapIdleTimeoutRef.current = setTimeout(() => {
            if (map) {
                const newCenter = map.getCenter();
                if (newCenter) {
                    handleReverseGeocode(newCenter.lat(), newCenter.lng());
                }
            }
        }, 1000); // 1 second debounce
    }, [map, handleReverseGeocode]);

    useEffect(() => {
        if (isLoaded && inputRef.current && map && !autocompleteRef.current) {
            try {
                // Calculate bounds based on current map center with 7km radius
                const mapCenter = map.getCenter();
                if (!mapCenter || !window.google?.maps?.places) return;

                const circle = new window.google.maps.Circle({
                    center: mapCenter,
                    radius: 7000, // 7km in meters
                });

                const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
                    componentRestrictions: { country: "ph" },
                    fields: ["address_components", "geometry", "name"],
                    bounds: circle.getBounds(),
                    strictBounds: false,
                });

                autocomplete.addListener("place_changed", () => {
                    const place = autocomplete.getPlace();
                    if (place.geometry?.location) {
                        map?.panTo(place.geometry.location);
                        map?.setZoom(17);
                    }
                });

                autocompleteRef.current = autocomplete;
            } catch (err) {
                console.error('Failed to initialize Places Autocomplete:', err);
            }
        }
    }, [isLoaded, map]);

    const handleSubmit = () => {
        if (map && completeAddress.trim()) {
            const finalCenter = map.getCenter();
            if (finalCenter) {
                onLocationSelect({
                    latitude: finalCenter.lat(),
                    longitude: finalCenter.lng(),
                    street_address: completeAddress.trim(),
                    city: detectedCity,
                });
            }
        } else {
            showError("Please enter your complete address.");
        }
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={onClose}>

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Set Delivery Location</h3>
                    <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors"><X size={20} /></button>
                </div>
                <div className="flex-grow relative">
                    {!isLoaded ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-pink-500 w-8 h-8" /></div>
                    ) : (
                        <>
                            <GoogleMap
                                mapContainerStyle={{ width: '100%', height: '100%' }}
                                center={center}
                                zoom={15}
                                onLoad={setMap}
                                onIdle={onMapIdle}
                                options={{
                                    disableDefaultUI: true,
                                    zoomControl: true,
                                    mapTypeControl: false,
                                    streetViewControl: false
                                }}
                            />
                            {/* Pin marker - positioned so the pin's point is at map center */}
                            <div className="absolute top-1/2 left-1/2 pointer-events-none z-20" style={{ transform: 'translate(-50%, -100%)' }}>
                                <MapPin className="text-pink-500 w-12 h-12 drop-shadow-lg" fill="currentColor" strokeWidth={1.5} />
                            </div>
                            <div className="absolute top-4 left-0 right-0 flex justify-center px-4 pointer-events-none z-10">
                                <div className="relative w-full max-w-lg pointer-events-auto">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        placeholder="Search for a building or street..."
                                        autoComplete="off"
                                        name="map-search-no-autofill"
                                        aria-autocomplete="none"
                                        className="w-full px-4 py-3 bg-white rounded-full shadow-lg border border-slate-300 focus:ring-2 focus:ring-pink-500 focus:outline-none text-sm"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <label htmlFor="completeAddress" className="block text-sm font-medium text-slate-600 mb-1">Complete Address (Unit No., Building, Street) <span className="text-red-500">*</span></label>
                    <textarea
                        id="completeAddress"
                        value={completeAddress}
                        onChange={e => setCompleteAddress(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
                        rows={3}
                        placeholder="e.g., Unit 5B, The Padgett Place, Molave St..."
                        required
                    />
                    <div className="mt-1 min-h-[2rem]">
                        {suggestedAddress && !isGeocoding && (
                            <div className={`text-xs p-2 rounded-md ${isServiceable ? 'text-slate-500 bg-slate-100' : 'text-red-600 bg-red-50 border border-red-200'}`}>
                                {isServiceable ? (
                                    <><strong>Suggested Location:</strong> {suggestedAddress}</>
                                ) : (
                                    <><strong>Not Serviceable Yet:</strong> We currently only deliver to Cebu City, Mandaue, Talisay, Lapu-Lapu, Cordova, and Liloan.</>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={!completeAddress.trim() || isGeocoding || !isServiceable}
                        className="w-full mt-3 bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all disabled:opacity-50 flex items-center justify-center"
                    >
                        {isGeocoding ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Locating...</> : 'Confirm Location'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- Address Form Component ---
interface AddressFormProps {
    userId: string;
    initialData?: CakeGenieAddress | null;
    onSuccess: (newAddress?: CakeGenieAddress) => void;
    onCancel: () => void;
    isGuest?: boolean;
    onFormChange?: (data: Partial<CakeGenieAddress>, isValid: boolean) => void;
    hideActions?: boolean;
}

const AddressForm: React.FC<AddressFormProps> = ({ userId, initialData, onSuccess, onCancel, isGuest = false, onFormChange, hideActions = false }) => {
    const addAddressMutation = useAddAddress();
    const updateAddressMutation = useUpdateAddress();
    const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);

    // Form state
    const [recipientName, setRecipientName] = useState('');
    const [recipientPhone, setRecipientPhone] = useState('');
    const [streetAddress, setStreetAddress] = useState('');
    const [addressLabel, setAddressLabel] = useState('');
    const [isDefault, setIsDefault] = useState(false);
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [city, setCity] = useState<string>('');

    const isEditing = !!initialData;
    const isSubmitting = addAddressMutation.isPending || updateAddressMutation.isPending;

    // Report changes to parent
    useEffect(() => {
        if (onFormChange) {
            const isValid = !!(recipientName && recipientPhone && streetAddress && latitude && longitude);
            const data: Partial<CakeGenieAddress> = {
                recipient_name: recipientName,
                recipient_phone: recipientPhone,
                street_address: streetAddress,
                address_label: addressLabel,
                is_default: isDefault,
                latitude: latitude,
                longitude: longitude,
                // Default values for required fields
                country: 'Philippines',
                province: 'Cebu',
                city: city,
                barangay: '',
                postal_code: '',
                landmark: null
            };
            onFormChange(data, isValid);
        }
    }, [recipientName, recipientPhone, streetAddress, addressLabel, isDefault, latitude, longitude, city, onFormChange]);

    useEffect(() => {
        if (initialData) {
            setRecipientName(initialData.recipient_name || '');
            setRecipientPhone(initialData.recipient_phone || '');
            setStreetAddress(initialData.street_address || '');
            setAddressLabel(initialData.address_label || '');
            setIsDefault(initialData.is_default || false);
            setLatitude(initialData.latitude || null);
            setLongitude(initialData.longitude || null);
        } else {
            // Reset for "add new" mode
            setRecipientName(''); setRecipientPhone(''); setStreetAddress('');
            setAddressLabel(''); setIsDefault(false); setLatitude(null); setLongitude(null);
        }
    }, [initialData]);

    const handleLocationSelect = useCallback((details: any) => {
        setLatitude(details.latitude);
        setLongitude(details.longitude);
        setStreetAddress(details.street_address);
        if (details.city) setCity(details.city);
        setIsPickerModalOpen(false);
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!recipientName || !recipientPhone || !streetAddress || !latitude || !longitude) {
            showError("Please fill in recipient details and set a location on the map.");
            return;
        }

        const newAddressData: Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'> = {
            recipient_name: recipientName, recipient_phone: recipientPhone, street_address: streetAddress,
            barangay: '', city: city, province: 'Cebu', postal_code: '',
            address_label: addressLabel || '', landmark: null, is_default: isDefault,
            country: 'Philippines', latitude, longitude
        };

        // GUEST MODE: Skip database save, just return the data
        if (isGuest) {
            const guestAddress: CakeGenieAddress = {
                ...newAddressData,
                address_id: `guest-${Date.now()}`, // Temporary ID
                user_id: userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            onSuccess(guestAddress);
            return;
        }

        if (isEditing && initialData) {
            updateAddressMutation.mutate({ userId, addressId: initialData.address_id, addressData: newAddressData }, {
                onSuccess: (updatedAddress) => {
                    showSuccess("Address updated successfully!");
                    onSuccess(updatedAddress ?? undefined);
                },
                onError: (error: any) => { showError(error.message || "Failed to update address."); }
            });
        } else {
            addAddressMutation.mutate({ userId, addressData: newAddressData }, {
                onSuccess: (newAddress) => {
                    if (newAddress) {
                        showSuccess("Address added successfully!");
                        onSuccess(newAddress);
                    }
                },
                onError: (error: any) => { showError(error.message || "Failed to add address."); }
            });
        }
    };

    const inputStyle = "w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500 disabled:bg-slate-50";

    return (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 mt-6 animate-fade-in">
            <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <h3 className="text-lg font-bold text-slate-800 mb-4">{isEditing ? 'Edit Address' : 'Add a New Address'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="recipientName" className="block text-sm font-medium text-slate-600 mb-1">Recipient Name <span className="text-red-500">*</span></label>
                        <input id="recipientName" type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)} className={inputStyle} required />
                    </div>
                    <div>
                        <label htmlFor="recipientPhone" className="block text-sm font-medium text-slate-600 mb-1">Phone Number <span className="text-red-500">*</span></label>
                        <input id="recipientPhone" type="tel" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} className={inputStyle} required />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Address <span className="text-red-500">*</span></label>
                    <button type="button" onClick={() => setIsPickerModalOpen(true)} className={`${inputStyle} text-left`}>
                        {streetAddress ? (
                            <div className="flex items-start gap-3">
                                <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-800">{streetAddress}</span>
                            </div>
                        ) : (
                            <span className="text-slate-400">Set delivery location on map</span>
                        )}
                    </button>
                    {latitude && longitude && <StaticMap latitude={latitude} longitude={longitude} />}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="addressLabel" className="block text-sm font-medium text-slate-600 mb-1">Address Label</label>
                        <input id="addressLabel" type="text" value={addressLabel} onChange={e => setAddressLabel(e.target.value)} className={inputStyle} placeholder="e.g., Home, Work" />
                    </div>
                </div>

                <div className="flex items-center pt-2">
                    <input id="isDefault" type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="h-4 w-4 text-pink-600 border-slate-300 rounded focus:ring-pink-500" />
                    <label htmlFor="isDefault" className="ml-2 block text-sm text-slate-800">Set as default address</label>
                </div>

                {!hideActions && (
                    <div className="flex items-center justify-end gap-3 pt-4">
                        <button type="button" onClick={onCancel} className="bg-white border border-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg shadow-sm hover:bg-slate-50 transition-all text-sm">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="flex justify-center items-center bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all text-sm disabled:opacity-75">
                            {isSubmitting && <Loader2 className="animate-spin mr-2 w-4 h-4" />}
                            {isEditing ? 'Save Changes' : 'Save Address'}
                        </button>
                    </div>
                )}
            </form>
            <AddressPickerModal
                isOpen={isPickerModalOpen}
                onClose={() => setIsPickerModalOpen(false)}
                onLocationSelect={handleLocationSelect}
                initialCoords={latitude && longitude ? { lat: latitude, lng: longitude } : null}
                initialStreetAddress={streetAddress}
            />
        </div>
    );
};

// Named export: use this when the parent already provides GoogleMapsLoaderProvider
export { AddressForm };

// Wrap the exported component with GoogleMapsLoaderProvider
// This ensures Google Maps only loads when AddressForm is actually used standalone
const AddressFormWithMaps: React.FC<AddressFormProps> = (props) => {
    return (
        <GoogleMapsLoaderProvider>
            <AddressForm {...props} />
        </GoogleMapsLoaderProvider>
    );
};

export default AddressFormWithMaps;