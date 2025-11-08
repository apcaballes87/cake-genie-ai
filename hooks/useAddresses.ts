


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getUserAddresses, 
  addAddress, 
  deleteAddress, 
  setDefaultAddress,
  updateAddress,
} from '../services/supabaseService';
import { CakeGenieAddress } from '../lib/database.types';

export function useAddresses(userId: string | undefined) {
  return useQuery({
    queryKey: ['addresses', userId],
    queryFn: async () => {
      if (!userId) return []; // Return empty array if no user
      const result = await getUserAddresses(userId);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAddAddress() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, addressData }: { userId: string; addressData: Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'>}) => {
      const result = await addAddress(userId, addressData);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.user_id) {
        queryClient.invalidateQueries({ queryKey: ['addresses', data.user_id] });
      }
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, addressId, addressData }: { userId: string; addressId: string; addressData: Partial<Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'>>}) => {
      const result = await updateAddress(userId, addressId, addressData);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.user_id) {
        queryClient.invalidateQueries({ queryKey: ['addresses', data.user_id] });
      }
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, addressId }: { userId: string; addressId: string }) => {
      const result = await deleteAddress(addressId);
      if (result.error) throw result.error;
      // FIX: `result.data` is null, so it cannot be spread. Return it directly.
      // The `userId` is available in `variables` in `onSuccess`.
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['addresses', variables.userId] });
    },
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, addressId }: { userId: string; addressId: string }) => {
      const result = await setDefaultAddress(addressId, userId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['addresses', variables.userId] });
    },
  });
}