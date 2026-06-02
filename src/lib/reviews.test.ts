import { describe, expect, it } from 'vitest';
import { buildReviewSummary, hasReviewSummary } from './reviews';

describe('reviews helpers', () => {
  it('builds an aggregate summary from public review ratings', () => {
    expect(buildReviewSummary([
      { rating: 5 },
      { rating: 4 },
      { rating: 5 },
    ])).toEqual({
      total: 3,
      averageRating: 14 / 3,
    });
  });

  it('treats empty or missing ratings as no live summary', () => {
    expect(buildReviewSummary(null)).toEqual({
      total: 0,
      averageRating: 0,
    });

    expect(hasReviewSummary(null)).toBe(false);
    expect(hasReviewSummary({ total: 0, averageRating: 0 })).toBe(false);
    expect(hasReviewSummary({ total: 9, averageRating: 4.9 })).toBe(true);
  });
});
