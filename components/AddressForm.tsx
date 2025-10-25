'use client';

import React, { useState, FormEvent, useEffect, useCallback, useRef } from 'react';
import { useAddAddress, useUpdateAddress } from '../hooks/useAddresses';
import { showSuccess, showError } from '../lib/utils/toast';
import { CakeGenieAddress } from '../lib/database.types';
import { Loader2, MapPin, Search, X, Pencil } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY } from '../config';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMapsLoader } from '../contexts/GoogleMapsLoaderContext';

declare const google: any;

// --- Static Map Component ---
export const StaticMap: React.FC<{ latitude: number; longitude: number }> = ({ latitude, longitude }) => {
  if (!GOOGLE_MAPS_API_KEY || !latitude || !longitude) return null;
  const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=300x150&markers=color:0xf472b6%7C${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
  return (
    <div className="mt-4 rounded-lg overflow-hidden border border-slate-200">
      <img src={imageUrl} alt="Map location" className="w-full h-auto object-cover" />
    </div>
  );
};

// --- Address Form's Map Picker Modal Component ---
const AddressPickerModal = ({ isOpen, onClose, onLocationSelect, initialCoords, initialStreetAddress }: { isOpen: boolean, onClose: () => void, onLocationSelect: (details: any) => void, initialCoords?: { lat: number, lng: number } | null, initialStreetAddress?: string | null }) => {
    const { isLoaded } = useGoogleMapsLoader();

    const [map, setMap] = useState<any | null>(null);
    const [center, setCenter] = useState(initialCoords || { lat: 10.3157, lng: 123.8854 });
    const [completeAddress, setCompleteAddress] = useState(''); // User-controlled input
    const [suggestedAddress, setSuggestedAddress] = useState(''); // Geocoding output
    const [isGeocoding, setIsGeocoding] = useState(false);

    const autocompleteRef = useRef<any | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    
    useEffect(() => {
        if(isOpen && initialStreetAddress) {
            setCompleteAddress(initialStreetAddress);
        }
    }, [isOpen, initialStreetAddress]);

    const handleReverseGeocode = useCallback((lat: number, lng: number) => {
        if (!isLoaded || !window.google) return;
        setIsGeocoding(true);
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                setSuggestedAddress(results[0].formatted_address);
            } else {
                console.error("Reverse geocoding failed:", status);
                setSuggestedAddress('Could not determine address from map.');
            }
            setIsGeocoding(false);
        });
    }, [isLoaded]);

    const onMapIdle = useCallback(() => {
        if (map) {
            const newCenter = map.getCenter();
            if (newCenter) {
                handleReverseGeocode(newCenter.lat(), newCenter.lng());
                // Update autocomplete bounds when user pans the map
                if (autocompleteRef.current) {
                    const circle = new google.maps.Circle({
                        center: newCenter,
                        radius: 7000, // 7km
                    });
                    autocompleteRef.current.setBounds(circle.getBounds());
                }
            }
        }
    }, [map, handleReverseGeocode]);

    useEffect(() => {
        // We need the map to be loaded to set the initial bounds for autocomplete
        if (isLoaded && inputRef.current && map && !autocompleteRef.current) {
            const circle = new google.maps.Circle({
                center: map.getCenter(),
                radius: 7000, // 7km in meters
            });
    
            const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
                // Remove 'types: ['geocode']' to allow searching for establishments (shops, places)
                componentRestrictions: { country: "ph" },
                bounds: circle.getBounds(),
                strictBounds: true, // Restrict results to within the 7km radius
            });
            autocompleteRef.current = autocomplete;
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.geometry?.location) {
                    map?.panTo(place.geometry.location);
                    map?.setZoom(17);
                }
            });
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
                });
            }
        } else {
            showError("Please enter your complete address.");
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Set Delivery Location</h3>
                    <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors"><X size={20} /></button>
                </div>
                <div className="flex-grow relative">
                    {!isLoaded ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-pink-500 w-8 h-8"/></div>
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
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none">
                                 <MapPin className="text-pink-500 w-10 h-10" fill="currentColor" />
                             </div>
                             <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-lg">
                                 <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        placeholder="Search for a building or street..."
                                        className="w-full pl-10 pr-4 py-3 bg-white rounded-full shadow-lg border border-slate-300 focus:ring-2 focus:ring-pink-500 focus:outline-none"
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
                    {suggestedAddress && !isGeocoding && (
                        <div className="text-xs text-slate-500 mt-1 p-2 bg-slate-100 rounded-md">
                            <strong>Suggested Location:</strong> {suggestedAddress}
                        </div>
                    )}
                    <button 
                        onClick={handleSubmit} 
                        disabled={!completeAddress.trim() || isGeocoding}
                        className="w-full mt-3 bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all disabled:opacity-50 flex items-center justify-center"
                    >
                         {isGeocoding ? <><Loader2 className="w-5 h-5 mr-2 animate-spin"/> Locating...</> : 'Confirm Location'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Address Form Component ---
interface AddressFormProps {
  userId: string;
  initialData?: CakeGenieAddress | null;
  onSuccess: (newAddress?: CakeGenieAddress) => void;
  onCancel: () => void;
}

const AddressForm: React.FC<AddressFormProps> = ({ userId, initialData, onSuccess, onCancel }) => {
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
    
    const isEditing = !!initialData;
    const isSubmitting = addAddressMutation.isPending || updateAddressMutation.isPending;

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
            barangay: '', city: '', province: 'Cebu', postal_code: '',
            address_label: addressLabel || null, landmark: null, is_default: isDefault,
            country: 'Philippines', latitude, longitude
        };

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
                    if(newAddress) {
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

                <div className="flex items-center justify-end gap-3 pt-4">
                    <button type="button" onClick={onCancel} className="bg-white border border-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg shadow-sm hover:bg-slate-50 transition-all text-sm">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="flex justify-center items-center bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all text-sm disabled:opacity-75">
                         {isSubmitting && <Loader2 className="animate-spin mr-2 w-4 h-4" />}
                        {isEditing ? 'Save Changes' : 'Save Address'}
                    </button>
                </div>
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

export default AddressForm;