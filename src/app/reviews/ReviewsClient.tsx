'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, Loader2 } from 'lucide-react';

interface Review {
  review_id: string;
  rating: number;
  review_title: string;
  review_text: string;
  review_photos: string[];
  is_verified: boolean;
  created_at: string;
  cakegenie_merchants?: {
    business_name: string;
  };
}

interface ReviewsClientProps {
  initialReviews?: Review[];
  error?: string | null;
}

const ReviewsClient: React.FC<ReviewsClientProps> = ({ initialReviews = [], error: initialError = null }) => {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
      <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/')} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
          <ArrowLeft />
        </button>
        <h1 className="text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">Customer Reviews</h1>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-red-500">
          {error}
        </div>
      )}

      {!loading && !error && reviews.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>No reviews yet. Be the first to share your experience!</p>
        </div>
      )}

      {!loading && !error && reviews.length > 0 && (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.review_id} className="bg-slate-50 rounded-xl p-6 border border-slate-100">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {renderStars(review.rating)}
                  <span className="text-sm font-medium text-slate-700">{review.rating}/5</span>
                </div>
                {review.is_verified && (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                    Verified Purchase
                  </span>
                )}
              </div>

              {review.review_title && (
                <h3 className="font-semibold text-slate-800 text-lg mb-2">
                  {review.review_title}
                </h3>
              )}

              <p className="text-slate-600 mb-4">{review.review_text}</p>

              {review.review_photos && review.review_photos.length > 0 && (
                <div className="flex gap-2 mb-4">
                  {review.review_photos.map((photo, idx) => (
                    <img
                      key={idx}
                      src={photo}
                      alt={`Review photo ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-sm text-slate-500">
                {review.cakegenie_merchants?.business_name && (
                  <span className="font-medium text-pink-600">
                    {review.cakegenie_merchants.business_name}
                  </span>
                )}
                <span>{formatDate(review.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (
        <p className="text-center text-slate-500 text-sm mt-8">
          Have you ordered from us? We&apos;d love to hear about your experience!
        </p>
      )}
    </div>
  );
};

export default ReviewsClient;
