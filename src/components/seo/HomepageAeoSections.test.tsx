import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import HomepageAeoSections from './HomepageAeoSections'

vi.mock('@/components/ReviewsDisplay', () => ({
  default: () => null,
}))

describe('HomepageAeoSections', () => {
  it('shows the approved-review summary instead of a fixed rating', () => {
    const html = renderToStaticMarkup(
      <HomepageAeoSections reviews={[]} reviewSummary={{ total: 7, averageRating: 4.43 }} />,
    )
    expect(html).toContain('4.4/5')
    expect(html).toContain('7 approved reviews')
    expect(html).not.toContain('4.9/5')
  })

  it('omits the rating when there are no approved reviews', () => {
    const html = renderToStaticMarkup(
      <HomepageAeoSections reviews={[]} reviewSummary={{ total: 0, averageRating: 0 }} />,
    )
    expect(html).not.toContain('Average customer rating')
  })
})
