'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, ShieldCheck, X } from 'lucide-react';
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

export const ReviewCard: React.FC<{
  review: CakeGenieReview;
  showMerchantResponse?: boolean;
  showRecreateCta?: boolean;
}> = ({ review, showMerchantResponse = true, showRecreateCta = true }) => {
  const router = useRouter();
  const displayName = getReviewDisplayName(review);
  const [localLightbox, setLocalLightbox] = useState<string | null>(null);

  const hasBefore = !!review.original_image_url;
  const hasAfter = !!review.finished_image_url;
  const hasAnyImage = hasBefore || hasAfter;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
      {hasAnyImage ? (
        <div className="flex flex-col md:flex-row-reverse gap-5 items-start">
          {/* Right Side: Before & After images */}
          <div className={`grid gap-2.5 w-full md:w-44 lg:w-52 flex-shrink-0 ${hasBefore && hasAfter ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {/* Before */}
            {hasBefore && (
              <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-slate-100 group shadow-xs">
                <button
                  type="button"
                  className="absolute inset-0 w-full h-full text-left cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-pink-400 focus:rounded-lg"
                  onClick={() => setLocalLightbox(review.original_image_url!)}
                  aria-label="View original inspiration design"
                >
                  <span className="absolute top-1.5 left-1.5 z-10 px-1 py-0.5 text-[7px] min-[400px]:text-[8px] font-extrabold tracking-wider text-pink-700 bg-pink-50/90 backdrop-blur-xs rounded-md shadow-xs uppercase border border-pink-100 whitespace-nowrap">
                    Cake Inspo
                  </span>
                  <LazyImage
                    src={review.original_image_url!}
                    alt="Inspiration cake design"
                    fill
                    imageClassName="object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                    sizes="(max-width: 768px) 50vw, 150px"
                  />
                </button>
              </div>
            )}

            {/* After */}
            {hasAfter && (
              <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-slate-100 group shadow-xs">
                <button
                  type="button"
                  className="absolute inset-0 w-full h-full text-left cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-purple-400 focus:rounded-lg"
                  onClick={() => setLocalLightbox(review.finished_image_url!)}
                  aria-label="View finished masterpiece cake"
                >
                  <span className="absolute top-1.5 left-1.5 z-10 px-1 py-0.5 text-[7px] min-[400px]:text-[8px] font-extrabold tracking-wider text-purple-700 bg-purple-50/90 backdrop-blur-xs rounded-md shadow-xs uppercase border border-purple-100 whitespace-nowrap">
                    Final Product
                  </span>
                  <LazyImage
                    src={review.finished_image_url!}
                    alt="Finished custom cake"
                    fill
                    imageClassName="object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                    sizes="(max-width: 768px) 50vw, 150px"
                  />
                </button>
              </div>
            )}
          </div>

          {/* Right Side: details */}
          <div className="flex-1 min-w-0 w-full flex flex-col justify-between self-stretch">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/80 bg-linear-to-br from-[#f3e8ff] via-[#ddd6fe] to-[#c084fc] text-xs font-bold text-purple-700 shadow-sm">
                    {getReviewAvatarInitial(review)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 text-sm block leading-tight">
                      {displayName}
                    </span>
                    {(review.is_verified || review.user_id) && (
                      <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-50/80 px-1.5 py-0.2 rounded-full border border-emerald-100">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        Verified Purchase
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">{formatDate(review.created_at)}</span>
              </div>

              {/* Stars + rating */}
              <div className="flex items-center gap-1.5 mb-2">
                <StarRating rating={review.rating} />
                <span className="text-[11px] font-bold text-slate-500">{review.rating}/5</span>
              </div>

              {/* Title */}
              {review.title && (
                <h4 className="font-bold text-slate-800 text-sm mb-1">{review.title}</h4>
              )}

              {/* Comment */}
              {review.comment && (
                <p className="text-purple-900/90 text-xs leading-relaxed whitespace-pre-wrap">{review.comment}</p>
              )}
            </div>

            {/* Recreate CTA */}
            {showRecreateCta && review.cakegenie_analysis_cache?.slug && (
              <div className="mt-3 flex items-center justify-end">
                <button
                  onClick={() => router.push(`/customizing/${review.cakegenie_analysis_cache?.slug}`)}
                  className="genie-btn-secondary genie-focus inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Recreate Design</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Legacy View */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-linear-to-br from-[#f3e8ff] via-[#ddd6fe] to-[#c084fc] text-sm font-bold text-purple-700 shadow-sm">
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
            <p className="text-purple-900/90 text-sm leading-relaxed mb-3">
              {review.comment}
            </p>
          )}

          {/* Photos */}
          {review.photos && review.photos.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {review.photos.slice(0, 4).map((photo, index) => (
                <button
                  key={index}
                  type="button"
                  className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-pink-400"
                  onClick={() => setLocalLightbox(photo)}
                  aria-label={`View photo ${index + 1}`}
                >
                  <LazyImage
                    src={photo}
                    alt={`Review photo ${index + 1}`}
                    fill
                    imageClassName="object-cover"
                    sizes="80px"
                  />
                </button>
              ))}
              {review.photos.length > 4 && (
                <div className="w-20 h-20 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-500">
                  +{review.photos.length - 4} more
                </div>
              )}
            </div>
          )}

          {/* Recreate CTA for standard items */}
          {showRecreateCta && review.cakegenie_analysis_cache?.slug && (
            <div className="mt-3 flex items-center justify-end">
              <button
                onClick={() => router.push(`/customizing/${review.cakegenie_analysis_cache?.slug}`)}
                className="genie-btn-secondary genie-focus inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>Recreate Design</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          )}
        </>
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

      {/* Local Lightbox */}
      {localLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLocalLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
            onClick={() => setLocalLightbox(null)}
            type="button"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="relative max-w-4xl max-h-[90vh] w-full aspect-[4/3]" onClick={(e) => e.stopPropagation()}>
            <LazyImage
              src={localLightbox}
              alt="Enlarged review photo"
              fill
              imageClassName="object-contain"
            />
          </div>
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
