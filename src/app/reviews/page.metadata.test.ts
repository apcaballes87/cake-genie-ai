import { describe, expect, it } from 'vitest'
import { metadata } from './page'

describe('reviews page metadata', () => {
  it('is indexable and canonicalized', () => {
    expect(metadata.alternates?.canonical).toBe('https://genie.ph/reviews')
    expect(metadata.robots).toBeUndefined()
    expect(metadata.openGraph).toMatchObject({
      title: 'Customer Reviews and Testimonials | Genie.ph',
      url: 'https://genie.ph/reviews',
    })
  })
})
