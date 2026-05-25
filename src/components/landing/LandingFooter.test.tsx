import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LandingFooter } from './LandingFooter'

describe('LandingFooter', () => {
  it('renders live review stats without stale hardcoded trust copy', () => {
    const markup = renderToStaticMarkup(
      <LandingFooter
        reviewSummary={{
          total: 6,
          averageRating: 5,
        }}
      />,
    )

    expect(markup).toContain('5.0/5 based on 6 Happy Customers.')
    expect(markup).not.toContain('4.8/5 based on 6 public reviews.')
  })
})
