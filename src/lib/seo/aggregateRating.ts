export function buildPositiveAggregateRating(
  ratingValue: unknown,
  reviewCount: unknown,
) {
  const rating = Number(ratingValue)
  const count = Number(reviewCount)

  if (
    !Number.isFinite(rating)
    || rating <= 0
    || rating > 5
    || !Number.isFinite(count)
    || !Number.isInteger(count)
    || count <= 0
  ) {
    return undefined
  }

  return {
    '@type': 'AggregateRating',
    ratingValue: rating,
    reviewCount: count,
  }
}
