import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserOrders, uploadPaymentProof, getSingleOrder, cancelOrder, getBillSharingCreations } from '@/services/supabaseService';
import { CakeGenieOrder } from '@/lib/database.types';
import { showSuccess, showError } from '@/lib/utils/toast';

export function useOrders(userId: string | undefined, options?: { limit?: number; offset?: number, includeItems?: boolean }) {
  return useQuery({
    queryKey: ['creations', userId, options?.limit, options?.offset],
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');

      const [ordersResult, designsResult] = await Promise.all([
        getUserOrders(userId, options),
        // Only fetch designs on the first page load to avoid re-fetching
        (options?.offset ?? 0) === 0 ? getBillSharingCreations(userId) : Promise.resolve({ data: [], error: null }),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (designsResult.error) throw designsResult.error;

      return {
        orders: ordersResult.data?.orders || [],
        totalOrderCount: ordersResult.data?.totalCount || 0,
        designs: designsResult.data || [],
      };
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds - reduced for better freshness with pagination
    refetchOnMount: 'always', // Always refetch on mount to ensure fresh data
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
      queryClient.invalidateQueries({ queryKey: ['creations', variables.userId] });
      // Also invalidate the specific order detail query if it's cached
      queryClient.invalidateQueries({ queryKey: ['order-details', variables.orderId] });
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
      queryClient.invalidateQueries({ queryKey: ['creations', variables.userId] });
      // Also invalidate the specific order detail query if it's cached
      queryClient.invalidateQueries({ queryKey: ['order-details', variables.orderId] });
    },
    onError: (err: any) => {
      showError(err.message || "Failed to cancel the order.");
    }
  });
}
