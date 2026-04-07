import type { CakeGenieReview } from './database.types';

export const REVIEW_SELECT = `
  review_id,
  order_id,
  order_item_id,
  user_id,
  merchant_id,
  product_id,
  rating,
  title:review_title,
  comment:review_text,
  photos:review_photos,
  reviewer_name,
  is_verified,
  is_approved,
  is_visible,
  merchant_response,
  merchant_response_at,
  created_at,
  updated_at,
  merchant:cakegenie_merchants(business_name),
  user:cakegenie_users(first_name, last_name),
  order_item:cakegenie_order_items!order_item_id(cake_type, cake_size, customized_image_url, customization_details)
`;

export const REVIEW_SELECT_WITH_ORDER_NUMBER = `
  ${REVIEW_SELECT},
  cakegenie_orders(order_number)
`;

type MaybeArray<T> = T | T[] | null | undefined;

type ReviewNameSource = Pick<CakeGenieReview, 'reviewer_name' | 'user'>;

type RawReviewRecord = Omit<CakeGenieReview, 'user' | 'merchant' | 'order_item' | 'cakegenie_orders'> & {
  user?: MaybeArray<CakeGenieReview['user']>;
  merchant?: MaybeArray<CakeGenieReview['merchant']>;
  order_item?: MaybeArray<CakeGenieReview['order_item']>;
  cakegenie_orders?: MaybeArray<CakeGenieReview['cakegenie_orders']>;
};

function pickFirst<T>(value: MaybeArray<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function normalizePublicReviewRecord(review: RawReviewRecord): CakeGenieReview {
  return {
    ...review,
    user: pickFirst(review.user),
    merchant: pickFirst(review.merchant),
    order_item: pickFirst(review.order_item),
    cakegenie_orders: pickFirst(review.cakegenie_orders),
  };
}

export function normalizePublicReviews(reviews: RawReviewRecord[] | null | undefined): CakeGenieReview[] {
  return (reviews || []).map(normalizePublicReviewRecord);
}

function cleanNamePart(value: string | null | undefined): string {
  return value?.trim() || '';
}

export function getReviewDisplayName(review: ReviewNameSource): string {
  const reviewerName = cleanNamePart(review.reviewer_name);
  if (reviewerName) return reviewerName;

  const firstName = cleanNamePart(review.user?.first_name);
  const lastName = cleanNamePart(review.user?.last_name);

  if (firstName && lastName) return `${firstName} ${lastName}`.trim();
  if (firstName) return firstName;
  if (lastName) return lastName;

  return 'Customer';
}

export function getReviewAvatarInitial(review: ReviewNameSource): string {
  return getReviewDisplayName(review).charAt(0).toUpperCase() || 'C';
}
