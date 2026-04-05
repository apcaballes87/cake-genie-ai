import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMerchantReviews,
  getProductReviews,
  getMerchantAllReviews,
  getOrderReviews,
  submitReview,
  updateReviewModeration,
  respondToReview,
} from '@/services/supabaseService';
import { CakeGenieReview } from '@/lib/database.types';
import { showSuccess, showError } from '@/lib/utils/toast';

export function useMerchantReviews(merchantId: string | undefined, options?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['merchant-reviews', merchantId, options?.limit, options?.offset],
    queryFn: async () => {
      if (!merchantId) return [];
      const result = await getMerchantReviews(merchantId, options);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!merchantId,
    staleTime: 30 * 1000,
  });
}

export function useProductReviews(productId: string | undefined, options?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['product-reviews', productId, options?.limit, options?.offset],
    queryFn: async () => {
      if (!productId) return [];
      const result = await getProductReviews(productId, options);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!productId,
    staleTime: 30 * 1000,
  });
}

export function useOrderReviews(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order-reviews', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const result = await getOrderReviews(orderId);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!orderId,
    staleTime: 30 * 1000,
  });
}

export function useMerchantAllReviews(merchantId: string | undefined, options?: { limit?: number; offset?: number; includeUnapproved?: boolean }) {
  return useQuery({
    queryKey: ['merchant-all-reviews', merchantId, options],
    queryFn: async () => {
      if (!merchantId) return [];
      const result = await getMerchantAllReviews(merchantId, options);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!merchantId,
    staleTime: 30 * 1000,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      orderId: string;
      orderItemId?: string;
      userId: string | null;
      merchantId: string;
      productId?: string;
      rating: number;
      title?: string;
      comment?: string;
      photos?: string[];
    }) => {
      const result = await submitReview(params);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.merchant_id) {
        queryClient.invalidateQueries({ queryKey: ['merchant-reviews', data.merchant_id] });
        queryClient.invalidateQueries({ queryKey: ['merchant-all-reviews', data.merchant_id] });
      }
      showSuccess('Review submitted successfully!');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to submit review');
    },
  });
}

export function useUpdateReviewVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, merchantId, isApproved, isVisible }: {
      reviewId: string;
      merchantId: string;
      isApproved?: boolean;
      isVisible?: boolean;
    }) => {
      const result = await updateReviewModeration(reviewId, merchantId, { isApproved, isVisible });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.merchant_id) {
        queryClient.invalidateQueries({ queryKey: ['merchant-all-reviews', data.merchant_id] });
      }
      showSuccess('Review updated successfully!');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to update review');
    },
  });
}

export function useRespondToReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, merchantId, response }: {
      reviewId: string;
      merchantId: string;
      response: string;
    }) => {
      const result = await respondToReview(reviewId, merchantId, response);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.merchant_id) {
        queryClient.invalidateQueries({ queryKey: ['merchant-all-reviews', data.merchant_id] });
      }
      showSuccess('Response submitted successfully!');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to submit response');
    },
  });
}

export function useReviewStats(merchantId: string | undefined) {
  return useQuery({
    queryKey: ['merchant-all-reviews', merchantId, { limit: 1000 }],
    queryFn: async () => {
      if (!merchantId) return { average: 0, total: 0, distribution: [] };
      const result = await getMerchantAllReviews(merchantId, { limit: 1000 });
      if (result.error) throw result.error;
      
      const reviews = result.data || [];
      const total = reviews.length;
      const average = total > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;
      
      const distribution = [1, 2, 3, 4, 5].map(rating => ({
        rating,
        count: reviews.filter(r => r.rating === rating).length,
      }));
      
      return { average, total, distribution };
    },
    enabled: !!merchantId,
    staleTime: 60 * 1000,
  });
}