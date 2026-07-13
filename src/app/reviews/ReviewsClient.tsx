'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, X, ShieldCheck } from 'lucide-react';
import { LazyImage } from '@/components/LazyImage';
import { ReviewSummary } from '@/components/ReviewsDisplay';
import { CakeGenieReview } from '@/lib/database.types';
import { getReviewAvatarInitial, getReviewDisplayName } from '@/lib/reviews';
import { useImageZoomScrollLock } from '@/hooks/useImageZoomScrollLock';

interface ReviewsClientProps {
  initialReviews?: CakeGenieReview[];
  error?: string | null;
}

const ReviewsClient: React.FC<ReviewsClientProps> = ({ initialReviews = [], error: initialError = null }) => {
  const router = useRouter();
  const [reviews] = useState<CakeGenieReview[]>(initialReviews);
  const [error] = useState<string | null>(initialError);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useImageZoomScrollLock(Boolean(lightboxImage));

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
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8 animate-fade-in">
      <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/')} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
          <ArrowLeft />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Customer <span className="text-purple-400">Reviews</span>
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
              const firstItem = review.order_item ?? null;
              const displayName = getReviewDisplayName(review);
              const hasBefore = !!review.original_image_url;
              const hasAfter = !!review.finished_image_url;
              const hasAnyImage = hasBefore || hasAfter;

              return (
                <div
                  key={review.review_id}
                  className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 animate-fade-in"
                >
                  {hasAnyImage ? (
                    <div className="flex flex-col md:flex-row-reverse gap-6 items-start">
                      {/* Right Side: Before & After images side-by-side */}
                      <div className={`grid gap-3 w-full md:w-52 lg:w-[244px] flex-shrink-0 ${hasBefore && hasAfter ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {/* Before (Inspiration) Image */}
                        {hasBefore && (
                          <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-slate-100 group shadow-xs">
                            <button
                              type="button"
                              className="absolute inset-0 w-full h-full text-left cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-purple-400 focus:rounded-xl"
                              onClick={() => setLightboxImage(review.original_image_url!)}
                              aria-label="View original inspiration design"
                            >
                              <span className="absolute top-2 left-2 z-10 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider text-purple-750 bg-purple-50/90 backdrop-blur-xs rounded-md shadow-xs uppercase border border-purple-200/50 whitespace-nowrap">
                                Cake Inspo
                              </span>
                              <LazyImage
                                src={review.original_image_url!}
                                alt="Original inspiration custom cake design request"
                                fill
                                imageClassName="object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                                sizes="(max-width: 768px) 50vw, 180px"
                              />
                            </button>
                          </div>
                        )}

                        {/* After (Finished) Image */}
                        {hasAfter && (
                          <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-slate-100 group shadow-xs">
                            <button
                              type="button"
                              className="absolute inset-0 w-full h-full text-left cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-purple-400 focus:rounded-xl"
                              onClick={() => setLightboxImage(review.finished_image_url!)}
                              aria-label="View bakery finished masterpiece custom cake"
                            >
                              <span className="absolute top-2 left-2 z-10 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider text-purple-750 bg-purple-50/90 backdrop-blur-xs rounded-md shadow-xs uppercase border border-purple-200/50 whitespace-nowrap">
                                Final Product
                              </span>
                              <LazyImage
                                src={review.finished_image_url!}
                                alt="Bakery finished masterpiece cake delivery"
                                fill
                                imageClassName="object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                                sizes="(max-width: 768px) 50vw, 180px"
                              />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right Side: Details */}
                      <div className="flex-1 min-w-0 w-full flex flex-col justify-between self-stretch">
                        <div>
                          {/* Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-xs border border-purple-100">
                                {getReviewAvatarInitial(review)}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-800 block leading-tight">
                                  {displayName}
                                </span>
                                {(review.is_verified || review.user_id) && (
                                  <span className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50/80 px-1.5 py-0.2 rounded-full border border-emerald-100">
                                    <ShieldCheck className="w-2.5 h-2.5" />
                                    Verified Purchase
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-slate-400 font-medium">{formatDate(review.created_at)}</span>
                          </div>

                          {/* Stars + rating */}
                          <div className="flex items-center gap-2 mb-3">
                            {renderStars(review.rating)}
                            <span className="text-xs font-bold text-slate-500">{review.rating}/5</span>
                          </div>

                          {/* Title */}
                          {review.title && (
                            <h3 className="font-bold text-slate-900 text-base mb-1.5 leading-snug">{review.title}</h3>
                          )}

                          {/* Comment */}
                          {review.comment && (
                            <p className="text-purple-900/90 text-sm leading-relaxed whitespace-pre-wrap">{review.comment}</p>
                          )}
                        </div>

                        {/* CTA button */}
                        {review.cakegenie_analysis_cache?.slug && (
                          <div className="mt-4 flex items-center justify-end">
                            <button
                              onClick={() => router.push(`/customizing/${review.cakegenie_analysis_cache?.slug}`)}
                              className="genie-btn-secondary px-4 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-[0.99] transition-transform"
                            >
                              <span>Recreate This Custom Cake</span>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Row 1: Avatar + Name + Date */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {getReviewAvatarInitial(review)}
                          </div>
                          <span className="font-semibold text-slate-800">
                            {displayName}
                          </span>
                        </div>
                        <span className="text-sm text-slate-400">{formatDate(review.created_at)}</span>
                      </div>

                      {/* Row 2: Stars + rating + Verified badge */}
                      <div className="flex items-center gap-3 mb-3">
                        {renderStars(review.rating)}
                        <span className="text-sm font-medium text-slate-600">{review.rating}/5</span>
                        {(review.is_verified || review.user_id) && (
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
                        <p className="text-purple-900/90 leading-relaxed mb-4">{review.comment}</p>
                      )}

                      {/* Row 5: Product info */}
                      {firstItem && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                          {firstItem.customized_image_url && (
                            <button
                              type="button"
                              className="relative w-20 h-20 flex-shrink-0 overflow-hidden rounded-lg cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-purple-400"
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
                            {review.merchant?.business_name && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                by {review.merchant.business_name}
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
                              className="relative w-20 h-20 overflow-hidden rounded-lg cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-purple-400"
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

                      {/* Recreate CTA for standard items if linked to analysis cache */}
                      {review.cakegenie_analysis_cache?.slug && (
                        <div className="mt-4 flex items-center justify-end">
                          <button
                            onClick={() => router.push(`/customizing/${review.cakegenie_analysis_cache?.slug}`)}
                            className="genie-btn-secondary px-4 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-[0.99] transition-transform"
                          >
                            <span>Recreate This Custom Cake</span>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </>
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
          <div className="relative max-w-4xl max-h-[90vh] w-full aspect-[4/3]" onClick={(e) => e.stopPropagation()}>
            <LazyImage
              src={lightboxImage}
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

export default ReviewsClient;
