'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';
import { showSuccess, showError } from '@/lib/utils/toast';
import { CakeGenieReview } from '@/lib/database.types';
import { getMerchantAllReviews, getMerchantReviewStats, updateReviewModeration, respondToReview } from '@/services/supabaseService';
import { Loader2, ArrowLeft, Star, CheckCircle, Eye, EyeOff, MessageSquare, X } from 'lucide-react';
import { Skeleton } from '@/components/LoadingSkeletons';
import LazyImage from '@/components/LazyImage';
import { ReviewSummary } from '@/components/ReviewsDisplay';

interface ReviewStats {
    total: number;
    averageRating: number;
    ratingDistribution: { rating: number; count: number }[];
}

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
    <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
            <Star
                key={star}
                className={`w-4 h-4 ${
                    star <= rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'fill-slate-200 text-slate-300'
                }`}
            />
        ))}
    </div>
);

const ReviewRow: React.FC<{
    review: CakeGenieReview;
    onToggleVisibility: (reviewId: string, currentVisible: boolean) => void;
    onRespond: (reviewId: string, response: string) => void;
    isUpdating: boolean;
}> = ({ review, onToggleVisibility, onRespond, isUpdating }) => {
    const [showRespondForm, setShowRespondForm] = useState(false);
    const [responseText, setResponseText] = useState('');

    const handleSubmitResponse = () => {
        if (responseText.trim()) {
            onRespond(review.review_id, responseText.trim());
            setShowRespondForm(false);
            setResponseText('');
        }
    };

    const displayName = review.user?.first_name
        ? `${review.user.first_name}`
        : 'Customer';

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                {/* Left: Review Content */}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 font-bold text-sm">
                            {displayName.charAt(0).toUpperCase()}
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

                    {review.cakegenie_orders && (
                        <p className="text-xs text-slate-500 mb-2">
                            Order #{review.cakegenie_orders.order_number}
                        </p>
                    )}

                    {review.title && (
                        <h4 className="font-semibold text-slate-800 mb-1">{review.title}</h4>
                    )}

                    {review.comment && (
                        <p className="text-slate-600 text-sm mb-2">{review.comment}</p>
                    )}

                    {review.photos && review.photos.length > 0 && (
                        <div className="flex gap-2 flex-wrap mb-2">
                            {review.photos.slice(0, 4).map((photo, index) => (
                                <div
                                    key={index}
                                    className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200"
                                >
                                    <LazyImage
                                        src={photo}
                                        alt={`Review photo ${index + 1}`}
                                        fill
                                        imageClassName="object-cover"
                                        sizes="48px"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Merchant Response */}
                    {review.merchant_response && (
                        <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                                <MessageSquare className="w-4 h-4 text-purple-600" />
                                <span className="text-sm font-semibold text-slate-700">Your Response</span>
                                {review.merchant_response_at && (
                                    <span className="text-xs text-slate-400">
                                        {formatDate(review.merchant_response_at)}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-slate-600">{review.merchant_response}</p>
                        </div>
                    )}

                    {/* Response Form */}
                    {showRespondForm && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <textarea
                                value={responseText}
                                onChange={(e) => setResponseText(e.target.value)}
                                placeholder="Write your response to this review..."
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => setShowRespondForm(false)}
                                    className="px-3 py-1.5 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitResponse}
                                    disabled={!responseText.trim()}
                                    className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                >
                                    Submit Response
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col items-end gap-2">
                    {/* Visibility Toggle */}
                    <button
                        onClick={() => onToggleVisibility(review.review_id, review.is_visible)}
                        disabled={isUpdating}
                        className={`p-2 rounded-lg transition-colors ${
                            review.is_visible
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                        title={review.is_visible ? 'Hide from public' : 'Show to public'}
                    >
                        {isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : review.is_visible ? (
                            <Eye className="w-4 h-4" />
                        ) : (
                            <EyeOff className="w-4 h-4" />
                        )}
                    </button>

                    {/* Respond Button */}
                    {!review.merchant_response && !showRespondForm && (
                        <button
                            onClick={() => setShowRespondForm(true)}
                            className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                            title="Respond to review"
                        >
                            <MessageSquare className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Status Badges */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                {review.is_approved ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Approved
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                        Pending Review
                    </span>
                )}
                {!review.is_visible && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                        Hidden
                    </span>
                )}
            </div>
        </div>
    );
};

export default function ReviewsManagementClient() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [reviews, setReviews] = useState<CakeGenieReview[]>([]);
    const [stats, setStats] = useState<ReviewStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [updatingReviewId, setUpdatingReviewId] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;

            setIsLoading(true);
            try {
                // Get merchant ID from user metadata or first merchant staff record
                const userMerchants = await import('@/services/supabaseService').then(m => m.getUserMerchants());

                if (userMerchants?.data && userMerchants.data.length > 0) {
                    const merchantId = userMerchants.data[0].merchant_id;

                    const [reviewsResult, statsResult] = await Promise.all([
                        getMerchantAllReviews(merchantId, { includeUnapproved: true }),
                        getMerchantReviewStats(merchantId),
                    ]);

                    if (reviewsResult.data) {
                        setReviews(reviewsResult.data);
                    }
                    if (statsResult.data) {
                        setStats(statsResult.data);
                    }
                }
            } catch (err) {
                console.error('Error fetching reviews:', err);
                showError('Failed to load reviews');
            } finally {
                setIsLoading(false);
            }
        };

        if (!authLoading && user) {
            fetchData();
        }
    }, [user, authLoading]);

    const handleToggleVisibility = async (reviewId: string, currentVisible: boolean) => {
        setUpdatingReviewId(reviewId);
        try {
            // Get merchant ID
            const userMerchants = await import('@/services/supabaseService').then(m => m.getUserMerchants());
            const merchantId = userMerchants?.data?.[0]?.merchant_id;

            if (!merchantId) {
                showError('Could not find merchant');
                return;
            }

            const { error } = await updateReviewModeration(reviewId, merchantId, {
                isVisible: !currentVisible,
            });

            if (error) {
                showError(error.message || 'Failed to update visibility');
                return;
            }

            showSuccess(currentVisible ? 'Review hidden from public' : 'Review now visible');
            setReviews(reviews.map(r =>
                r.review_id === reviewId ? { ...r, is_visible: !currentVisible } : r
            ));
        } catch (err) {
            console.error('Error toggling visibility:', err);
            showError('An unexpected error occurred');
        } finally {
            setUpdatingReviewId(null);
        }
    };

    const handleRespond = async (reviewId: string, response: string) => {
        setUpdatingReviewId(reviewId);
        try {
            // Get merchant ID
            const userMerchants = await import('@/services/supabaseService').then(m => m.getUserMerchants());
            const merchantId = userMerchants?.data?.[0]?.merchant_id;

            if (!merchantId) {
                showError('Could not find merchant');
                return;
            }

            const { error } = await respondToReview(reviewId, merchantId, response);

            if (error) {
                showError(error.message || 'Failed to submit response');
                return;
            }

            showSuccess('Response submitted successfully');
            setReviews(reviews.map(r =>
                r.review_id === reviewId
                    ? { ...r, merchant_response: response, merchant_response_at: new Date().toISOString() }
                    : r
            ));
        } catch (err) {
            console.error('Error responding to review:', err);
            showError('An unexpected error occurred');
        } finally {
            setUpdatingReviewId(null);
        }
    };

    if (authLoading || (isLoading && reviews.length === 0)) {
        return (
            <div className="w-full max-w-4xl mx-auto py-8 px-4">
                <div className="flex items-center gap-4 mb-6">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-8 w-48" />
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center gap-3 mb-4">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-40" />
                                </div>
                            </div>
                            <Skeleton className="h-4 w-full mb-2" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="w-full max-w-4xl mx-auto py-8 px-4 text-center">
                <p className="text-slate-600">Please sign in to manage reviews.</p>
                 <button onClick={() => router.push('/')} className="mt-4 text-purple-600 font-semibold hover:underline">
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto pb-24 md:pb-8 px-4">
            <div className="flex items-center gap-4 mb-6 pt-4">
                <button
                    onClick={() => router.push('/account')}
                    className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors"
                    aria-label="Go back"
                >
                    <ArrowLeft />
                </button>
                 <h1 className="text-3xl font-bold text-slate-900">
                     Reviews <span className="text-purple-400">Management</span>
                 </h1>
            </div>

            {/* Stats Summary */}
            {stats && (
                <div className="mb-6">
                    <ReviewSummary
                        averageRating={stats.averageRating}
                        totalReviews={stats.total}
                        ratingDistribution={stats.ratingDistribution}
                    />
                </div>
            )}

            {/* Reviews List */}
            <div className="space-y-4">
                {reviews.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                        <Star className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-500">No reviews yet</p>
                    </div>
                ) : (
                    reviews.map((review) => (
                        <ReviewRow
                            key={review.review_id}
                            review={review}
                            onToggleVisibility={handleToggleVisibility}
                            onRespond={handleRespond}
                            isUpdating={updatingReviewId === review.review_id}
                        />
                    ))
                )}
            </div>
        </div>
    );
}