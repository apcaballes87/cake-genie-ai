
'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { showSuccess, showError } from '../../../lib/utils/toast';
import { CakeGenieAddress } from '../../../lib/database.types';
import { useAddresses, useAddAddress, useDeleteAddress, useSetDefaultAddress } from '../../../hooks/useAddresses';
import { Loader2, Trash2, Plus, MapPin, Star, Home, Building2, CheckCircle, ArrowLeft } from 'lucide-react';
import { CITIES_AND_BARANGAYS } from '../../../constants';
import { AddressesSkeleton, Skeleton } from '../../../components/LoadingSkeletons';

// --- Address Card Component ---
interface AddressCardProps {
  address: CakeGenieAddress;
  onSetDefault: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isSettingDefault: boolean;
}

const AddressCard: React.FC<AddressCardProps> = ({ address, onSetDefault, onDelete, isDeleting, isSettingDefault }) => {
  const fullAddress = [
    address.street_address,
    address.barangay,
    address.city,
    address.province,
    address.postal_code,
  ].filter(Boolean).join(', ');

  const isDefault = address.is_default;
  const cardId = `address-card-${address.address_id}`;

  return (
    <div
      id={cardId}
      className={`relative p-5 bg-white rounded-xl border-2 transition-all duration-300 ${isDefault ? 'border-pink-500 shadow-lg' : 'border-slate-200'}`}
    >
      {isDefault && (
        <div className="absolute -top-3 -right-3 flex items-center bg-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
          <Star className="w-3 h-3 mr-1.5" fill="currentColor" />
          DEFAULT
        </div>
      )}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
            {address.address_label?.toLowerCase() === 'home' ? <Home className="w-6 h-6 text-slate-400" /> :
             address.address_label?.toLowerCase() === 'work' ? <Building2 className="w-6 h-6 text-slate-400" /> :
             <MapPin className="w-6 h-6 text-slate-400" />}
        </div>
        <div className="flex-grow">
          {address.address_label && <p className="text-sm font-bold text-slate-800">{address.address_label}</p>}
          <p className="text-sm font-semibold text-slate-600 mt-1">{address.recipient_name} &middot; {address.recipient_phone}</p>
          <p className="text-xs text-slate-500 mt-1">{fullAddress}</p>
          {address.landmark && <p className="text-xs text-slate-500 mt-1">Landmark: {address.landmark}</p>}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
        {!isDefault && (
          <button
            onClick={onSetDefault}
            disabled={isSettingDefault}
            className="flex items-center justify-center text-xs font-semibold text-slate-600 hover:text-pink-600 disabled:opacity-50 transition-colors px-3 py-1.5"
          >
             {isSettingDefault ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />}
            Set as Default
          </button>
        )}
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="flex items-center justify-center text-xs font-semibold text-slate-600 hover:text-red-600 disabled:opacity-50 transition-colors px-3 py-1.5"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
          Delete
        </button>
      </div>
    </div>
  );
};

// --- Address Form Component ---
interface AddressFormProps {
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const AddressForm: React.FC<AddressFormProps> = ({ userId, onSuccess, onCancel }) => {
    const addAddressMutation = useAddAddress();
    
    // Form state
    const [recipientName, setRecipientName] = useState('');
    const [recipientPhone, setRecipientPhone] = useState('');
    const [streetAddress, setStreetAddress] = useState('');
    const [barangay, setBarangay] = useState('');
    const [city, setCity] = useState('');
    const [addressLabel, setAddressLabel] = useState('');
    const [landmark, setLandmark] = useState('');
    const [isDefault, setIsDefault] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!recipientName || !recipientPhone || !streetAddress || !city) {
            showError("Please fill in all required fields.");
            return;
        }

