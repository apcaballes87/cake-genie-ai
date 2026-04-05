'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, Loader2, X } from 'lucide-react';
import Image from 'next/image';

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
  cakegenie_orders?: {
    cakegenie_order_items?: {
      cake_type: string | null;
      cake_size: string | null;
      customized_image_url: string | null;
      customization_details: Record<string, unknown> | null;
    }[];
  };
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

const ReviewsClient: React.FC<ReviewsClientProps> = ({ initialReviews = [], error: initialError = null }) => {
  const router = useRouter();
  const [reviews] = useState<Review[]>(initialReviews);
  const [loading, setLoading] = useState(false);
  const [error] = useState<string | null>(initialError);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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

  const handleReviewClick = (orderId: string) => {
    router.push(`/customizing?order=${orderId}`);
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
            <div 
              key={review.review_id} 
              className="bg-slate-50 rounded-xl p-6 border border-slate-100 cursor-pointer hover:border-pink-300 hover:shadow-md transition-all"
              onClick={() => handleReviewClick(review.order_id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {renderStars(review.rating)}
                  <span className="text-sm font-medium text-slate-700">{review.rating}/5</span>
                </div>
                {review.user_id && (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                    Verified Purchase
                  </span>
                )}
              </div>

              {review.title && (
                <h3 className="font-semibold text-slate-800 text-lg mb-2">
                  {review.title}
                </h3>
              )}

              {/* Product Info */}
              {(() => {
                const orderItems = review.cakegenie_orders?.cakegenie_order_items;
                const firstItem = orderItems && orderItems.length > 0 ? orderItems[0] : null;
                if (!firstItem) return null;
                return (
                  <div className="flex items-center gap-3 mb-3 p-2 bg-white rounded-lg border border-slate-200">
                    {firstItem.customized_image_url && (
                      <div className="relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-md">
                        <Image
                          src={firstItem.customized_image_url}
                          alt={firstItem.cake_type || 'Cake'}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-slate-800">
                        {firstItem.cake_type} Cake
                      </p>
                      {firstItem.cake_size && (
                        <p className="text-sm text-slate-500">
                          {firstItem.cake_size}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {review.comment && (
                <p className="text-slate-600 mb-4">{review.comment}</p>
              )}

              {review.photos && review.photos.length > 0 && (
                <div className="flex gap-2 mb-4">
                  {review.photos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="relative w-20 h-20 cursor-zoom-in overflow-hidden rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxImage(photo);
                      }}
                    >
                      <Image
                        src={photo}
                        alt={`Review photo ${idx + 1}`}
                        fill
                        className="object-cover hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-sm text-slate-500">
                {formatCustomerName(
                  review.cakegenie_users?.first_name || null,
                  review.cakegenie_users?.last_name || null
                ) && (
                  <span className="font-medium text-slate-700">
                    {formatCustomerName(
                      review.cakegenie_users?.first_name || null,
                      review.cakegenie_users?.last_name || null
                    )}
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
            <Image
              src={lightboxImage}
              alt="Enlarged review photo"
              fill
              className="object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsClient;
