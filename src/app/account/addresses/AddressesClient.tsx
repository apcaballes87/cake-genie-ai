

'use client';

import React, { useState, FormEvent, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';
import { showSuccess, showError } from '@/lib/utils/toast';
import { CakeGenieAddress } from '@/lib/database.types';
import { useAddresses, useDeleteAddress, useSetDefaultAddress } from '@/hooks/useAddresses';
import { Loader2, Trash2, Plus, MapPin, Star, Home, Building2, ArrowLeft, Pencil } from 'lucide-react';
import { AddressesSkeleton, Skeleton } from '@/components/LoadingSkeletons';
import { GOOGLE_MAPS_API_KEY } from '@/config';
import AddressForm, { StaticMap } from '@/components/AddressForm';
import MobileBottomNav from '@/components/MobileBottomNav';


// --- Address Card Component ---
interface AddressCardProps {
  address: CakeGenieAddress;
  onSetDefault: () => void;
  onDelete: () => void;
  onEdit: () => void;
  isDeleting: boolean;
  isSettingDefault: boolean;
}

const AddressCard: React.FC<AddressCardProps> = ({ address, onSetDefault, onDelete, onEdit, isDeleting, isSettingDefault }) => {
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
        <div className="shrink-0">
          {address.address_label?.toLowerCase() === 'home' ? <Home className="w-6 h-6 text-slate-400" /> :
            address.address_label?.toLowerCase() === 'work' ? <Building2 className="w-6 h-6 text-slate-400" /> :
              <MapPin className="w-6 h-6 text-slate-400" />}
        </div>
        <div className="grow">
          {address.address_label && <p className="text-sm font-bold text-slate-800">{address.address_label}</p>}
          <p className="text-sm font-semibold text-slate-600 mt-1">{address.recipient_name} &middot; {address.recipient_phone}</p>
          <p className="text-xs text-slate-500 mt-1">{address.street_address}</p>
          {address.landmark && <p className="text-xs text-slate-500 mt-1">Landmark: {address.landmark}</p>}
        </div>
      </div>
      {address.latitude && address.longitude && (
        <StaticMap latitude={address.latitude} longitude={address.longitude} />
      )}
      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
        <button
          onClick={onEdit}
          className="flex items-center justify-center text-xs font-semibold text-slate-600 hover:text-pink-600 disabled:opacity-50 transition-colors px-3 py-1.5"
        >
          <Pencil className="w-4 h-4 mr-2" />
          Edit
        </button>
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


// --- Main Page Component ---
export default function AddressesClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: addresses = [], isLoading: dataLoading, error } = useAddresses(user?.id);

  const deleteAddressMutation = useDeleteAddress();
  const setDefaultAddressMutation = useSetDefaultAddress();

  const [formState, setFormState] = useState<{ mode: 'add' | 'edit'; address?: CakeGenieAddress } | null>(null);

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
    deleteAddressMutation.mutate({ userId: user.id, addressId }, {
      onSuccess: () => showSuccess("Address deleted."),
      onError: () => showError("Failed to delete address."),
    });
  };

  const handleFormSuccess = () => {
    setFormState(null);
  };

  const pageIsLoading = authLoading || (dataLoading && !addresses.length);

  if (pageIsLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto pb-24 md:pb-8 px-4">
        <div className="flex justify-between items-center mb-6 pt-4">
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
      <div className="w-full max-w-3xl mx-auto pb-24 md:pb-8 px-4 text-center pt-4">
        <p className="text-slate-600">You must be logged in to manage your addresses.</p>
        <button onClick={() => router.push('/')} className="mt-4 text-pink-600 font-semibold hover:underline">Go Back</button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto pb-24 md:pb-8 px-4">
      <div className="flex justify-between items-center mb-6 pt-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
            <ArrowLeft />
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text whitespace-nowrap">My Addresses</h1>
        </div>
        {formState === null && (
          <button
            onClick={() => setFormState({ mode: 'add' })}
            className="flex items-center justify-center bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg shadow-lg hover:shadow-xl transition-all text-sm shrink-0"
          >
            <Plus className="w-5 h-5 sm:mr-2" />
            <span className="hidden sm:inline">Add Address</span>
          </button>
        )}
      </div>

      {formState !== null ? (
        <AddressForm
          userId={user.id}
          initialData={formState.mode === 'edit' ? formState.address : undefined}
          onSuccess={handleFormSuccess}
          onCancel={() => setFormState(null)}
        />
      ) : (
        <div className="space-y-4">
          {addresses.length > 0 ? (
            addresses.map(addr => (
              <AddressCard
                key={addr.address_id}
                address={addr}
                onSetDefault={() => handleSetDefault(addr.address_id)}
                onDelete={() => handleDelete(addr.address_id)}
                onEdit={() => setFormState({ mode: 'edit', address: addr })}
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
      <MobileBottomNav />
    </div>
  );
}
