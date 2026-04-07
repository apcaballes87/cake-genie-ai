'use client';

import { useState } from 'react';
import { useMerchantAllReviews, useUpdateReviewVisibility, useRespondToReview } from '@/hooks/useReviews';
import { CakeGenieReview } from '@/lib/database.types';
import { getReviewDisplayName } from '@/lib/reviews';
import { Star, Check, Eye, EyeOff, MessageSquare, Loader2 } from 'lucide-react';

interface MerchantReviewDashboardProps {
  merchantId: string;
}

type TabType = 'all' | 'pending' | 'visible';

export function MerchantReviewDashboard({ merchantId }: MerchantReviewDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  const { data: reviews = [], isLoading, refetch } = useMerchantAllReviews(merchantId, {
    includeUnapproved: true,
  });

  const updateVisibility = useUpdateReviewVisibility();
  const respondToReview = useRespondToReview();

  const filteredReviews = reviews.filter((review) => {
    if (activeTab === 'pending') return !review.is_approved || !review.is_visible;
    if (activeTab === 'visible') return review.is_visible && review.is_approved;
    return true;
  });

  const handleToggleVisibility = async (review: CakeGenieReview) => {
    await updateVisibility.mutateAsync({
      reviewId: review.review_id,
      merchantId,
      isVisible: !review.is_visible,
    });
    refetch();
  };

  const handleApprove = async (review: CakeGenieReview) => {
    await updateVisibility.mutateAsync({
      reviewId: review.review_id,
      merchantId,
      isApproved: true,
      isVisible: true,
    });
    refetch();
  };

  const handleSubmitResponse = async (reviewId: string) => {
    if (!responseText.trim()) return;
    
    await respondToReview.mutateAsync({
      reviewId,
      merchantId,
      response: responseText,
    });
    
    setRespondingTo(null);
    setResponseText('');
    refetch();
  };

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

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'all', label: 'All Reviews', count: reviews.length },
    { key: 'pending', label: 'Pending', count: reviews.filter(r => !r.is_approved || !r.is_visible).length },
    { key: 'visible', label: 'Visible', count: reviews.filter(r => r.is_visible && r.is_approved).length },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-pink-500 text-pink-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {filteredReviews.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No reviews found
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <div key={review.review_id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 text-sm font-medium text-gray-800">
                    {getReviewDisplayName(review)}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {renderStars(review.rating)}
                    <span className="text-sm font-medium">{review.rating}/5</span>
                    {!review.is_approved && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                        Pending
                      </span>
                    )}
                    {!review.is_visible && (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                        Hidden
                      </span>
                    )}
                  </div>

                  {review.title && (
                    <h4 className="font-medium text-gray-900 text-sm mb-1">{review.title}</h4>
                  )}
                  <p className="text-gray-600 text-sm mb-2">{review.comment}</p>

                  {review.photos && review.photos.length > 0 && (
                    <div className="flex gap-2 mb-2">
                      {review.photos.map((photo, idx) => (
                        <img
                          key={idx}
                          src={photo}
                          alt={`Review ${idx + 1}`}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Order: {review.cakegenie_orders?.order_number || review.order_id.slice(0, 8)}</span>
                    <span>{new Date(review.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {!review.is_approved && (
                    <button
                      onClick={() => handleApprove(review)}
                      disabled={updateVisibility.isPending}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleVisibility(review)}
                    disabled={updateVisibility.isPending}
                    className={`flex items-center gap-1 px-3 py-1 text-sm rounded disabled:opacity-50 ${
                      review.is_visible
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {review.is_visible ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        Show
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setRespondingTo(review.review_id)}
                    disabled={!!review.merchant_response}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-pink-100 text-pink-700 rounded hover:bg-pink-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {review.merchant_response ? 'Responded' : 'Respond'}
                  </button>
                </div>
              </div>

              {respondingTo === review.review_id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Write your response..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        setRespondingTo(null);
                        setResponseText('');
                      }}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSubmitResponse(review.review_id)}
                      disabled={respondToReview.isPending || !responseText.trim()}
                      className="px-3 py-1 text-sm bg-pink-600 text-white rounded hover:bg-pink-700 disabled:opacity-50"
                    >
                      {respondToReview.isPending ? 'Sending...' : 'Submit Response'}
                    </button>
                  </div>
                </div>
              )}

              {review.merchant_response && !respondingTo && (
                <div className="mt-3 pl-4 border-l-2 border-pink-200">
                  <p className="text-sm font-medium text-gray-700">Your Response:</p>
                  <p className="text-sm text-gray-600 mt-1">{review.merchant_response}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
