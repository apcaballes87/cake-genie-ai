'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, X, ShieldCheck } from 'lucide-react';
import { LazyImage } from '@/components/LazyImage';
import { ReviewSummary } from '@/components/ReviewsDisplay';

interface Review {
  review_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  photos: string[] | null;
  user_id: string | null;
  created_at: string;
  order_id: string;
  cakegenie_merchants?: {
    business_name: string;
  };
  cakegenie_users?: {
    first_name: string | null;
    last_name: string | null;
  };
  cakegenie_order_items?: {
    cake_type: string | null;
    cake_size: string | null;
    customized_image_url: string | null;
    customization_details: Record<string, unknown> | null;
  } | null;
}

interface ReviewsClientProps {
  initialReviews?: Review[];
  error?: string | null;
}

function formatCustomerName(firstName: string | null, lastName: string | null): string {
  const cleanedFirst = firstName?.trim() || '';
  const cleanedLast = lastName?.trim() || '';

  if (!cleanedFirst && !cleanedLast) return '';
  if (cleanedFirst && cleanedLast) {
    return `${cleanedFirst.charAt(0).toUpperCase()}. ${cleanedLast}`;
  }
  if (cleanedFirst) {
    const parts = cleanedFirst.split(' ');
    if (parts.length > 1) {
      return `${parts[0].charAt(0).toUpperCase()}. ${parts.slice(1).join(' ')}`;
    }
    return `${cleanedFirst.charAt(0).toUpperCase()}.`;
  }
  return cleanedLast || '';
}

function getAvatarInitial(review: Review): string {
  const first = review.cakegenie_users?.first_name?.trim();
  const last = review.cakegenie_users?.last_name?.trim();
  return (first || last || 'C').charAt(0).toUpperCase();
}

const ReviewsClient: React.FC<ReviewsClientProps> = ({ initialReviews = [], error: initialError = null }) => {
  const router = useRouter();
  const [reviews] = useState<Review[]>(initialReviews);
  const [error] = useState<string | null>(initialError);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const ratingSummary = useMemo(() => {
    if (reviews.length === 0) return null;
    const total = reviews.length;
    const average = reviews.reduce((acc, r) => acc + r.rating, 0) / total;
    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      rating: star,
      count: reviews.filter((r) => r.rating === star).length,
    }));
    return { total, average, distribution };
  }, [reviews]);

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

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/')} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
          <ArrowLeft />
        </button>
        <div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">
            Customer Reviews
          </h1>
          {ratingSummary && (
            <p className="text-sm text-slate-500 mt-0.5">
              {ratingSummary.average.toFixed(1)} out of 5 · {ratingSummary.total} {ratingSummary.total === 1 ? 'review' : 'reviews'}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="text-center py-12 text-red-500">
          {error}
        </div>
      )}

      {!error && reviews.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>No reviews yet. Be the first to share your experience!</p>
        </div>
      )}

      {!error && reviews.length > 0 && (
        <>
          {/* Rating Summary Panel */}
          {ratingSummary && (
            <div className="mb-8">
              <ReviewSummary
                averageRating={ratingSummary.average}
                totalReviews={ratingSummary.total}
                ratingDistribution={ratingSummary.distribution}
              />
            </div>
          )}

          {/* Review Cards */}
          <div className="space-y-6">
            {reviews.map((review) => {
              const firstItem = review.cakegenie_order_items ?? null;
              const displayName = formatCustomerName(
                review.cakegenie_users?.first_name || null,
                review.cakegenie_users?.last_name || null
              );

              return (
                <div
                  key={review.review_id}
                  className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Row 1: Avatar + Name + Date */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {getAvatarInitial(review)}
                      </div>
                      <span className="font-semibold text-slate-800">
                        {displayName || 'Customer'}
                      </span>
                    </div>
                    <span className="text-sm text-slate-400">{formatDate(review.created_at)}</span>
                  </div>

                  {/* Row 2: Stars + rating + Verified badge */}
                  <div className="flex items-center gap-3 mb-3">
                    {renderStars(review.rating)}
                    <span className="text-sm font-medium text-slate-600">{review.rating}/5</span>
                    {review.user_id && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                        <ShieldCheck className="w-3 h-3" />
                        Verified Purchase
                      </span>
                    )}
                  </div>

                  {/* Row 3: Title */}
                  {review.title && (
                    <h3 className="font-bold text-slate-900 text-base mb-2">{review.title}</h3>
                  )}

                  {/* Row 4: Full comment */}
                  {review.comment && (
                    <p className="text-slate-600 leading-relaxed mb-4">{review.comment}</p>
                  )}

                  {/* Row 5: Product info */}
                  {firstItem && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                      {firstItem.customized_image_url && (
                        <button
                          type="button"
                          className="relative w-20 h-20 flex-shrink-0 overflow-hidden rounded-lg cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-pink-400"
                          onClick={() => setLightboxImage(firstItem.customized_image_url!)}
                          aria-label="View product image"
                        >
                          <LazyImage
                            src={firstItem.customized_image_url}
                            alt={firstItem.cake_type || 'Cake'}
                            fill
                            imageClassName="object-cover hover:scale-110 transition-transform duration-300"
                            sizes="80px"
                          />
                        </button>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">
                          {firstItem.cake_type ? `${firstItem.cake_type} Cake` : 'Custom Cake'}
                        </p>
                        {firstItem.cake_size && (
                          <p className="text-sm text-slate-500">{firstItem.cake_size}</p>
                        )}
                        {review.cakegenie_merchants?.business_name && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            by {review.cakegenie_merchants.business_name}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Row 6: Review photos */}
                  {review.photos && review.photos.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {review.photos.map((photo, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="relative w-20 h-20 overflow-hidden rounded-lg cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-pink-400"
                          onClick={() => setLightboxImage(photo)}
                          aria-label={`View review photo ${idx + 1}`}
                        >
                          <LazyImage
                            src={photo}
                            alt={`Review photo ${idx + 1}`}
                            fill
                            imageClassName="object-cover hover:scale-110 transition-transform duration-300"
                            sizes="80px"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!error && (
        <p className="text-center text-slate-500 text-sm mt-8">
          Have you ordered from us? We&apos;d love to hear about your experience!
        </p>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
            onClick={() => setLightboxImage(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <div className="relative max-w-4xl max-h-[90vh] w-full aspect-[4/3]">
            <LazyImage
              src={lightboxImage}
              alt="Enlarged review photo"
              fill
              imageClassName="object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsClient;
