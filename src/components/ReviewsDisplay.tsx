'use client';

import React from 'react';
import { Star, ThumbsUp } from 'lucide-react';
import { CakeGenieReview } from '@/lib/database.types';
import { getReviewAvatarInitial, getReviewDisplayName } from '@/lib/reviews';
import LazyImage from './LazyImage';

interface ReviewsDisplayProps {
  reviews: CakeGenieReview[];
  isLoading?: boolean;
  showMerchantResponse?: boolean;
  maxDisplayCount?: number;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const StarRating: React.FC<{ rating: number; size?: 'sm' | 'md' }> = ({ rating, size = 'sm' }) => {
  const starSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${starSize} ${
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-slate-200 text-slate-300'
          }`}
        />
      ))}
    </div>
  );
};

const ReviewCard: React.FC<{
  review: CakeGenieReview;
  showMerchantResponse?: boolean;
}> = ({ review, showMerchantResponse = true }) => {
  const displayName = getReviewDisplayName(review);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
            {getReviewAvatarInitial(review)}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{displayName}</p>
            <div className="flex items-center gap-2">
              <StarRating rating={review.rating} />
              <span className="text-xs text-slate-400">
                {formatDate(review.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Title */}
      {review.title && (
        <h4 className="font-semibold text-slate-800 mb-2">{review.title}</h4>
      )}

      {/* Comment */}
      {review.comment && (
        <p className="text-slate-600 text-sm leading-relaxed mb-3">
          {review.comment}
        </p>
      )}

      {/* Photos */}
      {review.photos && review.photos.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {review.photos.slice(0, 4).map((photo, index) => (
            <div
              key={index}
              className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200"
            >
              <LazyImage
                src={photo}
                alt={`Review photo ${index + 1}`}
                fill
                imageClassName="object-cover"
                sizes="80px"
              />
            </div>
          ))}
          {review.photos.length > 4 && (
            <div className="w-20 h-20 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-500">
              +{review.photos.length - 4} more
            </div>
          )}
        </div>
      )}

      {/* Merchant Response */}
      {showMerchantResponse && review.merchant_response && (
        <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50 -mx-4 px-4 py-3 rounded-b-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-xs font-bold text-purple-600">M</span>
            </div>
            <span className="text-sm font-semibold text-slate-700">Merchant Response</span>
            {review.merchant_response_at && (
              <span className="text-xs text-slate-400">
                {formatDate(review.merchant_response_at)}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 pl-8">{review.merchant_response}</p>
        </div>
      )}
    </div>
  );
};

const ReviewsDisplay: React.FC<ReviewsDisplayProps> = ({
  reviews,
  isLoading = false,
  showMerchantResponse = true,
  maxDisplayCount,
}) => {
  const displayReviews = maxDisplayCount ? reviews.slice(0, maxDisplayCount) : reviews;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-200" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="h-3 w-32 bg-slate-200 rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-slate-200 rounded" />
              <div className="h-4 w-3/4 bg-slate-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
        <Star className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500">No reviews yet</p>
        <p className="text-sm text-slate-400 mt-1">Be the first to leave a review!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {displayReviews.map((review) => (
        <ReviewCard
          key={review.review_id}
          review={review}
          showMerchantResponse={showMerchantResponse}
        />
      ))}
    </div>
  );
};

interface ReviewSummaryProps {
  averageRating: number;
  totalReviews: number;
  ratingDistribution?: { rating: number; count: number }[];
}

export const ReviewSummary: React.FC<ReviewSummaryProps> = ({
  averageRating,
  totalReviews,
  ratingDistribution,
}) => {
  return (
    <div className="flex items-center gap-6 p-4 bg-white rounded-xl border border-slate-200">
      <div className="text-center">
        <div className="text-4xl font-bold text-slate-900">
          {averageRating > 0 ? averageRating.toFixed(1) : '0'}
        </div>
        <StarRating rating={Math.round(averageRating)} size="md" />
        <p className="text-sm text-slate-500 mt-1">{totalReviews} reviews</p>
      </div>

      {ratingDistribution && ratingDistribution.length > 0 && (
        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const dist = ratingDistribution.find((d) => d.rating === star);
            const count = dist?.count || 0;
            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

            return (
              <div key={star} className="flex items-center gap-2">
                <span className="text-sm text-slate-600 w-6">{star}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReviewsDisplay;
