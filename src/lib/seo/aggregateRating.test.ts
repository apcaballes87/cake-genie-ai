import { describe, expect, it } from 'vitest'
import { buildPositiveAggregateRating } from './aggregateRating'

describe('buildPositiveAggregateRating', () => {
  it('omits zero or missing reviews', () => {
    expect(buildPositiveAggregateRating(5, 0)).toBeUndefined()
    expect(buildPositiveAggregateRating('5', '0')).toBeUndefined()
    expect(buildPositiveAggregateRating(5, undefined)).toBeUndefined()
  })

  it('normalizes valid ratings to JSON numbers', () => {
    expect(buildPositiveAggregateRating('4.8', '9')).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.8,
      reviewCount: 9,
    })
  })
})
