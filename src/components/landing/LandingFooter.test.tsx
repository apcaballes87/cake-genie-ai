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
    expect(markup).toContain('aria-label="DTI Registered - view registration"')
    expect(markup).not.toContain('<h4')
  })

  it('renders the featured badges at the bottom of the footer', () => {
    const markup = renderToStaticMarkup(<LandingFooter />)

    expect(markup).toContain('Featured on')
    expect(markup).toContain('href="https://www.productlaunchify.com/projects/genie-ph"')
    expect(markup).toContain('target="_blank"')
    expect(markup).toContain('rel="noopener noreferrer"')
    expect(markup).toContain('title="Featured on Product Launchify"')
    expect(markup).toContain('aria-label="Featured on Product Launchify"')
    expect(markup).toContain('src="https://www.productlaunchify.com/images/badges/powered-by-neutral.svg"')
    expect(markup).toContain('alt="Featured on Product Launchify"')
    expect(markup).toContain('width="231"')
    expect(markup).toContain('height="55"')
    expect(markup).toContain('href="https://launchclash.com/product/genie"')
    expect(markup).toContain('title="Featured on LaunchClash"')
    expect(markup).toContain('src="https://launchclash.com/assets/images/badge.png"')
    expect(markup).toContain('alt="LaunchClash"')
    expect(markup).toContain('href="https://startupfa.me/s/genieph?utm_source=genie.ph"')
    expect(markup).toContain('title="Genie.ph - Featured on Startup Fame"')
    expect(markup).toContain('src="https://startupfa.me/badges/featured/light-rounded.webp"')
    expect(markup).toContain('alt="Genie.ph - Featured on Startup Fame"')
    expect(markup).toContain('width="171"')
    expect(markup).toContain('height="54"')
  })
})
