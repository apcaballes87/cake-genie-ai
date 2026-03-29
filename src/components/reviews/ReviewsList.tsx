'use client';

import { CakeGenieReview } from '@/lib/database.types';
import { ReviewCard } from './ReviewCard';
import { Loader2 } from 'lucide-react';

interface ReviewsListProps {
  reviews: CakeGenieReview[];
  loading?: boolean;
  emptyMessage?: string;
  showMerchantResponse?: boolean;
  onRespond?: (reviewId: string) => void;
}

export function ReviewsList({
  reviews,
  loading = false,
  emptyMessage = 'No reviews yet',
  showMerchantResponse = true,
  onRespond,
}: ReviewsListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <ReviewCard
          key={review.review_id}
          review={review}
          showMerchantResponse={showMerchantResponse}
          onRespond={onRespond}
        />
      ))}
    </div>
  );
}
