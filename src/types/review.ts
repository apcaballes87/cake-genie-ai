// src/types/review.ts
import { CakeGenieReview } from '@/lib/database.types';

export interface ReviewFormInput {
  order_id: string;
  order_item_id?: string;
  product_id?: string;
  merchant_id: string;
  rating: number;
  title?: string;
  comment?: string;
  photos?: string[];
}

export interface ReviewFilterParams {
  merchant_id?: string;
  product_id?: string;
  order_id?: string;
  order_item_id?: string;
  is_visible?: boolean;
  is_approved?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedReviewsResponse {
  reviews: CakeGenieReview[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MerchantResponseInput {
  review_id: string;
  merchant_response: string;
}

export interface ReviewStats {
  average_rating: number;
  total_reviews: number;
  rating_distribution: Record<number, number>;
}

export interface CreateReviewResponse {
  data: CakeGenieReview | null;
  error: Error | null;
}

export interface UpdateReviewResponse {
  data: CakeGenieReview | null;
  error: Error | null;
}
