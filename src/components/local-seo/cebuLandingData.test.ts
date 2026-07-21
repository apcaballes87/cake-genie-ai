import { describe, expect, it } from 'vitest'

import { CEBU_LANDING_PAGES } from './cebuLandingData'

describe('minimalist collection authority links', () => {
  it.each([
    'bento-cake-cebu',
    'cake-delivery-cebu',
    'birthday-cake-delivery-cebu-city',
  ])('links %s directly to the canonical minimalist hub', (slug) => {
    expect(CEBU_LANDING_PAGES[slug].relatedLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: '/collections/minimalist-cake' }),
      ]),
    )
  })

  it('uses the canonical minimalist hub for the Cebu City design CTA', () => {
    expect(CEBU_LANDING_PAGES['cake-delivery-cebu-city'].secondaryCta).toEqual({
      label: 'See Cebu City Cake Ideas',
      href: '/collections/minimalist-cake',
    })
  })

  it('does not retain misleading minimalist search labels', () => {
    const minimalistLinks = Object.values(CEBU_LANDING_PAGES)
      .flatMap((page) => page.relatedLinks)
      .filter((link) => /minimalist/i.test(link.label))

    expect(minimalistLinks).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: '/collections' }),
      ]),
    )
  })
})