        const newAddressData: Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'> = {
            recipient_name: recipientName,
            recipient_phone: recipientPhone,
            street_address: streetAddress,
            barangay: barangay || null,
            city,
            province: 'Cebu', // Hardcoded province
            postal_code: null,
            address_label: addressLabel || null,
            landmark: landmark || null,
            is_default: isDefault,
            country: 'Philippines',
        };

        addAddressMutation.mutate({ userId, addressData: newAddressData }, {
            onSuccess: () => {
                showSuccess("Address added successfully!");
                onSuccess();
            },
            onError: (error: any) => {
                 showError(error.message || "Failed to add address.");
            }
        });
    };

    const inputStyle = "w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500 disabled:bg-slate-50";

    return (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 mt-6 animate-fade-in">
             <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Add a New Address</h3>
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
                    <label htmlFor="streetAddress" className="block text-sm font-medium text-slate-600 mb-1">House No. / Street / Subdivision <span className="text-red-500">*</span></label>
                    <textarea id="streetAddress" value={streetAddress} onChange={e => setStreetAddress(e.target.value)} className={inputStyle} rows={2} required />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">City & Barangay <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <select id="city" value={city} onChange={(e) => { setCity(e.target.value); setBarangay(''); }} className={inputStyle} required>
                                <option value="">Select City</option>
                                {Object.keys(CITIES_AND_BARANGAYS).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <select id="barangay" value={barangay} onChange={(e) => setBarangay(e.target.value)} className={inputStyle} disabled={!city}>
                                <option value="">Select Barangay</option>
                                {city && CITIES_AND_BARANGAYS[city as keyof typeof CITIES_AND_BARANGAYS]?.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="addressLabel" className="block text-sm font-medium text-slate-600 mb-1">Address Label</label>
                        <input id="addressLabel" type="text" value={addressLabel} onChange={e => setAddressLabel(e.target.value)} className={inputStyle} placeholder="e.g., Home, Work" />
                    </div>
                    <div>
                        <label htmlFor="landmark" className="block text-sm font-medium text-slate-600 mb-1">Landmark</label>
                        <input id="landmark" type="text" value={landmark} onChange={e => setLandmark(e.target.value)} className={inputStyle} />
                    </div>
                </div>
                <div className="flex items-center pt-2">
                    <input id="isDefault" type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="h-4 w-4 text-pink-600 border-slate-300 rounded focus:ring-pink-500" />
                    <label htmlFor="isDefault" className="ml-2 block text-sm text-slate-800">Set as default address</label>
                </div>
                <div className="flex items-center justify-end gap-3 pt-4">
                    <button type="button" onClick={onCancel} className="bg-white border border-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg shadow-sm hover:bg-slate-50 transition-all text-sm">Cancel</button>
                    <button type="submit" disabled={addAddressMutation.isPending} className="flex justify-center items-center bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all text-sm disabled:opacity-75">
                         {addAddressMutation.isPending && <Loader2 className="animate-spin mr-2 w-4 h-4" />}
                        Save Address
                    </button>
                </div>
            </form>
        </div>
    );
};


// --- Main Page Component ---
interface AddressesPageProps {
  onClose: () => void;
}

export default function AddressesPage({ onClose }: AddressesPageProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: addresses = [], isLoading: dataLoading, error } = useAddresses(user?.id);
  
  const addAddressMutation = useAddAddress();
  const deleteAddressMutation = useDeleteAddress();
  const setDefaultAddressMutation = useSetDefaultAddress();
  
  const [showForm, setShowForm] = useState(false);
  
  useEffect(() => {
    if (error) {
        showError(error instanceof Error ? error.message : "Could not fetch addresses.");
    }
  }, [error]);

  const handleSetDefault = (addressId: string) => {
    if (!user) return;
    setDefaultAddressMutation.mutate({ userId: user.id, addressId }, {
        onSuccess: () => showSuccess("Default address updated."),
        onError: () => showError("Failed to set default address."),
    });
  };

  const handleDelete = (addressId: string) => {
    if (!user) return;
    // window.confirm is removed due to sandbox restrictions
    deleteAddressMutation.mutate({ userId: user.id, addressId }, {
        onSuccess: () => showSuccess("Address deleted."),
        onError: () => showError("Failed to delete address."),
    });
  };
  
  const handleAddressAdded = () => {
      setShowForm(false);
      // No need to manually refetch, useMutation's onSuccess handles invalidation
  };
  
  const pageIsLoading = authLoading || (dataLoading && !addresses.length);

  if (pageIsLoading) {
    return (
        <div className="w-full max-w-3xl mx-auto py-8 px-4">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-8 w-48" />
                </div>
                <Skeleton className="h-10 w-36 rounded-lg" />
            </div>
            <AddressesSkeleton count={2} />
        </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full max-w-3xl mx-auto py-8 px-4 text-center">
        <p className="text-slate-600">You must be logged in to manage your addresses.</p>
        <button onClick={onClose} className="mt-4 text-pink-600 font-semibold hover:underline">Go Back</button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                <ArrowLeft />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text whitespace-nowrap">My Addresses</h1>
        </div>
        {!showForm && (
            <button
                onClick={() => setShowForm(true)}
                className="flex items-center justify-center bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg shadow-lg hover:shadow-xl transition-all text-sm flex-shrink-0"
            >
                <Plus className="w-5 h-5 sm:mr-2" />
                <span className="hidden sm:inline">Add Address</span>
            </button>
        )}
      </div>

      {showForm ? (
        <AddressForm userId={user.id} onSuccess={handleAddressAdded} onCancel={() => setShowForm(false)} />
      ) : (
        <div className="space-y-4">
          {addresses.length > 0 ? (
            addresses.map(addr => (
              <AddressCard
                key={addr.address_id}
                address={addr}
                onSetDefault={() => handleSetDefault(addr.address_id)}
                onDelete={() => handleDelete(addr.address_id)}
                isDeleting={deleteAddressMutation.isPending && deleteAddressMutation.variables?.addressId === addr.address_id}
                isSettingDefault={setDefaultAddressMutation.isPending && setDefaultAddressMutation.variables?.addressId === addr.address_id}
              />
            ))
          ) : (
            <div className="text-center py-16 bg-white/50 rounded-2xl">
                <MapPin className="w-12 h-12 mx-auto text-slate-400" />
                <p className="text-slate-500 mt-4">You haven't added any addresses yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
