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
    expect(markup).toContain('class="h-[34px] transition-opacity hover:opacity-80"')
    expect(markup).toContain('class="h-full w-auto object-contain"')
    expect(markup).toContain('href="https://startupfa.me/s/genieph?utm_source=genie.ph"')
    expect(markup).toContain('title="Genie.ph - Featured on Startup Fame"')
    expect(markup).toContain('src="https://startupfa.me/badges/featured/light-rounded.webp"')
    expect(markup).toContain('alt="Genie.ph - Featured on Startup Fame"')
    expect(markup).toContain('href="https://utilportal.com/item/genieph"')
    expect(markup).toContain('title="Featured on UtilPortal"')
    expect(markup).toContain('src="https://cdn.sanity.io/images/ai8ccfzu/production/383b921ea147ea2c6f5f3e1f9d20992e86400e4d-968x245.png?w=2000&amp;fit=max&amp;auto=format&amp;dpr=2"')
    expect(markup).toContain('alt="UtilPortal badge"')
    expect(markup).toContain('class="h-[34px] cursor-pointer transition-opacity hover:opacity-80"')
    expect(markup).toContain('href="https://uno.directory"')
    expect(markup).toContain('rel="noopener"')
    expect(markup).toContain('src="https://uno.directory/uno-directory.svg"')
    expect(markup).toContain('alt="Listed on Uno Directory"')
    expect(markup).toContain('width="120"')
    expect(markup).toContain('height="30"')
    expect(markup).toContain('href="https://dang.ai"')
    expect(markup).toContain('rel="dofollow noopener"')
    expect(markup).toContain('title="Verified on DANG!"')
    expect(markup).toContain('src="https://assets.dang.ai/badges/dang-verified-light.png"')
    expect(markup).toContain('alt="Verified on DANG!"')
    expect(markup).toContain('width="260"')
    expect(markup).toContain('height="94"')
    expect(markup).toContain('href="https://newtool.site/item/genieph-genieph"')
    expect(markup).toContain('src="https://newtool.site/badges/newtool-light.svg"')
    expect(markup).toContain('alt="Featured on NewTool.site"')
    expect(markup).toContain('height="54"')
    expect(markup).toContain('href="https://startuups.com//projects/genie-ph"')
    expect(markup).toContain('src="https://startuups.com//images/badges/startuupscom.badge.svg"')
    expect(markup).toContain('alt="Featured on startuups"')
    expect(markup).toContain('width="150"')
    expect(markup).toContain('href="https://trustiner.com/product/genie"')
    expect(markup).toContain('title="Featured on Trustiner"')
    expect(markup).toContain('src="https://trustiner.com/assets/images/badge.png"')
    expect(markup).toContain('alt="Trustiner"')
    expect(markup).toContain('href="https://starthub.zip"')
    expect(markup).toContain('title="starthub.zip"')
    expect(markup).toContain('>starthub.zip</a>')
  })
})
