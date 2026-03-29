'use client';

import { CakeGenieReview } from '@/lib/database.types';
import { Star } from 'lucide-react';

interface ReviewCardProps {
  review: CakeGenieReview;
  showMerchantResponse?: boolean;
  onRespond?: (reviewId: string) => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

export function ReviewCard({ review, showMerchantResponse = true, onRespond }: ReviewCardProps) {
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {renderStars(review.rating)}
            <span className="text-sm font-medium text-gray-900">
              {review.rating}/5
            </span>
          </div>
          
          {review.title && (
            <h4 className="font-medium text-gray-900 text-sm mb-1">
              {review.title}
            </h4>
          )}
          
          <p className="text-gray-600 text-sm mb-2">{review.comment}</p>

          {review.photos && review.photos.length > 0 && (
            <div className="flex gap-2 mb-2">
              {review.photos.map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`Review photo ${index + 1}`}
                  className="w-20 h-20 object-cover rounded-md"
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-500">
            {review.user?.first_name && (
              <span className="font-medium text-gray-700">
                {review.user.first_name}
              </span>
            )}
            <span>•</span>
            <time dateTime={review.created_at}>
              {review.created_at
                ? formatDate(review.created_at)
                : 'Recently'}
            </time>
          </div>
        </div>

        {onRespond && !review.merchant_response && (
          <button
            onClick={() => onRespond(review.review_id)}
            className="text-sm text-pink-600 hover:text-pink-700"
          >
            Respond
          </button>
        )}
      </div>

      {showMerchantResponse && review.merchant_response && (
        <div className="mt-3 pl-4 border-l-2 border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-1">Merchant Response</p>
          <p className="text-sm text-gray-600">{review.merchant_response}</p>
          {review.merchant_response_at && (
            <p className="text-xs text-gray-400 mt-1">
              {formatDate(review.merchant_response_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
