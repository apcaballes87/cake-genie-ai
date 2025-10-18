import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserOrders, uploadPaymentProof, getSingleOrder, cancelOrder } from '../services/supabaseService';
import { CakeGenieOrder } from '../lib/database.types';
import { showSuccess, showError } from '../lib/utils/toast';

export function useOrders(userId: string | undefined, options?: { limit?: number; offset?: number, includeItems?: boolean }) {
  return useQuery({
    queryKey: ['orders', userId, options?.limit, options?.offset],
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');
      const result = await getUserOrders(userId, options);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!userId, // Only run query if userId exists
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
  });
}

export function useOrderDetails(orderId: string | undefined, userId: string | undefined, enabled: boolean) {
    return useQuery({
        queryKey: ['order-details', orderId],
        queryFn: async () => {
            if (!userId || !orderId) throw new Error('User and Order ID required');
            const result = await getSingleOrder(orderId, userId);
            if (result.error) throw result.error;
            return result.data;
        },
        enabled: !!userId && !!orderId && enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function useUploadPaymentProof() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      orderId, 
      userId, 
      file 
    }: { 
      orderId: string; 
      userId: string; 
      file: File;
    }) => {
      const result = await uploadPaymentProof(orderId, userId, file);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate all queries related to this user's orders to refetch them
      queryClient.invalidateQueries({ queryKey: ['orders', variables.userId] });
      // Also invalidate the specific order detail query if it's cached
      queryClient.invalidateQueries({ queryKey: ['order-details', variables.orderId]});
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      orderId, 
      userId 
    }: { 
      orderId: string; 
      userId: string; 
    }) => {
      const result = await cancelOrder(orderId, userId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data, variables) => {
      showSuccess("Order has been cancelled successfully.");
      // Invalidate all queries related to this user's orders to refetch them
      queryClient.invalidateQueries({ queryKey: ['orders', variables.userId] });
      // Also invalidate the specific order detail query if it's cached
      queryClient.invalidateQueries({ queryKey: ['order-details', variables.orderId]});
    },
    onError: (err: any) => {
        showError(err.message || "Failed to cancel the order.");
    }
  });
}