'use client';

import React, { useState, FormEvent, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAddAddress, useUpdateAddress } from '@/hooks/useAddresses';
import { showSuccess, showError } from '@/lib/utils/toast';
import { CakeGenieAddress } from '@/lib/database.types';
import { Loader2, MapPin, X, AlertTriangle } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY } from '@/config';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMapsLoader, GoogleMapsLoaderProvider } from '@/contexts/GoogleMapsLoaderContext';
import { CITIES_AND_BARANGAYS } from '@/constants';
import LazyImage from './LazyImage';

declare const google: any;

// --- Static Map Component ---
export const StaticMap: React.FC<{ latitude: number; longitude: number }> = ({ latitude, longitude }) => {
    if (!GOOGLE_MAPS_API_KEY || !latitude || !longitude) return null;
    const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=300x150&markers=color:0xf472b6%7C${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
    const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    return (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block mt-4 rounded-lg overflow-hidden border border-purple-100 hover:border-purple-300 hover:shadow-md transition-all group">
            <LazyImage 
                src={imageUrl} 
                alt="Map location" 
                width={300} 
                height={150} 
                className="w-full h-auto object-cover" 
                onError={(e) => {
                    // Log or handle specific map loading error if needed
                }}
            />
            <div className="flex flex-col items-center justify-center gap-1.5 py-2 bg-purple-50/60 group-hover:bg-purple-50 transition-colors">
                <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 genie-icon" />
                    <span className="text-xs font-medium text-purple-600">Open in Google Maps</span>
                </div>
            </div>
        </a>
    );
};

const SERVICEABLE_AREAS = [
    'Cebu City', 'Mandaue City', 'Talisay City', 'Lapu-Lapu City', 'Cordova', 'Liloan',
    'Mandaue', 'Talisay', 'Lapu-lapu', 'Consolacion'
];

// Approximate city-center coordinates for manual address mode (when Google Maps is unavailable)
const CITY_CENTER_COORDS: Record<string, { lat: number; lng: number }> = {
    'Cebu City': { lat: 10.3157, lng: 123.8854 },
    'Mandaue City': { lat: 10.3236, lng: 123.9223 },
    'Talisay City': { lat: 10.2447, lng: 123.8494 },
    'Lapu-lapu City': { lat: 10.3103, lng: 123.9494 },
    'Cordova': { lat: 10.2546, lng: 123.9528 },
    'Liloan': { lat: 10.4000, lng: 123.9980 },
    'Consolacion': { lat: 10.3770, lng: 123.9617 },
};

const checkServiceability = (components: any[]): { isServiceable: boolean; city: string | null } => {
    if (!components) return { isServiceable: false, city: null };

    let detectedCity: string | null = null;

    for (const c of components) {
        if (c.types.includes('locality') || c.types.includes('administrative_area_level_2')) {
            const name = c.long_name;
            if (!name) continue;
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
    const { isLoaded, loadError } = useGoogleMapsLoader();

    const [map, setMap] = useState<any | null>(null);
    const [center, setCenter] = useState(initialCoords || { lat: 10.3157, lng: 123.8854 });
    const [completeAddress, setCompleteAddress] = useState(''); // User-controlled input
    const [suggestedAddress, setSuggestedAddress] = useState(''); // Geocoding output
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [isServiceable, setIsServiceable] = useState(true);
    const [detectedCity, setDetectedCity] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const autocompleteElementRef = useRef<any | null>(null);
    const autocompleteContainerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const mapRef = useRef<any | null>(null);

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

    // Reset autocomplete ref when modal closes so it re-initializes on next open
    useEffect(() => {
        if (!isOpen) {
            autocompleteElementRef.current = null;
        }
    }, [isOpen]);

    useEffect(() => {
        if (isLoaded && inputRef.current && map && !autocompleteElementRef.current) {
            try {
                if (!window.google?.maps?.places) return;

                // Bias results within 15km of Cebu City center
                const cebuCityCenter = new window.google.maps.LatLng(10.3157, 123.8854);
                const cebuCircle = new window.google.maps.Circle({
                    center: cebuCityCenter,
                    radius: 15000, // 15km
                });

                const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
                    componentRestrictions: { country: 'ph' },
                    bounds: cebuCircle.getBounds(),
                    strictBounds: true,
                });

                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    const currentMap = mapRef.current;
                    if (place?.geometry?.location && currentMap) {
                        currentMap.panTo(place.geometry.location);
                        currentMap.setZoom(17);
                        if (place.formatted_address) {
                            setCompleteAddress(place.formatted_address);
                            setSuggestedAddress(place.formatted_address);
                        }
                        if (place.address_components) {
                            const { isServiceable: isAllowed, city } = checkServiceability(place.address_components);
                            setIsServiceable(isAllowed);
                            setDetectedCity(city);
                        }
                    }
                });

                autocompleteElementRef.current = autocomplete;
            } catch (err) {
                console.error('Failed to initialize Places Autocomplete:', err);
            }
        }
    }, [isLoaded, map]);

    const handleSubmit = () => {
        if (!completeAddress.trim()) {
            showError("Please enter your complete address.");
            return;
        }

        // Fallback mode: Google Maps didn't load, so accept the typed address
        // with default Cebu City coordinates.
        if (loadError || !map) {
            onLocationSelect({
                latitude: 10.3157,
                longitude: 123.8854,
                street_address: completeAddress.trim(),
                city: detectedCity || 'Cebu City',
            });
            return;
        }

        const finalCenter = map.getCenter();
        if (finalCenter) {
            onLocationSelect({
                latitude: finalCenter.lat(),
                longitude: finalCenter.lng(),
                street_address: completeAddress.trim(),
                city: detectedCity,
            });
        } else {
            showError("Could not determine map location. Please try again.");
        }
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-9999 flex items-center justify-center p-4" onClick={onClose}>

            <div className="genie-card rounded-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-purple-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Set Delivery Location</h3>
                    <button onClick={onClose} className="p-2 genie-icon-button rounded-full transition-colors"><X size={20} /></button>
                </div>
                <div className="grow relative">
                    {loadError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                                <MapPin className="text-red-400 w-8 h-8" />
                            </div>
                            <h4 className="text-slate-800 font-bold mb-2">Map service unavailable</h4>
                            <p className="text-slate-500 text-sm max-w-xs mb-6">
                                We&apos;re having trouble connecting to Google Maps. You can still enter your address manually below.
                            </p>
                            <button 
                                onClick={onClose}
                                className="genie-btn-secondary px-6 py-2 rounded-full text-sm font-medium"
                            >
                                Enter address manually
                            </button>
                        </div>
                    ) : !isLoaded ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-purple-50"><Loader2 className="animate-spin genie-icon w-8 h-8" /></div>
                    ) : (
                        <>
                            <GoogleMap
                                mapContainerStyle={{ width: '100%', height: '100%' }}
                                center={center}
                                zoom={15}
                                onLoad={(m) => { setMap(m); mapRef.current = m; }}
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
                                <MapPin className="genie-icon w-12 h-12 drop-shadow-lg" fill="currentColor" strokeWidth={1.5} />
                            </div>
                            <div className="absolute top-4 left-0 right-0 flex justify-center px-4 pointer-events-none z-10">
                                <div className="relative w-full max-w-lg pointer-events-auto">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        name="map-search-field"
                                        placeholder="Search for a building or street..."
                                        autoComplete="new-password"
                                        data-lpignore="true"
                                        data-1p-ignore
                                        data-form-type="other"
                                        className="w-full px-4 py-3 bg-white rounded-full shadow-lg border border-purple-200 focus:ring-2 focus:ring-purple-200 focus:border-purple-400 focus:outline-none text-sm"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div className="p-4 bg-purple-50/70 border-t border-purple-100">
                    <label htmlFor="completeAddress" className="block text-sm font-medium text-slate-600 mb-1">Complete Address (Unit No., Building, Street) <span className="text-red-500">*</span></label>
                    <textarea
                        id="completeAddress"
                        value={completeAddress}
                        onChange={e => setCompleteAddress(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-purple-200 rounded-md shadow-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                        rows={3}
                        placeholder="e.g., Unit 5B, The Padgett Place, Molave St..."
                        required
                    />
                    <div className="mt-1 min-h-8">
                        {suggestedAddress && !isGeocoding && (
                            <div className={`text-xs p-2 rounded-md ${isServiceable ? 'text-purple-700 bg-purple-100/70' : 'text-red-600 bg-red-50 border border-red-200'}`}>
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
                        disabled={!completeAddress.trim() || isGeocoding || (!loadError && !isServiceable)}
                        className="w-full mt-3 genie-btn-primary font-bold py-3 px-4 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center"
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
    const { isLoaded, loadError } = useGoogleMapsLoader();

    // Manual mode activates when Google Maps fails to load
    const isManualMode = !!loadError;

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
            // In manual mode, lat/lng are optional (we use approximate city-center coords)
            const isValid = isManualMode
                ? !!(recipientName && recipientPhone && streetAddress && city)
                : !!(recipientName && recipientPhone && streetAddress && latitude && longitude);
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
    }, [recipientName, recipientPhone, streetAddress, addressLabel, isDefault, latitude, longitude, city, isManualMode, onFormChange]);

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

        // In manual mode, validate without lat/lng
        if (isManualMode) {
            if (!recipientName || !recipientPhone || !streetAddress || !city) {
                showError("Please fill in all required fields including your city.");
                return;
            }
        } else {
            if (!recipientName || !recipientPhone || !streetAddress || !latitude || !longitude) {
                showError("Please fill in recipient details and set a location on the map.");
                return;
            }
        }

        // Use approximate city-center coords when in manual mode and no exact coords set
        const finalLatitude = latitude ?? (isManualMode && city ? (CITY_CENTER_COORDS[city]?.lat ?? null) : null);
        const finalLongitude = longitude ?? (isManualMode && city ? (CITY_CENTER_COORDS[city]?.lng ?? null) : null);

        const newAddressData: Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'> = {
            recipient_name: recipientName, recipient_phone: recipientPhone, street_address: streetAddress,
            barangay: '', city: city, province: 'Cebu', postal_code: '',
            address_label: addressLabel || '', landmark: null, is_default: isDefault,
            country: 'Philippines', latitude: finalLatitude, longitude: finalLongitude
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

    const inputStyle = "w-full px-3 py-2 text-sm bg-white border border-purple-200 rounded-md shadow-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:bg-slate-50";

    return (
        <div className="genie-card rounded-2xl p-6 mt-6 animate-fade-in">
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

                    {isManualMode ? (
                        /* Manual mode: city dropdown + text address (Google Maps unavailable) */
                        <>
                            <div className="flex items-center gap-2 p-2.5 mb-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>Map service is unavailable. Please enter your address manually.</span>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="manualCity" className="block text-sm font-medium text-slate-600 mb-1">City <span className="text-red-500">*</span></label>
                                <select
                                    id="manualCity"
                                    value={city}
                                    onChange={e => {
                                        const selectedCity = e.target.value;
                                        setCity(selectedCity);
                                        // Set approximate coords for delivery fee calculation
                                        const coords = CITY_CENTER_COORDS[selectedCity];
                                        if (coords) {
                                            setLatitude(coords.lat);
                                            setLongitude(coords.lng);
                                        }
                                    }}
                                    className={inputStyle}
                                    aria-label="Select your city"
                                    required
                                >
                                    <option value="">Select your city</option>
                                    {Object.keys(CITIES_AND_BARANGAYS).map(cityName => (
                                        <option key={cityName} value={cityName}>{cityName}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="manualStreetAddress" className="block text-sm font-medium text-slate-600 mb-1">Street Address <span className="text-red-500">*</span></label>
                                <textarea
                                    id="manualStreetAddress"
                                    value={streetAddress}
                                    onChange={e => setStreetAddress(e.target.value)}
                                    className={inputStyle}
                                    rows={2}
                                    placeholder="e.g., Unit 5B, The Padgett Place, Molave St, Brgy. Guadalupe"
                                    required
                                />
                            </div>
                        </>
                    ) : (
                        /* Normal mode: map picker button */
                        <>
                            <button type="button" onClick={() => setIsPickerModalOpen(true)} className={`${inputStyle} text-left`}>
                                {streetAddress ? (
                                    <div className="flex items-start gap-3">
                                        <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                                        <span className="text-slate-800">{streetAddress}</span>
                                    </div>
                                ) : (
                                    <span className="text-slate-400">Set delivery location on map</span>
                                )}
                            </button>
                            {latitude && longitude && <StaticMap latitude={latitude} longitude={longitude} />}
                        </>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="addressLabel" className="block text-sm font-medium text-slate-600 mb-1">Address Label</label>
                        <input id="addressLabel" type="text" value={addressLabel} onChange={e => setAddressLabel(e.target.value)} className={inputStyle} placeholder="e.g., Home, Work" />
                    </div>
                </div>

                <div className="flex items-center pt-2">
                    <input id="isDefault" type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="h-4 w-4 text-purple-600 border-purple-200 rounded focus:ring-purple-400" />
                    <label htmlFor="isDefault" className="ml-2 block text-sm text-slate-800">Set as default address</label>
                </div>

                {!hideActions && (
                    <div className="flex items-center justify-end gap-3 pt-4">
                        <button type="button" onClick={onCancel} className="genie-btn-secondary font-bold py-2 px-4 rounded-lg transition-all text-sm">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="genie-btn-primary flex justify-center items-center font-bold py-2 px-4 rounded-lg transition-all text-sm disabled:opacity-75">
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
